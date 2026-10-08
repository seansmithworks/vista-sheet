import { expect, test, type Page } from "@playwright/test";
import { CLOSE_REVEAL_PROGRESS, DEFAULT_OPEN_SPRING } from "../src/motion";
import { crossing, simulate } from "./canvas/springs";
import { CANVAS_TILES, type PlayTile } from "./canvas/tiles";
import { TICK_MS } from "./play/virtual-clock";

/**
 * The Motion Lab's virtual clock (play/virtual-clock.ts + clock-lab.ts) on
 * the real stage. Same virtual time must be the same frame whichever way
 * you got there: played slowly, seeked forward, or seeked back from later.
 * The snapshot is every part's box, opacity and transform, which parts
 * exist, the settled/closing attributes and the Shadow layer's own
 * crossfade, so a WAAPI animation running on real time, a late finish or a
 * ResizeObserver landing on a different tick all show up.
 */

const TILE = CANVAS_TILES.find((t) => t.id === "content-basic") as PlayTile;

async function openStage(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.addEventListener("message", (e) => {
      if (e.data?.type === "wicket-iris-play:ready")
        (window as { __ready?: boolean }).__ready = true;
    });
  });
  await page.goto("/play.html?stage=1&clock=1");
  // Polled from the test, not waitForFunction: Playwright's in-page
  // polling runs on the page's rAF/setTimeout, which are virtual here.
  await expect
    .poll(() => page.evaluate(() => (window as { __ready?: boolean }).__ready))
    .toBe(true);
  await page.evaluate(
    (state) =>
      window.postMessage(
        { type: "wicket-iris-play:state", state },
        location.origin,
      ),
    TILE.state,
  );
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__vistaLab)))
    .toBe(true);
}

const lab = {
  scene: (page: Page, direction: "open" | "close") =>
    page.evaluate(async (direction) => {
      window.__vistaLab!.command({ op: "scene", direction, endMs: 1200 });
      await window.__vistaLab!.idle();
    }, direction),
  seek: (page: Page, ms: number) =>
    page.evaluate((ms) => window.__vistaLab!.seek(ms), ms),
  playTo: (page: Page, ms: number, speed: number) =>
    page.evaluate(
      async ({ ms, speed }) => {
        window.__vistaLab!.command({ op: "speed", speed });
        await window.__vistaLab!.playTo(ms);
        await window.__vistaLab!.idle();
        // The same two real frames a seek waits for its ResizeObserver.
        const clock = window.__vistaClock!;
        await clock.realFrame();
        await clock.realFrame();
      },
      { ms, speed },
    ),
  t: (page: Page) => page.evaluate(() => window.__vistaLab!.state().t),
};

/** Every part, rounded so float noise in the last bits never counts. */
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const nums = (s: string) =>
      s === "none" ? s : (s.match(/-?[\d.e-]+/g) ?? []).map((v) => r3(+v));
    const parts = [
      ...document.querySelectorAll<HTMLElement>("[data-wicket-iris-part]"),
    ].map((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        part: el.dataset.wicketIrisPart,
        slot: el.dataset.wicketIrisSlot ?? null,
        rect: [r2(b.x), r2(b.y), r2(b.width), r2(b.height)],
        opacity: r3(+cs.opacity),
        transform: nums(cs.transform),
        settled: el.hasAttribute("data-wicket-iris-settled"),
        closing: el.hasAttribute("data-wicket-iris-closing"),
      };
    });
    const shadow = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-wicket-iris-part="shadow"]',
      ),
    ].map((el) => {
      const cs = getComputedStyle(el);
      const v = (name: string) =>
        r3(
          parseFloat(
            el.style.getPropertyValue(name) || cs.getPropertyValue(name),
          ),
        );
      return {
        collapse: v("--wicket-iris-collapse"),
        thin: v("--wicket-iris-shadow-opacity"),
        heavy: v("--wicket-iris-sheet-shadow-opacity"),
        layers: [el, ...el.querySelectorAll("*")].flatMap((n) =>
          ["::before", "::after", null].map((p) =>
            r3(+getComputedStyle(n, p).opacity),
          ),
        ),
      };
    });
    const flagged = [
      ...document.querySelectorAll(
        "[data-wicket-iris-settled],[data-wicket-iris-closing]",
      ),
    ].map(
      (el) =>
        `${el.getAttribute("data-wicket-iris-part")}:${el.hasAttribute("data-wicket-iris-settled") ? "settled" : ""}${el.hasAttribute("data-wicket-iris-closing") ? "closing" : ""}`,
    );
    // Set by a scenario's own hooks (the exit-completion test).
    const marks = document.body.dataset.afterExit ?? null;
    return { parts, shadow, flagged, marks };
  });

const POINTS: Array<{ direction: "open" | "close"; ms: number }> = [
  { direction: "open", ms: 120 },
  { direction: "open", ms: 300 },
  { direction: "close", ms: 150 },
];

/** The same virtual time reached three ways. */
async function threePaths(page: Page, direction: "open" | "close", ms: number) {
  await lab.scene(page, direction);
  // (i) slow play from the click, stopping on the tick.
  await lab.seek(page, 0);
  await lab.playTo(page, ms, 0.1);
  const t = await lab.t(page);
  expect(Math.abs(t - ms)).toBeLessThan(TICK_MS);
  const played = await snapshot(page);
  // (ii) forward seek from a fresh arm.
  await lab.seek(page, 400);
  await lab.seek(page, 0);
  await lab.seek(page, ms);
  const forward = await snapshot(page);
  // (iii) backward seek from later.
  await lab.seek(page, ms + 250);
  await lab.seek(page, ms);
  const backward = await snapshot(page);
  expect(played.parts.length).toBeGreaterThan(3);
  expect(forward, "forward seek == slow play").toEqual(played);
  expect(backward, "backward seek == slow play").toEqual(played);
}

test("same virtual time, same frame: slow play == forward seek == backward seek", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openStage(page);
  for (const { direction, ms } of POINTS) {
    await test.step(`${direction} +${ms}ms`, () =>
      threePaths(page, direction, ms));
  }
});

/**
 * A sheet whose box changes mid-morph (the font-landing / image-loading
 * case Sheet's ResizeObserver exists for): 60ms after the open click, and
 * again 60ms after the close click, its content grows 40px. Sheet
 * re-measures through its ResizeObserver and the Shadow follows. That
 * re-measure must land on the same tick however the time was reached, and
 * it must land at all.
 */
test("a sheet that resizes mid-morph: same frame on every path, and the Shadow follows it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openStage(page);
  await page.evaluate(() => {
    const grow = (sheet: Element) => {
      const d = document.createElement("div");
      d.style.height = "40px";
      d.dataset.testGrow = "";
      (
        sheet.querySelector('[data-wicket-iris-part="content"]') ?? sheet
      ).append(d);
    };
    const armed = new WeakSet<Element>();
    const closing = new WeakSet<Element>();
    // Microtask-timed, then a (virtual) timer: the same virtual time on
    // every path.
    new MutationObserver(() => {
      const sheet = document.querySelector('[data-wicket-iris-part="sheet"]');
      if (!sheet) return;
      if (!armed.has(sheet)) {
        armed.add(sheet);
        setTimeout(() => grow(sheet), 60);
      }
      if (
        document.querySelector("[data-wicket-iris-closing]") &&
        !closing.has(sheet)
      ) {
        closing.add(sheet);
        setTimeout(() => grow(sheet), 60);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  for (const { direction, ms } of [
    { direction: "open" as const, ms: 120 },
    { direction: "close" as const, ms: 150 },
  ]) {
    await test.step(`${direction} +${ms}ms`, () =>
      threePaths(page, direction, ms));
  }
  // Settling: the Shadow is the grown sheet's box, not the first measure.
  await lab.scene(page, "open");
  await lab.seek(page, 700);
  const m = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>(
      '[data-wicket-iris-part="sheet"]',
    )!;
    const shadow = document.querySelector<HTMLElement>(
      '[data-wicket-iris-part="shadow"]',
    )!;
    return {
      grown: sheet.querySelectorAll("[data-test-grow]").length,
      sheet: sheet.offsetHeight,
      shadow: parseFloat(shadow.style.height),
    };
  });
  expect(m.grown).toBe(1);
  expect(Math.abs(m.shadow - m.sheet), "Shadow height vs sheet").toBeLessThan(
    1,
  );
});

/**
 * Exit completion. Motion's WAAPI completion (commit the final style,
 * cancel, resolve `finished`, so AnimatePresence can unmount the sheet)
 * lives in each animation's `onfinish`, which a browser dispatches on its
 * next real frame. In a fast-forward that frame is the end of the seek, so
 * the unmount, and anything an app starts when it sees it, would happen at
 * the seek target instead of when the exit really finished. Stand-in for
 * that app code: 20ms after the sheet leaves the DOM, mark the body.
 */
test("exit completion lands on its own tick: what reacts to the unmount sees the same time on every path", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openStage(page);
  await page.evaluate(() => {
    let present = false;
    new MutationObserver(() => {
      const sheet = Boolean(
        document.querySelector('[data-wicket-iris-part="sheet"]'),
      );
      if (sheet && !present) delete document.body.dataset.afterExit;
      if (!sheet && present) {
        // A virtual timer: the same virtual time on every path.
        setTimeout(() => (document.body.dataset.afterExit = "1"), 20);
      }
      present = sheet;
    }).observe(document.body, { subtree: true, childList: true });
  });
  await threePaths(page, "close", 640);
  expect((await snapshot(page)).marks, "the sheet unmounted by +620ms").toBe(
    "1",
  );
});

test("paused is frozen, and 0.1x runs a tenth of real time", async ({
  page,
}) => {
  await openStage(page);
  await lab.scene(page, "open");
  // Mid-morph, with Content and Items about to animate.
  await lab.seek(page, 200);
  const a = await snapshot(page);
  const anims = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((x) => `${x.playState}@${Math.round(Number(x.currentTime))}`),
    );
  const before = await anims();
  await page.waitForTimeout(500);
  expect(await snapshot(page), "no part moves while paused").toEqual(a);
  expect(await anims()).toEqual(before);

  await lab.seek(page, 0);
  const dt = await page.evaluate(async () => {
    const l = window.__vistaLab!;
    const clock = window.__vistaClock!;
    l.command({ op: "speed", speed: 0.1 });
    l.command({ op: "play" });
    // Wait for playback to start, then time one real second.
    while (!l.state().playing) await clock.realFrame();
    const t0 = l.state().t;
    const r0 = clock.realNow();
    while (clock.realNow() - r0 < 1000) await clock.realFrame();
    const t1 = l.state().t;
    const real = clock.realNow() - r0;
    l.command({ op: "pause" });
    return ((t1 - t0) * 1000) / real;
  });
  console.log(`0.1x: ${dt.toFixed(1)}ms virtual per 1000ms real`);
  expect(dt).toBeGreaterThan(90);
  expect(dt).toBeLessThan(110);
});

test("Close reveal: opacity 0 one tick before the CLOSE_REVEAL marker, >0 one tick after", async ({
  page,
}) => {
  await openStage(page);
  await lab.scene(page, "open");
  const marker = crossing(simulate(DEFAULT_OPEN_SPRING), CLOSE_REVEAL_PROGRESS);
  const closeOpacity = () =>
    page.evaluate(() => {
      const el = document.querySelector(
        '[data-wicket-iris-part="sheet"] [data-wicket-iris-part="close"]',
      );
      return el ? Number(getComputedStyle(el).opacity) : 0;
    });
  await lab.seek(page, marker - TICK_MS);
  const before = await closeOpacity();
  await lab.seek(page, marker + TICK_MS);
  const after = await closeOpacity();
  console.log(
    `CLOSE_REVEAL marker ${marker}ms: opacity ${before} at -1 tick, ${after} at +1 tick`,
  );
  expect(before).toBe(0);
  expect(after).toBeGreaterThan(0);
});
