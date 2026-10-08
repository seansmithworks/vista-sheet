import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Copy-tool contract spec for example/play.html (P1 task 1 of 6,
 * tests-only). The 'copy-harness:' tests exercise the in-file TypeScript
 * compiler-API harness against README.md's own Usage snippet, and pass
 * today — they prove the harness itself works before any playground code
 * exists. The 'play-copy:' tests drive the not-yet-built playground and are
 * expected to fail until a later P1 task builds it.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!fs.existsSync(path.join(ROOT, "src", "index.ts"))) {
  throw new Error(`expected ${path.join(ROOT, "src", "index.ts")} to exist`);
}

let previousProgram: ts.Program | undefined;

/**
 * Typechecks each named virtual `.tsx` file against `src/` through the real
 * TypeScript compiler API, resolving `@wicket/iris` to
 * `src/index.ts` via a `paths` override — the same resolution a consumer
 * gets from the package's own d.ts, minus the publish step. Virtual files
 * are never written to disk: the host is asked for a fixed set of
 * `example/__play_copy_virtual__/<name>.tsx` paths and serves them from
 * memory only.
 */
function typecheck(
  files: Record<string, string>,
  pathsOverride: Record<string, string[]> = {
    "@wicket/iris": ["src/index.ts"],
  },
): Map<string, string[]> {
  const configPath = path.join(ROOT, "tsconfig.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);

  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    baseUrl: ROOT,
    paths: pathsOverride,
  };

  const virtualDir = path.join(ROOT, "example", "__play_copy_virtual__");
  const virtualPaths = new Map<string, string>();
  for (const name of Object.keys(files)) {
    virtualPaths.set(path.join(virtualDir, `${name}.tsx`), files[name]);
  }

  const host = ts.createCompilerHost(options);

  // Strawman (v0.2): a plain `paths` compiler-option override is not
  // enough — this package's own package.json declares
  // name: "@wicket/iris" with an `exports` map, so once
  // `paths` resolution fails (e.g. a broken target during the guard-fire
  // proof), TypeScript's self-referencing-package fallback silently
  // re-resolves the bare specifier to the built `dist/index.d.ts` next to
  // it — masking a broken path with stale compiled output instead of
  // failing. `resolveModuleNameLiterals` intercepts the specifier before
  // any of that machinery runs, so the target in `pathsOverride` is the
  // only place `@wicket/iris` can resolve to.
  host.resolveModuleNameLiterals = (
    moduleLiterals,
    containingFile,
    redirectedReference,
    resolutionOptions,
  ) =>
    moduleLiterals.map((literal) => {
      const target = pathsOverride[literal.text]?.[0];
      if (target) {
        const resolvedFileName = path.join(ROOT, target);
        return {
          resolvedModule: {
            resolvedFileName,
            extension: resolvedFileName.endsWith(".tsx")
              ? ts.Extension.Tsx
              : ts.Extension.Ts,
            isExternalLibraryImport: false,
          },
        };
      }
      const result = ts.resolveModuleName(
        literal.text,
        containingFile,
        resolutionOptions,
        host,
        undefined,
        redirectedReference,
      );
      return { resolvedModule: result.resolvedModule };
    });

  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) =>
    virtualPaths.has(fileName) || originalFileExists(fileName);

  const originalReadFile = host.readFile.bind(host);
  host.readFile = (fileName) =>
    virtualPaths.has(fileName)
      ? virtualPaths.get(fileName)
      : originalReadFile(fileName);

  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (virtualPaths.has(fileName)) {
      const languageVersion =
        typeof languageVersionOrOptions === "object"
          ? languageVersionOrOptions.languageVersion
          : languageVersionOrOptions;
      return ts.createSourceFile(
        fileName,
        virtualPaths.get(fileName) ?? "",
        languageVersion,
        true,
        ts.ScriptKind.TSX,
      );
    }
    return originalGetSourceFile(
      fileName,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  const rootNames = [
    ...virtualPaths.keys(),
    path.join(ROOT, "src", "css-modules.d.ts"),
  ];

  const program = ts.createProgram({
    rootNames,
    options,
    host,
    oldProgram: previousProgram,
  });
  previousProgram = program;

  const format = (d: ts.Diagnostic) =>
    `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;

  const shared = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ].map(format);

  const results = new Map<string, string[]>();
  for (const name of Object.keys(files)) {
    const fileName = path.join(virtualDir, `${name}.tsx`);
    const sf = program.getSourceFile(fileName);
    const diags = sf ? ts.getPreEmitDiagnostics(program, sf) : [];
    results.set(name, [...shared, ...diags.map(format)]);
  }

  return results;
}

function getReadmeUsageSnippet(): string {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const usageIndex = readme.indexOf("## Usage");
  if (usageIndex === -1) throw new Error("README.md has no '## Usage' section");
  const rest = readme.slice(usageIndex);
  const match = rest.match(/```tsx\n([\s\S]*?)```/);
  if (!match) throw new Error("README.md Usage section has no tsx block");
  return match[1];
}

function getReadmeVars(): Set<string> {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const re = /^\|\s*`(--wicket-iris-[a-zA-Z0-9-]+)`\s*\|/gm;
  const vars = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(readme))) vars.add(m[1]);
  return vars;
}

async function gotoPlay(page: Page) {
  await page.goto("/play.html");
  await expect(page.locator("[data-play-shell]")).toBeVisible();
  const frame = page.frameLocator("iframe[data-play-stage]");
  await expect(
    frame.locator(
      '[data-wicket-iris-root="specimen"] [data-wicket-iris-part="trigger"]',
    ),
  ).toBeVisible();
  return frame;
}

async function readOutputs(page: Page) {
  const jsx = await page.locator('pre[data-play-output="jsx"]').textContent();
  const css = await page.locator('pre[data-play-output="css"]').textContent();
  return { jsx: jsx ?? "", css: css ?? "" };
}

function assertNoMotionLeak(jsx: string) {
  expect(jsx).not.toMatch(/\b(snappy|gentle|presets?|transition)\b/);
}

function assertCssOnlyReadmeVars(css: string, readmeVars: Set<string>) {
  const used = css.match(/--wicket-iris-[a-zA-Z0-9-]+/g) ?? [];
  for (const token of used) {
    expect(readmeVars.has(token)).toBe(true);
  }
}

function assertNoShadowOrFilter(css: string) {
  expect(css).not.toMatch(/(^|[;{\s])(box-shadow|filter)\s*:/m);
}

test.describe("copy-harness", () => {
  test("copy-harness: accepts the README usage snippet", async () => {
    test.setTimeout(120_000);
    const snippet = getReadmeUsageSnippet();
    const results = typecheck({ case: snippet });
    expect(results.get("case")).toEqual([]);
  });

  test("copy-harness: rejects an invalid shape", async () => {
    test.setTimeout(120_000);
    const snippet = getReadmeUsageSnippet().replace(
      "<Iris.Root>",
      '<Iris.Root shape="triangle">',
    );
    const results = typecheck({ case: snippet });
    const diags = results.get("case") ?? [];
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.startsWith("2322:"))).toBe(true);
  });

  test("copy-harness: rejects a Trigger without aria-label", async () => {
    test.setTimeout(120_000);
    const snippet = getReadmeUsageSnippet().replace(
      ' aria-label="Open contact"',
      "",
    );
    const results = typecheck({ case: snippet });
    const diags = results.get("case") ?? [];
    expect(diags.length).toBeGreaterThan(0);
  });
});

test.describe("play-copy", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("play-copy: defaults typecheck", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);
    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('className="vs-theme"');
    expect(jsx).toContain("<Iris.Shadow />");
    expect(jsx).not.toContain("shape=");
  });

  test("play-copy: squircle, top-right, 72px, not draggable, red accent typecheck", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByRole("radio", { name: "Squircle", exact: true }).check();
    await page.getByLabel("Anchor", { exact: true }).selectOption("top-right");
    await page.getByLabel("Trigger size", { exact: true }).selectOption("72");
    await page.getByLabel("Draggable", { exact: true }).uncheck();
    await page.getByLabel("Accent", { exact: true }).fill("#ff0000");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('shape="squircle"');
    expect(jsx).toContain('defaultAnchor="top-right"');
    expect(jsx).toContain("triggerSize={72}");
    expect(jsx).toContain("draggable={false}");
    expect(css).toContain("--wicket-iris-accent: #ff0000;");
  });

  test("play-copy: list recipe, rounded square, 360 wide, no swipe, no shadow typecheck", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("list");
    await page
      .getByRole("radio", { name: "Rounded square", exact: true })
      .check();
    await page
      .getByLabel("Sheet max width", { exact: true })
      .selectOption("360");
    await page.getByLabel("Dismiss on swipe", { exact: true }).uncheck();
    await page.getByLabel("Shadow", { exact: true }).uncheck();

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('shape="rounded-square"');
    expect(jsx).toContain("sheetMaxWidth={360}");
    expect(jsx).toContain("dismissOnSwipe={false}");
    expect(jsx).not.toContain("Iris.Shadow");
  });

  test("play-copy: grid recipe, square, center, no backdrop dismiss, warm dark typecheck", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("grid");
    await page.getByRole("radio", { name: "Square", exact: true }).check();
    await page.getByLabel("Anchor", { exact: true }).selectOption("center");
    await page.getByLabel("Dismiss on backdrop", { exact: true }).uncheck();
    await page.getByLabel("Palette", { exact: true }).selectOption("warm-dark");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain("dismissOnBackdrop={false}");
    expect(jsx).toContain('defaultAnchor="center"');
    expect(css).toContain("--wicket-iris-surface: #1f1b17;");
  });

  test("play-copy: nav recipe, 128px, neutral typecheck", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("nav");
    await page.getByLabel("Trigger size", { exact: true }).selectOption("128");
    await page.getByLabel("Palette", { exact: true }).selectOption("neutral");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain("triggerSize={128}");
    expect(css).toContain("--wicket-iris-surface: #fafafa;");
  });

  test("play-copy: media recipe, top-left, squircle typecheck", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("media");
    await page.getByLabel("Anchor", { exact: true }).selectOption("top-left");
    await page.getByRole("radio", { name: "Squircle", exact: true }).check();

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('aria-label="Open Wavelength preview"');
    expect(jsx).toContain('defaultAnchor="top-left"');
  });

  test("play-copy: video recipe typecheck", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("video");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx.split("<Iris.Media").length - 1).toBe(2);
    expect(jsx).toContain("aspectRatio={0.5625}");
    expect(jsx).toContain('src="/media/wicket-iris-portrait.mp4"');
    expect(jsx).toContain('poster="/media/wicket-iris-portrait.jpg"');
    expect(jsx).toContain('aria-label="Portrait video"');

    expect(jsx).not.toContain("Iris.Shared");
    expect(jsx).not.toContain("Iris.Content");
    expect(jsx).not.toContain("aria-labelledby");
  });

  test("play-copy: search recipe, large, 240 wide, text only typecheck", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("search");
    await page.getByLabel("Button size", { exact: true }).selectOption("l");
    await page.getByLabel("Button width", { exact: true }).selectOption("240");
    await page
      .getByLabel("Button content", { exact: true })
      .selectOption("text");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('shape="rectangle"');
    expect(jsx).toContain('buttonSize="l"');
    expect(jsx).toContain("buttonWidth={240}");
    expect(jsx).not.toContain("Iris.Shared");
    expect(jsx).not.toContain("vs-button-icon");
  });

  test("play-copy: chat recipe typecheck", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoPlay(page);

    await page.getByLabel("Recipe", { exact: true }).selectOption("chat");

    const { jsx, css } = await readOutputs(page);
    const readmeVars = getReadmeVars();

    expect(jsx).toContain(
      'import { Iris } from "@wicket/iris";',
    );
    assertNoMotionLeak(jsx);
    const diags = typecheck({ case: jsx }).get("case") ?? [];
    expect(diags, diags.join("\n")).toEqual([]);
    assertCssOnlyReadmeVars(css, readmeVars);
    assertNoShadowOrFilter(css);

    expect(jsx).toContain('aria-label="Open chat"');
    expect(jsx).toContain('shape="rectangle"');
    expect(jsx).toContain("vs-button-icon");
    expect(jsx).toContain("Ask anything");
    expect(jsx).not.toContain("Iris.Shared");
  });
});
