import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FramesManifest } from "./canvas/Dissection";
import { CANVAS_TILES, type PlayTile } from "./canvas/tiles";

/**
 * Canvas coverage: every play tile's live iframe renders the state the tile
 * declares (read from the package's own data attributes, not the config),
 * the Dissection view shows every captured sequence with no broken image,
 * and every tile has a poster. One page load per check, tiles walked in
 * order so the live set (max 8 iframes) slides along with the scroll.
 */

const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const PLAY_TILES = CANVAS_TILES.filter((t): t is PlayTile => t.kind === "play");

test("every play tile renders its declared shape, button size and open state", async ({
  page,
}) => {
  test.setTimeout(PLAY_TILES.length * 6_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html");

  for (const tile of PLAY_TILES) {
    await test.step(tile.id, async () => {
      const figure = page.locator(`[data-canvas-tile="${tile.id}"]`);
      await figure.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const iframe = figure.locator("iframe[data-shown]");
      await expect(iframe).toHaveCount(1, { timeout: 15_000 });
      const frame = await (await iframe.elementHandle())!.contentFrame();
      const trigger = frame!.locator('[data-vista-sheet-part="trigger"]');

      await expect(trigger).toHaveAttribute(
        "data-vista-sheet-shape",
        tile.state.shape,
      );
      if (tile.state.shape === "rectangle") {
        await expect(trigger).toHaveAttribute(
          "data-vista-sheet-button-size",
          tile.state.buttonSize,
        );
      } else {
        await expect(trigger).not.toHaveAttribute(
          "data-vista-sheet-button-size",
        );
      }
      await expect(
        frame!.locator('[data-vista-sheet-part="sheet"]'),
      ).toHaveCount(tile.overrides?.defaultOpen ? 1 : 0);
    });
  }
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
