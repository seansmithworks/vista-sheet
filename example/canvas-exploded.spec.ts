import { expect, test, type Page } from "@playwright/test";

/**
 * Dissection › Anatomy › Exploded z-stack. The stack is clones of a frozen
 * real specimen, one per measured part: the slab count and the labels must
 * be the specimen's own [data-vista-sheet-part] set, and at gap 0 the stack
 * must composite back to the original specimen.
 */

/** Share of pixels whose largest channel difference exceeds `tol`. */
async function diffRatio(page: Page, a: Buffer, b: Buffer, tol = 8) {
  return page.evaluate(
    async ({ a, b, tol }) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      };
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      let off = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const d = Math.max(
          Math.abs(x.data[i] - y.data[i]),
          Math.abs(x.data[i + 1] - y.data[i + 1]),
          Math.abs(x.data[i + 2] - y.data[i + 2]),
        );
        if (d > tol) off++;
      }
      return off / (x.width * x.height);
    },
    { a: a.toString("base64"), b: b.toString("base64"), tol },
  );
}

test("exploded z-stack: one slab per measured part, labelled by part, flat at gap 0", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/canvas.html?view=dissection");
  const fig = page.locator("[data-exploded]");
  await expect(fig).toHaveAttribute("data-exploded-ready", "", {
    timeout: 30_000,
  });
  await fig.scrollIntoViewIfNeeded();
  const iframe = fig.locator("iframe");
  const frame = (await (await iframe.elementHandle())!.contentFrame())!;

  // The original specimen's parts, read from its own DOM.
  const measured = await frame.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "[data-exploded-original] [data-vista-sheet-part]",
      ),
    ].map((el) =>
      el.dataset.vistaSheetSlot
        ? `${el.dataset.vistaSheetPart}:${el.dataset.vistaSheetSlot}`
        : el.dataset.vistaSheetPart!,
    ),
  );
  expect(measured.length).toBeGreaterThan(4);
  const slabs = await frame.evaluate(
    () => document.querySelectorAll("[data-exploded-slab]").length,
  );
  // One per measured part, plus one: the Shadow is split into its two
  // looks (trigger ::before, sheet ::after).
  expect(slabs, "slab count").toBe(measured.length + 1);

  const labels = await fig
    .locator("[data-exploded-label]")
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.explodedLabel!),
    );
  const names = await fig
    .locator("[data-exploded-label] code:first-of-type")
    .allTextContents();
  expect([...labels].sort(), "labels are the part names").toEqual(
    [...measured, "shadow"].sort(),
  );
  expect(names, "both Shadow looks").toEqual(
    expect.arrayContaining([
      "shadow · trigger (::before)",
      "shadow · sheet (::after)",
    ]),
  );
  // The Shadow's sub-slabs are bare: no frost, no fill, each showing only
  // its own pseudo-element.
  const shadowSlabs = await frame.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-exploded-look]")]
      .filter((e) => e.matches("[data-exploded-slab]"))
      .map((slab) => {
        const look = slab.dataset.explodedLook!;
        const part = slab.querySelector<HTMLElement>(
          `[data-exploded-look="${look}"]`,
        )!;
        return {
          look,
          plane: getComputedStyle(
            slab.querySelector("[data-exploded-outline]")!,
          ).backgroundColor,
          fill: getComputedStyle(part).backgroundColor,
          before: getComputedStyle(part, "::before").display,
          after: getComputedStyle(part, "::after").display,
        };
      }),
  );
  expect(shadowSlabs).toEqual([
    {
      look: "before",
      plane: "rgba(0, 0, 0, 0)",
      fill: "rgba(0, 0, 0, 0)",
      before: "block",
      after: "none",
    },
    {
      look: "after",
      plane: "rgba(0, 0, 0, 0)",
      fill: "rgba(0, 0, 0, 0)",
      before: "none",
      after: "block",
    },
  ]);
  // Every row is numbered 1..n from the top layer, and duplicate parts
  // (two Items) get distinct names.
  const numbers = await fig
    .locator("[data-exploded-label]")
    .evaluateAll((els) =>
      els.map((e) => Number((e as HTMLElement).dataset.explodedN)),
    );
  expect(numbers).toEqual(labels.map((_, i) => i + 1));
  expect(new Set(names).size, "distinct names").toBe(names.length);
  expect(
    names.map((n) =>
      n.startsWith("shadow · ") ? "shadow" : n.replace(/ \d+$/, ""),
    ),
  ).toEqual(labels);
  // Tilted, each slab carries its number on the specimen too.
  const badges = await fig
    .locator("[data-exploded-badge]")
    .evaluateAll((els) =>
      els
        .map((e) => Number((e as HTMLElement).dataset.explodedBadge))
        .sort((a, b) => a - b),
    );
  expect(badges).toEqual(numbers);

  // Gap 0: identity stage, so the stack is the specimen. The leader lines
  // are canvas chrome drawn over the frame; keep them out of the pixels.
  await page.addStyleTag({
    content: ".dx-exploded-leaders{visibility:hidden!important}",
  });
  await fig.locator('input[type="range"]').fill("0");
  await expect(fig).toHaveAttribute("data-exploded-gap", "0");
  await page.waitForTimeout(300);
  const showOriginal = (on: boolean) =>
    frame.evaluate((on) => {
      document.querySelector<HTMLElement>(
        "[data-exploded-stage]",
      )!.style.display = on ? "none" : "";
      document.querySelector<HTMLElement>(
        "[data-exploded-original]",
      )!.style.visibility = on ? "visible" : "hidden";
    }, on);
  const pair = async () => {
    await showOriginal(false);
    await page.waitForTimeout(300);
    const stack = await iframe.screenshot();
    await showOriginal(true);
    await page.waitForTimeout(300);
    const original = await iframe.screenshot();
    return diffRatio(page, stack, original);
  };
  // Raw: the only differences are text antialiasing. A clone's Item text
  // sits on a transparent slab (the Sheet's fill is a different slab), so
  // Chromium drops subpixel AA for grayscale.
  const raw = await pair();
  // Item text hidden in both: every other pixel must match.
  await frame.evaluate(() => {
    const s = document.createElement("style");
    s.dataset.test = "";
    s.textContent =
      '[data-vista-sheet-part="item"],[data-vista-sheet-part="item"] *{color:transparent!important}';
    document.head.append(s);
  });
  const masked = await pair();
  await frame.evaluate(() =>
    document.querySelector("style[data-test]")!.remove(),
  );
  console.log(
    `exploded gap-0 diff: ${(raw * 100).toFixed(3)}% of pixels raw, ` +
      `${(masked * 100).toFixed(3)}% with Item text hidden`,
  );
  expect(masked).toBeLessThan(0.0001);
  expect(raw).toBeLessThan(0.02);
  const original = await iframe.screenshot();

  // And the exploded state really moves the slabs apart.
  await showOriginal(false);
  await fig.locator('input[type="range"]').fill("90");
  await page.waitForTimeout(300);
  const exploded = await iframe.screenshot();
  expect(await diffRatio(page, exploded, original)).toBeGreaterThan(0.02);
});
