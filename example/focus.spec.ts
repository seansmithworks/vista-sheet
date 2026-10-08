import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * focus.spec.ts — N2 (wave.md "### N2"): the Tab trap owns every focusable
 * control (form fields included, disabled/hidden excluded), the panel holds
 * initial focus by default and `Sheet initialFocus` is the opt-in escape
 * hatch (Search and Chat's recipes emit it — see the "search recipe:"
 * describe block below, which drives the real playground/recipe path), and
 * the trap/scroll-lock/aria-hiding all outlive `open` through the close
 * animation. Runs against example/fixtures/focus.tsx — a fixture built
 * specifically so its tab order can't be discovered from the trap's own
 * selector (see the comment on the fixture's trailing <input>).
 */

const TRIGGER_LABEL = "Open focus fixture";
const CLOSE_LABEL = "Close";

async function openFixture(
  page: Page,
  { initialFocus = false }: { initialFocus?: boolean } = {},
): Promise<Locator> {
  await page.goto(
    initialFocus ? "/fixtures/focus.html?initialFocus" : "/fixtures/focus.html",
  );
  await page.getByRole("button", { name: TRIGGER_LABEL }).click();
  const sheet = page.locator('[data-wicket-iris-part="sheet"]');
  await sheet.waitFor();
  return sheet;
}

async function waitForSettle(page: Page, sheet: Locator): Promise<void> {
  await sheet.waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-wicket-iris-part="sheet"]');
    return el?.hasAttribute("data-wicket-iris-settled") ?? false;
  });
}

test.describe("N2 focus model", () => {
  test("initial focus: without an initialFocus prop, the panel keeps focus at settle, not any control", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    // The opt-in default (wave.md: "The panel gets focus at the open
    // commit... skipped if focus is already inside") — no auto-focus onto
    // the first text-entry control or anything else.
    await expect(sheet).toBeFocused();
    await expect(sheet.getByTestId("field-textarea")).not.toBeFocused();
  });

  test("initialFocus prop: a sheet with the prop settles focus on that target control, not the first one", async ({
    page,
  }) => {
    const sheet = await openFixture(page, { initialFocus: true });
    await waitForSettle(page, sheet);

    // The fixture points initialFocus at field-input, the LAST control in
    // tab order — proves the prop targets whatever ref it's given, not
    // coincidentally the first tabbable (which is field-textarea, per the
    // traversal test below).
    await expect(sheet.getByTestId("field-input")).toBeFocused();
  });

  test("Tab and Shift+Tab visit every visible enabled control in DOM order and wrap, never leaving the panel", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    const close = sheet.getByRole("button", { name: CLOSE_LABEL });
    const content = sheet.locator('[data-wicket-iris-part="content"]');
    const textarea = sheet.getByTestId("field-textarea");
    const select = sheet.getByTestId("field-select");
    const input = sheet.getByTestId("field-input");

    // Settle leaves focus on the panel itself (no initialFocus prop here).
    await expect(sheet).toBeFocused();

    // DOM order: Close, then Content (tabbable while it overflows), then
    // the fields inside it. The disabled button and the display:none link
    // sit between select and input in the DOM (see the fixture) — Tab from
    // select must skip both and land on input directly, not stop on either.
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(content).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(textarea).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(select).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();

    // Wraps past the end of the sequence back to the start.
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    // Shift+Tab reverses the exact same sequence.
    await page.keyboard.press("Shift+Tab");
    await expect(input).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(select).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(textarea).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(content).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();

    // Shift+Tab from the first control wraps to the last.
    await page.keyboard.press("Shift+Tab");
    await expect(input).toBeFocused();
  });

  test("Close reveals immediately on keyboard focus, even before the open spring settles", async ({
    page,
  }) => {
    await page.goto("/fixtures/focus.html");
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    const sheet = page.locator('[data-wicket-iris-part="sheet"]');
    await sheet.waitFor();

    // This only exercises the intended race if the open hasn't already
    // settled by the time we get here — data-wicket-iris-settled flips at
    // the exact same collapseProgress threshold Close's own natural reveal
    // uses, so if it's already present the settle-triggered reveal and a
    // focus-triggered reveal are indistinguishable and this assertion
    // catches that rather than passing by accident.
    await expect(sheet).not.toHaveAttribute("data-wicket-iris-settled", "");

    const close = sheet.getByRole("button", { name: CLOSE_LABEL });
    // Tab to Close immediately, before waiting for settle — the panel holds
    // focus at the open commit, so a single Tab reaches Close (first in DOM
    // order) while the open spring is very likely still animating.
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    // Still pre-settle: confirm the race window is genuinely still open,
    // then require Close to already be revealing (opacity above 0, not
    // pinned there waiting for the spring) — a check on inline opacity
    // rather than "eventually reaches 1", which any settle-triggered reveal
    // satisfies too and proves nothing about focus.
    await expect(sheet).not.toHaveAttribute("data-wicket-iris-settled", "");
    await expect(async () => {
      const opacity = await close.evaluate((el) =>
        Number(getComputedStyle(el).opacity),
      );
      expect(opacity).toBeGreaterThan(0);
    }).toPass({ timeout: 200 });
  });

  test("PageDown scrolls the content region once it holds focus", async ({
    page,
  }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    const content = sheet.locator('[data-wicket-iris-part="content"]');
    // From the settled panel: Tab -> close -> content.
    await page.keyboard.press("Tab"); // -> close
    await page.keyboard.press("Tab"); // -> content
    await expect(content).toBeFocused();
    await content.evaluate((el) => {
      el.scrollTop = 0;
    });

    await page.keyboard.press("PageDown");
    await expect(async () => {
      const scrollTop = await content.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }).toPass();
  });

  test("a Tab pressed mid-close stays inside the panel", async ({ page }) => {
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    await page.keyboard.press("Escape");
    // Immediately, before the exit animation (and onExitComplete) finish:
    // the trap must still own Tab, because the panel is still on screen.
    await page.keyboard.press("Tab");

    const focusStayedInside = await sheet.evaluate(
      (el) =>
        el.contains(document.activeElement) || el === document.activeElement,
    );
    expect(focusStayedInside).toBe(true);
  });

  test("focus restores to the trigger once the close animation actually completes", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    const sheet = await openFixture(page);
    await waitForSettle(page, sheet);

    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 5000 });

    await expect(trigger).toBeFocused();
  });
});

test.describe("N2 focus model: search recipe (real playground path)", () => {
  test("Search's field is focused after settle", async ({ page }) => {
    // Drives the actual playground page + Search recipe (not a fixture
    // stand-in) — proves recipes.ts + codegen.ts's real wiring, not just
    // useDialogBehavior in isolation.
    await page.goto("/play.html");
    await expect(page.locator("[data-play-shell]")).toBeVisible();
    const frame = page.frameLocator("iframe[data-play-stage]");
    const trigger = frame.locator(
      '[data-wicket-iris-root="specimen"] [data-wicket-iris-part="trigger"]',
    );
    await expect(trigger).toBeVisible();

    await page.getByLabel("Recipe", { exact: true }).selectOption("search");
    await frame
      .getByRole("button", { name: "Open search", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-wicket-iris-root="specimen"] [data-wicket-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    const stageFrame = page.frame({ url: /stage=1/ });
    expect(stageFrame).not.toBeNull();
    if (!stageFrame) return;
    await stageFrame.waitForFunction(() => {
      const el = document.querySelector(
        '[data-wicket-iris-root="specimen"] [data-wicket-iris-part="sheet"]',
      );
      return el?.hasAttribute("data-wicket-iris-settled") ?? false;
    });

    const searchField = frame.getByPlaceholder(
      "Search notes, people and files",
    );
    await expect(searchField).toBeFocused();
  });
});
