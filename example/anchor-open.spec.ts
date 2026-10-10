import { test, expect, type Page } from "@playwright/test";
import { restingLeft, restingTop, type AnchorId } from "../src/anchors";

/**
 * anchor-open.spec.ts — useIris().setAnchor while the sheet is open
 * (P0-3 follow-up). The anchor updates and fires onAnchorChange once; the
 * hidden trigger seats directly at the new anchor (no spring); the open
 * sheet holds its placement; Escape's close morph lands on the new seat
 * with the Shadow on it. Fixture: example/fixtures/anchor-open.tsx.
 */

const ROOT = '[data-orrery-iris-root="ao"] ';
const WRAPPER = `${ROOT}[data-orrery-iris-part="trigger-root"]`;
const SURFACE = `${ROOT}[data-orrery-iris-part="trigger-surface"]`;
const SHADOW = `${ROOT}[data-orrery-iris-part="shadow"]`;
const SHEET = `${ROOT}[data-orrery-iris-part="sheet"]`;

type Point = { x: number; y: number };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Centre of the trigger seated at `anchor` (1280x800, 128px trigger). */
async function seatCentre(page: Page, anchor: AnchorId): Promise<Point> {
  return page.evaluate(
    ({ sel, l, t }) => {
      const b = document.querySelector(sel)!.getBoundingClientRect();
      return { x: l + b.width / 2, y: t + b.height / 2 };
    },
    {
      sel: WRAPPER,
      l: restingLeft(anchor, 1280, 128),
      t: restingTop(anchor, 800, 128),
    },
  );
}

async function centre(page: Page, sel: string): Promise<Point> {
  return page.evaluate((s) => {
    const b = document.querySelector(s)!.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, sel);
}

test("setAnchor while open: seats without a spring, sheet holds, close lands on the new seat", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fixtures/anchor-open.html");
  await expect(page.getByTestId("anchor-readout")).toHaveText("bottom-center");
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Open fixture sheet" }).click();
  await page.waitForSelector(`${SHEET}[data-orrery-iris-settled]`);
  await page.waitForTimeout(300);
  const sheetBefore = (await page.locator(SHEET).boundingBox())!;
  const from = await seatCentre(page, "bottom-center");
  const to = await seatCentre(page, "top-right");

  // Sample the hidden trigger's wrapper every frame through the move.
  await page.evaluate((sel) => {
    const w = window as unknown as { __wrap: Point[]; __on: boolean };
    w.__wrap = [];
    w.__on = true;
    const tick = () => {
      if (!w.__on) return;
      const b = document.querySelector(sel)!.getBoundingClientRect();
      w.__wrap.push({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, WRAPPER);
  await page.getByTestId("move-top-right").click();
  await expect(page.getByTestId("anchor-readout")).toHaveText("top-right");
  await page.waitForTimeout(800);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __wrap: Point[]; __on: boolean };
    w.__on = false;
    return w.__wrap;
  });

  expect(await page.evaluate(() => window.__anchorChanges)).toEqual([
    "top-right",
  ]);
  await expect(page.locator(`${ROOT}[role="status"]`)).toHaveText(
    "Moved to top right.",
  );
  // Seated directly: every frame is on the old seat or the new one.
  expect(frames.length).toBeGreaterThan(10);
  expect(
    frames.filter((f) => dist(f, from) > 1 && dist(f, to) > 1),
  ).toHaveLength(0);
  expect(dist(frames[frames.length - 1], to)).toBeLessThan(1);
  // The open sheet does not move.
  const sheetAfter = (await page.locator(SHEET).boundingBox())!;
  expect(Math.abs(sheetAfter.x - sheetBefore.x)).toBeLessThan(1);
  expect(Math.abs(sheetAfter.y - sheetBefore.y)).toBeLessThan(1);

  // The close morph lands on the new seat, with the shadow under it.
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(async () => {
    const s = await centre(page, SURFACE);
    expect(dist(s, to)).toBeLessThan(1);
    expect(dist(await centre(page, SHADOW), s)).toBeLessThan(2);
  }).toPass({ timeout: 3000 });
});
