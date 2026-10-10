import { test, expect, type Page } from "@playwright/test";
import { ALL_ANCHORS, type AnchorId } from "../src/anchors";

/**
 * geometry.spec.ts — the gate the review says was missing entirely: real
 * rendered geometry, at real viewports, in both motion modes. Each assertion
 * below maps directly to a REVIEW-FINDINGS.md blocker/major:
 *
 *   (a) trigger-side vs sheet-side <Shared> box size  — B1
 *   (b) sheet border-radius > 0 in both motion modes — B3
 *   (c) content sits inside the sheet's padding box — M4
 *   (d) --orrery-iris-z / --orrery-iris-sheet-max-width respond to props — M1/M2
 *
 * FIXED — Defect 3 (stale first-open shared-layoutId snapshot). Tests (e),
 * (j), and (k) are green. FIVE candidate fixes were tried and rejected
 * first (see git history for the full writeup that used to live here); all
 * five tried to make Motion RE-snapshot the box AFTER JS promoted
 * `triggerSize` from its SSR-safe base value: gating `layoutId` on a "settled"
 * flag, remounting via `key`, a synthetic `resize` event, `flushSync`-ing
 * the promotion, and moving promotion to `useLayoutEffect`. All five were
 * on the wrong axis — Motion snapshots the element's real DOM box at first
 * paint, not React state, so nothing that fires AFTER that paint can help.
 *
 * Isolation evidence that pointed at the real axis: sampling
 * `?openDelay=0.25` at 120ms (nothing animating yet, so no spring blur) gave
 * |Δbottom| = 0.0 / 32.0 / 48.0 at 375/1280/1700 — EXACTLY the ramp's
 * promotion delta (128−96=32, 144−96=48), and |Δtop| stayed 0.0 throughout
 * (the two boxes share a pinned bottom edge; see
 * reference_pinned-bottoms-collapse-dtop-and-dheight-into-one-
 * assertion). That means the trigger-side shared element was being PAINTED at
 * the base size on the real (non-base) viewport, not just measured wrong.
 *
 * The fix: make the first-paint box CORRECT instead of chasing a
 * re-snapshot. `useTriggerSize`'s JS value still resolves at vpW=0 on first
 * render (still needed for hydration-safe position math in anchors.ts), but
 * it no longer sizes any FLIP-tracked element. Root.tsx now renders a
 * scoped `<style>` block with real `@media` rules for
 * `--orrery-iris-trigger-size`, derived from `resolveTriggerSize` (the ramp's one
 * source of truth) at the ramp's own breakpoints. A real `@media` query
 * resolves correctly in the browser before any script runs, so there is
 * never a stale value for Motion to snapshot in the first place. Neither
 * Root.tsx's wrapper nor Trigger.tsx's drag wrapper write
 * `--orrery-iris-trigger-size` inline anymore — an inline write on either would
 * have kept beating the `<style>` block's `@media` rules regardless of
 * viewport, which is why Trigger.tsx's drag wrapper (an ANCESTOR of the
 * trigger-side `.shared`) needed the same change as Root.tsx, not just one of
 * the two.
 *
 * (g) is a SEPARATE, still-unfixed defect (reversed morph — Escape fired
 * mid-open) and stays red on purpose: it fails at all three viewports,
 * including 375px where no trigger-size promotion ever happens, so it cannot
 * be D3. Leave it red; do not "helpfully" chase it here.
 */

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
  { width: 1700, height: 1000 },
] as const;

const MOTION_MODES = ["normal", "reduced-motion"] as const;

const TRIGGER_LABEL = "Open example sheet";

async function gotoExample(
  page: Page,
  reduced: boolean,
  query?: Record<string, string>,
) {
  if (reduced) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  await page.goto(`/${qs}`);
  await page.waitForSelector(
    '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
  );
}

/** Poll a locator's boundingBox().width until it stops changing between two
 * reads, rather than a fixed delay long enough for the slowest case (a
 * spring settle, or useTriggerSize's post-mount resize promotion — see M6)
 * but wastefully long for every faster one. */
async function waitForStableWidth(
  page: Page,
  locator: ReturnType<Page["locator"]>,
) {
  await expect(async () => {
    const a = (await locator.boundingBox())?.width;
    await page.waitForTimeout(120);
    const b = (await locator.boundingBox())?.width;
    expect(a).not.toBeUndefined();
    expect(Math.abs((a ?? 0) - (b ?? 0))).toBeLessThan(0.2);
  }).toPass({ timeout: 5000 });
}

async function openSheet(page: Page) {
  await page.getByRole("button", { name: TRIGGER_LABEL }).click();
  const sheet = page.locator(
    '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
  );
  await sheet.waitFor();
  // Let the FLIP/cross-fade fully settle so offsetWidth/Height reflect the
  // resting geometry, not a mid-spring frame.
  await waitForStableWidth(page, sheet);
}

/**
 * Frame-samples `[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]` against whichever surface
 * node currently shares its layoutId (`sheet` while opening, `trigger-surface`
 * while closing — both project to the same box during the FLIP, so either
 * selector matching is sufficient) for `durationMs`, via an in-page rAF loop
 * so sampling isn't gated by Playwright's own polling cadence. Returns the
 * worst |top delta|, |height delta| AND |bottom delta| seen across every
 * sampled frame.
 *
 * |Δbottom| is the informative axis (adversarial review finding D5): both
 * boxes' bottom edges are pinned to `viewport - 16` at rest, so a HEALTHY
 * desync interpolates top and height together and leaves the bottom edge
 * algebraically invariant — |Δtop| and |Δheight| collapse to the same
 * number and never expose a defect that breaks that invariant (e.g. a
 * shared-layout FLIP seeded from a stale snapshot, D3). |Δbottom| is the
 * only axis that catches that class of bug, and previously wasn't sampled
 * at all.
 *
 * Regression gate for the D1/D2 fix (docs: the transposed layoutId
 * transitions and the premature sheetRect clear): before that fix, worstTop/
 * worstHeight were 315px (open) and 487px (close).
 */
// `rootSelector` scopes to the demo's primary sheet on pages that render a
// second, unrelated Iris.Root (index's "Design" settings sheet —
// `[data-orrery-iris-root="main"]`, the id set in main.tsx). flagship.html
// (off-limits, unmodified) has exactly one Root and no such id, so its own
// caller (test (m)) passes "" for an unscoped, unambiguous selector there.
async function sampleShadowSurfaceDelta(
  page: Page,
  durationMs: number,
  rootSelector = '[data-orrery-iris-root="main"] ',
) {
  return page.evaluate(
    ({ duration, root }) => {
      return new Promise<{
        worstTop: number;
        worstHeight: number;
        worstBottom: number;
      }>((resolve) => {
        let worstTop = 0;
        let worstHeight = 0;
        let worstBottom = 0;
        const start = performance.now();
        function tick() {
          const surface = document.querySelector(
            `${root}[data-orrery-iris-part="sheet"], ${root}[data-orrery-iris-part="trigger-surface"]`,
          );
          const shadow = document.querySelector(
            `${root}[data-orrery-iris-part="shadow"]`,
          );
          if (surface && shadow) {
            const s = surface.getBoundingClientRect();
            const sh = shadow.getBoundingClientRect();
            worstTop = Math.max(worstTop, Math.abs(sh.top - s.top));
            worstHeight = Math.max(worstHeight, Math.abs(sh.height - s.height));
            worstBottom = Math.max(worstBottom, Math.abs(sh.bottom - s.bottom));
          }
          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve({ worstTop, worstHeight, worstBottom });
          }
        }
        requestAnimationFrame(tick);
      });
    },
    { duration: durationMs, root: rootSelector },
  );
}

// Open thresholds: 8px. Close (Escape path): 6px. The open bound was
// 30px, which only ever passed because it was set from a measured
// spread (15.1-29.6px) that was itself the M2 defect — the shadow
// clock and Motion's layout-projection clock starting from two
// different timestamps. With those two clocks structurally coupled
// (Root.tsx's startMorphClock, fired from Motion's own
// onLayoutAnimationStart), a healthy open measures 0.1-0.4px worst
// |Δtop| on both example pages at 390x844 and 1280x800. 8px is
// therefore ~20x the observed spread, not a margin over it: it is
// low enough that any reappearance of a start-time offset — even a
// single frame of one — fails here rather than passing quietly.
const OPEN_THRESHOLD_PX = 8;
const CLOSE_THRESHOLD_PX = 6;
// |Δbottom| bound: both boxes are bottom-pinned at rest, so a
// healthy desync leaves the bottom edge algebraically invariant
// (see the comment on sampleShadowSurfaceDelta). 2px is not "loose
// margin over noise" — it is close to zero on purpose, because this
// is the axis D3 (the stale first-open FLIP snapshot) breaks by
// tens of px while Δtop/Δheight stay inside their own bounds.
const BOTTOM_THRESHOLD_PX = 2;
// (h)-only: 3 rapid open/close cycles compound spring settle noise
// on the shared bottom-pinned edge in a way the single-transition
// tests above don't. Sampled 37x locally (27 idle + 10 under
// synthetic `yes`-process CPU load) at 1700x1000: worstBottom was
// 0.0px every single time. But this bound has independently been
// measured at 2.09px and 2.20px on other runs/machines — evidence
// this is real cross-machine spring-timing spread under load this
// machine didn't reproduce, not noise to explain away. 4px sits
// ~1.8px above the highest documented outlier (headroom for
// machines slower than any sampled so far) while staying an order
// of magnitude under the tens-of-px D3 defect this axis exists to
// catch. Scoped to (h) only — the shared BOTTOM_THRESHOLD_PX above
// stays tight for (e)/(f)/(g)/(j), which don't compound cycles.
const RAPID_TOGGLE_BOTTOM_THRESHOLD_PX = 4;

for (const viewport of VIEWPORTS) {
  for (const mode of MOTION_MODES) {
    const reduced = mode === "reduced-motion";

    test.describe(`${viewport.width}x${viewport.height} — ${mode}`, () => {
      test.use({ viewport });

      test("(a) trigger-side and sheet-side Shared boxes are equal", async ({
        page,
      }) => {
        await gotoExample(page, reduced);

        const triggerShared = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shared"][data-orrery-iris-slot="trigger"]',
        );
        // useTriggerSize's SSR-safe initializer (M6) always resolves at the
        // ramp's base size first, then promotes to the real size in a
        // post-mount effect — wait for that promotion to land before
        // measuring, or a fast read here catches the pre-promotion value.
        await waitForStableWidth(page, triggerShared);
        const triggerBox = await triggerShared.boundingBox();
        expect(
          triggerBox,
          "trigger-side Shared must be measurable before open",
        ).not.toBeNull();

        await openSheet(page);

        const sheetShared = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shared"][data-orrery-iris-slot="sheet"]',
        );
        const sheetBox = await sheetShared.boundingBox();
        expect(
          sheetBox,
          "sheet-side Shared must be measurable once open",
        ).not.toBeNull();

        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: ` +
            `trigger-side Shared ${triggerBox!.width.toFixed(1)}x${triggerBox!.height.toFixed(1)}, ` +
            `sheet-side Shared ${sheetBox!.width.toFixed(1)}x${sheetBox!.height.toFixed(1)}`,
        );

        expect(sheetBox!.width).toBeCloseTo(triggerBox!.width, 0);
        expect(sheetBox!.height).toBeCloseTo(triggerBox!.height, 0);
      });

      test("(b) sheet border-radius is greater than 0", async ({ page }) => {
        await gotoExample(page, reduced);
        await openSheet(page);

        const sheet = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        const radius = await sheet.evaluate((el) => {
          const cs = getComputedStyle(el);
          // borderRadius is the shorthand; read one corner explicitly.
          return Number.parseFloat(cs.borderTopLeftRadius || "0");
        });

        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: sheet border-radius = ${radius}px`,
        );
        expect(radius).toBeGreaterThan(0);
      });

      test("(c) content's box sits inside the sheet's padding box", async ({
        page,
      }) => {
        await gotoExample(page, reduced);
        await openSheet(page);

        const sheet = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        const content = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="content"]',
        );

        const sheetBox = (await sheet.boundingBox())!;
        const contentBox = (await content.boundingBox())!;
        const borderWidth = await sheet.evaluate((el) =>
          Number.parseFloat(getComputedStyle(el).borderTopWidth || "0"),
        );

        const paddingBox = {
          left: sheetBox.x + borderWidth,
          top: sheetBox.y + borderWidth,
          right: sheetBox.x + sheetBox.width - borderWidth,
          bottom: sheetBox.y + sheetBox.height - borderWidth,
        };

        const EPS = 1; // subpixel tolerance
        expect(contentBox.x).toBeGreaterThanOrEqual(paddingBox.left - EPS);
        expect(contentBox.y).toBeGreaterThanOrEqual(paddingBox.top - EPS);
        expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(
          paddingBox.right + EPS,
        );
        expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(
          paddingBox.bottom + EPS,
        );
      });

      test("(d) --orrery-iris-z and --orrery-iris-sheet-max-width respond to props", async ({
        page,
      }) => {
        await gotoExample(page, reduced, {
          zIndex: "500",
          sheetMaxWidth: "600",
        });

        const rootEl = page.locator('[data-orrery-iris-root="main"]');
        const z = await rootEl.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--orrery-iris-z").trim(),
        );
        const maxWidth = await rootEl.evaluate((el) =>
          getComputedStyle(el)
            .getPropertyValue("--orrery-iris-sheet-max-width")
            .trim(),
        );
        expect(z).toBe("500");
        expect(maxWidth).toBe("600px");

        // And it must actually reach the rendered layers, not just the var.
        const triggerRoot = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-root"]',
        );
        const triggerZ = await triggerRoot.evaluate(
          (el) => getComputedStyle(el).zIndex,
        );
        expect(triggerZ).toBe("500");

        await openSheet(page);
        const sheet = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        const sheetWidth = (await sheet.boundingBox())!.width;
        // .sheet's CSS width is min(--orrery-iris-sheet-max-width, 100vw -
        // 32px) — at our narrowest viewport (375) the viewport clamp wins,
        // not the 600px max-width, so the expectation has to account for
        // that clamp rather than assume 600 always renders.
        const expectedWidth = Math.min(600, viewport.width - 32);
        expect(sheetWidth).toBeCloseTo(expectedWidth, 0);
      });

      // Audit M11: the backdrop used to survive the whole close (rendered
      // inside AnimatePresence's `{open && ...}` child, so it stayed mounted
      // at zIndex + 101 — above the trigger's zIndex 100 — for the entire exit
      // animation), eating every click over the trigger's resting position for
      // as long as the close took to settle. Both motion modes render a
      // close (reduced motion just skips the FLIP, not the backdrop's own
      // mount lifecycle), so this gate isn't scoped to `!reduced` like the
      // FLIP-sampling gates below it.
      test("(l) a click over the trigger's resting position reaches the trigger, not the backdrop, 300ms into a close (M11)", async ({
        page,
      }) => {
        await gotoExample(page, reduced);
        const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
        const triggerBox = (await trigger.boundingBox())!;
        const cx = triggerBox.x + triggerBox.width / 2;
        const cy = triggerBox.y + triggerBox.height / 2;

        await trigger.click();
        const sheet = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        await sheet.waitFor();
        await waitForStableWidth(page, sheet);

        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        const hitPart = await page.evaluate(
          ([x, y]) => {
            const el = document.elementFromPoint(x, y);
            return (
              el
                ?.closest("[data-orrery-iris-part]")
                ?.getAttribute("data-orrery-iris-part") ?? null
            );
          },
          [cx, cy],
        );
        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: ` +
            `300ms-into-close elementFromPoint(trigger resting position) part=${hitPart}`,
        );
        expect(hitPart).not.toBe("backdrop");
      });

      // Review finding #8, resurrected as a real gate — and it caught a
      // shipped defect immediately. The trigger's RESTING shape is CSS
      // (`border-radius: var(--orrery-iris-trigger-radius, 9999px)`), but the
      // close morph binds a numeric MotionValue over it (M1) and Motion
      // writes that inline: scale-corrected percentages while the projection
      // runs, then one final px keyframe when it settles. So "the trigger is a
      // circle at rest" is only true if the morph BOTH ends on a circular
      // value AND releases the inline write afterward. Neither held. Measured
      // before the fix, on every close path of both example pages, the trigger
      // rested at `border-radius: 32px` (36px on the flagship) on a 128px box
      // — a paper squircle around a circular child, from the first close
      // until reload. Runs in BOTH motion modes: reduced motion drops the
      // layoutId but not the binding.
      //
      // The 1.6s settle per variant outlasts the 1.5s wall-clock radius hold
      // that used to gate the curve, so what this reads is the real resting
      // shape and not a frame of the hold.
      test("(o) the trigger surface rests as a circle after every close path (#8)", async ({
        page,
      }) => {
        await gotoExample(page, reduced);
        const trigger = page.getByRole("button", { name: TRIGGER_LABEL });

        const expectRestingCircle = async (variant: string) => {
          await page.waitForTimeout(1600);
          const r = await page.evaluate(() => {
            const el = document.querySelector(
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
            ) as HTMLElement | null;
            if (!el) return null;
            const box = el.getBoundingClientRect();
            return {
              inline: (el.style.borderRadius || "").trim(),
              computed: getComputedStyle(el).borderTopLeftRadius,
              width: box.width,
              height: box.height,
            };
          });
          expect(
            r,
            `${variant}: the trigger surface must be mounted and measurable at rest`,
          ).not.toBeNull();
          const half = Math.min(r!.width, r!.height) / 2;
          // A percentage radius is circular at >= 50%; a px radius at >= half
          // the box's shorter side. 0.5px of slack for sub-pixel box sizes.
          const isCircular = (value: string) =>
            value.trim().endsWith("%")
              ? parseFloat(value) >= 50
              : parseFloat(value) >= half - 0.5;
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} ${mode} ${variant}: ` +
              `resting trigger radius computed=${r!.computed} ` +
              `inline=${r!.inline || "(none)"} ` +
              `box=${r!.width.toFixed(0)}x${r!.height.toFixed(0)} (half=${half})`,
          );
          expect(
            isCircular(r!.computed),
            `${variant}: computed border-radius ${r!.computed} does not render a circle on a ${r!.width}x${r!.height} trigger`,
          ).toBe(true);
          expect(
            r!.inline === "" || isCircular(r!.inline),
            `${variant}: a stale inline border-radius (${r!.inline}) survived the morph and beats the --orrery-iris-trigger-radius token`,
          ).toBe(true);
        };

        await trigger.click();
        await page.waitForTimeout(900);
        await page.keyboard.press("Escape");
        await expectRestingCircle("simple close");

        // The reported repro: reopen while the close is still running (M11
        // made the trigger tappable from frame one of a close), then close again.
        await trigger.click();
        await page.waitForTimeout(900);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await trigger.click();
        await page.waitForTimeout(900);
        await page.keyboard.press("Escape");
        await expectRestingCircle("close interrupted by a reopen");

        for (let i = 0; i < 3; i++) {
          await trigger.click();
          await page.waitForTimeout(180);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(180);
        }
        await expectRestingCircle("rapid open/close toggle");

        await trigger.click();
        await page.waitForTimeout(900);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(90);
        await page.setViewportSize({
          width: viewport.width,
          height: Math.round(viewport.height * 0.63),
        });
        await expectRestingCircle("resize mid-close");
      });

      // Reduced motion drops layoutId entirely on both sides (§6) and
      // cross-fades in 200ms flat — there is no mid-morph FLIP to sample,
      // and reduced-motion's own correctness is covered by a11y.spec.ts and
      // test (b) above. This gate is about the normal-motion morph only.
      if (!reduced) {
        test("(e) shadow tracks the surface box through open AND close", async ({
          page,
        }) => {
          await gotoExample(page, reduced);

          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
          await trigger.click();

          // 1.2s covers settle for both the open spring (375/42.5/1.75) and
          // the close spring (240/34/1.75 + the 100ms SURFACE_CLOSE_LEAD_
          // DELAY_MS) at real wall-clock speed, generous over either's
          // measured settle time so a slow CI runner doesn't clip the tail.
          const openResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} open: ` +
              `worst |Δtop|=${openResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${openResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${openResult.worstBottom.toFixed(1)}px`,
          );
          expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);

          await page.keyboard.press("Escape");
          const closeResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${closeResult.worstBottom.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        // Same gate as (e), on the OTHER example page. The M2 clock desync
        // scaled with how much work a page's open commit did, so it was 3-4x
        // worse on the flagship (a photo, a five-row nav, a real type ramp)
        // than on the generic example (e) samples — 58-74px vs 18-21px worst
        // |Δtop| at the same viewports. A gate that only ever opens the
        // lightest page in the repo cannot see that class of regression at
        // all, which is exactly how a 30px bound came to look reasonable.
        test("(m) shadow tracks the flagship example's surface through open AND close", async ({
          page,
        }) => {
          // flagship.html is off-limits/unmodified — it has exactly one
          // Root and no `data-orrery-iris-root="main"` id, so its own
          // locators here stay unscoped (unambiguous on that page).
          await page.goto("/flagship.html");
          await page.waitForSelector('[data-orrery-iris-part="trigger"]');
          // The flagship's text faces are used ONLY inside its sheet, so they
          // are still unloaded when the trigger is tapped and the swap re-lays
          // the sheet out mid-morph (measured at 390x844: 592 -> 618px tall,
          // ~40ms in). Shadow.tsx re-measures and both clocks restart
          // together when that happens, but Motion's own projection paints
          // one frame against the pre-relayout transform, and that frame is
          // the example page's font strategy talking, not the package's
          // clock. Load the faces first so this gate measures the morph.
          await page.evaluate(() =>
            Promise.all([...document.fonts].map((f) => f.load())),
          );
          await waitForStableWidth(
            page,
            page.locator('[data-orrery-iris-part="trigger"]'),
          );

          await page.locator('[data-orrery-iris-part="trigger"]').click();
          const openResult = await sampleShadowSurfaceDelta(page, 1200, "");
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} flagship open: ` +
              `worst |Δtop|=${openResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${openResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${openResult.worstBottom.toFixed(1)}px`,
          );
          expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);

          await page.keyboard.press("Escape");
          const closeResult = await sampleShadowSurfaceDelta(page, 1200, "");
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} flagship close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${closeResult.worstBottom.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(f) shadow tracks the sheet through a swipe-to-dismiss drag (D1)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);

          const sheet = page.locator(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
          );
          const box = (await sheet.boundingBox())!;
          // Top strip of the sheet, above <Iris.Shared>'s 24px margin
          // and the Close button inside Content — a safe drag-handle point
          // that isn't an interactive child.
          const startX = box.x + box.width / 2;
          const startY = box.y + 8;

          await page.mouse.move(startX, startY);
          await page.mouse.down();

          // Drag well past SWIPE_OFFSET_PX (96) in small steps, without
          // releasing — this is the HELD-DRAG sample the prior gate never
          // took (it only ever closed via Escape, never via drag).
          const dragSteps = 10;
          for (let i = 1; i <= dragSteps; i++) {
            await page.mouse.move(startX, startY + (140 * i) / dragSteps, {
              steps: 1,
            });
          }

          const held = await page.evaluate(() => {
            const surface = document.querySelector(
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
            )!;
            const shadow = document.querySelector(
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
            )!;
            const s = surface.getBoundingClientRect();
            const sh = shadow.getBoundingClientRect();
            return {
              top: Math.abs(sh.top - s.top),
              bottom: Math.abs(sh.bottom - s.bottom),
            };
          });
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} held-drag: ` +
              `|Δtop|=${held.top.toFixed(1)}px, |Δbottom|=${held.bottom.toFixed(1)}px`,
          );
          // Loose on purpose: mid-drag the sheet is user-dragged away from
          // its resting anchor by up to ~140px of pointer travel, and the
          // shadow must follow that same translation, not just settle at
          // rest. 20px covers drag-vs-shadow frame lag without hiding a
          // fixed-anchor shadow that never moved at all (pre-fix: ~145px on
          // a comparable real-device swipe per the adversarial review).
          expect(held.top).toBeLessThan(20);
          expect(held.bottom).toBeLessThan(20);

          // Release past the dismiss threshold and sample through the close
          // this swipe triggers.
          await page.mouse.move(startX, startY + 220, { steps: 3 });
          await page.mouse.up();

          const closeResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} swipe-dismiss close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${closeResult.worstBottom.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(g) shadow tracks a reversed morph — Escape fired mid-open", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
          await trigger.click();

          // Fire the reversal partway through the open spring's settle,
          // before it has a chance to finish — this is the state a
          // fast-double-tap or an impatient Escape produces, and the prior
          // gate never exercised it at all.
          await page.waitForTimeout(160);
          await page.keyboard.press("Escape");

          const result = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} reversed-morph: ` +
              `worst |Δtop|=${result.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${result.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${result.worstBottom.toFixed(1)}px`,
          );
          // Was: "the reversal runs the close spring/timing (same code path
          // as a normal close)". That was never true, and the pre-fix
          // numbers prove it — worstTop measured 26-37px here vs. 2.7-4px
          // for an actual close (e). The real cause: collapseProgress's
          // animate() call inherited the in-flight open animation's
          // velocity by default (motion-dom's animateMotionValue defaults to
          // value.getVelocity()), while Motion's own layout-projection
          // spring — the one actually moving the shared-layoutId surface —
          // unconditionally restarts its internal progress value at
          // velocity 0 on every animation, reversal or not
          // (motion-dom's create-projection-node.mjs startAnimation:
          // `jump(0, false)` then `animateSingleValue(..., { velocity: 0
          // })`). Two clocks starting a reversal from different velocities
          // diverge. Root.tsx's collapseProgress animate() calls now pass
          // an explicit `velocity: 0` on both the open and close branches to
          // match — sampled 26x across all three viewports post-fix:
          // worstTop 5.7-11.9px. That is a real fix (26-37px -> 5.7-11.9px),
          // but it only aligned the two clocks' STARTING velocity, not their
          // spring constants, so a reversal still settles a few px above
          // what a fresh close (e) achieves (2.7-4px) — hence this stays at
          // CLOSE_THRESHOLD_PX * 3, not CLOSE_THRESHOLD_PX itself.
          expect(result.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        // Review finding #1: collapseProgress.set(1) used to fire
        // unconditionally on every isOpening transition, including a tap
        // that reopens the trigger while a PREVIOUS close is still animating —
        // reachable since M11 moved the backdrop out of the way from frame
        // one of a close (see test (l) above). That forced the shadow/
        // radius clock to snap to fully-closed (collapseProgress: 1) right
        // before re-arming toward 0, while Motion's own layout-projection
        // spring for the surface box has no equivalent reset and resumes
        // smoothly from wherever it currently is — producing a large,
        // immediate shadow/surface desync for the whole reopen, which
        // sampleShadowSurfaceDelta (already used above to catch the D3
        // stale-snapshot defect) is equally able to catch here: a snap
        // shows up as the same class of spike in worst |Δtop|/|Δbottom| in
        // the reopen window, not a small, converging spread.
        test("(n) shadow does not snap when the trigger reopens a still-closing sheet", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
          await trigger.click();
          const sheet = page.locator(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
          );
          await sheet.waitFor();
          await waitForStableWidth(page, sheet);

          await page.keyboard.press("Escape");
          // Mid-close — well before the close spring/hold settles (~240-
          // 440ms depending on viewport), and after the backdrop has
          // already unmounted (M11), so the trigger is genuinely tappable
          // here.
          await page.waitForTimeout(150);
          await trigger.click();

          const result = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} reopen-mid-close: ` +
              `worst |Δtop|=${result.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${result.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${result.worstBottom.toFixed(1)}px`,
          );
          // Same bound as a genuine reversal (g) — a fixed, converging
          // desync from the two clocks' differing spring constants, not the
          // unbounded snap the bug produces (which the pre-fix comment on
          // (g) measured at 26-37px for a SIMPLER reversal; a snap straight
          // to collapseProgress=1 mid-flight is at least as large).
          expect(result.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(h) shadow tracks a rapid open/close toggle (3 cycles)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });

          let worstTop = 0;
          let worstHeight = 0;
          let worstBottom = 0;
          for (let i = 0; i < 3; i++) {
            await trigger.click();
            await page.waitForTimeout(220);
            const openSample = await sampleShadowSurfaceDelta(page, 220);
            worstTop = Math.max(worstTop, openSample.worstTop);
            worstHeight = Math.max(worstHeight, openSample.worstHeight);
            worstBottom = Math.max(worstBottom, openSample.worstBottom);

            await page.keyboard.press("Escape");
            await page.waitForTimeout(220);
            const closeSample = await sampleShadowSurfaceDelta(page, 220);
            worstTop = Math.max(worstTop, closeSample.worstTop);
            worstHeight = Math.max(worstHeight, closeSample.worstHeight);
            worstBottom = Math.max(worstBottom, closeSample.worstBottom);
          }

          console.log(
            `[geometry] ${viewport.width}x${viewport.height} rapid-toggle (3x): ` +
              `worst |Δtop|=${worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${worstBottom.toFixed(1)}px`,
          );
          expect(worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(worstBottom).toBeLessThan(RAPID_TOGGLE_BOTTOM_THRESHOLD_PX);
        });

        test("(i) shadow tracks the sheet through a resize mid-close (D2)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);
          await page.keyboard.press("Escape");

          // 90ms into the close, resize the viewport — matches the
          // adversarial review's repro (orientation change / iOS URL-bar
          // collapse mid-close).
          await page.waitForTimeout(90);
          await page.setViewportSize({
            width: viewport.width,
            height: Math.round(viewport.height * 0.63),
          });

          // Two different measurements on purpose, because a live resize
          // mid-close mixes TWO effects this repo's own methodology can't
          // otherwise tell apart:
          //
          // 1. D2 itself (Sheet.tsx's resize listener now stays registered
          //    through the whole close, so sheetRect keeps updating instead
          //    of freezing) — this is what makes the geometry CONVERGE to a
          //    correct end state at all, instead of staying wrong for the
          //    rest of the close the way the pre-fix 481.7px case did.
          // 2. A residual, KNOWN AND ACCEPTED transient, now much smaller
          //    than it was: Trigger.tsx's resize handler used to re-seat the
          //    trigger wrapper with an instant `.jump()` even while a shared-
          //    layoutId FLIP was in flight — that ancestor-transform jump
          //    compounded with the FLIP's own in-progress transform on its
          //    child (trigger-surface), producing an 868–869px worst-case
          //    (375/1280/1700: 868–869 / 586–587 / 651–653px, three runs).
          //    Fixed: the handler now defers the re-seat (pendingResizeRef)
          //    until Sheet's onExitComplete nulls sheetRect, matching the
          //    onExitComplete pattern already established for sheetRect's
          //    own release. That cut the worst case by ~60–70% (three runs,
          //    375/1280/1700: 298–299 / 294–295 / 367–369px) but did not
          //    zero it, because a SEPARATE, structurally different
          //    mechanism remains: this test's queried "surface" (the actual
          //    trigger-surface/sheet DOM box) reflows natively and
          //    synchronously the instant the viewport resizes, while
          //    Shadow.tsx's silhouette is driven by `sheetRect`, which is
          //    D2's OWN tracking value — plumbed through React state, one
          //    render tick behind the native reflow by construction.
          //    Removing that lag would mean making sheetRect update
          //    synchronously with the resize event, which touches the exact
          //    mechanism D2 fixed and is out of this test's bounds. worst
          //    |Δheight| stays ~2.5–4px throughout (both boxes keep the
          //    right SIZE — this is a POSITION-only artifact, same
          //    signature as the fixed defect, opposite of D3).
          //
          // So: the SETTLE window (last 300ms of the sample) asserts D2's
          // own fix — convergence — and is tight. The FULL window is now
          // gated too, at a bound with real headroom over three stable
          // post-fix runs (worst observed 369px at 1700x1000): this is an
          // accepted, bounded artifact of resizing mid-morph, not an
          // unknown regression budget.
          const FULL_WINDOW_THRESHOLD_PX = 450;
          const full = await sampleShadowSurfaceDelta(page, 1200);
          const settleWindowMs = 300;
          const settled = await sampleShadowSurfaceDelta(page, settleWindowMs);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} resize-mid-close FULL WINDOW (gated, known bounded transient — see comment): ` +
              `worst |Δtop|=${full.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${full.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${full.worstBottom.toFixed(1)}px`,
          );
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} resize-mid-close SETTLE WINDOW (gated, D2's own mechanism): ` +
              `worst |Δtop|=${settled.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${settled.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${settled.worstBottom.toFixed(1)}px`,
          );
          expect(full.worstBottom).toBeLessThan(FULL_WINDOW_THRESHOLD_PX);
          expect(settled.worstTop).toBeLessThan(15);
          expect(settled.worstHeight).toBeLessThan(15);
        });

        test("(j) cold first open does not FLIP from a stale trigger-size snapshot (D3)", async ({
          page,
        }) => {
          // Deliberately does NOT call waitForStableWidth or otherwise wait
          // for useTriggerSize's post-mount promotion to land before opening —
          // that wait is exactly what makes every OTHER test in this file a
          // warm open. This is a fresh navigation (a new Page per Playwright
          // test) with the earliest possible click, which is what a real
          // visitor's first interaction after page load looks like.
          await gotoExample(page, reduced);
          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
          await trigger.click();

          const result = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} cold-first-open: ` +
              `worst |Δtop|=${result.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${result.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${result.worstBottom.toFixed(1)}px`,
          );
          // |Δbottom| is the assertion that matters here — see the D3 note
          // on sampleShadowSurfaceDelta. A stale pre-promotion snapshot
          // breaks exactly this invariant while leaving Δtop/Δheight inside
          // their normal bound.
          expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        // Audit M1: the close-morph ellipse. Trigger.tsx's trigger-surface used to
        // bind border-radius to a CSS `var()` STRING, which Motion can't
        // parse or scale-correct for a shared-layoutId crossfade — so the
        // computed border-radius on whichever element currently carries the
        // layoutId snapped to the literal 9999px fallback from frame one of
        // every close, painting a full ellipse on a sheet-sized box for the
        // whole collapse. Both crossfade participants (Sheet.tsx's `.sheet`
        // on open, Trigger.tsx's `.triggerSurface` on close) now bind to the SAME
        // numeric collapseRadius MotionValue (useCollapseRadius.ts), so this
        // asserts the invariant a healthy close must never break: while the
        // box is still sheet-sized (width > 200px — comfortably above the
        // trigger's own resting diameter, which is under 150px at every ramp
        // breakpoint), its border-radius can never exceed a plain rounded
        // rectangle's max (min(width, height) / 2) the way an ellipse does.
        test("(k) close-morph border-radius never balloons into an ellipse while the box is still sheet-sized (M1)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);
          await page.keyboard.press("Escape");

          const result = await page.evaluate((duration) => {
            return new Promise<{ worstExcessPx: number; samples: number }>(
              (resolve) => {
                let worstExcessPx = 0;
                let samples = 0;
                const start = performance.now();
                function tick() {
                  const el = document.querySelector(
                    '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"], [data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
                  );
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 200) {
                      const radius = Number.parseFloat(
                        getComputedStyle(el).borderTopLeftRadius || "0",
                      );
                      const maxAllowed = Math.min(rect.width, rect.height) / 2;
                      samples += 1;
                      worstExcessPx = Math.max(
                        worstExcessPx,
                        radius - maxAllowed,
                      );
                    }
                  }
                  if (performance.now() - start < duration) {
                    requestAnimationFrame(tick);
                  } else {
                    resolve({ worstExcessPx, samples });
                  }
                }
                requestAnimationFrame(tick);
              },
            );
          }, 1200);

          console.log(
            `[geometry] ${viewport.width}x${viewport.height} close border-radius: ` +
              `worst excess over min(w,h)/2 = ${result.worstExcessPx.toFixed(1)}px ` +
              `across ${result.samples} samples with width>200px`,
          );
          expect(result.samples).toBeGreaterThan(0);
          expect(result.worstExcessPx).toBeLessThanOrEqual(0.5);
        });
      }
    });
  }
}

/**
 * P2 shape repeats (task 1 — failing until P2 lands the `shape` prop, its
 * geometry and the shadow/Shared/focus-ring shape follow-through). Reuses
 * the (e)(g)(h)(n)(o) bodies above verbatim, plus (p2), on each non-default
 * shape, then adds shape-specific radius-tracking gates ((rt), (sh)) across
 * every shape including the default. `?shape=` is example/main.tsx's P2
 * task-1 fixture; expectShapeApplied fails first for every shape today,
 * since no part carries `data-orrery-iris-shape` yet.
 */
const NON_DEFAULT_SHAPES = ["squircle", "rounded-square", "square"] as const;
const ALL_SHAPES = ["circle", ...NON_DEFAULT_SHAPES] as const;
type ShapeName = (typeof ALL_SHAPES)[number];

const ROUNDED_SQUARE_FRACTION = 0.25;
const SQUIRCLE_FALLBACK_FRACTION = 0.2716; // must equal src/shape.ts (DESIGN.md §3)

const RADIUS_TRACK_THRESHOLD_PX = 4;

async function expectShapeApplied(page: Page, shape: ShapeName) {
  const actual = await page
    .locator('[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]')
    .getAttribute("data-orrery-iris-shape");
  expect(actual, "?shape= did not reach <Iris.Root shape>").toBe(shape);
}

function radiusToPx(value: string, box: number): number {
  const token = (value || "").trim().split(/\s+/)[0] || "0";
  return token.endsWith("%")
    ? (parseFloat(token) / 100) * box
    : parseFloat(token);
}

function expectedTriggerRadiusPx(
  shape: ShapeName,
  box: number,
  supported: boolean,
): number {
  switch (shape) {
    case "circle":
      return box / 2;
    case "squircle":
      return supported ? box / 2 : box * SQUIRCLE_FALLBACK_FRACTION;
    case "rounded-square":
      return box * ROUNDED_SQUARE_FRACTION;
    case "square":
      return 0;
  }
}

function radiusMatches(
  shape: ShapeName,
  px: number,
  box: number,
  supported: boolean,
): boolean {
  const expected = expectedTriggerRadiusPx(shape, box, supported);
  if (expected === box / 2) return px >= box / 2 - 0.5;
  return Math.abs(px - expected) <= 0.5;
}

/** Same shape as sampleShadowSurfaceDelta, but samples the surface's and
 * the shadow's CORNER RADIUS instead of their box geometry — the (rt) gate
 * this feeds needs to know the shadow's radius tracks the surface's radius
 * through the morph, not just its box. */
async function sampleShadowSurfaceRadiusDelta(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<{ worst: number }>((resolve) => {
      let worst = 0;
      const start = performance.now();
      function tick() {
        const surface = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"], [data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
        ) as HTMLElement | null;
        const shadow = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
        ) as HTMLElement | null;
        if (surface && shadow) {
          const surfaceRect = surface.getBoundingClientRect();
          const shadowRect = shadow.getBoundingClientRect();
          const token =
            (getComputedStyle(surface).borderTopLeftRadius || "")
              .trim()
              .split(/\s+/)[0] || "0";
          const surfaceRadius = token.endsWith("%")
            ? (parseFloat(token) / 100) * surfaceRect.width
            : parseFloat(token) *
              (surfaceRect.width /
                (surface.offsetWidth || surfaceRect.width || 1));
          const shadowRadius = parseFloat(
            getComputedStyle(shadow).getPropertyValue(
              "--orrery-iris-shadow-radius",
            ),
          );
          const a = Math.min(
            surfaceRadius,
            Math.min(surfaceRect.width, surfaceRect.height) / 2,
          );
          const b = Math.min(
            shadowRadius,
            Math.min(shadowRect.width, shadowRect.height) / 2,
          );
          if (!Number.isNaN(a) && !Number.isNaN(b)) {
            worst = Math.max(worst, Math.abs(a - b));
          }
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve({ worst });
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

for (const shape of NON_DEFAULT_SHAPES) {
  test.describe(`shape=${shape} — 1280x800 — normal`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test(`(e-shape) shape=${shape}: shadow tracks the surface box through open AND close`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.click();

      const openResult = await sampleShadowSurfaceDelta(page, 1200);
      expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(openResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);

      await page.keyboard.press("Escape");
      const closeResult = await sampleShadowSurfaceDelta(page, 1200);
      expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
      expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
      expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
    });

    test(`(g-shape) shape=${shape}: shadow tracks a reversed morph — Escape fired mid-open`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.click();
      await page.waitForTimeout(160);
      await page.keyboard.press("Escape");

      const result = await sampleShadowSurfaceDelta(page, 1200);
      expect(result.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
      expect(result.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
      expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
    });

    test(`(n-shape) shape=${shape}: shadow does not snap when the trigger reopens a still-closing sheet`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.click();
      const sheet = page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      await sheet.waitFor();
      await waitForStableWidth(page, sheet);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      await trigger.click();

      const result = await sampleShadowSurfaceDelta(page, 1200);
      expect(result.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
      expect(result.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
      expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
    });

    test(`(h-shape) shape=${shape}: shadow tracks a rapid open/close toggle (3 cycles)`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      let worstTop = 0;
      let worstHeight = 0;
      let worstBottom = 0;
      for (let i = 0; i < 3; i++) {
        await trigger.click();
        await page.waitForTimeout(220);
        const openSample = await sampleShadowSurfaceDelta(page, 220);
        worstTop = Math.max(worstTop, openSample.worstTop);
        worstHeight = Math.max(worstHeight, openSample.worstHeight);
        worstBottom = Math.max(worstBottom, openSample.worstBottom);

        await page.keyboard.press("Escape");
        await page.waitForTimeout(220);
        const closeSample = await sampleShadowSurfaceDelta(page, 220);
        worstTop = Math.max(worstTop, closeSample.worstTop);
        worstHeight = Math.max(worstHeight, closeSample.worstHeight);
        worstBottom = Math.max(worstBottom, closeSample.worstBottom);
      }

      expect(worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(worstBottom).toBeLessThan(RAPID_TOGGLE_BOTTOM_THRESHOLD_PX);
    });

    test(`(p2-shape) shape=${shape}: no element inside the trigger or sheet paints a box-shadow or filter, open through close`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.click();

      const openPaint = await sampleForStrayPainter(page, 1200);
      expect(openPaint, "open->settle").toBeNull();

      const sheet = page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      await waitForStableWidth(page, sheet);

      const restPaint = await sampleForStrayPainter(page, 200);
      expect(restPaint, "rest").toBeNull();

      await page.keyboard.press("Escape");
      const closePaint = await sampleForStrayPainter(page, 1200);
      expect(closePaint, "close").toBeNull();
    });
  });
}

for (const shape of NON_DEFAULT_SHAPES) {
  for (const viewport of VIEWPORTS) {
    const isBaseViewport = viewport.width === 1280 && viewport.height === 800;
    const modes = isBaseViewport
      ? (["normal", "reduced-motion"] as const)
      : (["normal"] as const);
    for (const mode of modes) {
      const reduced = mode === "reduced-motion";

      test.describe(`shape=${shape} — ${viewport.width}x${viewport.height} — ${mode}`, () => {
        test.use({ viewport });

        test(`(o-shape) shape=${shape}: the trigger surface rests at its shape after every close path`, async ({
          page,
        }) => {
          await gotoExample(page, reduced, { shape });
          await expectShapeApplied(page, shape);
          const trigger = page.getByRole("button", { name: TRIGGER_LABEL });

          const expectRestingShape = async (variant: string) => {
            await page.waitForTimeout(1600);
            const r = await page.evaluate(() => {
              const el = document.querySelector(
                '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
              ) as HTMLElement | null;
              if (!el) return null;
              const box = el.getBoundingClientRect();
              return {
                inline: (el.style.borderRadius || "").trim(),
                computed: getComputedStyle(el).borderTopLeftRadius,
                width: box.width,
                cornerShape: getComputedStyle(el)
                  .getPropertyValue("corner-top-left-shape")
                  .trim(),
                supported: CSS.supports("corner-shape", "squircle"),
              };
            });
            expect(
              r,
              `${variant}: the trigger surface must be mounted and measurable at rest`,
            ).not.toBeNull();
            const computedPx = radiusToPx(r!.computed, r!.width);
            expect(
              radiusMatches(shape, computedPx, r!.width, r!.supported),
              `${variant}: computed border-radius ${r!.computed} does not match shape=${shape} on a ${r!.width}px trigger`,
            ).toBe(true);
            expect(
              r!.inline === "" ||
                radiusMatches(
                  shape,
                  radiusToPx(r!.inline, r!.width),
                  r!.width,
                  r!.supported,
                ),
              `${variant}: a stale inline border-radius (${r!.inline}) survived the morph`,
            ).toBe(true);
            if (r!.supported) {
              expect(r!.cornerShape).toBe(
                shape === "squircle" ? "squircle" : "round",
              );
            }
          };

          await trigger.click();
          await page.waitForTimeout(900);
          await page.keyboard.press("Escape");
          await expectRestingShape("simple close");

          await trigger.click();
          await page.waitForTimeout(900);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          await trigger.click();
          await page.waitForTimeout(900);
          await page.keyboard.press("Escape");
          await expectRestingShape("close interrupted by a reopen");

          for (let i = 0; i < 3; i++) {
            await trigger.click();
            await page.waitForTimeout(180);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(180);
          }
          await expectRestingShape("rapid open/close toggle");

          await trigger.click();
          await page.waitForTimeout(900);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(90);
          await page.setViewportSize({
            width: viewport.width,
            height: Math.round(viewport.height * 0.63),
          });
          await expectRestingShape("resize mid-close");
        });
      });
    }
  }
}

for (const shape of ALL_SHAPES) {
  test.describe(`shape=${shape} — 1280x800 — normal — follows shape`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test(`(rt) shape=${shape}: shadow corner radius tracks the surface corner radius through open AND close`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.click();
      const openResult = await sampleShadowSurfaceRadiusDelta(page, 1200);
      expect(openResult.worst).toBeLessThan(RADIUS_TRACK_THRESHOLD_PX);

      await page.keyboard.press("Escape");
      const closeResult = await sampleShadowSurfaceRadiusDelta(page, 1200);
      expect(closeResult.worst).toBeLessThan(RADIUS_TRACK_THRESHOLD_PX);
    });

    test(`(sh) shape=${shape}: shadow, Shared and focus ring follow the shape at rest`, async ({
      page,
    }) => {
      await gotoExample(page, false, { shape });
      await expectShapeApplied(page, shape);

      const triggerSurface = page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
      );
      await waitForStableWidth(page, triggerSurface);
      await page.waitForTimeout(300);

      const closedRest = await page.evaluate(() => {
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
        const surfaceRect = surface.getBoundingClientRect();
        const sharedRect = shared.getBoundingClientRect();
        const sharedStyle = getComputedStyle(shared) as CSSStyleDeclaration & {
          webkitMaskImage?: string;
        };
        return {
          surfaceWidth: surfaceRect.width,
          ringWidth: parseFloat(getComputedStyle(surface).borderTopWidth),
          surfaceRadius: getComputedStyle(surface).borderTopLeftRadius,
          shadowRadius: parseFloat(
            getComputedStyle(shadow).getPropertyValue(
              "--orrery-iris-shadow-radius",
            ),
          ),
          shadowCornerShape: getComputedStyle(shadow)
            .getPropertyValue("corner-top-left-shape")
            .trim(),
          shadowBeforeCornerShape: getComputedStyle(shadow, "::before")
            .getPropertyValue("corner-top-left-shape")
            .trim(),
          shadowAfterCornerShape: getComputedStyle(shadow, "::after")
            .getPropertyValue("corner-top-left-shape")
            .trim(),
          sharedWidth: sharedRect.width,
          sharedRadius: sharedStyle.borderTopLeftRadius,
          sharedMask:
            sharedStyle.maskImage && sharedStyle.maskImage !== "none"
              ? sharedStyle.maskImage
              : (sharedStyle.webkitMaskImage ?? "none"),
          supported: CSS.supports("corner-shape", "squircle"),
        };
      });
      expect(
        closedRest,
        "trigger-surface/shadow/shared must be mounted at rest",
      ).not.toBeNull();

      const surfacePx = radiusToPx(
        closedRest!.surfaceRadius,
        closedRest!.surfaceWidth,
      );
      expect(
        Math.abs(closedRest!.shadowRadius - surfacePx),
      ).toBeLessThanOrEqual(0.5);
      expect(
        radiusMatches(
          shape,
          surfacePx,
          closedRest!.surfaceWidth,
          closedRest!.supported,
        ),
      ).toBe(true);
      if (closedRest!.supported) {
        const expectedCornerShape = shape === "squircle" ? "squircle" : "round";
        expect(closedRest!.shadowCornerShape).toBe(expectedCornerShape);
        expect(closedRest!.shadowBeforeCornerShape).toBe(expectedCornerShape);
        expect(closedRest!.shadowAfterCornerShape).toBe(expectedCornerShape);
      }

      const sharedPx = radiusToPx(
        closedRest!.sharedRadius,
        closedRest!.sharedWidth,
      );
      if (shape === "circle") {
        expect(sharedPx).toBeGreaterThanOrEqual(
          closedRest!.sharedWidth / 2 - 0.5,
        );
        expect(closedRest!.sharedMask).toBe("none");
      } else if (shape === "rounded-square") {
        expect(
          Math.abs(sharedPx - (closedRest!.surfaceWidth * 0.25 - closedRest!.ringWidth)),
        ).toBeLessThanOrEqual(0.5);
        expect(closedRest!.sharedMask).toBe("none");
      } else if (shape === "square") {
        expect(sharedPx).toBeLessThanOrEqual(0.5);
        expect(closedRest!.sharedMask).toBe("none");
      } else {
        expect(sharedPx).toBeLessThanOrEqual(0.5);
        expect(closedRest!.sharedMask).toContain("data:image/svg+xml");
      }

      const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
      await trigger.focus();
      const focusState = await page.evaluate(() => {
        const button = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
        ) as HTMLElement | null;
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        return {
          focusVisible: button.matches(":focus-visible"),
          radius: getComputedStyle(button).borderTopLeftRadius,
          width: rect.width,
          cornerShape: getComputedStyle(button)
            .getPropertyValue("corner-top-left-shape")
            .trim(),
        };
      });
      expect(focusState, "trigger button must be mounted").not.toBeNull();
      expect(focusState!.focusVisible).toBe(true);
      expect(
        radiusMatches(
          shape,
          radiusToPx(focusState!.radius, focusState!.width),
          focusState!.width,
          closedRest!.supported,
        ),
      ).toBe(true);
      if (closedRest!.supported) {
        expect(focusState!.cornerShape).toBe(
          shape === "squircle" ? "squircle" : "round",
        );
      }

      await openSheet(page);
      const openRest = await page.evaluate(() => {
        const sheet = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        ) as HTMLElement | null;
        const shadow = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
        ) as HTMLElement | null;
        const shared = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shared"][data-orrery-iris-slot="sheet"]',
        ) as HTMLElement | null;
        if (!sheet || !shadow || !shared) return null;
        const sheetRect = sheet.getBoundingClientRect();
        const sharedRect = shared.getBoundingClientRect();
        const sharedStyle = getComputedStyle(shared) as CSSStyleDeclaration & {
          webkitMaskImage?: string;
        };
        return {
          sheetCornerShape: getComputedStyle(sheet)
            .getPropertyValue("corner-top-left-shape")
            .trim(),
          sheetRadius: getComputedStyle(sheet).borderTopLeftRadius,
          sheetWidth: sheetRect.width,
          shadowRadius: parseFloat(
            getComputedStyle(shadow).getPropertyValue(
              "--orrery-iris-shadow-radius",
            ),
          ),
          sharedWidth: sharedRect.width,
          sharedRadius: sharedStyle.borderTopLeftRadius,
          sharedMask:
            sharedStyle.maskImage && sharedStyle.maskImage !== "none"
              ? sharedStyle.maskImage
              : (sharedStyle.webkitMaskImage ?? "none"),
          supported: CSS.supports("corner-shape", "squircle"),
        };
      });
      expect(
        openRest,
        "sheet/shadow/shared must be mounted after open",
      ).not.toBeNull();

      if (openRest!.supported) {
        expect(openRest!.sheetCornerShape).toBe(
          shape === "squircle" ? "squircle" : "round",
        );
      }
      const sheetPx = radiusToPx(openRest!.sheetRadius, openRest!.sheetWidth);
      expect(Math.abs(sheetPx - openRest!.shadowRadius)).toBeLessThanOrEqual(
        0.5,
      );

      const sheetSharedPx = radiusToPx(
        openRest!.sharedRadius,
        openRest!.sharedWidth,
      );
      if (shape === "circle") {
        expect(sheetSharedPx).toBeGreaterThanOrEqual(
          openRest!.sharedWidth / 2 - 0.5,
        );
        expect(openRest!.sharedMask).toBe("none");
      } else if (shape === "rounded-square") {
        // The rounded-square radius formula (styles.module.css) is 25% of
        // --orrery-iris-trigger-size minus the ring inset
        // (--orrery-iris-surface-border-width, read off the surface), on BOTH
        // slots — deliberately the SAME source value regardless of slot "so
        // the Shared FLIP has no radius pop" (that CSS's own comment). The
        // trigger's own surface (closedRest!.surfaceWidth) IS
        // --orrery-iris-trigger-size exactly; <Shared> itself renders two
        // ring widths narrower (its inset-ring sizing), so comparing against its
        // own rendered width, or the sheet's much larger outer box, both
        // miss the actual formula input — trigger-size is only recoverable
        // here via the trigger's own surface width, already captured above.
        // Not sheetWidth (the sheet's own, unrelated, much larger box) —
        // that was this assertion's bug before this fix (P2 FIX round 1).
        expect(
          Math.abs(sheetSharedPx - (closedRest!.surfaceWidth * 0.25 - closedRest!.ringWidth)),
        ).toBeLessThanOrEqual(0.5);
        expect(openRest!.sharedMask).toBe("none");
      } else if (shape === "square") {
        expect(sheetSharedPx).toBeLessThanOrEqual(0.5);
        expect(openRest!.sharedMask).toBe("none");
      } else {
        expect(sheetSharedPx).toBeLessThanOrEqual(0.5);
        expect(openRest!.sharedMask).toContain("data:image/svg+xml");
      }
    });
  });
}

/**
 * (k) — D4: a consumer's transition.open delay must reach BOTH clocks (the
 * layoutId FLIP on <Sheet> and the collapseProgress spring driving
 * <Shadow>), not just one. Root.tsx's drivenOpenTransition used to strip the
 * consumer's delay from collapseProgress alone (forcing delay: 0) while
 * Sheet.tsx passed transition.open through untouched — exactly the class of
 * desync D1/D2 fixed, but reachable through a documented public prop.
 *
 * example/main.tsx plumbs `?openDelay=<seconds>` into transition.open. A
 * consumer-set 250ms delay should hold the surface AND the shadow at the
 * trigger's own box for (most of) that window — sampled at 120ms in, well
 * before the delay elapses, so a broken clock has already visibly diverged
 * but a working one hasn't started moving yet.
 */
test.describe("1280x800 — normal — D4 consumer delay", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(k) shadow and surface both honour transition.open's delay", async ({
    page,
  }) => {
    await gotoExample(page, false, { openDelay: "0.25" });
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();

    await page.waitForTimeout(120);
    const midDelay = await page.evaluate(() => {
      const surface = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      const shadow = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
      );
      if (!surface || !shadow) return null;
      const s = surface.getBoundingClientRect();
      const sh = shadow.getBoundingClientRect();
      return {
        top: Math.abs(sh.top - s.top),
        bottom: Math.abs(sh.bottom - s.bottom),
      };
    });
    expect(midDelay, "sheet must be mounted 120ms after click").not.toBeNull();
    console.log(
      `[geometry] 1280x800 D4 mid-delay(120ms of 250ms): ` +
        `|Δtop|=${midDelay!.top.toFixed(1)}px, |Δbottom|=${midDelay!.bottom.toFixed(1)}px`,
    );
    // Both clocks are still inside the consumer's 250ms delay window at
    // 120ms — a working component holds both at the trigger's box (near 0
    // desync). A stripped delay on one clock alone (the D4 bug) lets that
    // clock run ahead for the whole 120ms window, which measured 182.7px at
    // 1280 pre-fix.
    expect(midDelay!.top).toBeLessThan(10);
    expect(midDelay!.bottom).toBeLessThan(10);
  });
});

/**
 * Frame-samples every element inside the trigger root or the sheet (both
 * subtrees, every descendant) — AND each element's ::before/::after — for a
 * computed `box-shadow` or `filter` other than `none`, for `durationMs`, via
 * an in-page rAF loop. `[data-orrery-iris-part="shadow"]` and its
 * descendants are excluded — that element (and only that element, via its
 * own ::before/::after) is the one documented painter (DESIGN.md §4.1) —
 * but it is never a descendant of trigger-root or sheet in this example
 * (Shadow, Trigger, and Sheet are siblings under Iris.Root), so the
 * exclusion here only matters if a future example nests it. `filter` is
 * checked alongside `box-shadow` because `filter: drop-shadow(...)` is the
 * same class of second painter — a shadow rendered outside Shadow.tsx's one
 * silhouette — that a plain box-shadow guard would miss entirely. Returns
 * the first offending element/pseudo found (tag + its data-orrery-iris-part,
 * if any + which pseudo-element + which property + its value) or null.
 */
async function sampleForStrayPainter(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<{
      tag: string;
      part: string | null;
      pseudo: "" | "::before" | "::after";
      property: "box-shadow" | "filter";
      value: string;
    } | null>((resolve) => {
      let found: {
        tag: string;
        part: string | null;
        pseudo: "" | "::before" | "::after";
        property: "box-shadow" | "filter";
        value: string;
      } | null = null;
      const start = performance.now();
      function tick() {
        if (!found) {
          const nodes = document.querySelectorAll(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-root"], ' +
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-root"] *, ' +
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"], ' +
              '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"] *',
          );
          outer: for (const el of Array.from(nodes)) {
            if (
              el.closest(
                '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
              )
            )
              continue;
            const pseudos: ("" | "::before" | "::after")[] = [
              "",
              "::before",
              "::after",
            ];
            for (const pseudo of pseudos) {
              const style = getComputedStyle(el, pseudo || undefined);
              const bs = style.boxShadow;
              if (bs && bs !== "none") {
                found = {
                  tag: el.tagName.toLowerCase(),
                  part: el.getAttribute("data-orrery-iris-part"),
                  pseudo,
                  property: "box-shadow",
                  value: bs,
                };
                break outer;
              }
              const filter = style.filter;
              if (filter && filter !== "none") {
                found = {
                  tag: el.tagName.toLowerCase(),
                  part: el.getAttribute("data-orrery-iris-part"),
                  pseudo,
                  property: "filter",
                  value: filter,
                };
                break outer;
              }
            }
          }
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve(found);
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

/**
 * Frame-samples the sheet's computed `mask-image` for `durationMs`. Used to
 * assert the sheet never carries a mask while `open` is true, including
 * through an interrupted close (CloseMask.tsx's contract — see its own
 * comment on why `open`, not collapseProgress.getVelocity(), is the correct
 * flag). Returns the first non-"none" value seen, or "".
 */
async function sampleForStrayMask(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<string>((resolve) => {
      let firstNonNone = "";
      const start = performance.now();
      function tick() {
        const sheet = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        if (sheet) {
          const mi = getComputedStyle(sheet).maskImage;
          if (mi && mi !== "none" && !firstNonNone) firstNonNone = mi;
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve(firstNonNone);
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

/**
 * (p) Regression gate for the shadow-pop fix: one painter, one clock
 * (DESIGN.md §4.1). Before the fix, `.sheet[data-orrery-iris-settled]`
 * painted its own `--orrery-iris-sheet-shadow` box-shadow starting 240ms
 * after settle — a second painter/second clock that a demo close-mask
 * (driven by collapseProgress velocity, itself a symptom of the same
 * "second clock" class of bug) could clip for one frame. Deliberately broken
 * to confirm this test can fail: restoring that CSS rule (uncommented,
 * `[data-orrery-iris-settled] { box-shadow: var(--orrery-iris-sheet-shadow, ...) }`)
 * turned this red — the sheet's computed box-shadow was no longer "none"
 * once settled — then reverted, both checked in the shadow-pop-fix commit.
 */
test.describe("1280x800 — normal — shadow crossfade (single painter)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(p) sheet paints no box-shadow through open->settle, Shadow's sheet-shadow opacity is ~1 at open rest", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();

    // Frame-sample the sheet's COMPUTED box-shadow (not the inline style —
    // this must catch a shadow painted by any CSS rule, including a
    // resurrected `[data-orrery-iris-settled]` one) for 1.2s, covering the
    // open spring's settle. Any non-"none" value at any sampled frame fails.
    const seenBoxShadow = await page.evaluate((duration) => {
      return new Promise<string>((resolve) => {
        let firstNonNone = "";
        const start = performance.now();
        function tick() {
          const sheet = document.querySelector(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
          );
          if (sheet) {
            const bs = getComputedStyle(sheet).boxShadow;
            if (bs && bs !== "none" && !firstNonNone) firstNonNone = bs;
          }
          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve(firstNonNone);
          }
        }
        requestAnimationFrame(tick);
      });
    }, 1200);

    console.log(
      `[geometry] (p) open->settle sheet box-shadow: ${
        seenBoxShadow || "none at every sampled frame"
      }`,
    );
    expect(seenBoxShadow).toBe("");

    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await waitForStableWidth(page, sheet);

    const restState = await page.evaluate(() => {
      const sheetEl = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      const shadowEl = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
      );
      return {
        sheetBoxShadow: sheetEl ? getComputedStyle(sheetEl).boxShadow : null,
        sheetMaskImage: sheetEl ? getComputedStyle(sheetEl).maskImage : null,
        sheetShadowOpacity: shadowEl
          ? getComputedStyle(shadowEl)
              .getPropertyValue("--orrery-iris-sheet-shadow-opacity")
              .trim()
          : null,
      };
    });
    console.log(
      `[geometry] (p) at open rest: box-shadow=${restState.sheetBoxShadow}, ` +
        `mask-image=${restState.sheetMaskImage}, ` +
        `--orrery-iris-sheet-shadow-opacity=${restState.sheetShadowOpacity}`,
    );
    expect(restState.sheetBoxShadow).toBe("none");
    expect(["none", null]).toContain(restState.sheetMaskImage);
    expect(Number(restState.sheetShadowOpacity)).toBeGreaterThan(0.95);
  });

  /**
   * (p2) Hardens (p) against the MECHANISM, not just the one instance: (p)
   * only ever looked at the sheet element's own box-shadow. This checks
   * every element inside the trigger root or the sheet — and each one's
   * ::before/::after — for a box-shadow OR a filter, across open, settle,
   * rest, AND close. A stray painter anywhere else in the component (e.g. a
   * revived box-shadow on .triggerSurface, or a filter: drop-shadow(...) —
   * the same class of second painter under a different CSS property, which
   * (p) never touches at all) would pass (p) while still producing a shadow
   * pop. Single-painter (DESIGN.md §4.1): only <Iris.Shadow>'s own
   * ::before/::after may ever paint one.
   *
   * Proven twice to fail (P2 task 1 report has the pasted red lines for
   * both, then each reverted via `git checkout -- src/styles.module.css`):
   * (i) `filter: drop-shadow(0 0 1px red);` added to `.triggerSurface`;
   * (ii) `.triggerSurface::after { content: ""; box-shadow: 0 0 0 1px red; }`
   * added. Both turned this test red.
   */
  test("(p2) no element inside the trigger or sheet paints a box-shadow or filter, open through close", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();

    const openPaint = await sampleForStrayPainter(page, 1200);
    console.log(
      `[geometry] (p2) open->settle stray painter: ${
        openPaint
          ? JSON.stringify(openPaint)
          : "none at any sampled element/frame"
      }`,
    );
    expect(openPaint, "open->settle").toBeNull();

    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await waitForStableWidth(page, sheet);

    const restPaint = await sampleForStrayPainter(page, 200);
    console.log(
      `[geometry] (p2) rest stray painter: ${
        restPaint
          ? JSON.stringify(restPaint)
          : "none at any sampled element/frame"
      }`,
    );
    expect(restPaint, "rest").toBeNull();

    await page.keyboard.press("Escape");
    const closePaint = await sampleForStrayPainter(page, 1200);
    console.log(
      `[geometry] (p2) close stray painter: ${
        closePaint
          ? JSON.stringify(closePaint)
          : "none at any sampled element/frame"
      }`,
    );
    expect(closePaint, "close").toBeNull();
  });

  /**
   * (p3) Hardens (p)'s mask-image check against the MECHANISM
   * (CloseMask.tsx's `open` flag), not just an open that runs to
   * completion: starts a close, re-opens before it finishes (the exact
   * shape a fast double-tap produces — see test (n) above), and asserts the
   * sheet carries no mask-image through that re-open or at its eventual
   * rest.
   *
   * Deliberately broken to confirm this test can fail: reverted
   * CloseMask.tsx's guard from `if (open)` back to the prior (wrong)
   * `collapseProgress.getVelocity() > 0` inference — turned red at the
   * `expect(maskDuringReopen, ...)` assertion (line ~1225 below), reporting
   * a non-"none" `linear-gradient(...)` value during the re-open — then
   * reverted (git diff shows only this test file changed).
   */
  test("(p3) sheet carries no mask-image through a close interrupted by a re-open", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    await trigger.click();
    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await sheet.waitFor();
    await waitForStableWidth(page, sheet);

    await page.keyboard.press("Escape");
    // Mid-close, well before the close spring/hold settles — CloseMask is
    // legitimately painting a mask here (open === false). Not sampled.
    await page.waitForTimeout(150);
    await trigger.click();

    const maskDuringReopen = await sampleForStrayMask(page, 1200);
    console.log(
      `[geometry] (p3) mask-image through interrupted-close re-open: ${
        maskDuringReopen || "none at every sampled frame"
      }`,
    );
    expect(maskDuringReopen, "re-open").toBe("");

    await waitForStableWidth(page, sheet);
    const maskAtRest = await page.evaluate(() => {
      const sheetEl = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      return sheetEl ? getComputedStyle(sheetEl).maskImage : null;
    });
    console.log(`[geometry] (p3) mask-image at rest: ${maskAtRest}`);
    expect(["none", null]).toContain(maskAtRest);
  });
});

/**
 * Center anchor — the seven-anchor model (anchors.ts, 2026-09-11). Uses
 * localStorage (not defaultAnchor) to set the anchor before load, so the
 * mount-time restore path (usePersistedAnchor) is what's actually
 * exercised, not just the default-anchor branch.
 *
 * Deliberately does NOT reuse BOTTOM_THRESHOLD_PX (the |Δbottom| assertion
 * from (e)/(f)/etc. above) — that axis is only informative for a
 * bottom-pinned box, where a healthy desync leaves the bottom edge
 * algebraically invariant. The center anchor pins BOTH top and bottom, so
 * bottom isn't a distinguishing axis here; centre-offset is.
 */
const ANCHOR_STORAGE_KEY = "orrery-iris-anchor";

async function gotoWithAnchor(page: Page, anchor: string, path = "/") {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [ANCHOR_STORAGE_KEY, anchor] as [string, string],
  );
  await page.goto(path);
  // Index ("/") renders a second Root (the settings sheet), scoped by
  // `data-orrery-iris-root="main"`; flagship.html has exactly one Root and
  // no such id, so it stays unscoped there.
  const scope = path === "/" ? '[data-orrery-iris-root="main"] ' : "";
  await page.waitForSelector(`${scope}[data-orrery-iris-part="trigger"]`);
}

/** Same rAF sampling loop as sampleShadowSurfaceDelta, plus the two
 * centre-offset axes the center anchor needs: shadow-vs-surface centre
 * distance, and surface-centre-vs-viewport-midpoint distance. */
async function sampleCenterAnchorDelta(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<{
      worstTop: number;
      worstHeight: number;
      worstShadowSurfaceCenter: number;
      worstSurfaceViewportCenter: number;
    }>((resolve) => {
      let worstTop = 0;
      let worstHeight = 0;
      let worstShadowSurfaceCenter = 0;
      let worstSurfaceViewportCenter = 0;
      const start = performance.now();
      function tick() {
        const surface = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"], [data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
        );
        const shadow = document.querySelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="shadow"]',
        );
        if (surface && shadow) {
          const s = surface.getBoundingClientRect();
          const sh = shadow.getBoundingClientRect();
          worstTop = Math.max(worstTop, Math.abs(sh.top - s.top));
          worstHeight = Math.max(worstHeight, Math.abs(sh.height - s.height));
          const sCenterX = s.left + s.width / 2;
          const sCenterY = s.top + s.height / 2;
          const shCenterX = sh.left + sh.width / 2;
          const shCenterY = sh.top + sh.height / 2;
          worstShadowSurfaceCenter = Math.max(
            worstShadowSurfaceCenter,
            Math.hypot(sCenterX - shCenterX, sCenterY - shCenterY),
          );
          const vpMidX = window.innerWidth / 2;
          const vpMidY = window.innerHeight / 2;
          worstSurfaceViewportCenter = Math.max(
            worstSurfaceViewportCenter,
            Math.hypot(sCenterX - vpMidX, sCenterY - vpMidY),
          );
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve({
            worstTop,
            worstHeight,
            worstShadowSurfaceCenter,
            worstSurfaceViewportCenter,
          });
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

test.describe("center anchor", () => {
  const CENTER_VIEWPORTS = [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
    { width: 1700, height: 1000 },
  ] as const;

  for (const viewport of CENTER_VIEWPORTS) {
    test(`(q) trigger rests at viewport centre at ${viewport.width}x${viewport.height} (AC1)`, async ({
      page,
    }) => {
      test.info().annotations.push({
        type: "viewport",
        description: `${viewport.width}x${viewport.height}`,
      });
      await page.setViewportSize(viewport);
      await gotoWithAnchor(page, "center");

      const trigger = page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
      );
      await waitForStableWidth(page, trigger);
      const box = (await trigger.boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      console.log(
        `[geometry] (q) ${viewport.width}x${viewport.height} trigger centre: ` +
          `(${cx.toFixed(2)}, ${cy.toFixed(2)}), viewport mid: ` +
          `(${(viewport.width / 2).toFixed(2)}, ${(viewport.height / 2).toFixed(2)})`,
      );
      expect(Math.abs(cx - viewport.width / 2)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(cy - viewport.height / 2)).toBeLessThanOrEqual(0.5);
    });
  }

  test("(r) open sheet is centred within 1px and >=16px from both edges on a short viewport with scrolling content (AC3)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 280 });
    // flagship.html — a photo, a five-row nav, a real type ramp — so the
    // sheet's content genuinely overflows the height-capped box and
    // scrolls, rather than fitting and making the height cap moot.
    // flagship.html is off-limits/unmodified — one Root, no
    // `data-orrery-iris-root="main"` id, so it stays unscoped here.
    await gotoWithAnchor(page, "center", "/flagship.html");

    const trigger = page.locator('[data-orrery-iris-part="trigger"]');
    await trigger.click();
    const sheet = page.locator('[data-orrery-iris-part="sheet"]');
    await sheet.waitFor();
    await waitForStableWidth(page, sheet);

    const metrics = await page.evaluate(() => {
      const sheetEl = document.querySelector(
        '[data-orrery-iris-part="sheet"]',
      )!;
      const box = sheetEl.getBoundingClientRect();
      const content = sheetEl.querySelector(
        '[data-orrery-iris-part="content"]',
      ) as HTMLElement | null;
      return {
        top: box.top,
        bottom: box.bottom,
        centerY: box.top + box.height / 2,
        viewportHeight: window.innerHeight,
        scrollHeight: content?.scrollHeight ?? 0,
        clientHeight: content?.clientHeight ?? 0,
      };
    });
    console.log(
      `[geometry] (r) 800x280 sheet: top=${metrics.top.toFixed(1)}, ` +
        `bottom=${metrics.bottom.toFixed(1)}, centerY=${metrics.centerY.toFixed(1)}, ` +
        `scrollHeight=${metrics.scrollHeight}, clientHeight=${metrics.clientHeight}`,
    );
    expect(
      metrics.scrollHeight,
      "content must actually overflow its box for this test to exercise the height cap",
    ).toBeGreaterThan(metrics.clientHeight);
    expect(Math.abs(metrics.centerY - metrics.viewportHeight / 2)).toBeLessThan(
      1,
    );
    expect(metrics.top).toBeGreaterThanOrEqual(16 - 0.5);
    expect(metrics.viewportHeight - metrics.bottom).toBeGreaterThanOrEqual(
      16 - 0.5,
    );
  });

  const CENTER_OPEN_THRESHOLD_PX = 8;
  const CENTER_CLOSE_THRESHOLD_PX = 6;
  const CENTER_CENTER_OFFSET_PX = 2;

  test("(s) same clock at center: open, Escape close, swipe close (AC4)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoWithAnchor(page, "center");
    const trigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );

    // Open.
    await trigger.click();
    const openResult = await sampleCenterAnchorDelta(page, 1200);
    console.log(
      `[geometry] (s) center open: worst |Δtop|=${openResult.worstTop.toFixed(1)}px, ` +
        `worst |Δheight|=${openResult.worstHeight.toFixed(1)}px, ` +
        `worst shadow-surface centre=${openResult.worstShadowSurfaceCenter.toFixed(1)}px, ` +
        `worst surface-viewport centre=${openResult.worstSurfaceViewportCenter.toFixed(1)}px`,
    );
    expect(openResult.worstTop).toBeLessThan(CENTER_OPEN_THRESHOLD_PX);
    expect(openResult.worstHeight).toBeLessThan(CENTER_OPEN_THRESHOLD_PX);
    expect(openResult.worstShadowSurfaceCenter).toBeLessThan(
      CENTER_CENTER_OFFSET_PX,
    );
    expect(openResult.worstSurfaceViewportCenter).toBeLessThan(
      CENTER_CENTER_OFFSET_PX,
    );

    // Escape close.
    await page.keyboard.press("Escape");
    const escapeResult = await sampleCenterAnchorDelta(page, 1200);
    console.log(
      `[geometry] (s) center Escape close: worst |Δtop|=${escapeResult.worstTop.toFixed(1)}px, ` +
        `worst |Δheight|=${escapeResult.worstHeight.toFixed(1)}px, ` +
        `worst shadow-surface centre=${escapeResult.worstShadowSurfaceCenter.toFixed(1)}px`,
    );
    expect(escapeResult.worstTop).toBeLessThan(CENTER_CLOSE_THRESHOLD_PX);
    expect(escapeResult.worstHeight).toBeLessThan(CENTER_CLOSE_THRESHOLD_PX);
    expect(escapeResult.worstShadowSurfaceCenter).toBeLessThan(
      CENTER_CENTER_OFFSET_PX,
    );

    // Swipe close.
    await trigger.click();
    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await sheet.waitFor();
    await waitForStableWidth(page, sheet);
    const box = (await sheet.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + 8;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 220, { steps: 6 });
    await page.mouse.up();
    const swipeResult = await sampleCenterAnchorDelta(page, 1200);
    console.log(
      `[geometry] (s) center swipe close: worst |Δtop|=${swipeResult.worstTop.toFixed(1)}px, ` +
        `worst |Δheight|=${swipeResult.worstHeight.toFixed(1)}px, ` +
        `worst shadow-surface centre=${swipeResult.worstShadowSurfaceCenter.toFixed(1)}px`,
    );
    expect(swipeResult.worstTop).toBeLessThan(CENTER_CLOSE_THRESHOLD_PX);
    expect(swipeResult.worstHeight).toBeLessThan(CENTER_CLOSE_THRESHOLD_PX);
    expect(swipeResult.worstShadowSurfaceCenter).toBeLessThan(
      CENTER_CENTER_OFFSET_PX,
    );
  });

  test("(t) trigger rests as a circle after closing at center (AC5)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoWithAnchor(page, "center");
    const trigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    await trigger.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1600);

    const r = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger-surface"]',
      ) as HTMLElement | null;
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return {
        computed: getComputedStyle(el).borderTopLeftRadius,
        width: box.width,
        height: box.height,
      };
    });
    expect(
      r,
      "trigger surface must be mounted and measurable at rest",
    ).not.toBeNull();
    const half = Math.min(r!.width, r!.height) / 2;
    const isCircular = (value: string) =>
      value.trim().endsWith("%")
        ? parseFloat(value) >= 50
        : parseFloat(value) >= half - 0.5;
    console.log(
      `[geometry] (t) center resting trigger radius computed=${r!.computed} ` +
        `box=${r!.width.toFixed(0)}x${r!.height.toFixed(0)}`,
    );
    expect(isCircular(r!.computed)).toBe(true);
  });

  test("(u) center persists across reload; a persisted top-right restores; an invalid persisted anchor falls back to bottom-center (AC6)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Drag the trigger to the exact viewport centre and release, so the
    // real drag-end -> nearestAnchor -> setAnchor -> persist path is what
    // writes localStorage, not a manual seed of it.
    await gotoExample(page, false);
    const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
    const startBox = (await trigger.boundingBox())!;
    const startX = startBox.x + startBox.width / 2;
    const startY = startBox.y + startBox.height / 2;
    const targetX = 640;
    const targetY = 400;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900); // let the snap spring settle

    const persisted = await page.evaluate(() =>
      window.localStorage.getItem("orrery-iris-anchor"),
    );
    expect(persisted).toBe("center");

    await page.reload();
    await page.waitForSelector(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    const restoredTrigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, restoredTrigger);
    const restoredBox = (await restoredTrigger.boundingBox())!;
    expect(
      Math.abs(restoredBox.x + restoredBox.width / 2 - 640),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(restoredBox.y + restoredBox.height / 2 - 400),
    ).toBeLessThanOrEqual(0.5);

    // A legitimate persisted non-center anchor still restores correctly.
    await gotoWithAnchor(page, "top-right");
    const topRightTrigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, topRightTrigger);
    const topRightBox = (await topRightTrigger.boundingBox())!;
    expect(topRightBox.x + topRightBox.width).toBeGreaterThan(1280 - 32 - 16);
    expect(topRightBox.y).toBeLessThan(32);

    // An invalid persisted value (the old six-anchor model plus a bogus
    // "middle-center" someone could hand-edit into localStorage) is
    // rejected by usePersistedAnchor's isAnchorId guard and falls back to
    // DEFAULT_ANCHOR ("bottom-center"), never to the invalid value itself.
    await gotoWithAnchor(page, "middle-center");
    const fallbackTrigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, fallbackTrigger);
    const fallbackBox = (await fallbackTrigger.boundingBox())!;
    // bottom-center IS horizontally centered too (same as the real center
    // anchor) — the distinguishing axis is vertical: bottom-center sits
    // pinned near the bottom edge, not at the vertical midpoint (400) the
    // way a restored "center" would.
    expect(
      Math.abs(fallbackBox.x + fallbackBox.width / 2 - 640),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(fallbackBox.y + fallbackBox.height / 2 - 400),
    ).toBeGreaterThan(50);
    expect(fallbackBox.y + fallbackBox.height).toBeGreaterThan(800 - 32 - 16); // pinned to the bottom edge, like bottom-center
  });
});

/**
 * (q) Regression gate for the max-height model change (anchors.ts
 * `sheetMaxHeight`, replacing the single shared `.sheet` CSS cap that
 * shortened every top-pinned sheet by ~64px — see git history around
 * f55cb3d/28ab824). Hard-coded against the d020d91 formulas: top-pinned was
 * `calc(100dvh - 32px)`, bottom-pinned the flat `88dvh`; center has no
 * d020d91 precedent and keeps `min(88dvh, calc(100dvh - 32px))`.
 *
 * Sets the persisted anchor directly via localStorage (the same key
 * `usePersistedAnchor` reads, `orrery-iris-anchor`) rather than simulating a
 * drag — anchor selection isn't under test here, only the resulting
 * max-height. Injects a 3000px-tall filler node into the sheet's content
 * after opening so the cap is actually load-bearing (a short sheet would
 * pass this test even with the regression reapplied, since nothing would
 * be there to clip).
 */
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1700, height: 1000 },
] as const) {
  test.describe(`${viewport.width}x${viewport.height} — normal — max-height per anchor (q)`, () => {
    test.use({ viewport });

    const TOP_PINNED_PX = viewport.height - 32;
    const BOTTOM_PINNED_PX = viewport.height * 0.88;
    const CENTER_PX = Math.min(BOTTOM_PINNED_PX, TOP_PINNED_PX);

    const EXPECTED: Record<AnchorId, number> = {
      "top-left": TOP_PINNED_PX,
      "top-center": TOP_PINNED_PX,
      "top-right": TOP_PINNED_PX,
      "bottom-left": BOTTOM_PINNED_PX,
      "bottom-center": BOTTOM_PINNED_PX,
      "bottom-right": BOTTOM_PINNED_PX,
      center: CENTER_PX,
    };

    for (const anchor of ALL_ANCHORS) {
      test(`anchor "${anchor}" caps at ${EXPECTED[anchor].toFixed(1)}px`, async ({
        page,
      }) => {
        await page.addInitScript(
          (a) => window.localStorage.setItem("orrery-iris-anchor", a),
          anchor,
        );
        await page.goto("/");
        await page.waitForSelector(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
        );
        await page.getByRole("button", { name: TRIGGER_LABEL }).click();

        const sheet = page.locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        );
        await sheet.waitFor();
        await waitForStableWidth(page, sheet);

        // Force real overflow so the cap is load-bearing, not just declared.
        await page.evaluate(() => {
          const content = document.querySelector(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="content"]',
          );
          const filler = document.createElement("div");
          filler.style.height = "3000px";
          content?.appendChild(filler);
        });
        await page.waitForTimeout(50);

        const measured = await sheet.evaluate((el) => ({
          computedMaxHeight: Number.parseFloat(
            getComputedStyle(el).maxHeight || "0",
          ),
          renderedHeight: el.getBoundingClientRect().height,
        }));

        console.log(
          `[geometry] ${viewport.width}x${viewport.height} anchor=${anchor}: ` +
            `computed max-height=${measured.computedMaxHeight.toFixed(1)}px, ` +
            `expected=${EXPECTED[anchor].toFixed(1)}px, ` +
            `rendered height=${measured.renderedHeight.toFixed(1)}px`,
        );

        // 1px tolerance for dvh/vh rounding in headless Chrome.
        expect(measured.computedMaxHeight).toBeCloseTo(EXPECTED[anchor], 0);
        expect(measured.renderedHeight).toBeLessThanOrEqual(
          EXPECTED[anchor] + 1,
        );
      });
    }
  });
}

/**
 * Design settings sheet (a second, independent Iris.Root, `id="settings"`)
 * replacing the old fixed "Iridescent shadow" pill. Scoped to
 * `[data-orrery-iris-root="settings"]` the same way every other test above is
 * scoped to `"main"` — both roots render `[data-orrery-iris-part="trigger"]`
 * etc, so an unscoped locator here would be ambiguous too.
 */
test.describe("Design settings sheet", () => {
  const SETTINGS_LABEL = "Design settings";

  test("(v) settings trigger renders at top-right by default", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const trigger = page.locator(
      '[data-orrery-iris-root="settings"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, trigger);
    const box = (await trigger.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeGreaterThan(viewport.width - 32 - 16);
    expect(box.y).toBeLessThan(32);
  });

  test("(w) opening it shows the 8 controls", async ({ page }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();

    await expect(
      page.getByRole("switch", { name: "Iridescent shadow" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Glow colour" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Glow strength" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Shadow speed" }),
    ).toBeVisible();
    await expect(page.getByRole("switch", { name: "Dark mode" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Surface" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Trigger size" }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Show dials" }),
    ).toBeVisible();
  });

  // (x2): the review's finding — toggling used to switch the page ground
  // only, leaving both sheets white-on-black. This asserts BOTH the page
  // ground and the main sheet's own computed surface background change.
  // Main sheet is opened/closed BEFORE and AFTER the toggle (not held open
  // across it) — its backdrop's outside-click dismiss would otherwise
  // swallow the settings-trigger click in between.
  test("(x) toggling Dark mode changes the page background and the main sheet's surface", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const bodyBefore = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await openSheet(page);
    const sheetBefore = await sheet.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 5000 });

    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await page.waitForTimeout(50);
    await page.keyboard.press("Escape");
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor({ state: "detached", timeout: 5000 });

    const bodyAfter = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    await openSheet(page);
    const sheetAfter = await sheet.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bodyAfter).not.toBe(bodyBefore);
    expect(sheetAfter).not.toBe(sheetBefore);
  });

  test("(y) Dark mode persists across reload", async ({ page }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await page.waitForTimeout(50);

    await page.reload();
    await page.waitForSelector(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    const isDark = await page.evaluate(() => document.body.dataset.darkMode);
    expect(isDark).toBe("true");
  });

  test("(z) the main sheet still opens with settings present", async ({
    page,
  }) => {
    await gotoExample(page, false);
    await openSheet(page);
    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    await expect(sheet).toBeVisible();
  });

  // (z2): review finding 1 — .triggerSurface (position:absolute, z-index
  // auto) always painted above a plain (non-Shared) Trigger child, so the
  // SlidersIcon never appeared. Sampling the exact centre of the settings
  // trigger button (the SlidersIcon's middle line runs corner-to-corner
  // through it by construction) via elementFromPoint: pre-fix this returns
  // the trigger-surface div (closest("svg") is null); post-fix it returns a
  // node inside the icon's <svg>.
  test("(z2) the SlidersIcon paints above the seed surface, not underneath it", async ({
    page,
  }) => {
    await gotoExample(page, false);
    const trigger = page.locator(
      '[data-orrery-iris-root="settings"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, trigger);
    const box = (await trigger.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const hitsIcon = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest("svg") !== null : false;
      },
      { x: cx, y: cy },
    );
    expect(hitsIcon).toBe(true);
  });

  // (z3): Warm surface's palette used to be an inline style on `.page`,
  // which always outranks body[data-dark-mode]'s dark tokens in the cascade
  // — Warm + Dark mode painted cream sheets on a black page. Now both
  // resolve from body[data-surface]/[data-dark-mode] cells with no inline
  // override to win.
  test("(z3) Warm + Dark mode paints the warm dark cell, not the light warm surface", async ({
    page,
  }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("combobox", { name: "Surface" }).selectOption("warm");
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await page.waitForTimeout(50);
    await page.keyboard.press("Escape");
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor({ state: "detached", timeout: 5000 });

    await openSheet(page);
    const sheet = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
    );
    const bg = await sheet.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // #f4f0e8 (light warm's elevated/sheet colour) would be
    // rgb(244, 240, 232) — the bug this guards against. #29241f (warm dark
    // strawman's elevated/sheet colour) is rgb(41, 36, 31).
    expect(bg).not.toBe("rgb(244, 240, 232)");
    expect(bg).toBe("rgb(41, 36, 31)");
  });

  // (z4): Glow strength (Light/Medium/Bold) supplies per-palette
  // opacity/length/blur onto the live iridescent dials — Light must be a
  // visibly lower --iri-opacity than Bold for the same palette.
  test("(z4) Glow strength Light sets a lower --iri-opacity than Bold on Mono", async ({
    page,
  }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("switch", { name: "Iridescent shadow" }).click();
    await page
      .getByRole("combobox", { name: "Glow colour" })
      .selectOption("Mono");

    await page
      .getByRole("combobox", { name: "Glow strength" })
      .selectOption("Bold");
    await page.waitForTimeout(50);
    const boldOpacity = await page
      .locator(".iri-shadow")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--iri-opacity"));

    await page
      .getByRole("combobox", { name: "Glow strength" })
      .selectOption("Light");
    await page.waitForTimeout(50);
    const lightOpacity = await page
      .locator(".iri-shadow")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--iri-opacity"));

    expect(Number.parseFloat(lightOpacity)).toBeLessThan(
      Number.parseFloat(boldOpacity),
    );
  });

  // (z5): colour, strength and speed all live in localStorage (dialkit's
  // persisted palette dial, and the demo's own settings blob for strength
  // and speed) — a reload must not silently fall back to defaults.
  test("(z5) reload preserves glow colour, strength and speed", async ({
    page,
  }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("switch", { name: "Iridescent shadow" }).click();
    await page
      .getByRole("combobox", { name: "Glow colour" })
      .selectOption("Neon Gold");
    await page
      .getByRole("combobox", { name: "Glow strength" })
      .selectOption("Light");
    await page
      .getByRole("combobox", { name: "Shadow speed" })
      .selectOption("Variable");
    await page.waitForTimeout(50);

    await page.reload();
    await page.waitForSelector(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();

    await expect(
      page.getByRole("combobox", { name: "Glow colour" }),
    ).toHaveValue("Neon Gold");
    await expect(
      page.getByRole("combobox", { name: "Glow strength" }),
    ).toHaveValue("Light");
    await expect(
      page.getByRole("combobox", { name: "Shadow speed" }),
    ).toHaveValue("Variable");
  });

  // (z6) F2: the glow's rAF spin reads prefers-reduced-motion live (via a
  // matchMedia `change` listener), matching the old CSS-driven spin's
  // behaviour — toggling the OS setting mid-session must stop/start it
  // without a reload.
  test("(z6) reduced motion toggled mid-session stops and resumes the glow spin", async ({
    page,
  }) => {
    await gotoExample(page, false);
    await page.getByRole("button", { name: SETTINGS_LABEL }).click();
    await page
      .locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="sheet"]',
      )
      .waitFor();
    await page.getByRole("switch", { name: "Iridescent shadow" }).click();
    await page
      .getByRole("combobox", { name: "Shadow speed" })
      .selectOption("Fast");

    const readAngle = () =>
      page
        .locator(".iri-shadow")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--iri-angle"));

    await page.waitForTimeout(100);
    const a1 = await readAngle();
    await page.waitForTimeout(150);
    const a2 = await readAngle();
    expect(a1).not.toBe(a2);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    const stopped1 = await readAngle();
    await page.waitForTimeout(150);
    const stopped2 = await readAngle();
    expect(stopped1).toBe(stopped2);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(100);
    const resumed1 = await readAngle();
    await page.waitForTimeout(150);
    const resumed2 = await readAngle();
    expect(resumed1).not.toBe(resumed2);
  });
});

/**
 * Settings-trigger vs main-trigger collision (review finding 2): with the
 * main sheet anchored top-right, the settings trigger (also top-right by
 * default) sat entirely inside the main trigger's larger box at a higher
 * z-index, swallowing its taps. The settings sheet now derives its anchor
 * from the main sheet's — top-right unless main occupies it, then
 * top-left — via `onAnchorChange` (live drags) plus reading the persisted
 * value directly at mount (the localStorage restore inside
 * `usePersistedAnchor` never calls `onAnchorChange`).
 */
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const) {
  test.describe(`${viewport.width}x${viewport.height} — settings vs main trigger collision`, () => {
    test.use({ viewport });

    test("main persisted to top-right pushes the settings trigger to top-left, and both remain independently clickable", async ({
      page,
    }) => {
      await gotoWithAnchor(page, "top-right");

      const mainTrigger = page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
      );
      const settingsTrigger = page.locator(
        '[data-orrery-iris-root="settings"] [data-orrery-iris-part="trigger"]',
      );
      await waitForStableWidth(page, mainTrigger);
      await waitForStableWidth(page, settingsTrigger);

      const mainBox = (await mainTrigger.boundingBox())!;
      const settingsBox = (await settingsTrigger.boundingBox())!;

      console.log(
        `[geometry] ${viewport.width}x${viewport.height} main=${JSON.stringify(mainBox)} settings=${JSON.stringify(settingsBox)}`,
      );

      // Settings trigger sits at top-left: near the left edge, not the right.
      expect(settingsBox.x).toBeLessThan(32 + 16);
      expect(mainBox.x).toBeGreaterThan(viewport.width / 2);

      // The two rects don't intersect.
      const intersects =
        settingsBox.x < mainBox.x + mainBox.width &&
        settingsBox.x + settingsBox.width > mainBox.x &&
        settingsBox.y < mainBox.y + mainBox.height &&
        settingsBox.y + settingsBox.height > mainBox.y;
      expect(intersects).toBe(false);

      // The main trigger still opens its own sheet from its own centre point.
      await page.mouse.click(
        mainBox.x + mainBox.width / 2,
        mainBox.y + mainBox.height / 2,
      );
      await page
        .locator(
          '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
        )
        .waitFor();
    });
  });
}

test.describe("settings vs main trigger collision — live drag", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The collision tests above only cover the mount-time persisted anchor
  // (seeded via localStorage before the first paint). These exercise the
  // live path: dragging the mounted main trigger, and the settings trigger
  // reflowing in response to the real onAnchorChange callback.

  test("dragging the main trigger into top-right moves the settings trigger to top-left", async ({
    page,
  }) => {
    await gotoExample(page, false);

    const mainTrigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    const settingsTrigger = page.locator(
      '[data-orrery-iris-root="settings"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, mainTrigger);
    await waitForStableWidth(page, settingsTrigger);

    // Default anchor is bottom-center — settings starts at top-right.
    const startSettingsBox = (await settingsTrigger.boundingBox())!;
    expect(startSettingsBox.x).toBeGreaterThan(1280 / 2);

    // Drag main into the top-right region and release.
    const startBox = (await mainTrigger.boundingBox())!;
    await page.mouse.move(
      startBox.x + startBox.width / 2,
      startBox.y + startBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(1280 - 20, 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900); // let the snap spring settle

    const mainAtTopRight = (await mainTrigger.boundingBox())!;
    expect(mainAtTopRight.x).toBeGreaterThan(1280 / 2);
    expect(mainAtTopRight.y).toBeLessThan(400); // sanity: top half of the 800px viewport

    const settingsAtTopLeft = (await settingsTrigger.boundingBox())!;
    expect(settingsAtTopLeft.x).toBeLessThan(32 + 16);
    const intersects =
      settingsAtTopLeft.x < mainAtTopRight.x + mainAtTopRight.width &&
      settingsAtTopLeft.x + settingsAtTopLeft.width > mainAtTopRight.x &&
      settingsAtTopLeft.y < mainAtTopRight.y + mainAtTopRight.height &&
      settingsAtTopLeft.y + settingsAtTopLeft.height > mainAtTopRight.y;
    expect(intersects).toBe(false);
  });

  test("dragging the main trigger back out of top-right returns the settings trigger to top-right", async ({
    page,
  }) => {
    await gotoExample(page, false);

    const mainTrigger = page.locator(
      '[data-orrery-iris-root="main"] [data-orrery-iris-part="trigger"]',
    );
    const settingsTrigger = page.locator(
      '[data-orrery-iris-root="settings"] [data-orrery-iris-part="trigger"]',
    );
    await waitForStableWidth(page, mainTrigger);
    await waitForStableWidth(page, settingsTrigger);

    // Drag main into the top-right region first.
    const startBox = (await mainTrigger.boundingBox())!;
    await page.mouse.move(
      startBox.x + startBox.width / 2,
      startBox.y + startBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(1280 - 20, 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900); // let the snap spring settle

    // Sanity: settings did move to top-left before the second drag.
    const settingsAtTopLeft = (await settingsTrigger.boundingBox())!;
    expect(settingsAtTopLeft.x).toBeLessThan(32 + 16);

    // Drag main back out of top-right (to the viewport centre) and release.
    const midBox = (await mainTrigger.boundingBox())!;
    await page.mouse.move(
      midBox.x + midBox.width / 2,
      midBox.y + midBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(640, 400, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900); // let the snap spring settle

    const settingsBackAtTopRight = (await settingsTrigger.boundingBox())!;
    expect(settingsBackAtTopRight.x).toBeGreaterThan(1280 / 2);
  });
});
