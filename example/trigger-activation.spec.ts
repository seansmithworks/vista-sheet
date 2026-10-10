import { test, expect, type Page } from "@playwright/test";

/**
 * trigger-activation.spec.ts — T3 (a11y M1 = code M2): a drag that ends with
 * the pointer off the trigger must never swallow the NEXT Enter or tap.
 *
 * Root cause (pre-fix `src/Trigger.tsx`): `draggedRef` is set `true` in
 * `handleDragStart` and only ever cleared inside `handleClick` itself
 * (":437-440") or the sub-threshold branch of `handleDragEnd` (":388"). A
 * drag that snaps to a new anchor releases the pointer away from the
 * button, so no click ever fires there to clear the ref — it stays `true`
 * forever, and the very next Enter/tap on the trigger is silently eaten by
 * `if (draggedRef.current) { draggedRef.current = false; return; }`.
 *
 * The fix (per the T3 lane card) deletes the sticky ref. Activation is
 * decided per-gesture: a `maxTravel` ref reset on every `pointerdown`,
 * raised from `onDrag`'s cumulative `info.offset`, read once in
 * `handleClick` — `e.detail === 0` (keyboard/AT) or `maxTravel <
 * DRAG_THRESHOLD_PX` opens; nothing is EVER left armed across gestures.
 *
 * Copied (not imported) navigation/selector helpers, matching the existing
 * "don't share test infra across spec files" pattern in geometry.spec.ts /
 * buttons.spec.ts.
 */

const ROOT = '[data-orrery-iris-root="main"] ';
const TRIGGER = `${ROOT}[data-orrery-iris-part="trigger"]`;
const SHEET = `${ROOT}[data-orrery-iris-part="sheet"]`;
const ANCHOR_STORAGE_KEY = "orrery-iris-anchor";

type Box = { x: number; y: number; width: number; height: number };

async function gotoMain(page: Page, anchor = "bottom-center") {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [ANCHOR_STORAGE_KEY, anchor] as [string, string],
  );
  await page.goto("/");
  await page.waitForSelector(TRIGGER);
}

async function triggerBox(page: Page): Promise<Box> {
  const box = await page.locator(TRIGGER).boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** A drag well past DRAG_THRESHOLD_PX (5px), released far to the left of
 * the viewport — off the trigger's post-snap box. Mirrors the 20-step
 * mouse-move method already used for snap coverage in buttons.spec.ts /
 * geometry.spec.ts. */
async function dragOffToTheLeft(page: Page, box: Box) {
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, cy);
  await page.mouse.down();
  await page.mouse.move(-200, cy, { steps: 20 });
  await page.mouse.up();
  // Let the snap spring settle at the new anchor.
  await page.waitForTimeout(900);
}

test.describe("trigger-activation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(act-1) drag released off the trigger, then the FIRST Enter opens", async ({
    page,
  }) => {
    await gotoMain(page);
    const box = await triggerBox(page);
    await dragOffToTheLeft(page, box);

    const trigger = page.locator(TRIGGER);
    await trigger.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator(SHEET)).toBeVisible();
  });

  test("(act-2) drag released off the trigger, then one click opens", async ({
    page,
  }) => {
    await gotoMain(page);
    const box = await triggerBox(page);
    await dragOffToTheLeft(page, box);

    await page.locator(TRIGGER).click();

    await expect(page.locator(SHEET)).toBeVisible();
  });

  test("(act-3) touch drag released off the trigger, then one tap opens", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== "chromium",
      "CDP Input.dispatchTouchEvent is Chromium-only",
    );
    await gotoMain(page);
    const cdp = await page.context().newCDPSession(page);
    const box = await triggerBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: cy }],
    });
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx - ((cx + 200) * i) / steps, y: cy }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(900);

    const settled = await triggerBox(page);
    const tapX = settled.x + settled.width / 2;
    const tapY = settled.y + settled.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: tapX, y: tapY }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(page.locator(SHEET)).toBeVisible();
  });

  test("(act-4) a 4px press-hold-release opens — inferred, not proof on its own", async ({
    page,
  }) => {
    await gotoMain(page);
    const box = await triggerBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 4, cy, { steps: 4 });
    await page.waitForTimeout(80);
    await page.mouse.up();

    await expect(page.locator(SHEET)).toBeVisible();
  });

  test("(act-5) regression: a >=5px drag released OVER the trigger still does NOT open", async ({
    page,
  }) => {
    await gotoMain(page);
    const box = await triggerBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Small drag that stays constrained on-screen and releases back over
    // the button itself (unlike dragOffToTheLeft, which snaps far away).
    await page.mouse.move(cx + 30, cy, { steps: 10 });
    await page.mouse.move(cx, cy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    await expect(page.locator(SHEET)).not.toBeVisible();
  });
});
