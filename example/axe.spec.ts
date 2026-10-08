import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * axe.spec.ts — an axe scan of every shipping example page, in each state,
 * in default and reduced motion. Runs inside `test:geometry`, which
 * `prepublishOnly` runs, so any violation blocks a publish.
 * (docs/plans/a11y-web-standards.md, P0-5.) Not scanned: canvas, play, tune,
 * surface (lab/tool pages, not shipping examples).
 *
 * Two passes, because AxeBuilder's last runOnly wins: pass 1 is the WCAG
 * tag set; pass 2 is Label-in-Name, which carries a `wcag21a` tag but is
 * not reliably selected by tags alone. The red-proof test at the bottom
 * proves pass 2 actually catches a mismatch.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHEET = '[data-vista-sheet-part="sheet"]';

// The focus guards (`<span tabIndex=0 aria-hidden>`, the standard focus-trap
// sentinel) are scanned, not excluded: axe's aria-hidden-focus does not flag
// them. If a future axe does, exclude only [data-vista-sheet-focus-guard].

// data-vista-sheet-settled flips at a collapse threshold, before the item
// stagger has finished fading in. A half-faded item reads as low contrast, so
// wait for every item to be fully opaque too.
async function waitSettled(page: Page) {
  await page.waitForSelector(`${SHEET}[data-vista-sheet-settled]`);
  await page.waitForFunction(
    (sheet) =>
      [
        ...document.querySelectorAll(`${sheet} [data-vista-sheet-part="item"]`),
      ].every((el) => getComputedStyle(el).opacity === "1"),
    SHEET,
  );
}

function scan(page: Page) {
  return new AxeBuilder({ page });
}

async function violations(page: Page) {
  const wcag = await scan(page).withTags(TAGS).analyze();
  const labelInName = await scan(page)
    .withRules(["label-content-name-mismatch"])
    .analyze();
  return [...wcag.violations, ...labelInName.violations].map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
}

type PageSpec = {
  name: string;
  path: string;
  trigger?: string; // accessible name of the modal trigger
  hover?: string; // preview link text (hover card)
};

const PAGES: PageSpec[] = [
  { name: "index", path: "/", trigger: "Open example sheet" },
  { name: "contact", path: "/contact.html", trigger: "Open contact form" },
  { name: "buttons", path: "/buttons.html", trigger: "Open search messages" },
  { name: "list", path: "/list.html", trigger: "Open quick actions" },
  {
    name: "media-card",
    path: "/media-card.html",
    trigger: "Open Wavelength preview",
  },
  { name: "video", path: "/video.html", trigger: "Open portrait video" },
  { name: "link-preview", path: "/link-preview.html", hover: "Ghostties" },
  { name: "flagship", path: "/flagship.html", trigger: "Open contact" },
];

// The link-preview demo iframes real pages; never touch the network.
test.beforeEach(async ({ page }) => {
  await page.route("https://www.seansmithdesign.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>stub</title><h1>Stub page</h1><p>Local fixture.</p>",
    }),
  );
});

for (const motion of ["no-preference", "reduce"] as const) {
  test.describe(`axe, reducedMotion: ${motion}`, () => {
    test.use({ reducedMotion: motion });

    for (const p of PAGES) {
      test(`${p.name}: closed`, async ({ page }) => {
        await page.goto(p.path);
        await page.waitForLoadState("networkidle");
        expect(await violations(page)).toEqual([]);
      });

      if (p.trigger) {
        test(`${p.name}: open, settled`, async ({ page }) => {
          await page.goto(p.path);
          await page.getByRole("button", { name: p.trigger! }).click();
          await waitSettled(page);
          expect(await violations(page)).toEqual([]);
        });
      }

      if (p.hover) {
        test(`${p.name}: preview open`, async ({ page }) => {
          await page.goto(p.path);
          await page.locator("a.lp-link", { hasText: p.hover! }).hover();
          await waitSettled(page);
          expect(await violations(page)).toEqual([]);
        });
      }
    }
  });
}

test("red-proof: pass 2 flags a trigger whose aria-label omits its visible text", async ({
  page,
}) => {
  await page.goto("/fixtures/label-mismatch.html");
  await page.getByRole("button", { name: "Open panel" }).waitFor();
  const result = await scan(page)
    .withRules(["label-content-name-mismatch"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toContain(
    "label-content-name-mismatch",
  );
});
