import { expect, test, type Frame, type Page } from "@playwright/test";

/**
 * Contract spec for example/play.html — the P1 playground page. Written
 * before the page exists (P1 task 1 of 6, tests-only): every test here is
 * expected to fail against the current tree until a later P1 task builds
 * example/play/main.tsx, registers it in example/vite.config.ts, and wires
 * up the panel/sheet + controls + copy tool described below.
 *
 * Vite's SPA fallback serves index.html (200) for a missing /play.html, so
 * gotoPlay() never trusts HTTP status alone — it asserts on
 * [data-play-shell], which only the real page renders.
 */

async function gotoPlay(page: Page) {
  await page.goto("/play.html");
  await expect(page.locator("[data-play-shell]")).toBeVisible();
  const frame = page.frameLocator("iframe[data-play-stage]");
  await expect(
    frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    ),
  ).toBeVisible();
  return frame;
}

/**
 * Tags the stage frame's window, the specimen Root element and its trigger
 * surface with a JS property (never a DOM attribute) so a later remount —
 * which recreates all three — is detectable: the property is simply gone
 * from the new nodes/window.
 */
async function tagStageIdentity(frame: Frame) {
  await frame.evaluate(() => {
    (window as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag = true;
    const root = document.querySelector('[data-orrery-iris-root="specimen"]');
    const surface = document.querySelector(
      '[data-orrery-iris-part="trigger-surface"]',
    );
    if (root)
      (root as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag = true;
    if (surface)
      (surface as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag =
        true;
  });
}

async function stageIdentitySurvives(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => {
    const w = window as unknown as { __vsIdentityTag?: boolean };
    const root = document.querySelector('[data-orrery-iris-root="specimen"]');
    const surface = document.querySelector(
      '[data-orrery-iris-part="trigger-surface"]',
    );
    return !!(
      w.__vsIdentityTag &&
      root &&
      (root as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag &&
      surface &&
      (surface as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag
    );
  });
}

/** Starts an rAF sampler in the stage frame recording the trigger surface's
 * bounding box every frame for `ms`. Kicked off without awaiting so it runs
 * concurrently with the control change that follows. */
function sampleTriggerSurfaceBoxes(frame: Frame, ms: number) {
  return frame.evaluate((duration) => {
    return new Promise<
      Array<{ x: number; y: number; width: number; height: number }>
    >((resolve) => {
      const boxes: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      const start = performance.now();
      function step() {
        const el = document.querySelector(
          '[data-orrery-iris-part="trigger-surface"]',
        );
        if (el) {
          const r = el.getBoundingClientRect();
          boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(step);
        } else {
          resolve(boxes);
        }
      }
      requestAnimationFrame(step);
    });
  }, ms);
}

function expectBoxesStill(
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
) {
  expect(boxes.length).toBeGreaterThan(5);
  const ref = boxes[0];
  for (const b of boxes) {
    expect(Math.abs(b.x - ref.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.y - ref.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.width - ref.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.height - ref.height)).toBeLessThanOrEqual(0.5);
  }
}

/** Records every `orrery-iris-play:anchor` REPORT the shell's top window
 * receives, via addInitScript so the listener attaches before the page's
 * own handler does. Proves a drag settles in exactly one report and a
 * dropdown command (`orrery-iris-play:set-anchor`) never produces one at
 * all — the two feeding back into each other on this channel is what
 * looped forever. */
async function installAnchorMessageRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __anchorMessages: string[] }).__anchorMessages = [];
    window.addEventListener("message", (e) => {
      const data = e.data as { type?: string; anchor?: string } | undefined;
      if (data?.type === "orrery-iris-play:anchor" && data.anchor) {
        (
          window as unknown as { __anchorMessages: string[] }
        ).__anchorMessages.push(data.anchor);
      }
    });
  });
}

function readAnchorMessages(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __anchorMessages: string[] }).__anchorMessages,
  );
}

test.describe("1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("play-ui: desktop loads with a docked panel beside the specimen", async ({
    page,
  }) => {
    await gotoPlay(page);

    const panel = page.locator("[data-play-panel]");
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const iframeBox = await page
      .locator("iframe[data-play-stage]")
      .boundingBox();
    expect(panelBox).not.toBeNull();
    expect(iframeBox).not.toBeNull();
    if (!panelBox || !iframeBox) return;

    expect(panelBox.width).toBeGreaterThanOrEqual(359);
    expect(panelBox.width).toBeLessThanOrEqual(361);

    expect(iframeBox.x + iframeBox.width).toBeLessThanOrEqual(panelBox.x + 0.5);

    expect(iframeBox.width + panelBox.width).toBeGreaterThanOrEqual(1439);
    expect(iframeBox.width + panelBox.width).toBeLessThanOrEqual(1441);
  });

  test("play-ui: desktop controls never cover the specimen", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const panel = page.locator("[data-play-panel]");
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    if (!panelBox) return;

    const anchorSelect = page.getByLabel("Anchor", { exact: true });

    for (const anchor of ["top-right", "bottom-right"]) {
      await anchorSelect.selectOption(anchor);

      const iframeBox = await page
        .locator("iframe[data-play-stage]")
        .boundingBox();
      expect(iframeBox).not.toBeNull();
      if (!iframeBox) continue;

      await expect
        .poll(async () => {
          const trig = await frame
            .locator(
              '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
            )
            .boundingBox();
          if (!trig) return false;
          const mainBox = {
            x: iframeBox.x + trig.x,
            y: iframeBox.y + trig.y,
            width: trig.width,
            height: trig.height,
          };
          const insideIframe =
            mainBox.x >= iframeBox.x - 0.5 &&
            mainBox.y >= iframeBox.y - 0.5 &&
            mainBox.x + mainBox.width <= iframeBox.x + iframeBox.width + 0.5 &&
            mainBox.y + mainBox.height <= iframeBox.y + iframeBox.height + 0.5;
          const intersectsPanel = !(
            mainBox.x + mainBox.width <= panelBox.x ||
            mainBox.x >= panelBox.x + panelBox.width ||
            mainBox.y + mainBox.height <= panelBox.y ||
            mainBox.y >= panelBox.y + panelBox.height
          );
          return insideIframe && !intersectsPanel;
        })
        .toBe(true);

      const trigger = frame.locator(
        '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
      );
      await trigger.click();

      const sheet = frame.locator(
        '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
      );
      await expect(sheet).toBeVisible();

      let previousWidth = -1;
      await expect
        .poll(async () => {
          const box = await sheet.boundingBox();
          const w = box?.width ?? -1;
          const stable = Math.abs(w - previousWidth) < 0.2;
          previousWidth = w;
          return stable;
        })
        .toBe(true);

      const sheetBox = await sheet.boundingBox();
      expect(sheetBox).not.toBeNull();
      if (sheetBox) {
        const mainSheetBox = {
          x: iframeBox.x + sheetBox.x,
          y: iframeBox.y + sheetBox.y,
          width: sheetBox.width,
          height: sheetBox.height,
        };
        expect(mainSheetBox.x).toBeGreaterThanOrEqual(iframeBox.x - 0.5);
        expect(mainSheetBox.y).toBeGreaterThanOrEqual(iframeBox.y - 0.5);
        expect(mainSheetBox.x + mainSheetBox.width).toBeLessThanOrEqual(
          iframeBox.x + iframeBox.width + 0.5,
        );
        expect(mainSheetBox.y + mainSheetBox.height).toBeLessThanOrEqual(
          iframeBox.y + iframeBox.height + 0.5,
        );

        const intersectsPanel = !(
          mainSheetBox.x + mainSheetBox.width <= panelBox.x ||
          mainSheetBox.x >= panelBox.x + panelBox.width ||
          mainSheetBox.y + mainSheetBox.height <= panelBox.y ||
          mainSheetBox.y >= panelBox.y + panelBox.height
        );
        expect(intersectsPanel).toBe(false);
      }

      await frame.getByRole("button", { name: "Close", exact: true }).click();
      await expect(sheet).toHaveCount(0, { timeout: 5000 });
    }
  });

  test("play-ui: desktop shape control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const jsxPane = page.locator('pre[data-play-output="jsx"]');
    await expect(jsxPane).not.toContainText("shape=");

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("data-orrery-iris-shape", "circle");

    await page.getByRole("radio", { name: "Square", exact: true }).check();

    await expect(trigger).toHaveAttribute("data-orrery-iris-shape", "square");
    await expect(jsxPane).toContainText('shape="square"');
  });

  test("play-ui: desktop shape switch applies in place — no specimen remount or entrance replay", async ({
    page,
  }) => {
    await gotoPlay(page);
    const stageFrame = page.frame({ url: /stage=1/ });
    expect(stageFrame).not.toBeNull();
    if (!stageFrame) return;

    await tagStageIdentity(stageFrame);

    const samplerPromise = sampleTriggerSurfaceBoxes(stageFrame, 900);

    const trigger = stageFrame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await page
      .getByRole("radio", { name: "Rounded square", exact: true })
      .check();
    await expect(trigger).toHaveAttribute(
      "data-orrery-iris-shape",
      "rounded-square",
    );

    const boxes = await samplerPromise;
    expectBoxesStill(boxes);

    expect(await stageIdentitySurvives(stageFrame)).toBe(true);
  });

  test("play-ui: desktop trigger size, shadow toggle, anchor change and dismiss toggle apply without remounting the specimen", async ({
    page,
  }) => {
    await gotoPlay(page);
    const stageFrame = page.frame({ url: /stage=1/ });
    expect(stageFrame).not.toBeNull();
    if (!stageFrame) return;

    await tagStageIdentity(stageFrame);

    const trigger = stageFrame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );

    // Trigger size — legitimately glides, so no box-stillness assertion.
    await page.getByLabel("Trigger size", { exact: true }).selectOption("96");
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        return box ? Math.abs(box.height - 96) : Infinity;
      })
      .toBeLessThanOrEqual(0.5);
    expect(await stageIdentitySurvives(stageFrame)).toBe(true);

    // Shadow toggle off then on.
    await page.getByLabel("Shadow", { exact: true }).uncheck();
    await expect(
      stageFrame.locator(
        '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="shadow"]',
      ),
    ).toHaveCount(0);
    expect(await stageIdentitySurvives(stageFrame)).toBe(true);

    await page.getByLabel("Shadow", { exact: true }).check();
    await expect(
      stageFrame.locator(
        '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="shadow"]',
      ),
    ).toHaveCount(1);
    expect(await stageIdentitySurvives(stageFrame)).toBe(true);

    // Anchor change while closed — Sean accepted this jumps, no glide.
    await page.getByLabel("Anchor", { exact: true }).selectOption("top-left");
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        return box ? box.x < 150 && box.y < 150 : false;
      })
      .toBe(true);
    expect(await stageIdentitySurvives(stageFrame)).toBe(true);

    // One dismiss toggle.
    await page.getByLabel("Dismiss on swipe", { exact: true }).uncheck();
    await expect(page.locator('pre[data-play-output="jsx"]')).toContainText(
      "dismissOnSwipe={false}",
    );
    expect(await stageIdentitySurvives(stageFrame)).toBe(true);
  });

  test("play-ui: desktop token control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    await page.getByLabel("Surface", { exact: true }).fill("#ff0000");

    await expect
      .poll(async () =>
        frame
          .locator('[data-orrery-iris-part="trigger-surface"]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(255, 0, 0)");

    const cssPane = page.locator('pre[data-play-output="css"]');
    await expect(cssPane).toContainText("--orrery-iris-surface: #ff0000;");

    const cssPaneText = await cssPane.textContent();
    const styleText = await frame.locator("style[data-play-css]").textContent();
    expect(styleText).toBe(cssPaneText);
  });

  test("play-ui: desktop specimen opens and closes", async ({ page }) => {
    const frame = await gotoPlay(page);
    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 5000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("play-ui: desktop recipe presets swap the specimen", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const jsxPane = page.locator('pre[data-play-output="jsx"]');

    const recipes: Record<string, string> = {
      list: "Open quick actions",
      grid: "Open apps",
      nav: "Open navigation",
      media: "Open Wavelength preview",
    };

    for (const [recipe, label] of Object.entries(recipes)) {
      await page.getByLabel("Recipe", { exact: true }).selectOption(recipe);
      await expect(
        frame.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
      await expect(jsxPane).toContainText(`aria-label="${label}"`);
    }
  });

  test("play-ui: desktop recipe switch while the sheet is open swaps the specimen without errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));

    const frame = await gotoPlay(page);
    const stageFrame = page.frame({ url: /stage=1/ });
    expect(stageFrame).not.toBeNull();
    if (!stageFrame) return;

    await tagStageIdentity(stageFrame);

    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();
    await expect(frame.locator("#vs-sheet-title")).toHaveText("Sheet title");

    // Basic (a circle disc with a shared child) -> Search (a rectangle
    // button trigger with its own icon/text) while the sheet is open —
    // structurally different enough to catch anything the in-place patch
    // (58b0097) missed for the open case specifically.
    await page.getByLabel("Recipe", { exact: true }).selectOption("search");

    await expect(frame.locator("#vs-sheet-title")).toHaveText("Search");
    await expect(
      frame.getByPlaceholder("Search notes, people and files"),
    ).toBeVisible();

    // Root identity only: trigger-surface is gated behind `{!open && ...}`
    // in Trigger.tsx, so it's absent while ANY shape's sheet is open, not
    // just rectangle's — stageIdentitySurvives' surface check doesn't apply
    // here.
    const rootIdentitySurvives = await stageFrame.evaluate(() => {
      const w = window as unknown as { __vsIdentityTag?: boolean };
      const root = document.querySelector('[data-orrery-iris-root="specimen"]');
      return !!(
        w.__vsIdentityTag &&
        root &&
        (root as unknown as { __vsIdentityTag?: boolean }).__vsIdentityTag
      );
    });
    expect(rootIdentitySurvives).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0, { timeout: 5000 });

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute(
      "data-orrery-iris-shape",
      "rectangle",
    );
    const reopenTrigger = frame.getByRole("button", {
      name: "Open search",
      exact: true,
    });
    await expect(reopenTrigger).toBeVisible();

    await reopenTrigger.click();
    await expect(sheet).toBeVisible();
    await expect(frame.locator("#vs-sheet-title")).toHaveText("Search");

    expect(errors).toEqual([]);
  });

  test("play-ui: desktop dragging the specimen settles at the drop anchor without an anchor-message loop", async ({
    page,
  }) => {
    await installAnchorMessageRecorder(page);
    const frame = await gotoPlay(page);
    const stageFrame = page.frame({ url: /stage=1/ });
    expect(stageFrame).not.toBeNull();
    if (!stageFrame) return;

    const iframeLocator = page.locator("iframe[data-play-stage]");
    const iframeBox = await iframeLocator.boundingBox();
    expect(iframeBox).not.toBeNull();
    if (!iframeBox) return;

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    const trigBox = await trigger.boundingBox();
    expect(trigBox).not.toBeNull();
    if (!trigBox) return;

    const startX = iframeBox.x + trigBox.x + trigBox.width / 2;
    const startY = iframeBox.y + trigBox.y + trigBox.height / 2;
    const centerX = iframeBox.x + iframeBox.width / 2;
    const centerY = iframeBox.y + iframeBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByLabel("Anchor", { exact: true })).toHaveValue(
      "center",
      { timeout: 5000 },
    );
    await expect(page.locator('pre[data-play-output="jsx"]')).toContainText(
      'defaultAnchor="center"',
    );

    // A broken (looping) build could transiently pass through "center" and
    // still satisfy toHaveValue above — wait past the loop window, then
    // require exactly one report and prove the value and position are
    // stable, not merely observed once.
    await page.waitForTimeout(1000);
    expect(await readAnchorMessages(page)).toEqual(["center"]);

    const boxesPromise = sampleTriggerSurfaceBoxes(stageFrame, 500);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByLabel("Anchor", { exact: true })).toHaveValue(
        "center",
      );
      await page.waitForTimeout(50);
    }
    expectBoxesStill(await boxesPromise);
    expect(await readAnchorMessages(page)).toEqual(["center"]);
  });

  test("play-ui: desktop Anchor dropdown commands the specimen without echoing a report, and holds while the sheet is open", async ({
    page,
  }) => {
    await installAnchorMessageRecorder(page);
    const frame = await gotoPlay(page);

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );

    // Closed: the command applies immediately and never posts an :anchor
    // report — only a drag reports.
    await page.getByLabel("Anchor", { exact: true }).selectOption("top-left");
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        return box ? box.x < 150 && box.y < 150 : false;
      })
      .toBe(true);
    await page.waitForTimeout(500);
    expect(await readAnchorMessages(page)).toEqual([]);

    // Open: the command is held, not applied, until the sheet closes.
    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();
    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    await page
      .getByLabel("Anchor", { exact: true })
      .selectOption("bottom-right");
    await page.waitForTimeout(300);
    const boxWhileOpen = await trigger.boundingBox();
    expect(boxWhileOpen).not.toBeNull();
    if (boxWhileOpen) {
      expect(boxWhileOpen.x).toBeLessThan(150);
      expect(boxWhileOpen.y).toBeLessThan(150);
    }

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 5000 });
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        const vp = page.viewportSize();
        return box && vp
          ? box.x > vp.width / 2 && box.y > vp.height / 2
          : false;
      })
      .toBe(true);

    expect(await readAnchorMessages(page)).toEqual([]);
  });

  test("play-ui: desktop Copy JSX writes the JSX pane to the clipboard", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (t: string) => {
            (window as unknown as { __playCopied?: string }).__playCopied = t;
          },
        },
      });
    });

    await gotoPlay(page);

    await page.getByRole("button", { name: "Copy JSX", exact: true }).click();

    const jsxPaneText = await page
      .locator('pre[data-play-output="jsx"]')
      .textContent();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __playCopied?: string }).__playCopied,
        ),
      )
      .toBe(jsxPaneText);

    await expect(page.locator("[data-play-copy-status]")).toHaveText(
      "Copied JSX",
    );
  });

  test("play-ui: desktop links to the motion tuner instead of duplicating it", async ({
    page,
  }) => {
    await gotoPlay(page);
    const link = page.getByRole("link", { name: "Motion tuner", exact: true });
    await expect(link).toHaveAttribute("href", /tune\.html$/);
  });

  test("play-ui: desktop video recipe shows media in the disc and opens an aspect-ratio sheet", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("video");

    const triggerButton = frame.getByRole("button", {
      name: "Open portrait video",
      exact: true,
    });
    await expect(triggerButton).toBeVisible();

    const triggerVideo = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger-surface"] [data-orrery-iris-part="media"] video',
    );
    await expect(triggerVideo).toBeAttached();

    await triggerButton.click();

    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    await expect(async () => {
      const a = await sheet.boundingBox();
      await page.waitForTimeout(120);
      const b = await sheet.boundingBox();
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(Math.abs((a?.width ?? 0) - (b?.width ?? 0))).toBeLessThan(0.2);
    }).toPass({ timeout: 5000 });

    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.abs(box.width / box.height / 0.5625 - 1)).toBeLessThan(0.01);
    }

    await expect(
      sheet.locator('[data-orrery-iris-part="media"] video'),
    ).toBeAttached();

    await expect(
      frame.locator(
        '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="shared"]',
      ),
    ).toHaveCount(0);

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("play-ui: desktop search recipe renders a rectangle button trigger", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("search");

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute(
      "data-orrery-iris-shape",
      "rectangle",
    );

    const triggerButton = frame.getByRole("button", {
      name: "Open search",
      exact: true,
    });
    await expect(triggerButton).toBeVisible();

    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    if (triggerBox) {
      expect(Math.abs(triggerBox.height - 44)).toBeLessThanOrEqual(0.5);
    }

    const jsxPane = page.locator('pre[data-play-output="jsx"]');
    await expect(jsxPane).toContainText('shape="rectangle"');
    await expect(jsxPane).toContainText("Search");
  });

  test("play-ui: desktop chat recipe opens a sheet with a message composer", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("chat");
    await frame.getByRole("button", { name: "Open chat", exact: true }).click();

    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    await expect(
      frame.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("play-ui: desktop rectangle controls change size, content and width", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);
    const jsxPane = page.locator('pre[data-play-output="jsx"]');

    await page.getByLabel("Recipe", { exact: true }).selectOption("search");

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );

    await page.getByLabel("Button size", { exact: true }).selectOption("l");
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        return box ? Math.abs(box.height - 52) : Infinity;
      })
      .toBeLessThanOrEqual(0.5);
    await expect(jsxPane).toContainText('buttonSize="l"');

    await page.getByLabel("Button width", { exact: true }).selectOption("240");
    await expect
      .poll(async () => {
        const box = await trigger.boundingBox();
        return box ? Math.abs(box.width - 240) : Infinity;
      })
      .toBeLessThanOrEqual(0.5);
    await expect(jsxPane).toContainText("buttonWidth={240}");

    await page
      .getByLabel("Button content", { exact: true })
      .selectOption("text");
    await expect(trigger.locator("svg")).toHaveCount(0);
    await expect(jsxPane).not.toContainText("vs-button-icon");
  });

  test("play-ui: desktop Rectangle shape is only offered for button recipes", async ({
    page,
  }) => {
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("basic");
    await expect(
      page.getByRole("radio", { name: "Rectangle", exact: true }),
    ).toBeDisabled();

    await page.getByLabel("Recipe", { exact: true }).selectOption("search");
    await expect(
      page.getByRole("radio", { name: "Rectangle", exact: true }),
    ).toBeChecked();

    await page.getByLabel("Recipe", { exact: true }).selectOption("basic");
    await expect(
      page.getByRole("radio", { name: "Circle", exact: true }),
    ).toBeChecked();
  });
});

test.describe("390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("play-ui: phone loads with controls in a sheet", async ({ page }) => {
    await gotoPlay(page);

    await expect(page.locator("[data-play-panel]")).toHaveCount(0);

    const iframeBox = await page
      .locator("iframe[data-play-stage]")
      .boundingBox();
    expect(iframeBox).not.toBeNull();
    if (iframeBox) {
      expect(iframeBox.width).toBeGreaterThanOrEqual(389);
      expect(iframeBox.width).toBeLessThanOrEqual(391);
      expect(iframeBox.height).toBeGreaterThanOrEqual(843);
      expect(iframeBox.height).toBeLessThanOrEqual(845);
    }

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();

    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: "Square", exact: true }),
    ).toBeVisible();
  });

  test("play-ui: phone shape control changes the specimen and the copy output", async ({
    page,
  }) => {
    const frame = await gotoPlay(page);

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await dialog.getByRole("radio", { name: "Square", exact: true }).check();

    const jsxPane = dialog.locator('pre[data-play-output="jsx"]');
    await expect(jsxPane).toContainText('shape="square"');

    await page
      .getByRole("button", { name: "Close controls", exact: true })
      .click();

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("data-orrery-iris-shape", "square");
  });

  test("play-ui: phone specimen opens and closes", async ({ page }) => {
    const frame = await gotoPlay(page);
    await frame
      .getByRole("button", { name: "Open sheet", exact: true })
      .click();

    const sheet = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();

    const trigger = frame.locator(
      '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
    );
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await frame.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0, { timeout: 5000 });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("play-ui: phone controls trigger yields the top-right corner to the specimen", async ({
    page,
  }) => {
    await gotoPlay(page);

    await page
      .getByRole("button", { name: "Playground controls", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Controls", exact: true });
    await dialog
      .getByLabel("Anchor", { exact: true })
      .selectOption("top-right");
    await page
      .getByRole("button", { name: "Close controls", exact: true })
      .click();

    const frame = page.frameLocator("iframe[data-play-stage]");

    await expect
      .poll(async () => {
        const controlsTrigger = page.locator(
          '[data-orrery-iris-root="play-controls"] [data-orrery-iris-part="trigger"]',
        );
        const specimenTrigger = frame.locator(
          '[data-orrery-iris-root="specimen"] [data-orrery-iris-part="trigger"]',
        );
        const controlsBox = await controlsTrigger.boundingBox();
        const specimenBox = await specimenTrigger.boundingBox();
        if (!controlsBox || !specimenBox) return false;

        const controlsCenterX = controlsBox.x + controlsBox.width / 2;
        const specimenCenterX = specimenBox.x + specimenBox.width / 2;

        const intersects = !(
          controlsBox.x + controlsBox.width <= specimenBox.x ||
          controlsBox.x >= specimenBox.x + specimenBox.width ||
          controlsBox.y + controlsBox.height <= specimenBox.y ||
          controlsBox.y >= specimenBox.y + specimenBox.height
        );

        return controlsCenterX < 195 && specimenCenterX > 195 && !intersects;
      })
      .toBe(true);
  });
});
