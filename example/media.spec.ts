import { test, expect, type Page } from "@playwright/test";

/**
 * media.spec.ts — P4 (video + aspect-ratio sheets), tests-first. Written
 * before src/Media.tsx, src/mediaFit.ts and example/video/main.tsx's real
 * markup exist (P4 task 1 of 5); every "media:"/"media-sizing:" test here is
 * expected to fail against the current tree until later P4 tasks build the
 * component. "media-regression:" tests pass today by design.
 *
 * All tests are scoped to `[data-wicket-iris-root="video"]` (example/video.html)
 * except the one regression test that runs against `/` (`main`).
 */

const MEDIA_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.01;
const MIN_SKEW = 0.15;
const MIN_MORPH_SAMPLES = 8;
// Extra time sampled once `until` is satisfied, so the count keeps including
// a few post-settle steady-state frames (`samples >= 20` was never only a
// mid-morph count) even when the host is slow to schedule paints.
const SETTLE_BUFFER_MS = 500;
// Hang-prevention ceiling for settle-based sampling (see sampleMediaRatio's
// `until` mode) — generous relative to DESIGN.md's ~640ms spring so a busy
// machine still gets to settle instead of having its window clipped early;
// a real stall past this is a genuine failure, not a load artifact.
const MORPH_SAFETY_MS = 20000;

// mirrors example/geometry.spec.ts; never loosen
const OPEN_THRESHOLD_PX = 8;
const CLOSE_THRESHOLD_PX = 6;
const BOTTOM_THRESHOLD_PX = 2;

async function gotoVideo(
  page: Page,
  opts: {
    ratio?: "tall" | "wide" | "narrow";
    anchor?: string;
    shape?: string;
    media?: boolean;
    reduced?: boolean;
  } = {},
) {
  const {
    ratio = "tall",
    anchor = "bottom-center",
    shape = "circle",
    media = true,
    reduced = false,
  } = opts;

  if (reduced) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }

  const qs = new URLSearchParams({
    ratio,
    anchor,
    shape,
    media: media ? "1" : "0",
  }).toString();
  await page.goto(`/video.html?${qs}`);
  await page.waitForSelector(
    '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger"]',
  );

  if (media) {
    await expect(
      page.locator(
        '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"] [data-wicket-iris-part="media"]',
      ),
    ).toBeAttached({ timeout: 5000 });
  }
}

/**
 * In-page rAF sampler (pattern: example/geometry.spec.ts's
 * sampleShadowSurfaceDelta). Samples every media element's rendered box
 * against its enclosing surface (sheet or trigger-surface).
 *
 * `durationMs` is a hang-prevention ceiling, not the real terminator: under
 * CPU contention a fixed wall-clock window can close before the spring (which
 * runs on real elapsed time, not frame count) has produced its peak-skew
 * frame, so a busy machine reads as "never morphed" rather than "morphed
 * slowly". When `until` is given, the sampler instead keeps sampling every
 * rAF tick until the surface reaches the same state Sheet.tsx itself uses to
 * mark the morph finished (`data-wicket-iris-settled` for open; the sheet's
 * removal from the DOM for close), so coverage of the actual morph window is
 * load-independent. `durationMs` still bounds the wait so a genuine stall
 * fails the test instead of hanging it.
 */
async function sampleMediaRatio(
  page: Page,
  durationMs: number,
  until?: "settled" | "removed",
) {
  return page.evaluate(
    ({ duration, ratio, until, settleBuffer }) => {
      return new Promise<{
        samples: number;
        morphSamples: number;
        worstSkew: number;
        worstErr: number;
        coverFailures: number;
        worstCenter: number;
      }>((resolve) => {
        let samples = 0;
        let morphSamples = 0;
        let worstSkew = 0;
        let worstErr = 0;
        let coverFailures = 0;
        let worstCenter = 0;
        let doneAt: number | null = null;
        const start = performance.now();

        function morphDone() {
          if (!until) return false;
          if (until === "removed") {
            return !document.querySelector(
              '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"]',
            );
          }
          const surface = document.querySelector(
            '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"], ' +
              '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"]',
          );
          return !!surface?.hasAttribute("data-wicket-iris-settled");
        }

        function tick() {
          const els = document.querySelectorAll(
            '[data-wicket-iris-root="video"] [data-wicket-iris-part="media"] > video, ' +
              '[data-wicket-iris-root="video"] [data-wicket-iris-part="media"] > img',
          );
          for (const el of Array.from(els)) {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;

            const surface = el.closest(
              '[data-wicket-iris-part="sheet"], [data-wicket-iris-part="trigger-surface"]',
            ) as HTMLElement | null;
            if (!surface) continue;
            const s = surface.getBoundingClientRect();
            const sx = s.width / surface.offsetWidth;
            const sy = s.height / surface.offsetHeight;

            samples++;
            if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) {
              morphSamples++;
              worstSkew = Math.max(worstSkew, Math.abs(sx / sy - 1));
            }

            worstErr = Math.max(
              worstErr,
              Math.abs(r.width / r.height / ratio - 1),
            );

            const padW = (s.width * surface.clientWidth) / surface.offsetWidth;
            const padH =
              (s.height * surface.clientHeight) / surface.offsetHeight;
            if (r.width < padW - 1 || r.height < padH - 1) {
              coverFailures++;
            }

            const dCenterX = Math.abs(
              r.left + r.width / 2 - (s.left + s.width / 2),
            );
            const dCenterY = Math.abs(
              r.top + r.height / 2 - (s.top + s.height / 2),
            );
            worstCenter = Math.max(worstCenter, dCenterX, dCenterY);
          }

          if (doneAt === null && morphDone()) {
            doneAt = performance.now();
          }
          const withinCap = performance.now() - start < duration;
          const stillSettling =
            doneAt === null || performance.now() - doneAt < settleBuffer;
          if (withinCap && stillSettling) {
            requestAnimationFrame(tick);
          } else {
            resolve({
              samples,
              morphSamples,
              worstSkew,
              worstErr,
              coverFailures,
              worstCenter,
            });
          }
        }
        requestAnimationFrame(tick);
      });
    },
    {
      duration: durationMs,
      ratio: MEDIA_RATIO,
      until: until ?? null,
      settleBuffer: SETTLE_BUFFER_MS,
    },
  );
}

function expectUniform(result: {
  samples: number;
  morphSamples: number;
  worstSkew: number;
  worstErr: number;
  coverFailures: number;
  worstCenter: number;
}) {
  console.log(
    `[media] samples=${result.samples} morphSamples=${result.morphSamples} ` +
      `worstSkew=${result.worstSkew.toFixed(3)} worstErr=${result.worstErr.toFixed(4)} ` +
      `coverFailures=${result.coverFailures} worstCenter=${result.worstCenter.toFixed(2)}`,
  );
  expect(result.samples).toBeGreaterThanOrEqual(20);
  expect(result.morphSamples).toBeGreaterThanOrEqual(MIN_MORPH_SAMPLES);
  expect(result.worstSkew).toBeGreaterThanOrEqual(MIN_SKEW);
  expect(result.worstErr).toBeLessThanOrEqual(RATIO_TOLERANCE);
  expect(result.coverFailures).toBe(0);
  expect(result.worstCenter).toBeLessThanOrEqual(1.5);
}

async function sampleShadowSurfaceDeltaVideo(page: Page, durationMs: number) {
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
            `${root}[data-wicket-iris-part="sheet"], ${root}[data-wicket-iris-part="trigger-surface"]`,
          );
          const shadow = document.querySelector(
            `${root}[data-wicket-iris-part="shadow"]`,
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
    { duration: durationMs, root: '[data-wicket-iris-root="video"] ' },
  );
}

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

const RATIOS = {
  tall: 9 / 16,
  wide: 16 / 9,
  narrow: 1 / 2,
} as const;

test.describe("media: intrinsic ratio through the morph", () => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ] as const) {
    for (const ratio of ["tall", "wide"] as const) {
      test(`media: video box keeps its intrinsic ratio through open and Escape close (${viewport.width}x${viewport.height}, ${ratio})`, async ({
        page,
      }, testInfo) => {
        // Two settle-gated sampling windows (open + close) can each run up to
        // MORPH_SAFETY_MS under real contention; give the test room for both.
        testInfo.setTimeout(2 * MORPH_SAFETY_MS + 10_000);
        await page.setViewportSize(viewport);
        await gotoVideo(page, { ratio });

        const triggerVideo = page.locator(
          '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"] [data-wicket-iris-part="media"] video',
        );
        await waitForStableWidth(page, triggerVideo);

        await page.getByRole("button", { name: "Open portrait video" }).click();

        // `until: "settled"` keeps sampling every rAF tick from click through
        // the moment Sheet.tsx itself marks the open finished (plus a short
        // steady-state buffer), so a busy machine just takes longer wall time
        // instead of its fixed window missing the morph's peak-skew frame.
        // MORPH_SAFETY_MS only guards against a genuine hang.
        const openResult = await sampleMediaRatio(
          page,
          MORPH_SAFETY_MS,
          "settled",
        );
        expectUniform(openResult);

        const sheet = page.locator(
          '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"]',
        );
        await waitForStableWidth(page, sheet);

        await page.keyboard.press("Escape");
        const closeResult = await sampleMediaRatio(
          page,
          MORPH_SAFETY_MS,
          "removed",
        );
        expectUniform(closeResult);

        await expect(sheet).toHaveCount(0);
      });
    }
  }

  test("media: ratio holds when a close is interrupted by a reopen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoVideo(page, { ratio: "tall" });

    await page.getByRole("button", { name: "Open portrait video" }).click();
    const sheet = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"]',
    );
    await waitForStableWidth(page, sheet);

    const p = sampleMediaRatio(page, 2400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(180);
    await page.getByRole("button", { name: "Open portrait video" }).click();
    const result = await p;

    expect(result.worstErr).toBeLessThanOrEqual(RATIO_TOLERANCE);
    expect(result.coverFailures).toBe(0);
    expect(result.morphSamples).toBeGreaterThanOrEqual(8);
  });

  test("media: ratio holds through a swipe-to-dismiss", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoVideo(page, { ratio: "tall" });

    await page.getByRole("button", { name: "Open portrait video" }).click();
    const sheet = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"]',
    );
    await waitForStableWidth(page, sheet);

    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(centerX, centerY + (260 * i) / 12);
    }

    const p = sampleMediaRatio(page, 1600);
    await page.mouse.up();
    const result = await p;

    expect(result.worstErr).toBeLessThanOrEqual(RATIO_TOLERANCE);
    expect(result.coverFailures).toBe(0);
  });
});

test.describe("media: trigger + playback", () => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ] as const) {
    test(`media: the trigger shows the media inside its surface, covering it (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoVideo(page);

      await expect(
        page.locator(
          '[data-wicket-iris-part="trigger"] > [data-wicket-iris-part="media"]',
        ),
      ).toHaveCount(0);

      await expect(
        page.locator(
          '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"] [data-wicket-iris-part="media"]',
        ),
      ).toBeAttached();

      const result = await sampleMediaRatio(page, 200);
      expect(result.samples).toBeGreaterThanOrEqual(5);
      expect(result.worstErr).toBeLessThanOrEqual(RATIO_TOLERANCE);
      expect(result.coverFailures).toBe(0);
      expect(result.worstCenter).toBeLessThanOrEqual(1.5);
    });
  }

  test("media: trigger video rests on its poster; the open sheet video plays muted, looped and inline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoVideo(page);

    const triggerVideo = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"] [data-wicket-iris-part="media"] video',
    );

    // At rest: paused on the poster, never started (nothing moves unasked).
    await page.waitForTimeout(1200);
    expect(await triggerVideo.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
      true,
    );
    expect(
      await triggerVideo.evaluate((v: HTMLVideoElement) => v.currentTime),
    ).toBe(0);
    expect(await triggerVideo.getAttribute("autoplay")).toBeNull();
    expect(await triggerVideo.getAttribute("poster")).not.toBeNull();

    await page.getByRole("button", { name: "Open portrait video" }).click();

    const sheetVideo = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"] [data-wicket-iris-part="media"] video',
    );
    await expect
      .poll(
        async () =>
          sheetVideo.evaluate(
            (v: HTMLVideoElement) => !v.paused && v.currentTime > 0.2,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
    expect(await sheetVideo.evaluate((v: HTMLVideoElement) => v.muted)).toBe(
      true,
    );
    expect(await sheetVideo.evaluate((v: HTMLVideoElement) => v.loop)).toBe(
      true,
    );
    expect(
      await sheetVideo.evaluate((v: HTMLVideoElement) => v.playsInline),
    ).toBe(true);
    expect(await sheetVideo.getAttribute("autoplay")).not.toBeNull();
  });

  test("media: reduced motion shows the poster, paused, and never scales", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoVideo(page, { reduced: true });

    const triggerVideo = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="trigger-surface"] [data-wicket-iris-part="media"] video',
    );
    expect(await triggerVideo.getAttribute("autoplay")).toBeNull();
    const poster = await triggerVideo.getAttribute("poster");
    expect(poster?.endsWith("/media/wicket-iris-portrait.jpg")).toBe(true);

    await page.waitForTimeout(1200);
    expect(await triggerVideo.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
      true,
    );
    expect(
      await triggerVideo.evaluate((v: HTMLVideoElement) => v.currentTime),
    ).toBe(0);

    await page.getByRole("button", { name: "Open portrait video" }).click();
    const openResult = await sampleMediaRatio(page, 900);
    expect(openResult.morphSamples).toBe(0);
    expect(openResult.worstErr).toBeLessThanOrEqual(RATIO_TOLERANCE);

    const sheetVideo = page.locator(
      '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"] [data-wicket-iris-part="media"] video',
    );
    expect(await sheetVideo.getAttribute("autoplay")).toBeNull();
    const sheetPoster = await sheetVideo.getAttribute("poster");
    expect(sheetPoster?.endsWith("/media/wicket-iris-portrait.jpg")).toBe(true);
    await page.waitForTimeout(1200);
    expect(await sheetVideo.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
      true,
    );
    expect(
      await sheetVideo.evaluate((v: HTMLVideoElement) => v.currentTime),
    ).toBe(0);
  });
});

test("media: nothing inside the video root paints a box-shadow or filter through a morph", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoVideo(page);

  async function sampleOffenders(durationMs: number) {
    return page.evaluate((duration) => {
      return new Promise<string[]>((resolve) => {
        const offenders = new Set<string>();
        const start = performance.now();
        function tick() {
          const root = document.querySelector(
            '[data-wicket-iris-root="video"]',
          );
          if (root) {
            const all = root.querySelectorAll("*");
            for (const el of Array.from(all)) {
              if (
                (el as HTMLElement).getAttribute("data-wicket-iris-part") ===
                  "shadow" ||
                (el as HTMLElement).closest('[data-wicket-iris-part="shadow"]')
              ) {
                continue;
              }
              const cs = getComputedStyle(el);
              if (cs.boxShadow !== "none" || cs.filter !== "none") {
                offenders.add(
                  `${el.tagName}.${(el as HTMLElement).className || ""}`,
                );
              }
            }
          }
          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve(Array.from(offenders));
          }
        }
        requestAnimationFrame(tick);
      });
    }, durationMs);
  }

  await page.getByRole("button", { name: "Open portrait video" }).click();
  const openOffenders = await sampleOffenders(1400);

  await page.keyboard.press("Escape");
  const closeOffenders = await sampleOffenders(1600);

  expect([...openOffenders, ...closeOffenders]).toEqual([]);
});

test.describe("media: shadow tracks the aspect sheet", () => {
  for (const ratio of ["tall", "wide"] as const) {
    test(`media: shadow tracks the aspect sheet through open and close (${ratio})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoVideo(page, { ratio });

      await page.getByRole("button", { name: "Open portrait video" }).click();
      const openResult = await sampleShadowSurfaceDeltaVideo(page, 1200);
      expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
      expect(openResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);

      await page.keyboard.press("Escape");
      const closeResult = await sampleShadowSurfaceDeltaVideo(page, 1200);
      expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
      expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
      expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
    });
  }
});

test.describe("media-sizing: sheet contain-fits its aspect ratio", () => {
  const anchors = ["bottom-center", "top-left", "center"] as const;
  const viewports = [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ] as const;

  for (const [ratioName, r] of Object.entries(RATIOS) as [
    keyof typeof RATIOS,
    number,
  ][]) {
    for (const anchor of anchors) {
      for (const viewport of viewports) {
        test(`media-sizing: sheet contain-fits its aspect ratio (${ratioName}, ${anchor}, ${viewport.width}x${viewport.height})`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await gotoVideo(page, { ratio: ratioName, anchor, media: false });

          const triggerButton = page.getByRole("button", {
            name: "Open portrait video",
          });
          await triggerButton.click();

          const sheet = page.locator(
            '[data-wicket-iris-root="video"] [data-wicket-iris-part="sheet"]',
          );
          await waitForStableWidth(page, sheet);

          const rect = await sheet.boundingBox();
          expect(rect).not.toBeNull();
          if (!rect) return;

          expect(
            Math.abs(rect.width / rect.height / r - 1),
          ).toBeLessThanOrEqual(0.005);

          const vpW = viewport.width;
          const vpH = viewport.height;
          let H0: number;
          if (anchor === "top-left") {
            H0 = vpH - 32;
          } else if (anchor === "bottom-center") {
            H0 = 0.88 * vpH;
          } else {
            H0 = Math.min(0.88 * vpH, vpH - 32);
          }
          const W = Math.min(480, vpW - 32, H0 * r);
          expect(Math.abs(rect.width - W)).toBeLessThanOrEqual(1);

          if (anchor === "bottom-center") {
            expect(
              Math.abs(rect.y + rect.height - (vpH - 16)),
            ).toBeLessThanOrEqual(1);
          } else if (anchor === "top-left") {
            expect(Math.abs(rect.y - 16)).toBeLessThanOrEqual(1);
          } else {
            expect(
              Math.abs((rect.y + rect.y + rect.height) / 2 - vpH / 2),
            ).toBeLessThanOrEqual(1);
          }

          expect(rect.x).toBeGreaterThanOrEqual(15.5);
          expect(rect.x + rect.width).toBeLessThanOrEqual(vpW - 15.5);

          if (anchor === "bottom-center" || anchor === "center") {
            expect(
              Math.abs(rect.x + rect.width / 2 - vpW / 2),
            ).toBeLessThanOrEqual(1);
          } else if (anchor === "top-left") {
            const trigBox = await triggerButton.boundingBox();
            expect(trigBox).not.toBeNull();
            if (trigBox) {
              const expectedLeft = Math.min(
                Math.max(16 + trigBox.width / 2 - W / 2, 16),
                vpW - 16 - W,
              );
              expect(Math.abs(rect.x - expectedLeft)).toBeLessThanOrEqual(1);
            }
          }
        });
      }
    }
  }
});

test("media-regression: a sheet without aspectRatio keeps its width and fit-content height", async ({
  page,
}) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForSelector(
      '[data-wicket-iris-root="main"] [data-wicket-iris-part="trigger"]',
    );
    await page.getByRole("button", { name: "Open example sheet" }).click();

    const sheet = page.locator(
      '[data-wicket-iris-root="main"] [data-wicket-iris-part="sheet"]',
    );
    await waitForStableWidth(page, sheet);

    const rect = await sheet.boundingBox();
    expect(rect).not.toBeNull();
    if (!rect) continue;
    expect(
      Math.abs(rect.width - Math.min(480, viewport.width - 32)),
    ).toBeLessThanOrEqual(0.5);

    const inlineHeight = await sheet.evaluate(
      (el: HTMLElement) => el.style.height,
    );
    expect(["", "fit-content"]).toContain(inlineHeight);

    const inlineWidth = await sheet.evaluate(
      (el: HTMLElement) => el.style.width,
    );
    const normalized = inlineWidth.replace(/\s+/g, " ").trim();
    expect([
      "",
      "min(var(--wicket-iris-sheet-max-width, 480px), calc(100vw - 32px))",
    ]).toContain(normalized);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  }
});
