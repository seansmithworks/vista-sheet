import { expect, test, type Page } from "@playwright/test";

/**
 * BACKLOG 39: a <VistaSheet.Root defaultOpen> must render settled at mount —
 * collapseProgress 0, no morph — and stay settled however many times Root
 * re-renders while it mounts. Before the fix the clock's one-shot fallback
 * rAF was cancelled by the first re-render, so the sheet sat at
 * collapseProgress 1 forever: no settled marker, Close at opacity 0, the
 * disc shadow instead of the sheet shadow, initialFocus never moved.
 *
 * Drives the play stage directly (play.html?stage=1 as the top window, so
 * window.parent === window and the stage accepts our own postMessage), and
 * sends the state TWICE so Root re-renders during mount on top of its own
 * internal mount re-renders.
 */
async function mountDefaultOpenSearch(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("message", (e) => {
      if ((e.data as { type?: string })?.type === "vista-sheet-play:ready") {
        (window as unknown as { __stageReady?: boolean }).__stageReady = true;
      }
    });
  });
  await page.goto("/play.html?stage=1");
  await page.waitForFunction(
    () => (window as unknown as { __stageReady?: boolean }).__stageReady,
  );
  await page.evaluate(async () => {
    // A URL the dev server serves, not a path tsc can resolve.
    const stateUrl = "/play/state.ts";
    const { DEFAULT_STATE, applyRecipe } = (await import(
      /* @vite-ignore */ stateUrl
    )) as {
      DEFAULT_STATE: unknown;
      applyRecipe: (state: unknown, id: string) => unknown;
    };
    const message = {
      type: "vista-sheet-play:state",
      state: applyRecipe(DEFAULT_STATE, "search"),
      overrides: { defaultOpen: true },
    };
    window.postMessage(message, location.origin);
    window.postMessage(message, location.origin);
  });
}

function readMountState(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-vista-sheet-part="sheet"]');
    const close = document.querySelector('[data-vista-sheet-part="close"]');
    const shadow = document.querySelector('[data-vista-sheet-part="shadow"]');
    return {
      settled: sheet?.hasAttribute("data-vista-sheet-settled") ?? null,
      closeOpacity: close ? getComputedStyle(close).opacity : null,
      discShadowOpacity: shadow
        ? getComputedStyle(shadow, "::before").opacity
        : null,
      sheetShadowOpacity: shadow
        ? getComputedStyle(shadow, "::after").opacity
        : null,
      focusedPlaceholder:
        document.activeElement?.getAttribute("placeholder") ?? null,
    };
  });
}

test("defaultOpen renders settled: marker, Close, sheet shadow, initialFocus", async ({
  page,
}) => {
  await mountDefaultOpenSearch(page);
  await expect(page.locator('[data-vista-sheet-part="sheet"]')).toBeVisible();
  await expect
    .poll(() => readMountState(page), { timeout: 3000 })
    .toEqual({
      settled: true,
      closeOpacity: "1",
      discShadowOpacity: "0",
      sheetShadowOpacity: "1",
      focusedPlaceholder: "Search notes, people and files",
    });
});

test("defaultOpen sheet closes to the trigger and reopens", async ({
  page,
}) => {
  await mountDefaultOpenSearch(page);
  const sheet = page.locator('[data-vista-sheet-part="sheet"]');
  await expect(sheet).toHaveAttribute("data-vista-sheet-settled", "");
  await page.locator('[data-vista-sheet-part="close"]').click();
  await expect(sheet).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const shadow = document.querySelector(
          '[data-vista-sheet-part="shadow"]',
        );
        return shadow ? getComputedStyle(shadow, "::before").opacity : null;
      }),
    )
    .toBe("1");
  await page.locator('[data-vista-sheet-part="trigger"]').click();
  await expect(sheet).toHaveAttribute("data-vista-sheet-settled", "");
  await expect(page.locator('[data-vista-sheet-part="close"]')).toHaveCSS(
    "opacity",
    "1",
  );
});
