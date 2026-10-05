import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * link-preview.spec.ts — `<VistaSheet.Root preview>` on /link-preview.html.
 *
 * Real rendered geometry in Chromium, like the other specs here. The page
 * has four preview links: "my write-up of the Brukas project" WRAPS across two lines at
 * 1280px (line 1 is a short fragment far right of line 2, the shape that
 * zeroes an absolutely-positioned child of an inline), "Ghostties" and
 * "Dab" sit on following lines, and "my portfolio" is parked at the
 * right viewport edge.
 */

const PAGE = "/link-preview.html";

// The demo previews real www.seansmithdesign.com pages. Specs never touch the
// network: every request to that host is answered with a small local page.
test.beforeEach(async ({ page }) => {
  await page.route("https://www.seansmithdesign.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>stub</title><h1>Stub page</h1><p>Local fixture.</p>",
    }),
  );
});
const SHEET = '[data-vista-sheet-part="sheet"]';
const HOVER_INTENT_MS = 150;

type Box = { left: number; top: number; width: number; height: number };

const link = (page: Page, text: string): Locator =>
  page.locator("a.lp-link", { hasText: text });

/** The link's per-line client rects, viewport px. */
async function lines(loc: Locator): Promise<Box[]> {
  return loc.evaluate((el) =>
    [...el.getClientRects()].map((r) => ({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    })),
  );
}

/** Console errors and warnings from OUR page. The preview iframe loads
 * seansmithdesign.com, whose own console is not ours to police. */
function watchConsole(page: Page): string[] {
  const out: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (m.location().url.includes("seansmithdesign.com")) return;
    out.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    if (!(e.stack ?? "").includes("seansmithdesign.com"))
      out.push(`pageerror: ${e.message}`);
  });
  return out;
}

/** Make the page scrollable and scroll it: pad the top so the prose sits
 * `lineTop`px below the viewport top once scrolled, using a real scroll. */
async function scrollPageTo(page: Page, scrollY: number, pad = 1400) {
  await page.evaluate(
    ([y, p]) => {
      document.body.style.paddingTop = `${p}px`;
      document.body.style.paddingBottom = "1000px";
      window.scrollTo(0, y);
    },
    [scrollY, pad],
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
}

/** Per-frame recorder: the sheet and shadow rects and the iframe count on
 * every animation frame, plus the largest iframe count ever seen in the DOM
 * (a MutationObserver, so a transient second iframe between frames counts). */
async function startRecording(page: Page) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __rec: any };
    const rec = (w.__rec = { frames: [] as any[], maxIframes: 0, stop: false });
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    new MutationObserver(() => {
      rec.maxIframes = Math.max(
        rec.maxIframes,
        document.querySelectorAll("iframe").length,
      );
    }).observe(document.body, { childList: true, subtree: true });
    const tick = () => {
      const sheet = document.querySelector(sel);
      rec.frames.push({
        t: performance.now(),
        sheet: rect(sheet),
        opacity: sheet ? Number(getComputedStyle(sheet).opacity) : null,
        shadow: rect(
          document.querySelector('[data-vista-sheet-part="shadow"]'),
        ),
      });
      if (!rec.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SHEET);
}

type Frame = {
  t: number;
  sheet: Box | null;
  opacity: number | null;
  shadow: Box | null;
};
const frames = (page: Page) =>
  page.evaluate(() => (window as any).__rec.frames as Frame[]);
const maxIframes = (page: Page) =>
  page.evaluate(() => (window as any).__rec.maxIframes as number);

/** Hover the centre of line `i` of a link. Returns the pointer position. */
async function hoverLine(page: Page, loc: Locator, i = 0, xFrac = 0.5) {
  const l = (await lines(loc))[i];
  const x = l.left + l.width * xFrac;
  const y = l.top + l.height / 2;
  await page.mouse.move(x, y);
  return { x, y, line: l };
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

async function gotoPreview(page: Page) {
  await page.goto(PAGE);
  await page.waitForSelector("a.lp-link");
  await page.evaluate(() => document.fonts.ready);
}

async function openCard(page: Page, loc: Locator, i = 0) {
  const at = await hoverLine(page, loc, i);
  await expect(page.locator(SHEET)).toBeVisible();
  await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
  return at;
}

test.describe("link preview (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const [name, scrollY, text, lineIdx] of [
    ["single-line link", 0, "Ghostties", 0],
    ["wrapped link, first line", 0, "my write-up of the Brukas project", 0],
    ["wrapped link, second line", 0, "my write-up of the Brukas project", 1],
    ["wrapped link on a page scrolled 800px", 800, "my write-up of the Brukas project", 0],
    [
      "wrapped link, second line, scrolled 800px",
      800,
      "my write-up of the Brukas project",
      1,
    ],
  ] as const) {
    test(`(a) opens after hover intent and grows from the hovered line: ${name}`, async ({
      page,
    }) => {
      await gotoPreview(page);
      if (scrollY) await scrollPageTo(page, scrollY);
      const loc = link(page, text);
      const target = (await lines(loc))[lineIdx];
      if (lineIdx === 0 && text.startsWith("my write-up")) {
        expect((await lines(loc)).length, "fixture link must wrap").toBe(2);
      }
      await startRecording(page);
      const t0 = Date.now();
      await hoverLine(page, loc, lineIdx);
      await expect(page.locator(SHEET)).toBeVisible();
      expect(Date.now() - t0).toBeGreaterThanOrEqual(HOVER_INTENT_MS - 20);
      await page.waitForTimeout(900);
      const f = (await frames(page)).find((x) => x.sheet);
      expect(f, "sheet frame").toBeTruthy();
      // First painted frame: the card is the hovered LINE box, not the
      // link's union rect and not a sliver.
      const s = f!.sheet!;
      expect(
        near(s.left, target.left, 6),
        `left ${s.left} vs ${target.left}`,
      ).toBe(true);
      expect(near(s.top, target.top, 6), `top ${s.top} vs ${target.top}`).toBe(
        true,
      );
      expect(
        near(s.width, target.width, 6),
        `width ${s.width} vs ${target.width}`,
      ).toBe(true);
      expect(
        near(s.height, target.height, 6),
        `height ${s.height} vs ${target.height}`,
      ).toBe(true);
    });
  }

  test("(a) hover that leaves before the intent delay opens nothing", async ({
    page,
  }) => {
    await gotoPreview(page);
    await hoverLine(page, link(page, "Ghostties"));
    await page.waitForTimeout(60);
    await page.mouse.move(900, 600);
    await page.waitForTimeout(400);
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page.locator("[data-vista-sheet-root]")).toHaveCount(0);
  });

  test("(a) hover intent opens between 130ms and 400ms after the pointer enters", async ({
    page,
  }) => {
    await gotoPreview(page);
    const loc = link(page, "Ghostties");
    await loc.evaluate((el, sel) => {
      const w = window as unknown as { __intent: { enter?: number; open?: number } };
      const t: { enter?: number; open?: number } = (w.__intent = {});
      el.addEventListener("pointerenter", () => (t.enter = performance.now()));
      new MutationObserver(() => {
        if (t.open === undefined && document.querySelector(sel)) t.open = performance.now();
      }).observe(document.body, { childList: true, subtree: true });
    }, SHEET);
    await hoverLine(page, loc);
    await expect(page.locator(SHEET)).toBeVisible();
    const { enter, open } = await page.evaluate(
      () => (window as any).__intent as { enter: number; open: number },
    );
    expect(open - enter).toBeGreaterThanOrEqual(130);
    expect(open - enter).toBeLessThanOrEqual(400);
  });

  test("(b) placement: the card never shrinks below the 240px floor", async ({
    page,
  }) => {
    // Too short for 520 above or below the link, so it shrinks to the floor.
    await page.setViewportSize({ width: 1280, height: 380 });
    await gotoPreview(page);
    await openCard(page, link(page, "Ghostties"));
    await page.waitForTimeout(900);
    const s = (await page.locator(SHEET).boundingBox())!;
    expect(near(s.height, 240, 1), `height ${s.height}`).toBe(true);
  });

  test("(b) placement: below when there is no room above, above when there is, centred on the pointer", async ({
    page,
  }) => {
    await gotoPreview(page);
    const loc = link(page, "Ghostties");
    // Link near the top: no room above, so the card flips below.
    const { x, line } = await openCard(page, loc);
    let s = (await page.locator(SHEET).boundingBox())!;
    expect(near(s.y, line.top + line.height + 8, 1), `below top ${s.y}`).toBe(
      true,
    );
    expect(near(s.x + s.width / 2, x, 1)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);

    // Link low in the viewport: room above, the preferred side.
    await page.mouse.move(900, 700);
    // The prose sits at y = pad + ~144; scroll it to ~650px down the viewport.
    await scrollPageTo(page, 1800 + 144 - 650, 1800);
    const up = await hoverLine(page, loc);
    await expect(page.locator(SHEET)).toBeVisible();
    await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
    s = (await page.locator(SHEET).boundingBox())!;
    expect(up.line.top).toBeGreaterThan(544);
    expect(
      near(s.y + s.height, up.line.top - 8, 1),
      `above bottom ${s.y + s.height}`,
    ).toBe(true);
    expect(near(s.x + s.width / 2, up.x, 1)).toBe(true);
  });

  test("(b) placement: clamps to a 16px gutter at the right edge", async ({
    page,
  }) => {
    await gotoPreview(page);
    await openCard(page, link(page, "my portfolio"));
    const s = (await page.locator(SHEET).boundingBox())!;
    expect(near(s.x + s.width, 1280 - 16, 1), `right ${s.x + s.width}`).toBe(
      true,
    );
  });

  test("(b) placement: a mid-viewport link never has its line covered, and the card shrinks to fit", async ({
    page,
  }) => {
    await gotoPreview(page);
    // Prose at y = pad + ~144; park the link line near y 400, in the band
    // where a 520px card fits neither above nor below.
    await scrollPageTo(page, 1800 + 144 - 400, 1800);
    const { line } = await openCard(page, link(page, "Ghostties"));
    expect(line.top).toBeGreaterThan(256);
    expect(line.top).toBeLessThan(544);
    await page.waitForTimeout(900); // let the spring's overshoot rest
    const s = (await page.locator(SHEET).boundingBox())!;
    const clear = s.y + s.height <= line.top || s.y >= line.top + line.height;
    expect(clear, `card ${s.y}..${s.y + s.height} covers line ${line.top}`).toBe(
      true,
    );
    expect(s.height).toBeGreaterThanOrEqual(240);
    expect(s.height).toBeLessThan(520);
    expect(s.y).toBeGreaterThanOrEqual(16 - 1);
    expect(s.y + s.height).toBeLessThanOrEqual(800 - 16 + 1);
  });

  test("(c) at most one iframe at any time while sweeping across links; none after close", async ({
    page,
  }) => {
    await gotoPreview(page);
    await startRecording(page);
    for (const [text, i] of [
      ["my write-up of the Brukas project", 1],
      ["Ghostties", 0],
      ["Dab", 0],
      ["my write-up of the Brukas project", 0],
      ["Ghostties", 0],
    ] as const) {
      await hoverLine(page, link(page, text), i);
      await page.waitForTimeout(HOVER_INTENT_MS + 200);
      expect(await page.locator("iframe").count()).toBeLessThanOrEqual(1);
    }
    expect(await maxIframes(page)).toBeLessThanOrEqual(1);
    expect(await maxIframes(page)).toBe(1);
    await page.mouse.move(1000, 600);
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 1500 });
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
  });

  test("(d) non-modal: focus does not move, nothing aria-hidden, no scroll lock", async ({
    page,
  }) => {
    await gotoPreview(page);
    await page.locator("h1").evaluate((h) => h.setAttribute("tabindex", "-1"));
    await page.locator("h1").focus();
    const before = await page.evaluate(() => document.activeElement?.tagName);
    await openCard(page, link(page, "Ghostties"));
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
      before,
    );
    const state = await page.evaluate(() => ({
      hidden: [...document.querySelectorAll("[aria-hidden]")].filter(
        (e) =>
          !e.closest("[data-vista-sheet-root]") &&
          // The other links' own transparent morph surfaces.
          e.getAttribute("data-vista-sheet-part") !== "trigger-surface",
      ).length,
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      backdrops: document.querySelectorAll('[data-vista-sheet-part="backdrop"]')
        .length,
      dialogs: document.querySelectorAll('[role="dialog"], [aria-modal]')
        .length,
      triggerButtons: document.querySelectorAll("button").length,
    }));
    expect(state).toEqual({
      hidden: 0,
      overflow: "",
      paddingRight: "",
      backdrops: 0,
      dialogs: 0,
      triggerButtons: 0,
    });
  });

  test("(e) Escape closes", async ({ page }) => {
    await gotoPreview(page);
    await openCard(page, link(page, "Ghostties"));
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 100 });
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
  });

  test("(e) a window resize closes the card and it stays closed", async ({
    page,
  }) => {
    await gotoPreview(page);
    await openCard(page, link(page, "Ghostties"));
    // Pointer off the link first, so nothing can reopen it, then a resize
    // event well inside the 250ms grace so the grace is not what closes it.
    await page.mouse.move(1000, 600);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 150 });
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    await page.waitForTimeout(700);
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page.locator("[data-vista-sheet-root]")).toHaveCount(0);
  });

  test("(e) a press outside closes, without waiting for the hover grace", async ({
    page,
  }) => {
    await gotoPreview(page);
    await openCard(page, link(page, "Ghostties"));
    await page.mouse.move(1000, 600);
    await page.mouse.down();
    // The grace period is 250ms: gone sooner than that is the pointerdown.
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 120 });
    await page.mouse.up();
  });

  test("(e) scrolling closes, and the close lands on the link's current rect", async ({
    page,
  }) => {
    await gotoPreview(page);
    await scrollPageTo(page, 800);
    const loc = link(page, "Ghostties");
    await openCard(page, loc);
    await startRecording(page);
    await page.mouse.wheel(0, 120);
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 120 });
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    const after = (await lines(loc))[0];
    const fs = (await frames(page)).filter((f) => f.sheet);
    const last = fs[fs.length - 1].sheet!;
    expect(
      near(last.left, after.left, 8),
      `left ${last.left} vs ${after.left}`,
    ).toBe(true);
    expect(
      near(last.top, after.top, 8),
      `top ${last.top} vs ${after.top}`,
    ).toBe(true);
    // One clock: the shadow and the surface head for the same place.
    for (const f of fs) {
      if (f.shadow)
        expect(Math.abs(f.shadow.top - f.sheet!.top)).toBeLessThanOrEqual(6);
    }
  });

  test("(e) a 120px scroll in the middle of a close keeps the shadow on the sheet", async ({
    page,
  }) => {
    await gotoPreview(page);
    await scrollPageTo(page, 800);
    await openCard(page, link(page, "Ghostties"));
    await startRecording(page);
    await page.keyboard.press("Escape");
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          let n = 3;
          const wait = () =>
            --n > 0
              ? requestAnimationFrame(wait)
              : (window.scrollBy(0, 120), done());
          requestAnimationFrame(wait);
        }),
    );
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    const fs = (await frames(page)).filter((f) => f.sheet && f.shadow);
    expect(fs.length).toBeGreaterThan(4);
    for (const f of fs) {
      expect(Math.abs(f.shadow!.top - f.sheet!.top)).toBeLessThanOrEqual(6);
    }
  });

  test("(h) the card is hoverable: it stays open while the pointer is on it", async ({
    page,
  }) => {
    await gotoPreview(page);
    const { x, line } = await openCard(page, link(page, "Ghostties"));
    // Cross the gap to the card in steps, then rest on it well past the grace.
    await page.mouse.move(x, line.top + line.height + 40, { steps: 6 });
    await page.waitForTimeout(600);
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(1);
    // Leaving both closes it.
    await page.mouse.move(1000, 700);
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 1000 });
  });

  test("(h) keyboard focus opens after the intent delay, blur closes, focus stays on the link", async ({
    page,
  }) => {
    await gotoPreview(page);
    await page.keyboard.press("Tab");
    await expect(link(page, "my write-up of the Brukas project")).toBeFocused();
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(link(page, "my write-up of the Brukas project")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(link(page, "Ghostties")).toBeFocused();
    await expect(page.locator("iframe")).toHaveCount(1, { timeout: 1500 });
    await page.mouse.move(1000, 700);
  });

  test("(h) the card is a visual duplicate: aria-hidden, Open is not tabbable", async ({
    page,
  }) => {
    await gotoPreview(page);
    await openCard(page, link(page, "Ghostties"));
    await expect(page.locator(SHEET)).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(`${SHEET} a.lp-open`)).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  test("(h) the skeleton shows until the iframe loads, then gives way", async ({
    page,
  }) => {
    // A slow page, so the skeleton has a window to be seen in.
    await page.route("**/projects/ghostties?preview=1", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fallback();
    });
    await gotoPreview(page);
    await hoverLine(page, link(page, "Ghostties"));
    await expect(page.locator(".lp-skeleton")).toBeVisible();
    await expect(page.locator(".lp-iframe[data-loaded]")).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(page.locator(".lp-skeleton")).toBeHidden();
  });
});

test.describe("link preview (touch)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  /** Chromium touch input that can hold: Playwright's own touchscreen can
   * only tap. */
  async function touch(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (
      type: "touchStart" | "touchMove" | "touchEnd",
      x?: number,
      y?: number,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: x!, y: y! }],
      });
    return {
      start: (x: number, y: number) => send("touchStart", x, y),
      move: (x: number, y: number) => send("touchMove", x, y),
      end: () => send("touchEnd"),
    };
  }

  test("(f) long-press opens a card, and lifting the finger does not close it", async ({
    page,
  }) => {
    await gotoPreview(page);
    const url = page.url();
    const finger = await touch(page);
    const l = (await lines(link(page, "Ghostties")))[0];
    const x = l.left + l.width / 2;
    const y = l.top + l.height / 2;
    await finger.start(x, y);
    await page.waitForTimeout(200);
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page.locator(SHEET)).toBeVisible({ timeout: 1000 });
    await finger.end();
    await page.waitForTimeout(700);
    await expect(page.locator(SHEET)).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(1);
    expect(page.url()).toBe(url);
    // A press outside dismisses.
    await finger.start(1000, 600);
    await finger.end();
    await expect(page.locator("iframe")).toHaveCount(0, { timeout: 120 });
  });

  test("(f) a short tap still follows the link, and a moving finger opens nothing", async ({
    page,
  }) => {
    await gotoPreview(page);
    const finger = await touch(page);
    const l = (await lines(link(page, "Ghostties")))[0];
    const x = l.left + l.width / 2;
    const y = l.top + l.height / 2;
    await finger.start(x, y);
    await finger.move(x, y + 30);
    await page.waitForTimeout(600);
    await finger.end();
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page.locator("[data-vista-sheet-root]")).toHaveCount(0);
  });

  test("(g) zero console errors or warnings from our page across hover, switch, long-press, Escape", async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await gotoPreview(page);
    await hoverLine(page, link(page, "my write-up of the Brukas project"), 1);
    await expect(page.locator(SHEET)).toBeVisible();
    await hoverLine(page, link(page, "Dab"));
    await page.waitForTimeout(HOVER_INTENT_MS + 500);
    await page.keyboard.press("Escape");
    await page.mouse.move(1000, 700);
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    const finger = await touch(page);
    const l = (await lines(link(page, "Ghostties")))[0];
    await finger.start(l.left + 5, l.top + 5);
    await expect(page.locator(SHEET)).toBeVisible({ timeout: 1500 });
    await finger.end();
    await page.waitForTimeout(300);
    await finger.start(1000, 600);
    await finger.end();
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    // Motion's own dev notice that the OS has Reduced Motion on is not ours.
    expect(errors.filter((e) => !e.includes("Reduced Motion enabled"))).toEqual(
      [],
    );
  });
});

test.describe("link preview (reduced motion)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("opens and closes as a crossfade with no console errors", async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoPreview(page);
    await openCard(page, link(page, "my write-up of the Brukas project"), 1);
    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0, { timeout: 3000 });
    // Motion's own dev notice that the OS has Reduced Motion on is not ours.
    expect(errors.filter((e) => !e.includes("Reduced Motion enabled"))).toEqual(
      [],
    );
  });
});
