import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FramesManifest } from "./canvas/Dissection";
import { FRAME_TICKS } from "./play/clock-lab";
import { TICK_MS } from "./play/virtual-clock";

/**
 * Dissection › Morph sequences › Motion Lab, driven through its UI: the
 * timeline scrubs the live specimen, transport plays it, and a captured
 * strip frame seeks the lab to the moment it was captured — where the
 * live specimen's own collapseProgress matches the capture's.
 */

const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));
const manifest: FramesManifest = JSON.parse(
  readFileSync(`${PUBLIC}canvas/frames.json`, "utf8"),
);

test("Motion Lab: scrub, play, and strip frames seek it", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html?view=dissection");
  const lab = page.locator("[data-motion-lab]");
  await expect(lab.locator("iframe[data-shown]")).toHaveCount(1, {
    timeout: 20_000,
  });
  const t = async () =>
    parseFloat((await lab.locator("[data-lab-t]").textContent())!.slice(1));
  const collapse = async () =>
    parseFloat(
      (await lab.locator(".dx-lab-readout code").nth(1).textContent())!.replace(
        "collapse ",
        "",
      ),
    );

  // Scrub: a click on the timeline at 300ms of its axis.
  const slider = lab.locator('[role="slider"]');
  const total = Number(await slider.getAttribute("aria-valuemax"));
  await slider.scrollIntoViewIfNeeded();
  const svg = lab.locator(".dx-tl-svg").first();
  const box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + (box.width * 300) / total, box.y + 10);
  await expect.poll(t).toBeCloseTo(300, -1);

  // Arrow key: one display frame.
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(t).toBeCloseTo(300 + FRAME_TICKS * TICK_MS, 0);

  // Play at 0.1x: time moves, and slowly.
  await lab.getByRole("radio", { name: "0.1×" }).click();
  await slider.focus();
  await page.keyboard.press("Home");
  await expect.poll(t).toBe(0);
  await lab.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1000);
  await lab.getByRole("button", { name: "Pause" }).click();
  const played = await t();
  expect(played).toBeGreaterThan(40);
  expect(played).toBeLessThan(160);

  // A strip frame: the lab lands on its ms with the capture's progress.
  const seq = manifest.sequences.find((s) => s.id === "morph-circle")!;
  const i = seq.frames.findIndex((f) => f.label === "open 40%");
  const frame = seq.frames[i];
  await page
    .locator(`[data-sequence="morph-circle"] .dx-frame`)
    .nth(i)
    .locator("button")
    .click();
  await expect(lab).toHaveAttribute("data-lab-tile", seq.tileId);
  await expect.poll(t, { timeout: 15_000 }).toBeCloseTo(frame.ms!, -1);
  await expect.poll(collapse).toBeCloseTo(frame.collapse!, 1);
  console.log(
    `strip ${seq.id} "${frame.label}": captured collapse ${frame.collapse!.toFixed(3)} at +${frame.ms}ms, lab ${(await collapse()).toFixed(3)} at +${(await t()).toFixed(1)}ms`,
  );

  // Close scene: the close timeline is the scrubber.
  await lab.getByRole("radio", { name: "Close" }).click();
  await expect(lab.locator(".dx-timeline figcaption")).toHaveText(
    "Close · ms from the click",
  );
});

test("Motion Lab keys keep the canvas's focus and scroll through re-arms", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html?view=dissection");
  const lab = page.locator("[data-motion-lab]");
  await expect(lab.locator("iframe[data-shown]")).toHaveCount(1, {
    timeout: 20_000,
  });
  const t = async () =>
    parseFloat((await lab.locator("[data-lab-t]").textContent())!.slice(1));
  const back = lab.getByRole("button", { name: "Back one frame" });
  await back.scrollIntoViewIfNeeded();
  // Somewhere to step back from.
  await lab.getByRole("button", { name: "Forward one frame" }).click();
  await lab.getByRole("button", { name: "Forward one frame" }).click();
  await lab.getByRole("button", { name: "Forward one frame" }).click();
  await expect.poll(t).toBeGreaterThan(40);
  // Let everything above the lab finish loading first (frozen specimens,
  // lazy captures): their layout shifts move scrollY by scroll anchoring,
  // which is not what this checks.
  await expect(page.locator("[data-exploded-ready]")).toHaveCount(1, {
    timeout: 20_000,
  });
  await expect(page.locator("[data-anatomy] .dx-legend")).toHaveCount(2, {
    timeout: 20_000,
  });
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll<HTMLImageElement>("#anatomy img")].map(
        (img) => {
          img.loading = "eager";
          return img.decode().catch(() => {});
        },
      ),
    ),
  );
  await page.waitForTimeout(500);
  await back.focus();
  const y0 = await page.evaluate(() => scrollY);
  const focused = () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  // Each ← is a backward seek: a re-arm that opens a modal sheet inside.
  for (let i = 0; i < 3; i++) {
    const before = await t();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(t).toBeLessThan(before);
    await page.waitForTimeout(300);
    expect(await focused(), `focus after ← ${i + 1}`).toBe("Back one frame");
  }
  await page.keyboard.press(" ");
  await expect(lab.locator(".dx-lab-play")).toHaveText("Pause");
  await page.keyboard.press(" ");
  await expect(lab.locator(".dx-lab-play")).toHaveText("Play");
  expect(await focused()).toBe("Back one frame");
  expect(await page.evaluate(() => scrollY), "canvas scroll").toBe(y0);
});
