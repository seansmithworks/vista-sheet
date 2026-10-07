import { expect, test } from "@playwright/test";
import { MAX_LIVE } from "./canvas/live";

/**
 * Interactive view › Autoplay: motion and behaviour tiles open and close
 * themselves while the toggle is on. It must stay inside the live-iframe
 * cap, stop with the tile off screen, start off for anyone who asks for
 * reduced motion, and never move the canvas's own focus or scroll.
 */

const sheetStates = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-canvas-tile]")]
        .filter((f) => f.querySelector("iframe"))
        .map((f) => [
          f.dataset.canvasTile!,
          Boolean(
            f
              .querySelector("iframe")!
              .contentDocument?.querySelector(
                '[data-vista-sheet-part="sheet"]',
              ),
          ),
        ]),
    ),
  );

test("autoplay cycles live tiles without touching the canvas's focus or scroll", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html#behaviour");
  const toggle = page.getByRole("switch", { name: "Autoplay" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-autoplay]").first()).toBeVisible();

  const y0 = await page.evaluate(() => scrollY);
  const focus0 = await page.evaluate(() => document.activeElement?.tagName);
  // 10s of autoplay, sampled: count every tile's open/close flips.
  const flips = new Map<string, number>();
  let prev = await sheetStates(page);
  let maxFrames = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const now = await sheetStates(page);
    for (const [id, open] of Object.entries(now)) {
      if (id in prev && prev[id] !== open)
        flips.set(id, (flips.get(id) ?? 0) + 1);
    }
    prev = now;
    maxFrames = Math.max(
      maxFrames,
      await page.locator(".cv-frame iframe").count(),
    );
    expect(await page.evaluate(() => scrollY), "canvas scroll").toBe(y0);
    expect(
      await page.evaluate(() => document.activeElement?.tagName),
      "canvas focus",
    ).toBe(focus0);
  }
  console.log(
    `autoplay flips over 10s: ${[...flips].map(([k, n]) => `${k} ${n}`).join(", ")}; max live iframes ${maxFrames}`,
  );
  expect(maxFrames).toBeLessThanOrEqual(MAX_LIVE);
  // The swipe tile dismisses by its drag, not a button.
  expect(flips.get("behaviour-swipe-dismiss") ?? 0).toBeGreaterThanOrEqual(2);
  expect(flips.get("motion-default") ?? 0).toBeGreaterThanOrEqual(2);

  // Off screen: the tile is unmounted, so it can't cycle.
  await page
    .locator("section#shapes")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  const tile = page.locator('[data-canvas-tile="motion-default"]');
  await expect(tile.locator("iframe")).toHaveCount(0);
  await expect(tile).not.toHaveAttribute("data-autoplay");

  // Off: nothing cycles.
  await page
    .locator("section#motion")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("[data-autoplay]")).toHaveCount(0);
});

test("autoplay starts off under prefers-reduced-motion", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/canvas.html#motion");
  await expect(page.getByRole("switch", { name: "Autoplay" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-autoplay]")).toHaveCount(0);
  await ctx.close();
});
