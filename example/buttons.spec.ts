import { test, expect, type Page } from "@playwright/test";

/**
 * buttons.spec.ts — P3 rectangle-button geometry gate. Samplers here are
 * copied (not imported) from geometry.spec.ts and rescoped to
 * `[data-orrery-iris-root="buttons"]`, the fixture at example/buttons.html —
 * the same "don't import test infrastructure across spec files" pattern
 * that file's own per-shape blocks already use.
 *
 * P3 task 1 (tests first): every test below targets an API that doesn't
 * exist yet (shape="rectangle", buttonSize, buttonWidth — see example/
 * buttons/main.tsx), so all are expected red until a later P3 task lands
 * that API. See the task's RUN AND CLASSIFY step for the expected failure
 * axis of each.
 */

const ROOT = '[data-orrery-iris-root="buttons"] ';
const TRIGGER = `${ROOT}[data-orrery-iris-part="trigger"]`;
const TRIGGER_ROOT = `${ROOT}[data-orrery-iris-part="trigger-root"]`;
const TRIGGER_SURFACE = `${ROOT}[data-orrery-iris-part="trigger-surface"]`;
const SHEET = `${ROOT}[data-orrery-iris-part="sheet"]`;
const SHADOW = `${ROOT}[data-orrery-iris-part="shadow"]`;

// mirrors example/geometry.spec.ts; never loosen
const OPEN = 8;
const CLOSE = 6;
const BOTTOM = 2;
const RADIUS_TRACK = 4;

const SIZE = {
  s: { h: 36, pad: 14 },
  m: { h: 44, pad: 18 },
  l: { h: 52, pad: 22 },
} as const;
type SizeKey = keyof typeof SIZE;
const SIZES = ["s", "m", "l"] as const;

type Box = { x: number; y: number; width: number; height: number };

function expectBoxClose(a: Box, b: Box, tol = 0.5) {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(tol);
}

/** Copied from geometry.spec.ts. */
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

async function gotoButtons(
  page: Page,
  opts: {
    size?: SizeKey;
    width?: number;
    content?: string;
    anchor?: string;
    shape?: string;
  } = {},
) {
  const query: Record<string, string> = {};
  if (opts.size) query.size = opts.size;
  if (opts.width !== undefined) query.width = String(opts.width);
  if (opts.content) query.content = opts.content;
  if (opts.anchor) query.anchor = opts.anchor;
  if (opts.shape) query.shape = opts.shape;
  const qs = Object.keys(query).length
    ? `?${new URLSearchParams(query).toString()}`
    : "";
  await page.goto(`/buttons.html${qs}`);
  const trigger = page.locator(TRIGGER);
  await trigger.waitFor();
  await waitForStableWidth(page, trigger);
}

/** Copied from geometry.spec.ts's sampleShadowSurfaceDelta, rescoped to
 * ROOT, plus worstLeft/worstWidth — the (btn-morph) gate needs the
 * horizontal axis too, since a rectangle's box isn't square. */
async function sampleShadowSurfaceBox(page: Page, durationMs: number) {
  return page.evaluate(
    ({ duration, root }) => {
      return new Promise<{
        worstTop: number;
        worstHeight: number;
        worstBottom: number;
        worstLeft: number;
        worstWidth: number;
      }>((resolve) => {
        let worstTop = 0;
        let worstHeight = 0;
        let worstBottom = 0;
        let worstLeft = 0;
        let worstWidth = 0;
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
            worstLeft = Math.max(worstLeft, Math.abs(sh.left - s.left));
            worstWidth = Math.max(worstWidth, Math.abs(sh.width - s.width));
          }
          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve({
              worstTop,
              worstHeight,
              worstBottom,
              worstLeft,
              worstWidth,
            });
          }
        }
        requestAnimationFrame(tick);
      });
    },
    { duration: durationMs, root: ROOT },
  );
}

/** Copied from geometry.spec.ts's sampleShadowSurfaceRadiusDelta, rescoped
 * to ROOT. */
async function sampleShadowSurfaceRadiusDelta(page: Page, durationMs: number) {
  return page.evaluate(
    ({ duration, root }) => {
      return new Promise<{ worst: number }>((resolve) => {
        let worst = 0;
        const start = performance.now();
        function tick() {
          const surface = document.querySelector(
            `${root}[data-orrery-iris-part="sheet"], ${root}[data-orrery-iris-part="trigger-surface"]`,
          ) as HTMLElement | null;
          const shadow = document.querySelector(
            `${root}[data-orrery-iris-part="shadow"]`,
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
    },
    { duration: durationMs, root: ROOT },
  );
}

/** Copied from geometry.spec.ts's sampleForStrayPainter, rescoped to ROOT's
 * trigger-root and sheet. */
async function sampleForStrayPainter(page: Page, durationMs: number) {
  return page.evaluate(
    ({ duration, root }) => {
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
              `${root}[data-orrery-iris-part="trigger-root"], ` +
                `${root}[data-orrery-iris-part="trigger-root"] *, ` +
                `${root}[data-orrery-iris-part="sheet"], ` +
                `${root}[data-orrery-iris-part="sheet"] *`,
            );
            outer: for (const el of Array.from(nodes)) {
              if (el.closest(`${root}[data-orrery-iris-part="shadow"]`))
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
    },
    { duration: durationMs, root: ROOT },
  );
}

test.describe("390x844 - rectangle rest", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const key of SIZES) {
    const { h, pad } = SIZE[key];

    test(`(btn-rest) size=${key}: rests at its height and padding, label-sized, pill corners`, async ({
      page,
    }) => {
      await gotoButtons(page, { size: key });

      const trigger = page.locator(TRIGGER);
      const box = (await trigger.boundingBox())!;
      expect(Math.abs(box.height - h)).toBeLessThanOrEqual(0.5);
      expect(box.width).toBeGreaterThan(box.height);

      const rootBox = (await page.locator(TRIGGER_ROOT).boundingBox())!;
      expectBoxClose(rootBox, box);

      const paddingLeft = await trigger.evaluate(
        (el) => getComputedStyle(el).paddingLeft,
      );
      expect(paddingLeft).toBe(`${pad}px`);

      const overflow = await trigger.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );

      expect(await trigger.getAttribute("data-orrery-iris-shape")).toBe(
        "rectangle",
      );
      const triggerRoot = page.locator(TRIGGER_ROOT);
      expect(await triggerRoot.getAttribute("data-orrery-iris-shape")).toBe(
        "rectangle",
      );
      expect(
        await triggerRoot.getAttribute("data-orrery-iris-button-size"),
      ).toBe(key);

      const surfaceBox = (await page.locator(TRIGGER_SURFACE).boundingBox())!;
      expectBoxClose(surfaceBox, box);
      const radius = await page
        .locator(TRIGGER_SURFACE)
        .evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
      expect(radius).toBeGreaterThanOrEqual(h / 2 - 0.5);

      const centerX = box.x + box.width / 2;
      const bottom = box.y + box.height;
      expect(Math.abs(centerX - 195)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(bottom - 828)).toBeLessThanOrEqual(0.5);
    });
  }

  test("(btn-rest) width=240: a fixed buttonWidth sets the width exactly", async ({
    page,
  }) => {
    await gotoButtons(page, { size: "m", width: 240 });
    const box = (await page.locator(TRIGGER).boundingBox())!;
    expect(Math.abs(box.width - 240)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.height - 44)).toBeLessThanOrEqual(0.5);
  });
});

const SNAP_VIEWPORTS = [
  { vpW: 390, vpH: 844, opts: { width: 240 } },
  { vpW: 1440, vpH: 900, opts: {} },
] as const;

for (const { vpW, vpH, opts } of SNAP_VIEWPORTS) {
  test.describe(`${vpW}x${vpH} - rectangle snap`, () => {
    test.use({ viewport: { width: vpW, height: vpH } });

    for (const key of SIZES) {
      const { h } = SIZE[key];

      async function setup(page: Page, startAnchor: string): Promise<Box> {
        await gotoButtons(page, { size: key, anchor: startAnchor, ...opts });
        const box = (await page.locator(TRIGGER).boundingBox())!;
        expect(Math.abs(box.height - h)).toBeLessThanOrEqual(0.5);
        if (vpW === 390) {
          expect(Math.abs(box.width - 240)).toBeLessThanOrEqual(0.5);
        }
        return box;
      }

      async function dragTo(page: Page, box: Box, targetCx: number) {
        const cy = box.y + box.height / 2;
        await page.mouse.move(box.x + box.width / 2, cy);
        await page.mouse.down();
        await page.mouse.move(targetCx, cy, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(900);
      }

      test(`(btn-snap) ${vpW}x${vpH} size=${key}: drop-left snaps to bottom-left`, async ({
        page,
      }) => {
        const box = await setup(page, "bottom-center");
        await dragTo(page, box, 16 + box.width / 2);
        const a = (await page.locator(TRIGGER).boundingBox())!;
        expect(Math.abs(a.x - 16)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.y + a.height - (vpH - 16))).toBeLessThanOrEqual(1);
        const stored = await page.evaluate(() =>
          localStorage.getItem("vista-sheet-buttons-anchor"),
        );
        expect(stored).toBe("bottom-left");
      });

      test(`(btn-snap) ${vpW}x${vpH} size=${key}: drop-right snaps to bottom-right`, async ({
        page,
      }) => {
        const box = await setup(page, "bottom-center");
        await dragTo(page, box, vpW - 16 - box.width / 2);
        const a = (await page.locator(TRIGGER).boundingBox())!;
        expect(Math.abs(a.x + a.width - (vpW - 16))).toBeLessThanOrEqual(1);
        expect(Math.abs(a.y + a.height - (vpH - 16))).toBeLessThanOrEqual(1);
        const stored = await page.evaluate(() =>
          localStorage.getItem("vista-sheet-buttons-anchor"),
        );
        expect(stored).toBe("bottom-right");
      });

      test(`(btn-snap) ${vpW}x${vpH} size=${key}: drop-centre snaps to bottom-center`, async ({
        page,
      }) => {
        const box = await setup(page, "bottom-left");
        await dragTo(page, box, vpW / 2);
        const a = (await page.locator(TRIGGER).boundingBox())!;
        expect(Math.abs(a.x + a.width / 2 - vpW / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.y + a.height - (vpH - 16))).toBeLessThanOrEqual(1);
        const stored = await page.evaluate(() =>
          localStorage.getItem("vista-sheet-buttons-anchor"),
        );
        expect(stored).toBe("bottom-center");
      });
    }
  });
}

test.describe("390x844 - rectangle morph", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const key of SIZES) {
    const { h } = SIZE[key];

    test(`(btn-morph) size=${key}: shadow tracks the rectangle surface through open AND close`, async ({
      page,
    }) => {
      await gotoButtons(page, { size: key });
      const box = (await page.locator(TRIGGER).boundingBox())!;
      expect(Math.abs(box.height - h)).toBeLessThanOrEqual(0.5);

      const shadowBox = (await page.locator(SHADOW).boundingBox())!;
      expectBoxClose(shadowBox, box, 1);

      await page.locator(TRIGGER).click();
      const openResult = await sampleShadowSurfaceBox(page, 1200);
      expect(openResult.worstTop).toBeLessThan(OPEN);
      expect(openResult.worstHeight).toBeLessThan(OPEN);
      expect(openResult.worstLeft).toBeLessThan(OPEN);
      expect(openResult.worstWidth).toBeLessThan(OPEN);
      expect(openResult.worstBottom).toBeLessThan(BOTTOM);

      await page.keyboard.press("Escape");
      const closeResult = await sampleShadowSurfaceBox(page, 1200);
      expect(closeResult.worstTop).toBeLessThan(CLOSE);
      expect(closeResult.worstHeight).toBeLessThan(CLOSE);
      expect(closeResult.worstLeft).toBeLessThan(CLOSE);
      expect(closeResult.worstWidth).toBeLessThan(CLOSE);
      expect(closeResult.worstBottom).toBeLessThan(BOTTOM);

      await page.waitForTimeout(1600);
      const restShadowBox = (await page.locator(SHADOW).boundingBox())!;
      const restButtonBox = (await page.locator(TRIGGER).boundingBox())!;
      expectBoxClose(restShadowBox, restButtonBox, 1);
    });

    test(`(btn-rt) size=${key}: shadow corner radius tracks the rectangle surface through open AND close`, async ({
      page,
    }) => {
      await gotoButtons(page, { size: key });
      const box = (await page.locator(TRIGGER).boundingBox())!;
      expect(Math.abs(box.height - h)).toBeLessThanOrEqual(0.5);
      await page.locator(TRIGGER).click();
      const openResult = await sampleShadowSurfaceRadiusDelta(page, 1200);
      expect(openResult.worst).toBeLessThan(RADIUS_TRACK);

      await page.keyboard.press("Escape");
      const closeResult = await sampleShadowSurfaceRadiusDelta(page, 1200);
      expect(closeResult.worst).toBeLessThan(RADIUS_TRACK);
    });
  }
});

test.describe("390x844 - rectangle painter and rest paths", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("(btn-p2) size=m: no element inside the trigger or sheet paints a box-shadow or filter, open through close", async ({
    page,
  }) => {
    await gotoButtons(page, { size: "m" });
    await page.locator(TRIGGER).click();

    const openPaint = await sampleForStrayPainter(page, 1200);
    expect(openPaint, "open->settle").toBeNull();

    await waitForStableWidth(page, page.locator(SHEET));
    const restPaint = await sampleForStrayPainter(page, 200);
    expect(restPaint, "rest").toBeNull();

    await page.keyboard.press("Escape");
    const closePaint = await sampleForStrayPainter(page, 1200);
    expect(closePaint, "close").toBeNull();
  });

  test("(btn-o) size=m: rests as a pill at its own box after every close path", async ({
    page,
  }) => {
    await gotoButtons(page, { size: "m" });
    const trigger = page.locator(TRIGGER);
    const w0 = (await trigger.boundingBox())!.width;

    const expectRestingPill = async (variant: string) => {
      await page.waitForTimeout(1600);
      const surface = page.locator(TRIGGER_SURFACE);
      const surfaceBox = (await surface.boundingBox())!;
      const buttonBox = (await trigger.boundingBox())!;
      const computedRadius = await surface.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius),
      );
      const inlineRadius = await surface.evaluate(
        (el) => (el as HTMLElement).style.borderRadius,
      );
      expect(
        computedRadius,
        `${variant}: computed radius does not read as a pill`,
      ).toBeGreaterThanOrEqual(buttonBox.height / 2 - 0.5);
      if (inlineRadius !== "") {
        expect(
          parseFloat(inlineRadius),
          `${variant}: a stale inline radius survived the morph`,
        ).toBeGreaterThanOrEqual(buttonBox.height / 2 - 0.5);
      }
      expectBoxClose(surfaceBox, buttonBox);
      expect(Math.abs(buttonBox.height - 44)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(buttonBox.width - w0)).toBeLessThanOrEqual(0.5);
    };

    await trigger.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await expectRestingPill("simple close");

    await trigger.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await trigger.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await expectRestingPill("close interrupted by a reopen");

    for (let i = 0; i < 3; i++) {
      await trigger.click();
      await page.waitForTimeout(180);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(180);
    }
    await expectRestingPill("rapid open/close toggle");

    await trigger.click();
    await page.waitForTimeout(900);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(90);
    await page.setViewportSize({ width: 390, height: Math.round(844 * 0.63) });
    await expectRestingPill("resize mid-close");
  });
});

test.describe("390x844 - trigger label reveal", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const shape of ["rectangle", "circle"] as const) {
    test(`(btn-label) shape=${shape}: the label is not visible over the sheet during close`, async ({
      page,
    }) => {
      await gotoButtons(page, { size: "m", content: "icon-text", shape });

      const readOpacities = () =>
        page.evaluate((root) => {
          function effectiveOpacity(el: Element | null): number {
            let n: Element | null = el;
            let product = 1;
            while (n) {
              product *= parseFloat(getComputedStyle(n).opacity || "1");
              n = n.parentElement;
            }
            return product;
          }
          const triggerEl = document.querySelector(
            `${root}[data-orrery-iris-part="trigger"]`,
          );
          let labelEl: Element | null = null;
          if (triggerEl) {
            const walker = document.createTreeWalker(
              triggerEl,
              NodeFilter.SHOW_TEXT,
            );
            let node: Node | null;
            while ((node = walker.nextNode())) {
              if ((node.textContent ?? "").trim() === "Search messages") {
                labelEl = node.parentElement;
                break;
              }
            }
          }
          const iconEl =
            triggerEl?.querySelector("[data-fixture-icon]") ?? null;
          return {
            labelOp: labelEl ? effectiveOpacity(labelEl) : 0,
            iconOp: iconEl ? effectiveOpacity(iconEl) : 0,
          };
        }, ROOT);

      const atRest = await readOpacities();
      expect(atRest.labelOp).toBeGreaterThanOrEqual(0.99);
      expect(atRest.iconOp).toBeGreaterThanOrEqual(0.99);

      await page.locator(TRIGGER).click();
      await waitForStableWidth(page, page.locator(SHEET));
      const sheetH = (await page.locator(SHEET).boundingBox())!.height;
      const btnH = (await page.locator(TRIGGER).boundingBox())!.height;
      expect(sheetH).toBeGreaterThanOrEqual(btnH + 150);

      const openOps = await readOpacities();
      expect(Math.max(openOps.labelOp, openOps.iconOp)).toBeLessThanOrEqual(
        0.02,
      );

      await page.keyboard.press("Escape");

      const result = await page.evaluate(
        ({ root, durationMs, sheetH, btnH }) => {
          function effectiveOpacity(el: Element | null): number {
            let n: Element | null = el;
            let product = 1;
            while (n) {
              product *= parseFloat(getComputedStyle(n).opacity || "1");
              n = n.parentElement;
            }
            return product;
          }
          return new Promise<{
            largeFrames: number;
            violations: number;
            first: { f: number; opacity: number } | null;
          }>((resolve) => {
            let largeFrames = 0;
            let violations = 0;
            let first: { f: number; opacity: number } | null = null;
            const start = performance.now();
            function tick() {
              const surface = document.querySelector(
                `${root}[data-orrery-iris-part="trigger-surface"], ${root}[data-orrery-iris-part="sheet"]`,
              );
              const triggerEl = document.querySelector(
                `${root}[data-orrery-iris-part="trigger"]`,
              );
              if (surface && triggerEl) {
                const h = surface.getBoundingClientRect().height;
                const f = (h - btnH) / (sheetH - btnH);
                if (f > 0.2) {
                  largeFrames += 1;
                  let labelEl: Element | null = null;
                  const walker = document.createTreeWalker(
                    triggerEl,
                    NodeFilter.SHOW_TEXT,
                  );
                  let node: Node | null;
                  while ((node = walker.nextNode())) {
                    if ((node.textContent ?? "").trim() === "Search messages") {
                      labelEl = node.parentElement;
                      break;
                    }
                  }
                  const iconEl = triggerEl.querySelector("[data-fixture-icon]");
                  const labelOp = labelEl ? effectiveOpacity(labelEl) : 0;
                  const iconOp = iconEl ? effectiveOpacity(iconEl) : 0;
                  const worst = Math.max(labelOp, iconOp);
                  if (worst > 0.02 && !first) {
                    first = { f, opacity: worst };
                    violations += 1;
                  } else if (worst > 0.02) {
                    violations += 1;
                  }
                }
              }
              if (performance.now() - start < durationMs) {
                requestAnimationFrame(tick);
              } else {
                resolve({ largeFrames, violations, first });
              }
            }
            requestAnimationFrame(tick);
          });
        },
        { root: ROOT, durationMs: 1200, sheetH, btnH },
      );

      expect(
        result.largeFrames,
        `too few large-surface frames sampled (${JSON.stringify(result)})`,
      ).toBeGreaterThanOrEqual(5);
      expect(
        result.violations,
        `label/icon visible over the sheet: ${JSON.stringify(result.first)}`,
      ).toBe(0);

      await page.waitForTimeout(1600);
      const settled = await readOpacities();
      expect(settled.labelOp).toBeGreaterThanOrEqual(0.99);
      expect(settled.iconOp).toBeGreaterThanOrEqual(0.99);
    });
  }
});

test.describe("1280x800 - riders are not faded", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(lbl-reg) the trigger-side Shared is never faded by a trigger ancestor during close", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open example sheet" }).click();
    await waitForStableWidth(
      page,
      page.locator(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      ),
    );
    await page.keyboard.press("Escape");

    const result = await page.evaluate((duration) => {
      return new Promise<{ count: number; min: number }>((resolve) => {
        let count = 0;
        let min = 1;
        const start = performance.now();
        function tick() {
          const el = document.querySelector(
            '[data-orrery-iris-root="main"] [data-orrery-iris-part="shared"][data-orrery-iris-slot="trigger"]',
          );
          if (el) {
            // Ancestor opacity only — the shared element's OWN opacity is
            // expected to animate as part of its layoutId crossfade; this
            // gate is about a `data-orrery-iris-closing` ancestor (or any
            // other trigger wrapper) fading IT out from outside, not about
            // its own fade-in.
            let n: Element | null = el.parentElement;
            let product = 1;
            while (n) {
              product *= parseFloat(getComputedStyle(n).opacity || "1");
              n = n.parentElement;
            }
            count += 1;
            min = Math.min(min, product);
          }
          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve({ count, min });
          }
        }
        requestAnimationFrame(tick);
      });
    }, 1200);

    expect(result.count).toBeGreaterThanOrEqual(10);
    expect(result.min).toBeGreaterThanOrEqual(0.99);
  });
});
