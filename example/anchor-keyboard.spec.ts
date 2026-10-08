import { test, expect, type Page } from "@playwright/test";
import {
  ALL_ANCHORS,
  restingLeft,
  restingTop,
  type AnchorId,
} from "../src/anchors";

/**
 * anchor-keyboard.spec.ts — acceptance gate for P0 item 3
 * (docs/plans/a11y-web-standards.md, ledger row F12): keyboard users can move
 * the trigger between the 7 anchors, and the move animates like a drag.
 * Runs against example/fixtures/anchor-keyboard.tsx. Written BEFORE the
 * feature: red until it is built. The builder must satisfy this file exactly.
 *
 * KEY MAP (physical; RTL identical). Focus on the trigger, draggable, closed:
 *
 *   anchor         ArrowLeft      ArrowRight     ArrowUp        ArrowDown
 *   top-left       -              top-center     -              bottom-left
 *   top-center     top-left       top-right      -              center
 *   top-right      top-center     -              -              bottom-right
 *   center         -              -              top-center     bottom-center
 *   bottom-left    -              bottom-center  top-left       -
 *   bottom-center  bottom-left    bottom-right   center         -
 *   bottom-right   bottom-center  -              top-right      -
 *
 *   "-" = no move: anchor unchanged, no onAnchorChange, status untouched.
 *
 * - While active (focus on the trigger, draggable, closed) EVERY arrow key is
 *   preventDefault()ed, including the "-" no-ops. Otherwise (draggable={false},
 *   or sheet open) arrows are not handled and not prevented.
 * - Each real move: anchor changes, onAnchorChange(newAnchor) fires exactly
 *   once, and the single role="status" element inside Root reads
 *   `Moved to ${anchor with "-" replaced by " "}.`, e.g. "Moved to bottom
 *   right." and "Moved to center.". It is visually hidden (<= 1px box) but not
 *   display:none / visibility:hidden. Drags never write to it.
 * - useVistaSheet().setAnchor(a) animates identically (spring, never a jump),
 *   fires onAnchorChange, and announces the same text.
 * - Root `anchorAnnouncement?: (a) => string | false` replaces the text;
 *   `false` writes nothing (text stays empty). Moves and onAnchorChange are
 *   unaffected.
 * - Through every move the trigger-root wrapper, trigger-surface and shadow
 *   centres agree within CENTER_OFFSET_PX on every sampled frame (shadow
 *   allowed its existing one-frame lag, see the constant below). The move is
 *   a spring (>= 4 in-flight frames, no single frame covering half the
 *   distance); the existing drag-release snap currently fails that, because
 *   the anchor layout effect jumps x/y (F12). Under reducedMotion: 'reduce'
 *   the trigger seats directly: no in-flight frame.
 */

const ROOT = '[data-vista-sheet-root="kb"] ';
const WRAPPER = `${ROOT}[data-vista-sheet-part="trigger-root"]`;
const SURFACE = `${ROOT}[data-vista-sheet-part="trigger-surface"]`;
const SHADOW = `${ROOT}[data-vista-sheet-part="shadow"]`;
const STATUS = `${ROOT}[role="status"]`;
const TRIGGER_LABEL = "Move fixture trigger";

// Same bound as geometry.spec.ts's CENTER_CENTER_OFFSET_PX (the shadow vs
// surface centre check in the center-anchor (s) test); not exported there.
//
// Measured on the existing drag-release spring (no builder code involved):
// <Shadow> follows a translating trigger one animation frame late (shadow x
// equals the surface x of the PREVIOUS frame, up to ~18px behind mid-spring).
// So the shadow is compared against the surface at the same frame or the
// frame before, whichever is closer; wrapper vs surface (parent/child) is
// compared at the same frame. A shadow left at the old anchor, or jumping
// ahead, still fails. A build that removes the lag only makes this easier.
const CENTER_OFFSET_PX = 2;
// A seated trigger sits within a pixel of restingLeft/restingTop.
const SEAT_EPS = 1;

type Key = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
const KEYS: Key[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

const KEY_MAP: Record<AnchorId, Record<Key, AnchorId | null>> = {
  "top-left": {
    ArrowLeft: null,
    ArrowRight: "top-center",
    ArrowUp: null,
    ArrowDown: "bottom-left",
  },
  "top-center": {
    ArrowLeft: "top-left",
    ArrowRight: "top-right",
    ArrowUp: null,
    ArrowDown: "center",
  },
  "top-right": {
    ArrowLeft: "top-center",
    ArrowRight: null,
    ArrowUp: null,
    ArrowDown: "bottom-right",
  },
  center: {
    ArrowLeft: null,
    ArrowRight: null,
    ArrowUp: "top-center",
    ArrowDown: "bottom-center",
  },
  "bottom-left": {
    ArrowLeft: null,
    ArrowRight: "bottom-center",
    ArrowUp: "top-left",
    ArrowDown: null,
  },
  "bottom-center": {
    ArrowLeft: "bottom-left",
    ArrowRight: "bottom-right",
    ArrowUp: "center",
    ArrowDown: null,
  },
  "bottom-right": {
    ArrowLeft: "bottom-center",
    ArrowRight: null,
    ArrowUp: "top-right",
    ArrowDown: null,
  },
};

const announcement = (a: AnchorId) => `Moved to ${a.replace("-", " ")}.`;

async function load(
  page: Page,
  query: Record<string, string> = {},
  reduced = false,
): Promise<void> {
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  const qs = new URLSearchParams(query).toString();
  await page.goto(`/fixtures/anchor-keyboard.html${qs ? `?${qs}` : ""}`);
  await page.waitForSelector(WRAPPER);
  await page.waitForSelector(SURFACE);
  await page.waitForSelector(SHADOW);
  await expect(page.getByTestId("anchor-readout")).toHaveText(
    query.anchor ?? "bottom-center",
  );
  // Let first-mount sizing settle.
  await page.waitForTimeout(400);
}

const trigger = (page: Page) =>
  page.getByRole("button", { name: TRIGGER_LABEL });
const readout = (page: Page) => page.getByTestId("anchor-readout");
const changes = (page: Page) => page.evaluate(() => window.__anchorChanges);
const statusText = (page: Page) =>
  page.locator(STATUS).evaluate((el) => (el.textContent ?? "").trim());

/** The wrapper's resting box must equal the anchor's seat (anchors.ts). */
async function expectSeated(page: Page, anchor: AnchorId): Promise<void> {
  await expect(async () => {
    const r = await page.evaluate((sel) => {
      const b = document.querySelector(sel)!.getBoundingClientRect();
      return {
        left: b.left,
        top: b.top,
        w: b.width,
        h: b.height,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    }, WRAPPER);
    expect(Math.abs(r.left - restingLeft(anchor, r.vw, r.w))).toBeLessThan(
      SEAT_EPS,
    );
    expect(Math.abs(r.top - restingTop(anchor, r.vh, r.h))).toBeLessThan(
      SEAT_EPS,
    );
  }).toPass({ timeout: 4000 });
}

/** Record every keydown's defaultPrevented at document bubble phase (after
 * React's handlers have run). */
async function recordPrevented(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __prevented: boolean[] };
    w.__prevented = [];
    document.addEventListener("keydown", (e) =>
      w.__prevented.push(e.defaultPrevented),
    );
  });
}
const prevented = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __prevented: boolean[] }).__prevented,
  );

interface Point {
  x: number;
  y: number;
}
interface Frame {
  wrapper: Point;
  surface: Point;
  shadow: Point;
}

async function startSampling(page: Page): Promise<void> {
  await page.evaluate(
    ({ w, s, sh }) => {
      type P = { x: number; y: number };
      type F = { wrapper: P; surface: P; shadow: P };
      const win = window as unknown as {
        __frames: F[];
        __sampling: boolean;
      };
      win.__frames = [];
      win.__sampling = true;
      const centre = (sel: string): P | null => {
        const b = document.querySelector(sel)?.getBoundingClientRect();
        return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
      };
      const tick = () => {
        if (!win.__sampling) return;
        const wrapper = centre(w);
        const surface = centre(s);
        const shadow = centre(sh);
        if (wrapper && surface && shadow)
          win.__frames.push({ wrapper, surface, shadow });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { w: WRAPPER, s: SURFACE, sh: SHADOW },
  );
}

async function stopSampling(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const win = window as unknown as {
      __frames: Frame[];
      __sampling: boolean;
    };
    win.__sampling = false;
    return win.__frames;
  });
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Worst centre disagreement over a run: wrapper vs surface at the same
 * frame; shadow vs surface at the same or the previous frame (see
 * CENTER_OFFSET_PX for why one frame of shadow lag is allowed). */
function centreErrors(frames: Frame[]) {
  let wrapperSurface = 0;
  let shadowSurface = 0;
  frames.forEach((f, i) => {
    wrapperSurface = Math.max(wrapperSurface, dist(f.wrapper, f.surface));
    const prev = frames[Math.max(0, i - 1)];
    shadowSurface = Math.max(
      shadowSurface,
      Math.min(dist(f.shadow, f.surface), dist(f.shadow, prev.surface)),
    );
  });
  return { wrapperSurface, shadowSurface };
}

/** Analyse a frame run that spans one move (first frame at rest before it,
 * last frame at rest after it). */
function analyse(frames: Frame[]) {
  const first = frames[0].wrapper;
  const last = frames[frames.length - 1].wrapper;
  const total = dist(first, last);
  let intermediate = 0;
  let maxStep = 0;
  frames.forEach((f, i) => {
    if (dist(f.wrapper, first) > 4 && dist(f.wrapper, last) > 4) intermediate++;
    if (i > 0)
      maxStep = Math.max(maxStep, dist(f.wrapper, frames[i - 1].wrapper));
  });
  return { total, ...centreErrors(frames), intermediate, maxStep };
}

test.describe("P0-3 keyboard anchor moves: key map", () => {
  for (const from of ALL_ANCHORS) {
    for (const key of KEYS) {
      const to = KEY_MAP[from][key];
      test(`${from} + ${key} -> ${to ?? "no move"}`, async ({ page }) => {
        await load(page, { anchor: from });
        await recordPrevented(page);
        await trigger(page).focus();
        await page.keyboard.press(key);
        if (to) {
          await expect(readout(page)).toHaveText(to);
          await expectSeated(page, to);
          expect(await changes(page)).toEqual([to]);
        } else {
          await page.waitForTimeout(300);
          await expect(readout(page)).toHaveText(from);
          await expectSeated(page, from);
          expect(await changes(page)).toEqual([]);
          expect(await statusText(page)).toBe("");
        }
        // Every arrow is consumed while the feature is active, no-ops too.
        expect(await prevented(page)).toEqual([true]);
      });
    }
  }

  test("all 7 anchors are reachable by arrows, one onAnchorChange each", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" });
    await trigger(page).focus();
    const walk: [Key, AnchorId][] = [
      ["ArrowLeft", "bottom-left"],
      ["ArrowUp", "top-left"],
      ["ArrowRight", "top-center"],
      ["ArrowRight", "top-right"],
      ["ArrowDown", "bottom-right"],
      ["ArrowLeft", "bottom-center"],
      ["ArrowUp", "center"],
    ];
    const visited = new Set<AnchorId>(["bottom-center"]);
    for (const [key, to] of walk) {
      await page.keyboard.press(key);
      await expect(readout(page)).toHaveText(to);
      await expectSeated(page, to);
      visited.add(to);
    }
    expect([...visited].sort()).toEqual([...ALL_ANCHORS].sort());
    expect(await changes(page)).toEqual(walk.map(([, to]) => to));
  });

  test("RTL: arrows are physical (Right still moves right)", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center", rtl: "1" });
    await trigger(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toHaveText("bottom-right");
    await page.keyboard.press("ArrowLeft");
    await expect(readout(page)).toHaveText("bottom-center");
    await page.keyboard.press("ArrowLeft");
    await expect(readout(page)).toHaveText("bottom-left");
    await expectSeated(page, "bottom-left");
  });
});

test.describe("P0-3 keyboard anchor moves: when inactive", () => {
  test("draggable={false}: arrows do nothing and are not prevented", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center", draggable: "0" });
    await recordPrevented(page);
    await trigger(page).focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
    await expect(readout(page)).toHaveText("bottom-center");
    await expectSeated(page, "bottom-center");
    expect(await changes(page)).toEqual([]);
    expect(await statusText(page)).toBe("");
    expect(await prevented(page)).toEqual([false, false]);
  });

  test("sheet open: arrows (on the trigger or anywhere) do nothing", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" });
    await trigger(page).click();
    await page.waitForSelector(
      `${ROOT}[data-vista-sheet-part="sheet"][data-vista-sheet-settled]`,
    );
    await recordPrevented(page);
    // Focus is inside the sheet; the page behind it is inert.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    // And a keydown delivered straight to the trigger button: the handler
    // itself must refuse while open, whether or not inert would have stopped
    // real focus getting there.
    await page.evaluate((sel) => {
      document.querySelector(sel)!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
          cancelable: true,
        }),
      );
    }, `${ROOT}[data-vista-sheet-part="trigger"]`);
    await page.waitForTimeout(300);
    await expect(readout(page)).toHaveText("bottom-center");
    expect(await changes(page)).toEqual([]);
    expect(await statusText(page)).toBe("");
    // The synthetic event reaches the trigger's handler; it must not be consumed.
    expect((await prevented(page)).at(-1)).toBe(false);
    await page.keyboard.press("Escape");
    await expect(
      page.locator(`${ROOT}[data-vista-sheet-part="sheet"]`),
    ).toHaveCount(0);
    await expectSeated(page, "bottom-center");
  });
});

test.describe("P0-3 live announcement", () => {
  test("status is one visually hidden role=status inside Root, empty at rest", async ({
    page,
  }) => {
    await load(page);
    await expect(page.locator(STATUS)).toHaveCount(1);
    expect(await statusText(page)).toBe("");
    const box = await page.locator(STATUS).evaluate((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: b.width,
        h: b.height,
        display: cs.display,
        visibility: cs.visibility,
      };
    });
    expect(box.w).toBeLessThanOrEqual(1);
    expect(box.h).toBeLessThanOrEqual(1);
    expect(box.display).not.toBe("none");
    expect(box.visibility).toBe("visible");
  });

  test("keyboard move writes 'Moved to bottom right.'", async ({ page }) => {
    await load(page, { anchor: "bottom-center" });
    await trigger(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(STATUS)).toHaveText("Moved to bottom right.");
  });

  test("center reads 'Moved to center.'", async ({ page }) => {
    await load(page, { anchor: "bottom-center" });
    await trigger(page).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(STATUS)).toHaveText("Moved to center.");
  });

  test("every anchor's text follows the pattern (via setAnchor)", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" });
    for (const to of ALL_ANCHORS.filter((a) => a !== "bottom-center")) {
      await page.getByTestId(`set-${to}`).click();
      await expect(page.locator(STATUS)).toHaveText(announcement(to));
    }
  });

  test("a drag does not announce (but still fires onAnchorChange)", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" });
    const box = (await page.locator(WRAPPER).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(1280 - 70, 70, { steps: 12 });
    await page.mouse.up();
    await expect(readout(page)).toHaveText("top-right");
    await expectSeated(page, "top-right");
    await page.waitForTimeout(400);
    expect(await changes(page)).toEqual(["top-right"]);
    expect(await statusText(page)).toBe("");
  });

  test("anchorAnnouncement overrides the text", async ({ page }) => {
    await load(page, { anchor: "bottom-center", announce: "custom" });
    await trigger(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(STATUS)).toHaveText(
      "Trigger now at bottom-right",
    );
    await page.getByTestId("set-top-left").click();
    await expect(page.locator(STATUS)).toHaveText("Trigger now at top-left");
  });

  test("anchorAnnouncement returning false writes nothing", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center", announce: "false" });
    await trigger(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toHaveText("bottom-right");
    await page.getByTestId("set-top-left").click();
    await expect(readout(page)).toHaveText("top-left");
    await page.waitForTimeout(300);
    expect(await statusText(page)).toBe("");
    expect(await changes(page)).toEqual(["bottom-right", "top-left"]);
  });
});

test.describe("P0-3 setAnchor (public)", () => {
  test("setAnchor moves, fires onAnchorChange and announces", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" });
    await page.getByTestId("set-top-right").click();
    await expect(readout(page)).toHaveText("top-right");
    await expectSeated(page, "top-right");
    expect(await changes(page)).toEqual(["top-right"]);
    await expect(page.locator(STATUS)).toHaveText("Moved to top right.");
  });
});

test.describe("P0-3 motion and geometry through the move", () => {
  const MOVES: {
    name: string;
    run: (page: Page) => Promise<void>;
    to: AnchorId;
  }[] = [
    {
      name: "keyboard ArrowRight",
      to: "bottom-right",
      run: async (page) => {
        await trigger(page).focus();
        await page.keyboard.press("ArrowRight");
      },
    },
    {
      name: "keyboard ArrowUp (to center)",
      to: "center",
      run: async (page) => {
        await trigger(page).focus();
        await page.keyboard.press("ArrowUp");
      },
    },
    {
      name: "setAnchor(top-left)",
      to: "top-left",
      run: async (page) => {
        await page.getByTestId("set-top-left").click();
      },
    },
  ];

  for (const move of MOVES) {
    test(`${move.name}: springs; wrapper, surface, shadow centres agree every frame`, async ({
      page,
    }) => {
      await load(page, { anchor: "bottom-center" });
      await startSampling(page);
      await page.waitForTimeout(100); // frames at rest, before the move
      await move.run(page);
      await expect(readout(page)).toHaveText(move.to);
      await page.waitForTimeout(1400); // settle, sampled to the end
      const frames = await stopSampling(page);
      await expectSeated(page, move.to);
      const m = analyse(frames);
      console.log(
        `[anchor-keyboard] ${move.name}: total=${m.total.toFixed(0)}px ` +
          `intermediate=${m.intermediate} maxStep=${m.maxStep.toFixed(1)}px ` +
          `wrapper-surface=${m.wrapperSurface.toFixed(2)}px ` +
          `shadow-surface=${m.shadowSurface.toFixed(2)}px`,
      );
      expect(m.total).toBeGreaterThan(100);
      // Animates like a drag snap: several in-flight frames, never one jump.
      expect(m.intermediate).toBeGreaterThanOrEqual(4);
      expect(m.maxStep).toBeLessThan(m.total * 0.5);
      // Through the whole move, not just at rest.
      expect(m.wrapperSurface).toBeLessThan(CENTER_OFFSET_PX);
      expect(m.shadowSurface).toBeLessThan(CENTER_OFFSET_PX);
    });
  }

  test("reducedMotion: 'reduce' seats directly (no in-flight frame), keyboard and setAnchor", async ({
    page,
  }) => {
    await load(page, { anchor: "bottom-center" }, true);
    await startSampling(page);
    await page.waitForTimeout(100);
    await trigger(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout(page)).toHaveText("bottom-right");
    await page.waitForTimeout(300);
    await page.getByTestId("set-top-left").click();
    await expect(readout(page)).toHaveText("top-left");
    await page.waitForTimeout(600);
    const frames = await stopSampling(page);
    await expectSeated(page, "top-left");
    // Three rest positions in the run (bottom-center, bottom-right, top-left):
    // every frame must sit on one of them.
    const rest = [
      frames[0].wrapper,
      frames.find((f) => Math.abs(f.wrapper.x - frames[0].wrapper.x) > 100)!
        .wrapper,
      frames[frames.length - 1].wrapper,
    ];
    const inFlight = frames.filter((f) =>
      rest.every((r) => dist(f.wrapper, r) > 4),
    );
    expect(inFlight).toHaveLength(0);
    const c = centreErrors(frames);
    expect(c.wrapperSurface).toBeLessThan(CENTER_OFFSET_PX);
    expect(c.shadowSurface).toBeLessThan(CENTER_OFFSET_PX);
    expect(await changes(page)).toEqual(["bottom-right", "top-left"]);
    await expect(page.locator(STATUS)).toHaveText("Moved to top left.");
  });
});
