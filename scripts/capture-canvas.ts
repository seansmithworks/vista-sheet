/**
 * Canvas captures: posters for every CANVAS_TILES entry, plus the frame
 * sequences the Dissection view shows. One config (example/canvas/tiles.ts)
 * drives the live tiles, these captures and the coverage spec.
 *
 *   npm run capture:canvas                  # everything
 *   npm run capture:canvas -- --only=posters
 *   npm run capture:canvas -- --only=frames --seq=morph-circle,close-reveal
 *   npm run capture:canvas -- --only=anatomy  # per-recipe part sets
 *   npm run capture:canvas -- --headless    # faster, but drops morph frames
 *
 * Needs the example dev server (`npm run dev -- --port 5180`) or set
 * CANVAS_BASE. Headed Chrome by default: headless Chromium skips
 * compositor frames mid-morph, so a strip would jump from rest to settled.
 *
 * Mid-morph technique (from .shotfun/states/capture.mjs): Playwright's fake
 * clock drives Motion's JS animations, every WAAPI animation is paused and
 * stepped by hand in 4ms ticks, and a frame is taken the first tick the
 * package's own collapseProgress (read off <VistaSheet.Shadow>'s
 * --vista-sheet-collapse) crosses each target.
 *
 * Writes example/public/canvas/{posters/<tileId>.png, frames/<seq>/NN-*.png,
 * anatomy/<recipe>.png, frames.json}. PNGs are palette-quantised through ffmpeg when it's on PATH.
 */
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANVAS_TILES,
  forAppearance,
  posterName,
  VIEWPORTS,
  type Appearance,
  type CanvasTile,
  type CanvasViewport,
} from "../example/canvas/tiles";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "example/public/canvas");
const BASE = process.env.CANVAS_BASE ?? "http://localhost:5180";

const arg = (name: string) =>
  (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? "")
    .slice(name.length + 3)
    .split(",")
    .filter(Boolean);
const only = arg("only");
const seqFilter = arg("seq");
const tileFilter = arg("tiles");
const headless = process.argv.includes("--headless");
const want = (s: string) => only.length === 0 || only.includes(s);

// Logical viewport -> device scale for posters. Phone tiles display up to
// ~260 CSS px wide on a 2x screen, desktop ones up to ~560.
const POSTER_DSF: Record<CanvasViewport, number> = {
  phone: 2,
  desktop: 1,
  fluid: 1,
};
const MARGIN = 40;

const SEL = {
  trigger: '[data-vista-sheet-part="trigger"]',
  sheet: '[data-vista-sheet-part="sheet"]',
  close: '[data-vista-sheet-part="sheet"] [data-vista-sheet-part="close"]',
  shadow: '[data-vista-sheet-part="shadow"]',
};

const HAS_FFMPEG = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** 256-colour palette PNG. Flat specimen grounds quantise cleanly; the
 * dither keeps shadow gradients from banding. */
function compress(path: string) {
  if (!HAS_FFMPEG) return;
  const tmp = path.replace(/\.png$/, ".q.png");
  execFileSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-y",
      "-i",
      path,
      "-vf",
      "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
      "-pred",
      "mixed",
      tmp,
    ],
    { stdio: "inherit" },
  );
  if (statSync(tmp).size < statSync(path).size) renameSync(tmp, path);
  else rmSync(tmp);
}

function tileById(id: string): CanvasTile {
  const t = CANVAS_TILES.find((x) => x.id === id);
  if (!t) throw new Error(`capture-canvas: no tile "${id}" in CANVAS_TILES`);
  return t;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Clip = { x: number; y: number; width: number; height: number };

async function newCtx(
  browser: Browser,
  viewport: CanvasViewport,
  opts: { dsf?: number; touch?: boolean; holdPreview?: boolean } = {},
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: opts.dsf ?? 1,
    isMobile: Boolean(opts.touch),
    hasTouch: Boolean(opts.touch),
    reducedMotion: "no-preference",
    colorScheme: "light",
  });
  // The link preview loads seansmithdesign.com into its card. Holding those
  // requests keeps every frame on the same skeleton, and the run offline.
  await ctx.addInitScript(() => {
    window.addEventListener("message", (e) => {
      if (e.data?.type === "vista-sheet-play:ready")
        (window as { __stageReady?: boolean }).__stageReady = true;
    });
  });
  if (opts.holdPreview)
    await ctx.route("https://www.seansmithdesign.com/**", () => {});
  return ctx;
}

/** Load a tile exactly as the canvas does: play.html?stage, then one state
 * message (the stage accepts it from window.parent, which at top level is
 * the page itself). Page tiles load their own src. */
async function loadTile(page: Page, tile: CanvasTile) {
  if (tile.kind === "page") {
    await page.goto(`${BASE}/${tile.src}`);
    await page.waitForSelector("a.lp-link", { state: "visible" });
  } else {
    await page.goto(`${BASE}/play.html?stage=1`);
    // The stage's `ready` (posted to "*", so to itself at top level) is the
    // signal its message listener is attached.
    await page.waitForFunction(
      () => (window as { __stageReady?: boolean }).__stageReady === true,
    );
    await page.evaluate(
      ([state, overrides]) =>
        window.postMessage(
          { type: "vista-sheet-play:state", state, overrides },
          location.origin,
        ),
      [tile.state, tile.overrides ?? null] as const,
    );
    await page.waitForSelector(SEL.trigger, { state: "visible" });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((i) =>
        i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)),
      ),
    ),
  );
}

const rectOf = (page: Page, sel: string): Promise<Rect | null> =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, sel);

const linkRects = (page: Page, text: string): Promise<Rect[]> =>
  page.evaluate((t) => {
    const a = [...document.querySelectorAll("a.lp-link")].find(
      (e) => e.textContent?.trim() === t,
    )!;
    return [...a.getClientRects()].map((r) => ({
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
    }));
  }, text);

function union(
  rects: Array<Rect | null>,
  vp: { width: number; height: number },
  margin = MARGIN,
): Clip {
  const rs = rects.filter((r): r is Rect => Boolean(r));
  const x0 = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.x)) - margin));
  const y0 = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.y)) - margin));
  const x1 = Math.min(
    vp.width,
    Math.ceil(Math.max(...rs.map((r) => r.x + r.w)) + margin),
  );
  const y1 = Math.min(
    vp.height,
    Math.ceil(Math.max(...rs.map((r) => r.y + r.h)) + margin),
  );
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

async function waitSettled(page: Page, extra = 1200) {
  await page.waitForSelector(`${SEL.sheet}[data-vista-sheet-settled]`, {
    timeout: 15000,
  });
  await page.waitForTimeout(extra);
}
async function waitClosed(page: Page) {
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-vista-sheet-part="sheet"]') &&
      !document.querySelector("[data-vista-sheet-closing]"),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);
}

/** The live Root's clock and Shadow crossfade, read off its Shadow layer. */
const readClock = (page: Page) =>
  page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-vista-sheet-part="shadow"]',
      ),
    ];
    let best: { c: number; s: number; ss: number } | null = null;
    for (const e of els) {
      const c = parseFloat(e.style.getPropertyValue("--vista-sheet-collapse"));
      if (Number.isNaN(c)) continue;
      const cs = getComputedStyle(e);
      const s = parseFloat(
        e.style.getPropertyValue("--vista-sheet-shadow-opacity") ||
          cs.getPropertyValue("--vista-sheet-shadow-opacity"),
      );
      const ss = parseFloat(
        e.style.getPropertyValue("--vista-sheet-sheet-shadow-opacity") ||
          cs.getPropertyValue("--vista-sheet-sheet-shadow-opacity"),
      );
      if (!best || c < best.c) best = { c, s, ss };
    }
    return best ?? { c: 1, s: NaN, ss: NaN };
  });

async function pause(page: Page) {
  const t = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(t + 16);
}
async function step(page: Page, ms = 4) {
  await page.clock.runFor(ms);
  await page.evaluate((d) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = (Number(a.currentTime) || 0) + d;
    }
  }, ms);
}
async function release(page: Page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (a.playState !== "paused") continue;
      const end = a.effect?.getComputedTiming().endTime;
      // One stepped past its end must finish(), not sit paused at the end:
      // a paused animation never resolves `finished`, and Motion waits on
      // that promise before it unmounts a closed sheet.
      if (
        !Number.isFinite(Number(end)) ||
        (Number(a.currentTime) || 0) < Number(end)
      )
        a.play();
      else a.finish();
    }
  });
  await page.clock.resume();
}

// ---------- frames manifest ----------

interface FrameMeta {
  file: string;
  label: string;
  /** The package's own collapseProgress (0 open, 1 closed) at capture, or null. */
  collapse: number | null;
  /** Elapsed ms since the action (click, hover, reveal start), when timed. */
  ms?: number;
  shadowOpacity?: number;
  sheetShadowOpacity?: number;
  detail?: string;
  width: number;
  height: number;
  /** Set when the frame is pixel-identical to another frame of the sequence. */
  identicalTo?: string;
}
interface SequenceMeta {
  id: string;
  group:
    "morph" | "close-reveal" | "shadow" | "trigger-states" | "reduced-motion";
  title: string;
  description: string;
  tileId: string;
  viewport: CanvasViewport;
  deviceScaleFactor: number;
  frames: FrameMeta[];
}

class Seq {
  frames: FrameMeta[] = [];
  private buffers = new Map<string, Buffer>();
  constructor(
    public meta: Omit<SequenceMeta, "frames">,
    private clip: Clip,
  ) {
    rmSync(join(OUT, "frames", meta.id), { recursive: true, force: true });
    mkdirSync(join(OUT, "frames", meta.id), { recursive: true });
  }
  async shot(
    page: Page,
    name: string,
    f: Omit<FrameMeta, "file" | "width" | "height">,
  ) {
    const n = String(this.frames.length).padStart(2, "0");
    const rel = `canvas/frames/${this.meta.id}/${n}-${name}.png`;
    const buf = await page.screenshot({ clip: this.clip });
    const same = [...this.buffers].find(([, b]) => b.equals(buf))?.[0];
    writeFileSync(join(OUT, "..", rel), buf);
    this.buffers.set(rel, buf);
    const dsf = this.meta.deviceScaleFactor;
    this.frames.push({
      file: rel,
      width: Math.round(this.clip.width * dsf),
      height: Math.round(this.clip.height * dsf),
      ...f,
      ...(same ? { identicalTo: same } : {}),
    });
    console.log(
      "  ",
      rel,
      f.collapse !== null ? `collapse ${f.collapse.toFixed(3)}` : "",
      same ? "(identical)" : "",
    );
  }
  done(): SequenceMeta {
    return { ...this.meta, frames: this.frames };
  }
}

// ---------- demo drivers ----------

interface Driver {
  restRects(page: Page): Promise<Array<Rect | null>>;
  open(page: Page): Promise<void>;
  close(page: Page): Promise<void>;
}

function modal(touch: boolean): Driver {
  const press = async (page: Page, sel: string) => {
    const c = center((await rectOf(page, sel))!);
    if (touch) await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
  };
  return {
    restRects: async (page) => [await rectOf(page, SEL.trigger)],
    open: (page) => press(page, SEL.trigger),
    close: async (page) => {
      const r = await rectOf(page, SEL.close);
      if (r && r.w > 0) await press(page, SEL.close);
      else await page.keyboard.press("Escape");
    },
  };
}

function link(text: string): Driver {
  return {
    restRects: (page) => linkRects(page, text),
    open: async (page) => {
      const l = (await linkRects(page, text))[0];
      await page.mouse.move(l.x + l.w / 2, l.y + l.h / 2, { steps: 4 });
    },
    close: async (page) => {
      await page.mouse.move(4, 4, { steps: 4 });
    },
  };
}

/** Rest rect(s) + settled sheet, measured on a throwaway page. */
async function measureClip(
  ctx: BrowserContext,
  tile: CanvasTile,
  d: Driver,
  vp: CanvasViewport,
): Promise<Clip> {
  const page = await ctx.newPage();
  await loadTile(page, tile);
  await page.waitForTimeout(300);
  const rest = await d.restRects(page);
  await d.open(page);
  await waitSettled(page, 300);
  const sheet = await rectOf(page, SEL.sheet);
  await page.close();
  return union([...rest, sheet], VIEWPORTS[vp]);
}

const OPEN_TARGETS = [0.2, 0.4, 0.6, 0.8];
const CLOSE_TARGETS = [1 / 3, 2 / 3];

interface SeqDef {
  id: string;
  group: SequenceMeta["group"];
  title: string;
  description: string;
  tileId: string;
  viewport: CanvasViewport;
  dsf: number;
  touch?: boolean;
  link?: string;
}

/** rest, open 20/40/60/80, settled, close 33/67, closed. With `isolateShadow`
 * every part but <VistaSheet.Shadow> is made transparent, so the strip
 * shows the one painter crossfading its two looks. */
async function morph(
  browser: Browser,
  def: SeqDef,
  opts: { isolateShadow?: boolean } = {},
): Promise<SequenceMeta> {
  // A morph starts at rest, whatever the tile shows by default.
  const declared = tileById(def.tileId);
  const tile: CanvasTile =
    declared.kind === "play" && declared.overrides?.defaultOpen
      ? {
          ...declared,
          overrides: { ...declared.overrides, defaultOpen: false },
        }
      : declared;
  const d = def.link ? link(def.link) : modal(Boolean(def.touch));
  const ctx = await newCtx(browser, def.viewport, {
    dsf: def.dsf,
    touch: def.touch,
    holdPreview: Boolean(def.link),
  });
  try {
    const clip = await measureClip(ctx, tile, d, def.viewport);
    const seq = new Seq(
      {
        id: def.id,
        group: def.group,
        title: def.title,
        description: def.description,
        tileId: def.tileId,
        viewport: def.viewport,
        deviceScaleFactor: def.dsf,
      },
      clip,
    );
    const page = await ctx.newPage();
    await page.clock.install();
    await loadTile(page, tile);
    if (opts.isolateShadow) {
      await page.addStyleTag({
        content:
          '[data-vista-sheet-part]:not([data-vista-sheet-part="shadow"]){opacity:0!important}',
      });
    }
    await page.waitForTimeout(700);
    const at = async (name: string, label: string) => {
      const k = await readClock(page);
      await seq.shot(page, name, {
        label,
        collapse: k.c,
        ...(opts.isolateShadow
          ? { shadowOpacity: k.s, sheetShadowOpacity: k.ss }
          : {}),
      });
    };
    await at("rest", "rest");

    await pause(page);
    await d.open(page);
    let i = 0;
    let t = 0;
    for (let n = 0; n < 1500 && i < OPEN_TARGETS.length; n++) {
      await step(page);
      t += 4;
      const { c } = await readClock(page);
      while (i < OPEN_TARGETS.length && 1 - c >= OPEN_TARGETS[i]) {
        const pct = Math.round(OPEN_TARGETS[i] * 100);
        const k = await readClock(page);
        await seq.shot(page, `open-${pct}`, {
          label: `open ${pct}%`,
          collapse: k.c,
          ms: t,
          ...(opts.isolateShadow
            ? { shadowOpacity: k.s, sheetShadowOpacity: k.ss }
            : {}),
        });
        i++;
      }
    }
    if (i < OPEN_TARGETS.length)
      throw new Error(`open never reached ${OPEN_TARGETS[i]}`);
    await release(page);
    await waitSettled(page);
    await at("settled", "settled");

    await pause(page);
    await d.close(page);
    let j = 0;
    t = 0;
    for (let n = 0; n < 1500 && j < CLOSE_TARGETS.length; n++) {
      await step(page);
      t += 4;
      const { c } = await readClock(page);
      while (j < CLOSE_TARGETS.length && c >= CLOSE_TARGETS[j]) {
        const pct = Math.round(CLOSE_TARGETS[j] * 100);
        const k = await readClock(page);
        await seq.shot(page, `close-${pct}`, {
          label: `close ${pct}%`,
          collapse: k.c,
          ms: t,
          ...(opts.isolateShadow
            ? { shadowOpacity: k.s, sheetShadowOpacity: k.ss }
            : {}),
        });
        j++;
      }
    }
    if (j < CLOSE_TARGETS.length)
      throw new Error(`close never reached ${CLOSE_TARGETS[j]}`);
    await release(page);
    await waitClosed(page);
    await at("closed", "closed");
    return seq.done();
  } finally {
    await ctx.close();
  }
}

/** <VistaSheet.Close>'s reveal, cropped tight, timed from the tick the open
 * crosses CLOSE_REVEAL_PROGRESS (the X's own start signal). */
async function closeReveal(
  browser: Browser,
  def: SeqDef,
): Promise<SequenceMeta> {
  const tile = tileById(def.tileId);
  const d = modal(false);
  const ctx = await newCtx(browser, def.viewport, { dsf: def.dsf });
  try {
    // Measure the settled X.
    const probe = await ctx.newPage();
    await loadTile(probe, tile);
    await d.open(probe);
    await waitSettled(probe, 800);
    const x = (await rectOf(probe, SEL.close))!;
    const sheet = (await rectOf(probe, SEL.sheet))!;
    await probe.close();
    const pad = 28;
    const clip = union(
      [{ x: x.x - pad, y: x.y - pad, w: x.w + pad * 2, h: x.h + pad * 2 }],
      VIEWPORTS[def.viewport],
      0,
    );
    // Keep the crop inside the sheet so the ground never shows.
    clip.x = Math.max(clip.x, Math.ceil(sheet.x));
    clip.y = Math.max(clip.y, Math.ceil(sheet.y));

    const seq = new Seq(
      {
        id: def.id,
        group: def.group,
        title: def.title,
        description: def.description,
        tileId: def.tileId,
        viewport: def.viewport,
        deviceScaleFactor: def.dsf,
      },
      clip,
    );
    const page = await ctx.newPage();
    await page.clock.install();
    await loadTile(page, tile);
    await page.waitForTimeout(500);
    await pause(page);
    await d.open(page);
    // Step until the X's start signal.
    for (let n = 0; n < 1500; n++) {
      await step(page);
      if ((await readClock(page)).c <= 0.01) break;
    }
    const xform = () =>
      page.evaluate((s) => {
        const el = document.querySelector<HTMLElement>(s);
        if (!el) return "";
        const cs = getComputedStyle(el);
        const m = new DOMMatrix(
          cs.transform === "none" ? undefined : cs.transform,
        );
        const scale = Math.hypot(m.a, m.b);
        const rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        return `opacity ${Number(cs.opacity).toFixed(2)} · scale ${scale.toFixed(2)} · rotate ${rot.toFixed(0)}°`;
      }, SEL.close);
    const MARKS = [0, 40, 80, 150, 250, 400, 600];
    let t = 0;
    for (const mark of MARKS) {
      while (t < mark) {
        await step(page);
        t += 4;
      }
      await seq.shot(page, `t${mark}`, {
        label: `+${mark}ms`,
        collapse: (await readClock(page)).c,
        ms: mark,
        detail: await xform(),
      });
    }
    await release(page);
    return seq.done();
  } finally {
    await ctx.close();
  }
}

/** Rest, hover, focus-visible and pressed on one trigger, cropped tight. */
async function triggerStates(
  browser: Browser,
  def: SeqDef,
): Promise<SequenceMeta> {
  const tile = tileById(def.tileId);
  const ctx = await newCtx(browser, def.viewport, { dsf: def.dsf });
  try {
    const page = await ctx.newPage();
    await loadTile(page, tile);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(600);
    const r = (await rectOf(page, SEL.trigger))!;
    const clip = union([r], VIEWPORTS[def.viewport], 24);
    const seq = new Seq(
      {
        id: def.id,
        group: def.group,
        title: def.title,
        description: def.description,
        tileId: def.tileId,
        viewport: def.viewport,
        deviceScaleFactor: def.dsf,
      },
      clip,
    );
    await seq.shot(page, "rest", { label: "rest", collapse: null });
    const c = center(r);
    await page.mouse.move(c.x, c.y, { steps: 4 });
    await page.waitForTimeout(400);
    await seq.shot(page, "hover", {
      label: "hover",
      collapse: null,
      detail: "pointer over the trigger",
    });
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    for (let k = 0; k < 12; k++) {
      await page.keyboard.press("Tab");
      if (
        await page.evaluate(
          (s) => document.activeElement === document.querySelector(s),
          SEL.trigger,
        )
      )
        break;
    }
    await page.waitForTimeout(300);
    await seq.shot(page, "focus-visible", {
      label: "focus-visible",
      collapse: null,
      detail: "keyboard Tab",
    });
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await seq.shot(page, "pressed", {
      label: "pressed",
      collapse: null,
      detail: "pointer down, held",
    });
    return seq.done();
  } finally {
    await ctx.close();
  }
}

/** Reduced motion: the 200ms opacity crossfade, timed from the click. */
async function reducedMotion(
  browser: Browser,
  def: SeqDef,
): Promise<SequenceMeta> {
  const tile = tileById(def.tileId);
  const d = modal(false);
  const ctx = await newCtx(browser, def.viewport, { dsf: def.dsf });
  try {
    const clip = await measureClip(ctx, tile, d, def.viewport);
    const seq = new Seq(
      {
        id: def.id,
        group: def.group,
        title: def.title,
        description: def.description,
        tileId: def.tileId,
        viewport: def.viewport,
        deviceScaleFactor: def.dsf,
      },
      clip,
    );
    const page = await ctx.newPage();
    await page.clock.install();
    await loadTile(page, tile);
    await page.waitForTimeout(500);
    await seq.shot(page, "rest", { label: "rest", collapse: null });
    await pause(page);
    await d.open(page);
    const sheetOpacity = () =>
      page.evaluate((s) => {
        const el = document.querySelector(s);
        return el
          ? `sheet opacity ${Number(getComputedStyle(el).opacity).toFixed(2)}`
          : "no sheet yet";
      }, SEL.sheet);
    let t = 0;
    for (const mark of [50, 100, 150]) {
      while (t < mark) {
        await step(page);
        t += 4;
      }
      await seq.shot(page, `t${mark}`, {
        label: `+${mark}ms`,
        collapse: null,
        ms: mark,
        detail: await sheetOpacity(),
      });
    }
    await release(page);
    await waitSettled(page, 600);
    await seq.shot(page, "settled", {
      label: "settled",
      collapse: null,
      detail: await sheetOpacity(),
    });
    return seq.done();
  } finally {
    await ctx.close();
  }
}

const MORPH_DESC =
  "rest, open at 20/40/60/80% of collapseProgress, settled, close at 33/67%, closed.";

const SEQUENCES: Array<
  SeqDef & { run: (b: Browser, d: SeqDef) => Promise<SequenceMeta> }
> = [
  {
    id: "morph-circle",
    group: "morph",
    title: "Circle · basic",
    description: MORPH_DESC,
    tileId: "shape-circle",
    viewport: "desktop",
    dsf: 1,
    run: (b, d) => morph(b, d),
  },
  {
    id: "morph-squircle",
    group: "morph",
    title: "Squircle",
    description: MORPH_DESC,
    tileId: "shape-squircle",
    viewport: "desktop",
    dsf: 1,
    run: (b, d) => morph(b, d),
  },
  {
    id: "morph-rectangle",
    group: "morph",
    title: "Rectangle · search",
    description: MORPH_DESC,
    tileId: "shape-rectangle",
    viewport: "desktop",
    dsf: 1,
    run: (b, d) => morph(b, d),
  },
  {
    id: "morph-dark",
    group: "morph",
    title: "List · neutral dark",
    description: MORPH_DESC,
    tileId: "theme-neutral-dark",
    viewport: "desktop",
    dsf: 1,
    run: (b, d) => morph(b, d),
  },
  {
    id: "morph-phone",
    group: "morph",
    title: "Media · phone 390×844, touch",
    description: MORPH_DESC,
    tileId: "content-media",
    viewport: "phone",
    dsf: 1.5,
    touch: true,
    run: (b, d) => morph(b, d),
  },
  {
    id: "morph-link-preview",
    group: "morph",
    title: "Link preview · hover",
    description: `${MORPH_DESC} Opens on hover intent, closes on pointer-out after the grace period. The previewed page is held on its skeleton so frames compare.`,
    tileId: "link-preview",
    viewport: "desktop",
    dsf: 1,
    link: "Ghostties",
    run: (b, d) => morph(b, d),
  },
  {
    id: "close-reveal",
    group: "close-reveal",
    title: "Close button reveal",
    description:
      "Timed from the tick collapseProgress reaches CLOSE_REVEAL_PROGRESS: fade, scale from 0 and a -90° turn on two springs.",
    tileId: "shape-circle",
    viewport: "desktop",
    dsf: 3,
    run: closeReveal,
  },
  {
    id: "shadow-crossfade",
    group: "shadow",
    title: "Shadow crossfade",
    description:
      "The same progress points with every part but <VistaSheet.Shadow> made transparent: one painter crossfading the thin trigger look into the heavy sheet look.",
    tileId: "behaviour-shadow-on",
    viewport: "desktop",
    dsf: 1,
    run: (b, d) => morph(b, d, { isolateShadow: true }),
  },
  {
    id: "trigger-states-disc",
    group: "trigger-states",
    title: "Disc trigger · interaction states",
    description: "Rest, hover, keyboard focus and pressed on a circle trigger.",
    tileId: "shape-circle",
    viewport: "phone",
    dsf: 3,
    run: triggerStates,
  },
  {
    id: "trigger-states-button",
    group: "trigger-states",
    title: "Button trigger · interaction states",
    description:
      "Rest, hover, keyboard focus and pressed on a rectangle button.",
    tileId: "button-m-icon-text",
    viewport: "phone",
    dsf: 3,
    run: triggerStates,
  },
  {
    id: "reduced-motion",
    group: "reduced-motion",
    title: "Reduced motion · open",
    description:
      "No morph: the sheet fades in over 200ms, timed from the click.",
    tileId: "reduced-motion-basic",
    viewport: "desktop",
    dsf: 1,
    run: reducedMotion,
  },
];

// ---------- anatomy ----------

interface AnatomyBox {
  part: string;
  slot: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}
/** One recipe's measured part set: every [data-vista-sheet-part] at rest
 * and opened, plus the opened frame and its boxes for the variant card. */
interface AnatomyRecipe {
  recipe: string;
  tileId: string;
  /** Part keys (`part` or `part:slot`), rest ∪ open, sorted. */
  parts: string[];
  file: string;
  width: number;
  height: number;
  boxes: AnatomyBox[];
}

const measureParts = (page: Page): Promise<AnatomyBox[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-vista-sheet-part]")].map(
      (el) => {
        const r = el.getBoundingClientRect();
        return {
          part: el.dataset.vistaSheetPart!,
          slot: el.dataset.vistaSheetSlot ?? null,
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        };
      },
    ),
  );

const boxKey = (b: AnatomyBox) => (b.slot ? `${b.part}:${b.slot}` : b.part);

/** Every Content tile (one per recipe), at rest then opened by a click. */
async function anatomy(browser: Browser): Promise<AnatomyRecipe[]> {
  const dir = join(OUT, "anatomy");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await newCtx(browser, "phone", { dsf: 1 });
  const out: AnatomyRecipe[] = [];
  try {
    for (const tile of CANVAS_TILES.filter(
      (t): t is Extract<CanvasTile, { kind: "play" }> =>
        t.kind === "play" && t.section === "content",
    )) {
      const page = await ctx.newPage();
      await loadTile(page, tile);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      const rest = await measureParts(page);
      await modal(false).open(page);
      await waitSettled(page, 1400);
      await page.mouse.move(0, 0);
      const open = await measureParts(page);
      const recipe = tile.state.recipe;
      const rel = `canvas/anatomy/${recipe}.png`;
      await page.screenshot({ path: join(OUT, "..", rel) });
      compress(join(OUT, "..", rel));
      await page.close();
      const parts = [...new Set([...rest, ...open].map(boxKey))].sort();
      out.push({
        recipe,
        tileId: tile.id,
        parts,
        file: rel,
        width: VIEWPORTS.phone.width,
        height: VIEWPORTS.phone.height,
        boxes: open,
      });
      console.log("   anatomy", recipe, parts.join(" "));
    }
  } finally {
    await ctx.close();
  }
  return out;
}

// ---------- posters ----------

async function posters(browser: Browser) {
  const dir = join(OUT, "posters");
  mkdirSync(dir, { recursive: true });
  const tiles = CANVAS_TILES.filter(
    (t) => tileFilter.length === 0 || tileFilter.includes(t.id),
  );
  // Every tile gets a light poster; tiles that follow the page appearance
  // get a dark twin too (posterName).
  const shots = (["light", "dark"] as Appearance[]).flatMap((a) =>
    tiles
      .filter((t) => a === "light" || !t.fixedTheme)
      .map((t) => ({ tile: forAppearance(t, a), file: posterName(t, a) })),
  );
  for (const vp of ["phone", "desktop", "fluid"] as const) {
    const ctx = await newCtx(browser, vp, { dsf: POSTER_DSF[vp] });
    const page = await ctx.newPage();
    for (const { tile, file: name } of shots.filter(
      (s) => s.tile.viewport === vp,
    )) {
      await loadTile(page, tile);
      await page.mouse.move(0, 0);
      // A defaultOpen mount never sets data-vista-sheet-settled (its
      // collapseProgress stays at 1), so wait on the sheet itself.
      if (tile.kind === "play" && tile.overrides?.defaultOpen) {
        await page.waitForSelector(SEL.sheet, { state: "visible" });
        await page.waitForTimeout(1500);
      } else await page.waitForTimeout(700);
      const file = join(dir, name);
      await page.screenshot({ path: file });
      compress(file);
      console.log("   poster", name);
    }
    await ctx.close();
  }
  // Drop posters for tiles that no longer exist.
  const names = new Set(
    CANVAS_TILES.flatMap((t) => [
      posterName(t, "light"),
      posterName(t, "dark"),
    ]),
  );
  for (const f of readdirSync(dir)) if (!names.has(f)) rmSync(join(dir, f));
}

// ---------- run ----------

const browser = await chromium.launch({ channel: "chrome", headless });
const failures: string[] = [];
try {
  if (want("posters")) {
    console.log("posters");
    await posters(browser);
  }
  const manifestPath = join(OUT, "frames.json");
  const prev: { sequences?: SequenceMeta[]; anatomy?: AnatomyRecipe[] } =
    existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, "utf8"))
      : {};
  const done = new Map((prev.sequences ?? []).map((s) => [s.id, s]));
  let anatomyOut = prev.anatomy;
  if (want("frames")) {
    console.log("frames");
    mkdirSync(OUT, { recursive: true });
    for (const def of SEQUENCES) {
      if (seqFilter.length && !seqFilter.includes(def.id)) continue;
      console.log(" ", def.id);
      try {
        const meta = await def.run(browser, def);
        for (const f of meta.frames) compress(join(OUT, "..", f.file));
        done.set(def.id, meta);
      } catch (e) {
        failures.push(`${def.id}: ${(e as Error).message.split("\n")[0]}`);
        console.error("FAIL", def.id, (e as Error).message.split("\n")[0]);
      }
    }
  }
  if (want("anatomy")) {
    console.log("anatomy");
    try {
      anatomyOut = await anatomy(browser);
    } catch (e) {
      failures.push(`anatomy: ${(e as Error).message.split("\n")[0]}`);
      console.error("FAIL anatomy", (e as Error).message.split("\n")[0]);
    }
  }
  if (want("frames") || want("anatomy")) {
    const git = (args: string[]) =>
      execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
    const dirty =
      git([
        "status",
        "--porcelain",
        "--",
        "src",
        "example/play",
        "example/canvas",
      ]) !== "";
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          gitHead:
            git(["rev-parse", "--short", "HEAD"]) + (dirty ? "-dirty" : ""),
          sequences: SEQUENCES.map((s) => done.get(s.id)).filter(Boolean),
          ...(anatomyOut ? { anatomy: anatomyOut } : {}),
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser.close();
}
console.log(
  failures.length ? `FAILURES:\n${failures.join("\n")}` : "no failures",
);
if (failures.length) process.exit(1);
