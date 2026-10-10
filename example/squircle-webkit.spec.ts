import { test, expect, type Page } from "@playwright/test";

/**
 * WebKit-only proof of the squircle fallback (P2 task 1). Chromium supports
 * `corner-shape: squircle`; Safari/WebKit does not, so this is the only
 * place the 27.16% fallback radius is actually exercised in a real
 * non-Chromium engine rather than approximated by CSS.supports() being
 * false under a mocked environment. Self-contained on purpose — never
 * imports geometry.spec.ts, which is Chromium-only in this config
 * (playwright.config.ts's `chromium` project ignores this file, and this
 * project only ever runs this file — see the comment there).
 */
const TRIGGER_LABEL = "Open example sheet";

async function gotoSquircle(page: Page) {
  await page.goto("/?shape=squircle");
  await page.waitForSelector(
    '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
  );
}

test.describe("squircle fallback (WebKit)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(wk-squircle) squircle falls back to a 27.16% radius where corner-shape is unsupported", async ({
    page,
  }) => {
    await gotoSquircle(page);

    const supported = await page.evaluate(() =>
      CSS.supports("corner-shape", "squircle"),
    );
    expect(
      supported,
      "precondition: WebKit must not support corner-shape",
    ).toBe(false);

    const shapeAttr = await page
      .locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
      )
      .getAttribute("data-orrery-iris-shape");
    expect(shapeAttr).toBe("squircle");

    await page.waitForTimeout(600);

    const rest = await page.evaluate(() => {
      const surface = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
      ) as HTMLElement | null;
      const shadow = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
      ) as HTMLElement | null;
      const shared = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="shared"][data-orrery-iris-slot="trigger"]',
      ) as HTMLElement | null;
      if (!surface || !shadow || !shared) return null;
      const rect = surface.getBoundingClientRect();
      const sharedStyle = getComputedStyle(shared) as CSSStyleDeclaration & {
        webkitMaskImage?: string;
      };
      return {
        width: rect.width,
        radius: getComputedStyle(surface).borderTopLeftRadius,
        shadowRadius: parseFloat(
          getComputedStyle(shadow).getPropertyValue(
            "--orrery-iris-shadow-radius",
          ),
        ),
        sharedMask:
          sharedStyle.maskImage && sharedStyle.maskImage !== "none"
            ? sharedStyle.maskImage
            : (sharedStyle.webkitMaskImage ?? "none"),
      };
    });
    expect(
      rest,
      "trigger surface/shadow/shared must be mounted",
    ).not.toBeNull();

    const expectedPx = rest!.width * 0.2716;
    const surfacePx = parseFloat(rest!.radius);
    expect(Math.abs(surfacePx - expectedPx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(rest!.shadowRadius - expectedPx)).toBeLessThanOrEqual(0.5);
    expect(rest!.sharedMask).toContain("data:image/svg+xml");

    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1600);

    const restAfterClose = await page.evaluate(() => {
      const surface = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
      ) as HTMLElement | null;
      if (!surface) return null;
      const rect = surface.getBoundingClientRect();
      return {
        width: rect.width,
        inline: (surface.style.borderRadius || "").trim(),
        computed: getComputedStyle(surface).borderTopLeftRadius,
      };
    });
    expect(
      restAfterClose,
      "trigger surface must be mounted after close",
    ).not.toBeNull();

    const expectedPxAfterClose = restAfterClose!.width * 0.2716;
    const computedPx = parseFloat(restAfterClose!.computed);
    expect(Math.abs(computedPx - expectedPxAfterClose)).toBeLessThanOrEqual(
      0.5,
    );
    expect(
      restAfterClose!.inline === "" ||
        Math.abs(parseFloat(restAfterClose!.inline) - expectedPxAfterClose) <=
          0.5,
    ).toBe(true);
  });
});
