import { expect, test, type Frame, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FramesManifest } from "./canvas/Dissection";
import {
  CANVAS_TILES,
  DRAG_TILE_ID,
  VIEWPORTS,
  type PlayTile,
} from "./canvas/tiles";
import { getRecipe } from "./play/recipes";
import { PALETTES, type PaletteId } from "./play/state";

/**
 * Canvas coverage: every play tile's live iframe renders the state the tile
 * declares (read from the package's own data attributes, not the config),
 * the Dissection view shows every captured sequence with no broken image,
 * and every tile has a poster. One page load per check, tiles walked in
 * order so the live set (max 8 iframes) slides along with the scroll.
 */

const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const PLAY_TILES = CANVAS_TILES.filter((t): t is PlayTile => t.kind === "play");

/** Which ninth of the viewport a point sits in, named like an AnchorId. */
function anchorOf(cx: number, cy: number, w: number, h: number): string {
  const col = cx < w / 3 ? "left" : cx > (2 * w) / 3 ? "right" : "center";
  const row = cy < h / 3 ? "top" : cy > (2 * h) / 3 ? "bottom" : "center";
  return row === "center" && col === "center" ? "center" : `${row}-${col}`;
}

/** DESIGN.md §3: rectangle trigger height per buttonSize. */
const BUTTON_HEIGHT = { s: 36, m: 44, l: 52 } as const;

/** The disc diameter the tile declares, at its logical viewport width. */
function expectedDisc(tile: PlayTile): number {
  const size = tile.state.triggerSize;
  if (size !== "responsive") return size;
  const w = VIEWPORTS[tile.viewport].width;
  return w >= 1600 ? 144 : w >= 768 ? 128 : 96;
}

async function liveFrame(page: Page, tileId: string): Promise<Frame> {
  const figure = page.locator(`[data-canvas-tile="${tileId}"]`);
  await figure.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const iframe = figure.locator("iframe[data-shown]");
  await expect(iframe).toHaveCount(1, { timeout: 15_000 });
  return (await (await iframe.elementHandle())!.contentFrame())!;
}

test("every play tile renders the state it declares", async ({ page }) => {
  test.setTimeout(PLAY_TILES.length * 6_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html");

  for (const tile of PLAY_TILES) {
    await test.step(tile.id, async () => {
      const frame = await liveFrame(page, tile.id);
      const { state } = tile;
      const open = Boolean(tile.overrides?.defaultOpen);
      const trigger = frame.locator('[data-vista-sheet-part="trigger"]');

      // Shape and button size, from the package's own attributes.
      await expect(trigger).toHaveAttribute("data-vista-sheet-shape", state.shape);
      if (state.shape === "rectangle") {
        await expect(trigger).toHaveAttribute(
          "data-vista-sheet-button-size",
          state.buttonSize,
        );
      } else {
        await expect(trigger).not.toHaveAttribute("data-vista-sheet-button-size");
      }
      // Open state.
      await expect(frame.locator('[data-vista-sheet-part="sheet"]')).toHaveCount(
        open ? 1 : 0,
      );
      // Recipe: each recipe's trigger carries its own accessible name.
      await expect(trigger).toHaveAttribute(
        "aria-label",
        getRecipe(state.recipe).triggerLabel,
      );

      const palette = PALETTES[state.palette as PaletteId];
      const m = await frame.evaluate(
        ({ surface, elevated, ground }) => {
          const q = (part: string) =>
            document.querySelector<HTMLElement>(`[data-vista-sheet-part="${part}"]`);
          // Normalise a CSS colour the way the browser computes it.
          const probe = document.createElement("div");
          document.body.append(probe);
          const norm = (c: string) => {
            probe.style.backgroundColor = c;
            return getComputedStyle(probe).backgroundColor;
          };
          const root = q("trigger-root")!.getBoundingClientRect();
          const sheet = q("sheet");
          const surfaceEl = q("trigger-surface");
          const out = {
            vw: innerWidth,
            vh: innerHeight,
            cx: root.left + root.width / 2,
            cy: root.top + root.height / 2,
            w: root.width,
            h: root.height,
            userSelect: getComputedStyle(q("trigger-root")!).userSelect,
            body: getComputedStyle(document.body).backgroundColor,
            ground: norm(ground),
            surfaceSeen: surfaceEl
              ? getComputedStyle(surfaceEl).backgroundColor
              : null,
            surface: norm(surface),
            sheetSeen: sheet ? getComputedStyle(sheet).backgroundColor : null,
            elevated: norm(elevated),
            sheetW: sheet?.offsetWidth ?? null,
            sheetH: sheet?.offsetHeight ?? null,
          };
          probe.remove();
          return out;
        },
        { surface: palette.surface, elevated: palette.surfaceElevated, ground: palette.ground },
      );

      // Anchor: the trigger sits in the declared ninth of the viewport.
      expect(anchorOf(m.cx, m.cy, m.vw, m.vh), "anchor").toBe(state.anchor);

      // Trigger size: measured box vs declared size.
      if (state.shape === "rectangle") {
        expect(Math.round(m.h), "button height").toBe(BUTTON_HEIGHT[state.buttonSize]);
        if (state.buttonWidth !== "label") {
          expect(Math.round(m.w), "button width").toBe(state.buttonWidth);
        }
      } else {
        expect(Math.round(m.w), "trigger size").toBe(expectedDisc(tile));
      }

      // Palette: page ground, trigger fill at rest, sheet fill when open.
      expect(m.body, "ground").toBe(m.ground);
      if (open) expect(m.sheetSeen, "sheet fill").toBe(m.elevated);
      else expect(m.surfaceSeen, "trigger fill").toBe(m.surface);

      // Sheet geometry when open.
      if (open) {
        expect(m.sheetW!, "sheet max width").toBeLessThanOrEqual(state.sheetMaxWidth);
        if (tile.section === "geometry" && tile.id.startsWith("geometry-width")) {
          expect(m.sheetW, "sheet width").toBe(state.sheetMaxWidth);
        }
        const ratio = getRecipe(state.recipe).media?.aspectRatio;
        if (ratio) {
          expect(m.sheetW! / m.sheetH!, "sheet aspect ratio").toBeCloseTo(ratio, 1);
        }
      }

      // Drag: only the drag tile's wrapper is drag-enabled (Motion's drag
      // sets user-select: none on it).
      expect(m.userSelect === "none", "draggable").toBe(tile.id === DRAG_TILE_ID);
      expect(state.draggable).toBe(tile.id === DRAG_TILE_ID);
    });
  }
});

test("link-preview page tiles load their host page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html");
  for (const tile of CANVAS_TILES.filter((t) => t.kind === "page")) {
    await test.step(tile.id, async () => {
      const frame = await liveFrame(page, tile.id);
      await expect(frame.locator("a.lp-link").first()).toBeVisible();
      const dark = tile.src.includes("dark=1");
      await expect(frame.locator("body")).toHaveAttribute(
        "data-dark-mode",
        dark ? "true" : "false",
      );
      const lum = await frame.evaluate(() => {
        const [r, g, b] = getComputedStyle(document.body)
          .backgroundColor.match(/[\d.]+/g)!
          .map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      });
      if (dark) expect(lum, "dark ground").toBeLessThan(0.2);
      else expect(lum, "light ground").toBeGreaterThan(0.8);
    });
  }
});

/** Activate a tile (as a user would), click its trigger inside the frame
 * and report how the open ran. */
async function openAndWatch(page: Page, tileId: string) {
  const frame = await liveFrame(page, tileId);
  await page.locator(`[data-canvas-tile="${tileId}"] .cv-activate`).click();
  return frame.evaluate(async () => {
    const t0 = performance.now();
    document
      .querySelector<HTMLElement>('[data-vista-sheet-part="trigger"]')!
      .click();
    let first: { opacity: number; transform: string } | null = null;
    for (;;) {
      await new Promise((r) => requestAnimationFrame(r));
      const sheet = document.querySelector('[data-vista-sheet-part="sheet"]');
      if (sheet && !first) {
        const cs = getComputedStyle(sheet);
        first = { opacity: Number(cs.opacity), transform: cs.transform };
      }
      if (sheet?.hasAttribute("data-vista-sheet-settled")) break;
      if (performance.now() - t0 > 5000) break;
    }
    return { first, settleMs: performance.now() - t0 };
  });
}

test("motion overrides are observable: presets, reduced motion, Esc", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html");

  // Reduced motion: the first painted sheet frame is a fade, not a morph.
  const reduced = await openAndWatch(page, "reduced-motion-basic");
  expect(reduced.first!.opacity).toBeLessThan(1);
  expect(reduced.first!.transform).toBe("none");
  const morph = await openAndWatch(page, "shape-circle");
  expect(morph.first!.opacity).toBe(1);
  expect(morph.first!.transform).not.toBe("none");

  // Presets: same recipe, settle order follows the spring frequency.
  const settle: Record<string, number> = {};
  for (const p of ["snappy", "default", "gentle"]) {
    settle[p] = (await openAndWatch(page, `motion-${p}`)).settleMs;
  }
  expect(settle.snappy).toBeLessThan(settle.default);
  expect(settle.default).toBeLessThan(settle.gentle);

  // Esc dismiss: on an active default-open tile, Esc closes the sheet.
  const frame = await liveFrame(page, "open-basic");
  await page.locator('[data-canvas-tile="open-basic"] .cv-activate').click();
  await expect(frame.locator('[data-vista-sheet-part="sheet"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(frame.locator('[data-vista-sheet-part="sheet"]')).toHaveCount(0);
});

test("dissection renders every captured sequence with no broken image", async ({
  page,
}) => {
  const manifest: FramesManifest = JSON.parse(
    readFileSync(`${PUBLIC}canvas/frames.json`, "utf8"),
  );
  expect(manifest.sequences.length).toBeGreaterThan(0);

  await page.goto("/canvas.html?view=dissection");
  for (const seq of manifest.sequences) {
    const strip = page.locator(`[data-sequence="${seq.id}"] img`);
    await expect(strip).toHaveCount(seq.frames.length);
  }

  const broken = await page.evaluate(async () => {
    const imgs = [
      ...document.querySelectorAll<HTMLImageElement>(".dx-frame img"),
    ];
    const results = await Promise.all(
      imgs.map(async (img) => {
        img.loading = "eager";
        try {
          await img.decode();
        } catch {
          /* counted below */
        }
        return img.naturalWidth > 0 ? null : img.getAttribute("src");
      }),
    );
    return { count: imgs.length, broken: results.filter(Boolean) };
  });
  expect(broken.broken).toEqual([]);
  expect(broken.count).toBe(
    manifest.sequences.reduce((n, s) => n + s.frames.length, 0),
  );

  // The anatomy specimens settle and are measured from their live DOM.
  await expect(page.locator(".dx-legend")).toHaveCount(4, { timeout: 20_000 });
});

test("every tile has a poster", () => {
  const missing = CANVAS_TILES.filter(
    (t) => !existsSync(`${PUBLIC}canvas/posters/${t.id}.png`),
  ).map((t) => t.id);
  expect(missing).toEqual([]);
});
