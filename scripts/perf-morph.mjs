#!/usr/bin/env node
/**
 * perf-morph.mjs — the morph-smoothness gate (docs/plans/motion-craft-audit.html,
 * item 3; DESIGN.md §4.8 "judge with the instrument, not memory").
 *
 * Turns "does the morph feel smooth?" into three gated numbers per warm
 * open+close cycle, checked against a checked-in baseline. All three come
 * from one Chrome trace of the page's own renderer process:
 *
 *   1. raster ms — total `RasterTask` duration over the cycle. Moves when
 *      paint work grows (reference_measuring-smoothness.md: 347ms -> 3070ms
 *      with the demo glow on, while rAF kept reporting 120fps).
 *   2. dropped frames — compositor frames, inside the two 900ms motion
 *      windows (open, close), that did not present the page's pending update
 *      on time. Read from `PipelineReporter` (cc's per-frame presentation
 *      record): a frame counts when its non-forked reporter ends
 *      STATE_DROPPED or STATE_PRESENTED_PARTIAL.
 *   3. longest presented interval — the largest gap, inside a motion window,
 *      between presentation timestamps of consecutive frames that presented
 *      everything (STATE_PRESENTED_ALL). A single long stall hides inside a
 *      healthy dropped-frame count; this is the number that sees it.
 *
 * Why these can't be inflated by an unrelated animation (the old gate
 * counted CDP screencast frames, which rose 90 -> 207 when an unrelated
 * overlay animated): an extra animation only adds frames that need
 * presenting. It cannot turn a frame that missed the morph's main-thread
 * update into a good one. With a compositor animation running, such a frame
 * reports PRESENTED_PARTIAL instead of DROPPED, which is why both states
 * count (measured 2026-09-11: --inject-jank 19 dropped alone, 19 with an
 * unrelated CSS animation). And a partial frame never closes a presented
 * interval, so a stall still reads full length (150ms block: 150ms with or
 * without the animation). Screencast frames are no longer captured at all.
 *
 * Runs headless in Chromium's NEW headless mode (`channel: "chromium"`),
 * which composites and rasterizes on the real GPU (ANGLE Metal on Apple
 * Silicon). The default Playwright headless shell renders on SwiftShader
 * (software) and gives meaningless numbers, so every launch reads the
 * renderer and refuses to measure or rebaseline on a software one.
 *
 * Runs its OWN vite server on a fixed port (never :5180, which Sean uses)
 * and tears it down on exit, including on failure/SIGINT.
 *
 * Usage:
 *   npm run perf                        # measure vs perf/baseline.json, exit 1 on regression
 *   npm run perf -- --update-baseline
 *   npm run perf -- --cycles=8
 *   npm run perf -- --inject-glow       # demo glow on (paint-heavy)
 *   npm run perf -- --inject-jank       # proves "dropped frames" fires
 *   npm run perf -- --inject-block      # proves "longest interval" fires
 *   npm run perf -- --inject-gpu        # compositor/GPU load that really drops frames
 *   npm run perf -- --inject-animation  # unrelated animation; combine to prove it can't mask
 *
 * Baseline model (--update-baseline): the first open after browser launch
 * renders roughly half the distinct frames of any later open
 * (reference_measuring-smoothness.md). So `--update-baseline` runs
 * BASELINE_LAUNCHES separate launches of CYCLES cycles each, throws away the
 * first launch entirely, and also discards each launch's own 2 in-page
 * warm-up cycles. Median/spread come from the pooled per-cycle samples of
 * the remaining launches, and tolerances are derived from that spread.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadavg, cpus } from "node:os";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(ROOT, "perf", "baseline.json");
const PORT = 5190;
const BASE_URL = `http://localhost:${PORT}/`;

// New headless mode: real GPU, no window. See the header comment.
const LAUNCH_OPTIONS = { headless: true, channel: "chromium" };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? Number(found.slice(prefix.length)) : fallback;
};

const UPDATE_BASELINE = flag("update-baseline");
const CYCLES = valueOf("cycles", 5);
const BASELINE_LAUNCHES = valueOf("baseline-launches", 5);
const INJECT_GLOW = flag("inject-glow");
// Busy-blocks the main thread ~20ms every rAF tick: many short blocks, so it
// shows up as dropped frames, not as one long presented interval.
const INJECT_JANK = flag("inject-jank");
// One 150ms main-thread block, 200ms into every measured open.
const INJECT_BLOCK = flag("inject-block");
// Static full-viewport backdrop-filter stack; see injectGpuLoad.
const INJECT_GPU = flag("inject-gpu");
// An unrelated, always-running compositor animation (not part of the morph).
const INJECT_ANIMATION = flag("inject-animation");
const WAIT_FOR_QUIET = flag("wait-for-quiet");
const WAIT_TIMEOUT_MS = valueOf("wait-for-quiet-timeout", 20 * 60 * 1000);

// Each scored motion window starts at the click and lasts this long.
// DESIGN.md springs settle in ~640ms; 900ms leaves margin.
const WINDOW_MS = 900;
const CLICK_MARK = "perf-morph:click";
const WINDOW_NAMES = ["open", "close"];

// Instrument floor, per window: frames cc reported in ANY state (presented,
// partial, dropped). Presented frames can't be the floor: a real regression
// collapses them (--inject-jank presents 27 in a close window, --inject-gpu
// about 23), and that must score as FAIL, not as an instrument error.
// Reported frames follow the 120Hz clock instead: healthy windows report 106
// (open) and 74 (close — the morph settles sooner), and every injection
// reports at least 73 (measured 2026-09-11). A window under 50 lost its
// trace events and would otherwise score a perfect 0 dropped / 0ms.
const MIN_REPORTED_PER_WINDOW = 50;

// Test-only hook: PERF_DROP_WINDOW=open|close discards that window's
// PipelineReporter events before analysis, standing in for a lost trace
// buffer, so the floor above can be proven to fire. Never set in normal use.
const DROP_WINDOW = process.env.PERF_DROP_WINDOW || null;
if (DROP_WINDOW && !WINDOW_NAMES.includes(DROP_WINDOW)) {
  throw new Error(`PERF_DROP_WINDOW must be "open" or "close", got "${DROP_WINDOW}"`);
}

// --- machine-quiet gate ------------------------------------------------
//
// Raster ms and frame presentation are absolute wall-clock/compositor
// numbers — contention from unrelated processes (another test browser,
// Spotlight indexing, another heavy app) inflates raster time and starves the
// compositor exactly like a real regression would, so a baseline or gate
// run captured under load is not measuring the morph. Refuse to measure
// (baseline) or measure with a loud warning (gate) rather than silently
// producing numbers that look like a regression, or a baseline that bakes
// in someone else's CPU spike.
const QUIET_LOAD_FACTOR = 0.5; // loadavg(1min) must be below this * core count
const CORES = cpus().length;
const QUIET_THRESHOLD = CORES * QUIET_LOAD_FACTOR;

// Test-only hook (see README "Measuring smoothness"): PERF_FAKE_LOAD_SEQUENCE
// feeds a fixed, comma-separated sequence of loadavg(1min) values instead of
// reading the real machine, one value per call to currentLoad(). This is how
// the per-launch quiet gate below is proven to fire on a specific launch
// (e.g. "1,1,99" makes launch 3 see load) without needing the real machine to
// spike on cue. Never set in normal use.
const fakeLoadSequence = process.env.PERF_FAKE_LOAD_SEQUENCE
  ? process.env.PERF_FAKE_LOAD_SEQUENCE.split(",").map(Number)
  : null;
let fakeLoadIndex = 0;

function currentLoad() {
  if (fakeLoadSequence) {
    const v = fakeLoadSequence[Math.min(fakeLoadIndex, fakeLoadSequence.length - 1)];
    fakeLoadIndex += 1;
    return v;
  }
  return loadavg()[0];
}

function isQuiet(load) {
  return load < QUIET_THRESHOLD;
}

async function waitForQuiet() {
  const start = Date.now();
  let load = currentLoad();
  while (!isQuiet(load)) {
    if (Date.now() - start > WAIT_TIMEOUT_MS) {
      return { quiet: false, load };
    }
    console.log(
      `  waiting for quiet machine: load1=${load.toFixed(2)} (need < ${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)...`,
    );
    await new Promise((r) => setTimeout(r, 15000));
    load = currentLoad();
  }
  return { quiet: true, load };
}

// Checks the machine is quiet before ONE specific launch (called fresh for
// every baseline launch, not once before the whole loop) — a load spike
// mid-run, which easily takes minutes across BASELINE_LAUNCHES launches,
// would otherwise silently contaminate later launches. Returns the load1
// used for this launch on success; returns null (and writes nothing) on
// refusal, deciding between "abort" and "poll" per --wait-for-quiet exactly
// like the old one-shot check did.
async function requireQuietForLaunch(launchNum, total) {
  let load = currentLoad();
  if (isQuiet(load)) return load;
  if (WAIT_FOR_QUIET) {
    const result = await waitForQuiet();
    if (!result.quiet) {
      console.error("");
      console.error(
        `Machine did not quiet down before launch ${launchNum}/${total} within ` +
          `${Math.round(WAIT_TIMEOUT_MS / 60000)}min (load1=${result.load.toFixed(2)}, need < ` +
          `${QUIET_THRESHOLD.toFixed(1)} on ${CORES} cores). Refusing to write a baseline captured under load.`,
      );
      return null;
    }
    return result.load;
  }
  console.error("");
  console.error(
    `Refusing to start baseline launch ${launchNum}/${total}: load1=${load.toFixed(2)} >= ` +
      `${QUIET_THRESHOLD.toFixed(1)} (0.5 * ${CORES} cores) — the machine isn't quiet, so raster/frame ` +
      `numbers would bake in someone else's CPU load, not the morph. Re-run when idle, or pass ` +
      `--wait-for-quiet to poll (default timeout ${Math.round(WAIT_TIMEOUT_MS / 60000)}min).`,
  );
  return null;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sh(cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", cmd, { cwd: ROOT });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`git ${cmd.join(" ")} failed`)),
    );
  });
}

// --- vite server lifecycle -------------------------------------------------

let viteProc = null;

function startVite() {
  return new Promise((resolve, reject) => {
    viteProc = spawn(
      join(ROOT, "node_modules", ".bin", "vite"),
      ["example", "--port", String(PORT), "--strictPort"],
      { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let settled = false;
    const onData = (d) => {
      if (settled) return;
      if (String(d).includes("ready in") || String(d).includes("Local:")) {
        settled = true;
        resolve();
      }
    };
    viteProc.stdout.on("data", onData);
    viteProc.stderr.on("data", (d) => {
      const s = String(d);
      if (s.includes("Port") && s.includes("is in use")) {
        settled = true;
        reject(new Error(`Port ${PORT} is already in use — refusing to start (see stderr): ${s}`));
      }
    });
    viteProc.on("error", (e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
    viteProc.on("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`vite exited early with code ${code}`));
      }
    });
    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`vite did not report ready within 15s on port ${PORT}`));
      }
    }, 15000);
  });
}

function stopVite() {
  if (!viteProc || viteProc.killed) return;
  try {
    // detached: true put vite in its own process group; kill the group so
    // esbuild's child processes die with it, not just the shell wrapper.
    process.kill(-viteProc.pid, "SIGTERM");
  } catch {
    try {
      viteProc.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  viteProc = null;
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  stopVite();
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

// --- renderer check --------------------------------------------------------

// Reads the WebGL renderer string and the GPU process's own feature status.
// A software renderer (SwiftShader etc.) or software compositing/raster means
// the numbers describe the CPU, not the GPU the morph ships on.
async function readRenderer(browser, page) {
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas").getContext("webgl");
    const dbg = c && c.getExtension("WEBGL_debug_renderer_info");
    return dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown (no WebGL)";
  });
  const session = await browser.newBrowserCDPSession();
  const { gpu } = await session.send("SystemInfo.getInfo");
  const compositing = gpu.featureStatus.gpu_compositing;
  const rasterization = gpu.featureStatus.rasterization;
  const software =
    /swiftshader|llvmpipe|software|basic render/i.test(renderer) ||
    !String(compositing).startsWith("enabled") ||
    !String(rasterization).startsWith("enabled");
  return { renderer, compositing, rasterization, software };
}

// --- injections (proof-of-firing only, run time only, no app file touched) --

// 48 stacked full-viewport layers with a large backdrop-filter. Static and
// near-invisible on purpose: the filter re-runs over the viewport every frame
// the morph changes what's beneath it, while the morph's own pixels stay
// unaltered, so a distinct-frame recording still counts the morph honestly
// (a visible blur lowers mpdecimate's per-block differences and undercounts).
// Ground truth, 2026-09-11, headless agent-browser 60fps + mpdecimate, one
// warm cycle: plain 68 distinct frames, 48 layers 39. 12 layers read 68
// headless (free) but 42 in a headed window, so the real display path costs
// more than headless shows — see README "Measuring smoothness".
const GPU_LOAD_LAYERS = 48;
async function injectGpuLoad(page) {
  await page.addStyleTag({
    content: `
      .perf-gpu-load-layer {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.01;
        mix-blend-mode: multiply;
        backdrop-filter: blur(200px) saturate(3) contrast(1.2);
        -webkit-backdrop-filter: blur(200px) saturate(3) contrast(1.2);
      }
    `,
  });
  const mounted = await page.evaluate((layers) => {
    for (let i = 0; i < layers; i++) {
      const el = document.createElement("div");
      el.className = "perf-gpu-load-layer";
      document.body.appendChild(el);
    }
    return Array.from(document.querySelectorAll(".perf-gpu-load-layer")).filter((el) => {
      const cs = getComputedStyle(el);
      const filter = cs.backdropFilter || cs.webkitBackdropFilter;
      return filter && filter !== "none" && Number(cs.opacity) > 0;
    }).length;
  }, GPU_LOAD_LAYERS);
  if (mounted !== GPU_LOAD_LAYERS) {
    throw new Error(`--inject-gpu: expected ${GPU_LOAD_LAYERS} filtered, visible layers, found ${mounted}`);
  }
}

async function injectUnrelatedAnimation(page) {
  await page.addStyleTag({
    content: `
      .perf-unrelated-animation {
        position: fixed;
        left: 24px;
        top: 200px;
        width: 60px;
        height: 60px;
        background: #c33;
        z-index: 9999;
        pointer-events: none;
        animation: perf-unrelated-spin 0.6s linear infinite;
      }
      @keyframes perf-unrelated-spin { to { transform: rotate(360deg); } }
    `,
  });
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "perf-unrelated-animation";
    document.body.appendChild(el);
  });
}

// Proves --inject-jank / --inject-block actually ran inside this cycle's
// scored windows, on the page clock, using the same trusted clicks that place
// the trace windows. A no-op injection would otherwise read as a clean PASS.
// Jank runs 20ms slices once per frame: 44 start inside each 900ms window
// (measured 2026-09-11), so 20 leaves room without accepting a no-op.
const JANK_MIN_SLICES_PER_WINDOW = 20;
async function verifyInjections(page) {
  const rec = await page.evaluate(() => window.__perfMorph);
  if (rec.clicks.length !== 2) {
    throw new Error(`instrument error: page recorded ${rec.clicks.length} trusted clicks in the cycle, expected 2`);
  }
  const windows = rec.clicks.map((c) => [c, c + WINDOW_MS]);
  const startsIn = ([start], [a, b]) => start >= a && start < b;
  const notes = [];
  if (INJECT_JANK) {
    const counts = windows.map((w) => rec.jank.filter((slice) => startsIn(slice, w)).length);
    counts.forEach((n, w) => {
      if (n < JANK_MIN_SLICES_PER_WINDOW) {
        throw new Error(
          `--inject-jank self-check: ${n} busy slices started in the ${WINDOW_NAMES[w]} window ` +
            `(need >= ${JANK_MIN_SLICES_PER_WINDOW}) — the injection didn't run while scored`,
        );
      }
    });
    notes.push(`jank slices open/close ${counts.join("/")}`);
  }
  if (INJECT_BLOCK) {
    const hit = rec.block.find((slice) => slice[1] - slice[0] >= 140 && startsIn(slice, windows[0]));
    if (!hit) {
      throw new Error(
        `--inject-block self-check: no >=140ms busy period started inside the open window ` +
          `(recorded ${rec.block.length}) — the injection didn't run while scored`,
      );
    }
    notes.push(`block ${(hit[1] - hit[0]).toFixed(0)}ms at +${(hit[0] - windows[0][0]).toFixed(0)}ms`);
  }
  return notes.join(", ");
}

// --- trace analysis --------------------------------------------------------

// Scores one traced cycle. Throws (rather than returning a number) when the
// trace can't be trusted: wrong marker count, or a window below the floor.
function analyzeCycle(events) {
  const marks = events.filter(
    (e) => e.name === "TimeStamp" && e.args?.data?.message === CLICK_MARK,
  );
  if (marks.length !== 2) {
    throw new Error(
      `instrument error: expected 2 click markers (open, close) in the traced cycle, found ` +
        `${marks.length} — refusing to score windows that can't be placed`,
    );
  }
  // Only the page's own renderer process: the browser process runs its own
  // compositor, which an unrelated browser-UI frame would otherwise feed.
  const pid = marks[0].pid;
  const windows = marks.map((m) => [m.ts, m.ts + WINDOW_MS * 1000]); // trace ts are µs
  const windowOf = (ts) => windows.findIndex(([a, b]) => ts >= a && ts < b);

  const rasterMs =
    events.filter((e) => e.name === "RasterTask").reduce((sum, e) => sum + (e.dur || 0), 0) / 1000;

  // PipelineReporter is an async b/e pair keyed by id2.local; ids are reused
  // once a reporter ends, so pair each begin with the next end on its id.
  const open = new Map();
  const reporters = [];
  const dropIndex = WINDOW_NAMES.indexOf(DROP_WINDOW);
  const pipeline = events
    .filter((e) => e.name === "PipelineReporter" && e.pid === pid)
    .filter((e) => dropIndex === -1 || windowOf(e.ts) !== dropIndex)
    .sort((a, b) => a.ts - b.ts);
  for (const e of pipeline) {
    const key = e.id2?.local ?? e.id;
    if (e.ph === "b") {
      if (!open.has(key)) open.set(key, []);
      open.get(key).push({ begin: e.ts, frame: e.args?.frame_reporter });
    } else if (e.ph === "e") {
      const started = open.get(key)?.shift();
      if (started) reporters.push({ ...started, end: e.ts });
    }
  }

  // A FORKED reporter is cc's copy of a frame whose main-thread update was
  // carried into a later frame; the non-forked reporter is the verdict.
  const scored = reporters.filter(
    (r) => r.frame && r.frame.frame_type !== "FORKED" && windowOf(r.begin) !== -1,
  );
  const dropped = new Set(
    scored
      .filter((r) => r.frame.state === "STATE_DROPPED" || r.frame.state === "STATE_PRESENTED_PARTIAL")
      .map((r) => `${r.frame.frame_source}:${r.frame.frame_sequence}`),
  ).size;

  const reportedPerWindow = windows.map((_, w) => scored.filter((r) => windowOf(r.begin) === w).length);
  reportedPerWindow.forEach((reported, w) => {
    if (reported < MIN_REPORTED_PER_WINDOW) {
      throw new Error(
        `instrument error: the ${WINDOW_NAMES[w]} window reported ${reported} frames ` +
          `(floor ${MIN_REPORTED_PER_WINDOW}; healthy ~106 open, ~74 close) — its trace events are ` +
          `missing, refusing to score it as a perfect window`,
      );
    }
  });

  let presented = 0;
  let longestIntervalMs = 0;
  const intervals = [];
  for (let w = 0; w < windows.length; w++) {
    const ends = scored
      .filter((r) => windowOf(r.begin) === w && r.frame.state === "STATE_PRESENTED_ALL")
      .map((r) => r.end)
      .sort((a, b) => a - b);
    presented += ends.length;
    for (let i = 1; i < ends.length; i++) {
      const gap = (ends[i] - ends[i - 1]) / 1000;
      intervals.push(gap);
      longestIntervalMs = Math.max(longestIntervalMs, gap);
    }
  }
  return { rasterMs, dropped, longestIntervalMs, presented, intervals, reportedPerWindow };
}

// --- measurement -------------------------------------------------------

// One full browser launch: 2 discarded in-page warm-up cycles followed by
// `cycles` measured cycles. Returns raw per-cycle arrays only; the caller
// decides how to pool/summarize across launches.
async function measureLaunch(cycles) {
  const browser = await chromium.launch(LAUNCH_OPTIONS);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    // Glow OFF by default (DESIGN.md §4.8: judge with the glow off). Set via
    // the demo's own persisted toggle, at run time only. Every trusted click
    // drops a trace marker that places the scored windows.
    await page.addInitScript(
      ({ inject, mark }) => {
        // wicket-iris-example:settings is the demo's single persisted
        // settings object (main.tsx readSettings/updateSettings) — the old
        // per-toggle localStorage key (iridescent-only) was folded into it.
        localStorage.setItem(
          "wicket-iris-example:settings",
          JSON.stringify({ iridescent: inject }),
        );
        // Page-clock record of each cycle, read back by verifyInjections.
        window.__perfMorph = { clicks: [], jank: [], block: [] };
        addEventListener(
          "click",
          (e) => {
            if (!e.isTrusted) return;
            console.timeStamp(mark);
            window.__perfMorph.clicks.push(performance.now());
          },
          true,
        );
      },
      { inject: INJECT_GLOW, mark: CLICK_MARK },
    );
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const gpu = await readRenderer(browser, page);
    if (gpu.software) {
      throw new Error(
        `Refusing to measure on a software renderer: "${gpu.renderer}" ` +
          `(gpu_compositing=${gpu.compositing}, rasterization=${gpu.rasterization}). ` +
          `Numbers would describe the CPU, not the GPU the morph ships on.`,
      );
    }

    const glowMounted = await page.locator(".iri-shadow").count();
    if (INJECT_GLOW && glowMounted === 0) {
      throw new Error("--inject-glow was set but .iri-shadow did not mount");
    }
    if (!INJECT_GLOW && glowMounted !== 0) {
      throw new Error(".iri-shadow is mounted with glow OFF — the demo toggle did not apply");
    }

    if (INJECT_GPU) await injectGpuLoad(page);
    if (INJECT_ANIMATION) await injectUnrelatedAnimation(page);

    // Scoped to the main Root (id="main" in main.tsx): a second, unrelated
    // Iris.Root (the "Design" settings sheet) also renders a trigger.
    const trigger = page.locator(
      '[data-wicket-iris-root="main"] [data-wicket-iris-part="trigger"]',
    );
    const triggerBox = await trigger.boundingBox();
    const cx = triggerBox.x + triggerBox.width / 2;
    const cy = triggerBox.y + triggerBox.height / 2;

    const cycle = async (measured) => {
      if (INJECT_BLOCK && measured) {
        await page.evaluate(() => {
          addEventListener(
            "click",
            () =>
              setTimeout(() => {
                const start = performance.now();
                while (performance.now() - start < 150) {
                  /* intentional busy-block */
                }
                window.__perfMorph.block.push([start, performance.now()]);
              }, 200),
            { capture: true, once: true },
          );
        });
      }
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(WINDOW_MS + 800); // open window + hold
      const closeBox = await page
        .locator('[data-wicket-iris-root="main"] [data-wicket-iris-part="close"]')
        .boundingBox();
      await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      await page.waitForTimeout(WINDOW_MS + 700); // close window + hold
    };

    // Warm-up: discard 2 cycles. The first open after launch renders ~half
    // the distinct frames on any build (reference_measuring-smoothness.md).
    await cycle(false);
    await cycle(false);

    if (INJECT_JANK) {
      await page.evaluate(() => {
        function tick() {
          const start = performance.now();
          while (performance.now() - start < 20) {
            /* intentional busy-block */
          }
          window.__perfMorph.jank.push([start, performance.now()]);
          requestAnimationFrame(tick);
        }
        tick();
      });
    }

    const cdp = await ctx.newCDPSession(page);
    const perCycle = {
      rasterMs: [],
      dropped: [],
      longestIntervalMs: [],
      presented: [],
      intervals: [],
      reportedPerWindow: [],
      selfCheck: [],
    };

    for (let i = 0; i < cycles; i++) {
      const events = [];
      const onTraceData = (d) => events.push(...d.value);
      cdp.on("Tracing.dataCollected", onTraceData);
      await cdp.send("Tracing.start", {
        categories:
          "disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,devtools.timeline,blink",
        options: "sampling-frequency=10000",
      });
      await page.evaluate(() => {
        window.__perfMorph = { clicks: [], jank: [], block: [] };
      });
      await cycle(true);
      await new Promise((resolve) => {
        cdp.once("Tracing.tracingComplete", resolve);
        cdp.send("Tracing.end");
      });
      cdp.off("Tracing.dataCollected", onTraceData);

      // Before scoring: an injection that didn't run must be named, not scored.
      perCycle.selfCheck.push(await verifyInjections(page));
      const result = analyzeCycle(events);
      perCycle.reportedPerWindow.push(result.reportedPerWindow.join("/"));
      perCycle.rasterMs.push(result.rasterMs);
      perCycle.dropped.push(result.dropped);
      perCycle.longestIntervalMs.push(result.longestIntervalMs);
      perCycle.presented.push(result.presented);
      perCycle.intervals.push(...result.intervals);
    }

    return { gpu: gpu.renderer, ...perCycle };
  } finally {
    await browser.close();
  }
}

// Test-only, reachable only when PERF_FAKE_LOAD_SEQUENCE is set: stands in
// for measureLaunch() so the per-launch quiet gate can be proven to fire on
// a specific launch without paying for a real browser launch per iteration.
// Never runs in normal use.
function fakeMeasureLaunch(cycles) {
  const n = Array.from({ length: cycles }, () => 1);
  return {
    gpu: "fake (PERF_FAKE_LOAD_SEQUENCE)",
    rasterMs: n.map(() => 10),
    dropped: n.map(() => 0),
    longestIntervalMs: n.map(() => 16.7),
    presented: n.map(() => 60),
    intervals: n.map(() => 16.7),
  };
}

function summarize(nums) {
  return { median: median(nums), min: Math.min(...nums), max: Math.max(...nums) };
}

function printTable(rows) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  for (const row of rows) {
    console.log(row.map((cell, c) => String(cell).padEnd(widths[c])).join("  "));
  }
}

const fmt = (s, digits = 1) => [s.median, s.min, s.max].map((n) => n.toFixed(digits));

// Raster tolerance: a one-sided fraction from the pooled high-side spread,
// widened 50%, with a floor (normal noise doesn't flake the gate) and a
// ceiling (a 2x raster regression is never masked by a wide spread).
function deriveRasterPct(summary) {
  const spreadPct = (summary.max - summary.median) / summary.median;
  return Math.min(0.9, Math.max(0.2, spreadPct * 1.5));
}

async function main() {
  await startVite();
  const commit = await sh(["rev-parse", "--short", "HEAD"]);

  if (UPDATE_BASELINE) {
    const launches = [];
    const load1PerLaunch = [];
    for (let i = 0; i < BASELINE_LAUNCHES; i++) {
      // Checked fresh before EACH launch, not once before the loop — see
      // requireQuietForLaunch.
      const load = await requireQuietForLaunch(i + 1, BASELINE_LAUNCHES);
      if (load == null) return 1;
      load1PerLaunch.push(load);
      console.log(
        `baseline launch ${i + 1}/${BASELINE_LAUNCHES} (load1=${load.toFixed(2)}, threshold < ` +
          `${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)...`,
      );
      const result = fakeLoadSequence ? fakeMeasureLaunch(CYCLES) : await measureLaunch(CYCLES);
      launches.push(result);
      printTable([
        ["  metric", "median", "min", "max"],
        ["  raster ms", ...fmt(summarize(result.rasterMs))],
        ["  dropped frames", ...fmt(summarize(result.dropped), 0)],
        ["  longest interval ms", ...fmt(summarize(result.longestIntervalMs))],
        ["  presented (info)", ...fmt(summarize(result.presented), 0)],
      ]);
    }

    // Discard the first launch entirely (cold-start, not steady state).
    const steady = launches.slice(1);
    console.log(
      `\ndiscarding launch 1/${BASELINE_LAUNCHES} entirely (cold start); ` +
        `baseline built from launches 2-${BASELINE_LAUNCHES} (${steady.length} launches, ` +
        `each with its own 2 discarded in-page warm-up cycles).`,
    );

    const pool = (key) => steady.flatMap((l) => l[key]);
    const raster = summarize(pool("rasterMs"));
    const dropped = summarize(pool("dropped"));
    const longestInterval = summarize(pool("longestIntervalMs"));
    const presented = summarize(pool("presented"));
    const frameIntervalMs = median(pool("intervals").filter((n) => n > 0));

    // Dropped frames are small integers, so the slack is absolute, not a
    // percentage of a median that can be 0: 1.5x the pooled high-side
    // spread, at least 2 frames. The longest interval is quantized to the
    // frame interval, so its slack is one frame on top of the worst pooled
    // cycle: any stall more than a frame beyond the worst healthy one fails.
    const rasterPct = deriveRasterPct(raster);
    const droppedSlack = Math.max(2, Math.ceil((dropped.max - dropped.median) * 1.5));
    const longestIntervalSlackMs = frameIntervalMs;

    console.log(`\npooled steady-state samples: n=${pool("rasterMs").length} cycles`);
    printTable([
      ["metric", "median", "min", "max", "limit"],
      ["raster ms", ...fmt(raster), `<= median +${(rasterPct * 100).toFixed(0)}%`],
      ["dropped frames", ...fmt(dropped, 0), `<= median + ${droppedSlack}`],
      ["longest interval ms", ...fmt(longestInterval), `<= max + ${frameIntervalMs.toFixed(1)} (one frame)`],
      ["presented (info)", ...fmt(presented, 0), "not gated"],
    ]);

    const baseline = {
      gpu: steady[0].gpu,
      mode: "headless (new), channel chromium",
      viewport: { width: 1280, height: 800 },
      date: new Date().toISOString().slice(0, 10),
      commit,
      cycles: CYCLES,
      baselineLaunches: BASELINE_LAUNCHES,
      load1PerLaunch,
      frameIntervalMs,
      raster,
      dropped,
      longestInterval,
      presented,
      tolerance: { rasterPct, droppedSlack, longestIntervalSlackMs },
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
    console.log("");
    console.log(`baseline written -> ${BASELINE_PATH}`);
    return 0;
  }

  const gateLoad = currentLoad();
  if (gateLoad >= QUIET_THRESHOLD) {
    console.error(
      `warning: load1=${gateLoad.toFixed(2)} >= ${QUIET_THRESHOLD.toFixed(1)} (0.5 * ${CORES} cores) — ` +
        `this run may read as a false regression. Results below are not refused, but treat a FAIL ` +
        `under this warning as suspect until re-run quiet.`,
    );
  }

  const result = await measureLaunch(CYCLES);
  const raster = summarize(result.rasterMs);
  const dropped = summarize(result.dropped);
  const longestInterval = summarize(result.longestIntervalMs);
  const presented = summarize(result.presented);

  const injected = [
    ["glow", INJECT_GLOW],
    ["jank", INJECT_JANK],
    ["block", INJECT_BLOCK],
    ["gpu", INJECT_GPU],
    ["animation", INJECT_ANIMATION],
  ]
    .filter(([, on]) => on)
    .map(([name]) => name);

  console.log("Wicket Iris perf");
  console.log(`  renderer:   ${result.gpu}`);
  console.log(`  mode:       ${LAUNCH_OPTIONS.channel} headless (new)`);
  console.log(`  load1:      ${gateLoad.toFixed(2)} (quiet threshold < ${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)`);
  console.log(`  cycles:     ${CYCLES} (+2 warm-up, discarded)`);
  console.log(`  injected:   ${injected.length ? injected.join(", ") : "none"}`);
  console.log("");
  printTable([
    ["metric", "median", "min", "max", "per cycle"],
    ["raster ms", ...fmt(raster), result.rasterMs.map((n) => n.toFixed(1)).join(", ")],
    ["dropped frames", ...fmt(dropped, 0), result.dropped.join(", ")],
    ["longest interval ms", ...fmt(longestInterval), result.longestIntervalMs.map((n) => n.toFixed(1)).join(", ")],
    ["presented (info)", ...fmt(presented, 0), result.presented.join(", ")],
  ]);
  console.log(
    `  frames reported per window, open/close (floor ${MIN_REPORTED_PER_WINDOW}): ${result.reportedPerWindow.join(", ")}`,
  );
  if (INJECT_JANK || INJECT_BLOCK) {
    console.log(`  injection self-check: PASS in every cycle (${result.selfCheck.join(" | ")})`);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error("");
    console.error(`No baseline at ${BASELINE_PATH}. Run: npm run perf -- --update-baseline`);
    return 1;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  if (baseline.dropped == null || baseline.longestInterval == null) {
    console.error("");
    console.error(
      `${BASELINE_PATH} predates the presented-frame metrics. Rebaseline on a quiet machine: ` +
        `npm run perf -- --update-baseline --wait-for-quiet`,
    );
    return 1;
  }

  const rasterLimit = baseline.raster.median * (1 + baseline.tolerance.rasterPct);
  const droppedLimit = baseline.dropped.median + baseline.tolerance.droppedSlack;
  const longestLimit = baseline.longestInterval.max + baseline.tolerance.longestIntervalSlackMs;
  const rasterPass = raster.median <= rasterLimit;
  const droppedPass = dropped.median <= droppedLimit;
  const longestPass = longestInterval.median <= longestLimit;

  console.log("");
  console.log(`vs baseline (commit ${baseline.commit}, ${baseline.date}, ${baseline.gpu}):`);
  printTable([
    ["metric", "baseline", "observed", "limit", "result"],
    ["raster ms", baseline.raster.median.toFixed(1), raster.median.toFixed(1), `<= ${rasterLimit.toFixed(1)}`, rasterPass ? "PASS" : "FAIL"],
    ["dropped frames", String(baseline.dropped.median), String(dropped.median), `<= ${droppedLimit}`, droppedPass ? "PASS" : "FAIL"],
    ["longest interval ms", baseline.longestInterval.median.toFixed(1), longestInterval.median.toFixed(1), `<= ${longestLimit.toFixed(1)}`, longestPass ? "PASS" : "FAIL"],
  ]);

  return rasterPass && droppedPass && longestPass ? 0 : 1;
}

main()
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    cleanup();
    process.exit(1);
  });
