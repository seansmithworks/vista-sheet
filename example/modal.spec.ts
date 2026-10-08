import { test, expect, type Page } from "@playwright/test";

/**
 * modal.spec.ts — P0-1 (docs/plans/a11y-web-standards.md): while the sheet
 * is open the page behind it is inert (no pointer, no focus), Tab inside the
 * sheet follows the browser's native order and wraps through the focus
 * guards, and live regions outside the sheet stay live. Runs against
 * example/fixtures/modal.tsx.
 */

const TRIGGER_LABEL = "Open modal fixture";
const SHEET = '[data-vista-sheet-part="sheet"]';

async function openSheet(page: Page, query = ""): Promise<void> {
  await page.goto(`/fixtures/modal.html${query}`);
  await page.getByRole("button", { name: TRIGGER_LABEL }).click();
  await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
}

/** Deep focus path: through open shadow roots and same-origin iframes. */
function focusPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    let a: Element | null = document.activeElement;
    while (a) {
      const el = a as HTMLElement;
      parts.push(
        el.dataset.testid ??
          el.getAttribute("data-vista-sheet-part") ??
          el.tagName.toLowerCase(),
      );
      if (el.shadowRoot?.activeElement) a = el.shadowRoot.activeElement;
      else if (el instanceof HTMLIFrameElement)
        a = el.contentDocument?.activeElement ?? null;
      else a = null;
    }
    return parts.join(">");
  });
}

async function tabSequence(
  page: Page,
  key: "Tab" | "Shift+Tab",
  count: number,
): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    seen.push(await focusPath(page));
  }
  return seen;
}

test.describe("P0-1 modal: inert page", () => {
  test("dismissOnBackdrop={false}: a click on a page button does nothing while open", async ({
    page,
  }) => {
    await page.goto("/fixtures/modal.html");
    const button = page.getByTestId("page-button");
    const clicks = page.getByTestId("page-clicks");
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    // Non-vacuous: the same pointer click lands while the sheet is closed.
    await page.mouse.click(x, y);
    await expect(clicks).toHaveText("1");

    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
    // Nothing of the sheet covers the button (it is fixed and stacked above
    // the sheet's layers anyway), so only inert can be stopping the click.
    const sheetBox = await page.locator(SHEET).boundingBox();
    expect(sheetBox).not.toBeNull();
    const overlaps =
      x >= sheetBox!.x &&
      x <= sheetBox!.x + sheetBox!.width &&
      y >= sheetBox!.y &&
      y <= sheetBox!.y + sheetBox!.height;
    expect(overlaps).toBe(false);
    expect(await button.evaluate((el) => el.closest("[inert]") !== null)).toBe(
      true,
    );

    await page.mouse.click(x, y);
    await expect(clicks).toHaveText("1");
    await expect(page.locator(SHEET)).toBeVisible();
    // Focus can't land on the page either: the next Tab reaches a live
    // stop (the kept toast region or the sheet), never the inert page.
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return {
        id: a?.dataset.testid ?? a?.getAttribute("data-vista-sheet-part"),
        inert: a?.closest("[inert]") !== null,
        body: a === document.body,
      };
    });
    expect(landed.inert).toBe(false);
    expect(landed.body).toBe(false);
    expect(landed.id).not.toBe("page-button");
  });

  test("the trigger is released at the close request, not at exit-complete", async ({
    page,
  }) => {
    await openSheet(page);
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await page.keyboard.press("Escape");
    // Same commit as the close request: nothing on the page is inert while
    // the panel is still animating out.
    await expect(page.locator(SHEET)).toBeAttached();
    expect(await page.locator("[inert]").count()).toBe(0);
    await expect(trigger).toBeEnabled();
    await page.locator(SHEET).waitFor({ state: "detached", timeout: 5000 });
    await expect(trigger).toBeFocused();
  });

  test("a toast [aria-live] outside the sheet stays live and clickable", async ({
    page,
  }) => {
    await openSheet(page);
    const toast = page.getByTestId("toast");
    expect(await toast.evaluate((el) => el.closest("[inert]") === null)).toBe(
      true,
    );
    // Its ancestor-siblings of the Root went inert around it.
    expect(
      await page.locator("header").evaluate((el) => el.closest("[inert]")),
    ).not.toBeNull();

    await page.getByTestId("save").click();
    await expect(page.getByTestId("toast-text")).toHaveText("Saved");

    await page.getByTestId("toast-undo").click();
    await expect(page.getByTestId("toast-undos")).toHaveText("1");
    await expect(page.locator(SHEET)).toBeVisible();
  });
});

test.describe("P0-1 modal: native Tab order", () => {
  test("radio group, <details> and shadow-root Tab order matches native and wraps both ways", async ({
    page,
  }) => {
    await openSheet(page);
    // Native: one stop for the radio group (the checked radio), the closed
    // <details> link skipped, the shadow-root input reached through its
    // host. Then the end guard wraps to the first stop.
    expect(await tabSequence(page, "Tab", 7)).toEqual([
      "close",
      "radio-medium",
      "summary",
      "save",
      "listbox-button",
      "shadow-host>shadow-input",
      "close",
    ]);
    // And the start guard wraps the other way, into the shadow root.
    expect(await tabSequence(page, "Shift+Tab", 7)).toEqual([
      "shadow-host>shadow-input",
      "listbox-button",
      "save",
      "summary",
      "radio-medium",
      "close",
      "shadow-host>shadow-input",
    ]);
  });

  test("Shift+Tab from the panel itself wraps to the last stop, not out of the sheet", async ({
    page,
  }) => {
    await openSheet(page);
    await expect(page.locator(SHEET)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    expect(await focusPath(page)).toBe("shadow-host>shadow-input");
  });

  test("an iframe in the sheet can't take focus out", async ({ page }) => {
    await openSheet(page, "?iframe");
    await page.getByTestId("listbox-button").focus();
    await page.keyboard.press("Tab");
    expect(await focusPath(page)).toBe("iframe>iframe-button");

    // Tab off the frame's last control: crosses documents (relatedTarget
    // null) and must wrap to the sheet's first stop, not leave the panel or
    // bounce back into the frame.
    await page.keyboard.press("Tab");
    expect(await focusPath(page)).toBe("close");
  });

  test("a listbox portaled to <body> from inside the sheet stays Tab-navigable", async ({
    page,
  }) => {
    await openSheet(page);
    await page.getByTestId("listbox-button").click();
    const listbox = page.getByTestId("listbox");
    await expect(listbox).toBeVisible();
    expect(await listbox.evaluate((el) => el.closest("[inert]") === null)).toBe(
      true,
    );

    await page.getByTestId("option-apple").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("option-pear")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("option-plum")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByTestId("option-pear")).toBeFocused();
  });
});

test.describe("P0-2 Escape: top layer only, never interrupts typing", () => {
  const closeSheet = '[data-vista-sheet-part="sheet"][aria-labelledby]';
  // The exit animation keeps a closing panel mounted, so a mounted panel
  // doesn't prove "still open". The page leaves inert at the close request,
  // so inert present means the sheet was never asked to close.
  const stillOpen = (page: Page) =>
    page.evaluate(() => document.querySelectorAll("[inert]").length > 0);

  test("a preview card inside the sheet takes two Escapes: the card, then the sheet", async ({
    page,
  }) => {
    await openSheet(page, "?preview");
    await page.getByTestId("preview-link").hover();
    const card = page.getByTestId("preview-card");
    await expect(card).toBeVisible();
    await page.waitForSelector(
      '[aria-label="Preview card"][data-vista-sheet-settled]',
    );

    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    // The sheet is still open after the first Escape.
    await page.waitForTimeout(300);
    expect(await stillOpen(page)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator(closeSheet)).toHaveCount(0);
  });

  for (const [name, init] of [
    ["isComposing", { key: "Escape", isComposing: true }],
    ["keyCode 229", { key: "Escape", keyCode: 229 }],
  ] as const) {
    test(`an Escape during IME composition (${name}) does not close the sheet`, async ({
      page,
    }) => {
      await openSheet(page);
      await page.evaluate((i) => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", {
            ...i,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, init);
      await page.waitForTimeout(400);
      expect(await stillOpen(page)).toBe(true);
      // Non-vacuous: a plain Escape still closes it.
      await page.keyboard.press("Escape");
      await expect(page.locator(closeSheet)).toHaveCount(0);
    });
  }

  test("a listbox that calls preventDefault on Escape keeps the sheet open", async ({
    page,
  }) => {
    await openSheet(page);
    await page.getByTestId("listbox-button").click();
    await page.getByTestId("option-apple").focus();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("listbox")).toHaveCount(0);
    await page.waitForTimeout(400);
    expect(await stillOpen(page)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator(closeSheet)).toHaveCount(0);
  });
});

test.describe("P0-1 review fixes", () => {
  const inertCount = (page: Page) =>
    page.evaluate(() => document.querySelectorAll("[inert]").length);

  test("stacked modals: the page stays inert until the second sheet closes too", async ({
    page,
  }) => {
    await openSheet(page, "?two");
    expect(await inertCount(page)).toBeGreaterThan(0);

    // Open the second sheet from inside the first.
    await page.getByTestId("open-second").click();
    await page.waitForSelector(
      '[aria-labelledby="second-sheet-title"][data-vista-sheet-settled]',
    );

    // Close the FIRST sheet (its Close button is inert under the second, so
    // drive its Root's state the way a consumer would: the page button path
    // is closed, so use the first sheet's own Close via script).
    await page.evaluate(() => {
      const first = document.querySelector<HTMLElement>(
        '[aria-labelledby="modal-sheet-title"]',
      );
      first?.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
    });
    await expect(
      page.locator('[aria-labelledby="modal-sheet-title"]'),
    ).toHaveCount(0);
    // The second is still open: the page must still be inert.
    await expect(
      page.locator('[aria-labelledby="second-sheet-title"]'),
    ).toHaveCount(1);
    expect(await inertCount(page)).toBeGreaterThan(0);
    const clicks = page.getByTestId("page-clicks");
    const box = (await page.getByTestId("page-button").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(clicks).toHaveText("0");

    await page.getByRole("button", { name: "Close second" }).click();
    await expect(
      page.locator('[aria-labelledby="second-sheet-title"]'),
    ).toHaveCount(0);
    await expect.poll(() => inertCount(page)).toBe(0);
  });

  test("a node the page itself made inert stays inert after the sheet closes", async ({
    page,
  }) => {
    await page.goto("/fixtures/modal.html");
    await page.evaluate(() =>
      document.querySelector("header")?.setAttribute("inert", ""),
    );
    await page.getByRole("button", { name: TRIGGER_LABEL }).click();
    await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect.poll(() => inertCount(page)).toBe(1);
    expect(
      await page.evaluate(() =>
        document.querySelector("header")?.hasAttribute("inert"),
      ),
    ).toBe(true);
  });

  test("a stale iframe marker doesn't misroute a later guard entry from outside the page", async ({
    page,
  }) => {
    await openSheet(page, "?iframe");
    await page.getByTestId("listbox-button").focus();
    await page.keyboard.press("Tab");
    expect(await focusPath(page)).toBe("iframe>iframe-button");

    // Click back into a panel button: the iframe visit is over.
    await page.getByTestId("save").click();
    await expect(page.getByTestId("save")).toBeFocused();

    // Enter the start guard from nowhere (relatedTarget null), as tabbing in
    // from browser chrome does. It must land on the FIRST stop.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document
        .querySelector<HTMLElement>("[data-vista-sheet-focus-guard]")
        ?.focus();
    });
    expect(await focusPath(page)).toBe("close");
  });
});
