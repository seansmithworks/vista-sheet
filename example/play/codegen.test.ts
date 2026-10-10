import { describe, expect, it } from "vitest";
import { buildCss, buildSpecimenTree, printJsxFile } from "./codegen";
import { getRecipe, type PlayNode, type RecipeId } from "./recipes";
import {
  applyPalette,
  applyRecipe,
  DEFAULT_STATE,
  PALETTES,
  type ButtonContent,
  type PaletteId,
  type PlayState,
} from "./state";

/**
 * Class-of-bug regression coverage for two verified playground defects
 * (2026-09-13):
 *
 * Bug A — `buildCss` used to omit a `--orrery-iris-*` declaration whenever
 * the current value equalled PACKAGE_DEFAULTS, so the default Warm palette
 * never declared the vars its own recipes read via `var(...)` with no
 * fallback (e.g. the chat bubble's `background: var(--orrery-iris-accent)`
 * resolved to nothing).
 *
 * Bug B — `.vs-button-icon` / `.vs-button-text` lived only in
 * SEARCH_RECIPE's own `css`, but `buildCss` only ever emits the ACTIVE
 * recipe's css block, so Chat's identical classes (trigger + composer send
 * icon) rendered unstyled.
 *
 * Both are structural: (a) proves every className the specimen tree can
 * produce has a matching selector in the CSS the same state generates; (b)
 * proves every `var(--orrery-iris-*)` read without a CSS fallback is
 * declared by that same state's CSS. Neither test is specific to accent or
 * to vs-button-icon — either bug class, in any recipe or palette, fails one
 * of these two.
 */

const RECIPE_IDS: RecipeId[] = [
  "basic",
  "list",
  "grid",
  "nav",
  "media",
  "video",
  "search",
  "chat",
];

const PALETTE_IDS: PaletteId[] = Object.keys(PALETTES) as PaletteId[];

const BUTTON_CONTENTS: ButtonContent[] = ["icon", "icon-text", "text"];

/**
 * One state per (recipe × palette), plus one extra state per (button
 * content variant) for recipes with a rectangle button — search and chat
 * are the only two, and buttonContent changes which classes the trigger
 * emits (icon-only vs text-only vs both).
 */
function allStates(): Array<{ label: string; state: PlayState }> {
  const states: Array<{ label: string; state: PlayState }> = [];
  for (const recipeId of RECIPE_IDS) {
    const recipeState = applyRecipe(DEFAULT_STATE, recipeId);
    for (const paletteId of PALETTE_IDS) {
      const state = applyPalette(recipeState, paletteId);
      states.push({ label: `${recipeId} / ${paletteId}`, state });

      const recipe = getRecipe(recipeId);
      if (recipe.button) {
        for (const buttonContent of BUTTON_CONTENTS) {
          states.push({
            label: `${recipeId} / ${paletteId} / button=${buttonContent}`,
            state: { ...state, buttonContent },
          });
        }
      }
    }
  }
  return states;
}

function collectClassNames(node: PlayNode, out: Set<string>): void {
  if ("text" in node) return;
  const classProp = node.props.find(([name]) => name === "className");
  if (classProp && typeof classProp[1] === "string") {
    for (const cls of classProp[1].split(/\s+/).filter(Boolean)) {
      out.add(cls);
    }
  }
  for (const child of node.children) collectClassNames(child, out);
}

/**
 * className values that legitimately have no CSS rule of their own (e.g. a
 * pure structural/theme-scoping class). Each entry needs a one-line reason;
 * an empty allowlist is the expected, healthy state.
 */
const CLASSNAME_ALLOWLIST: Record<string, string> = {};

function hasSelectorFor(css: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\.${escaped}(?![\\w-])`);
  return re.test(css);
}

describe("codegen: every specimen className has a matching CSS selector", () => {
  for (const { label, state } of allStates()) {
    it(label, () => {
      const tree = buildSpecimenTree(state);
      const css = buildCss(state);
      const classNames = new Set<string>();
      collectClassNames(tree, classNames);

      const missing = [...classNames].filter(
        (cls) => !CLASSNAME_ALLOWLIST[cls] && !hasSelectorFor(css, cls),
      );

      expect(
        missing,
        `${label}: classes with no CSS rule: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  }
});

function readVarsWithoutFallback(css: string): Set<string> {
  const re = /var\(\s*(--orrery-iris-[a-zA-Z0-9-]+)\s*\)/g;
  const vars = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) vars.add(m[1]);
  return vars;
}

function declaredVars(css: string): Set<string> {
  const re = /(--orrery-iris-[a-zA-Z0-9-]+)\s*:/g;
  const vars = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) vars.add(m[1]);
  return vars;
}

describe("codegen: every fallback-less var(--orrery-iris-*) read is declared", () => {
  for (const { label, state } of allStates()) {
    it(label, () => {
      const css = buildCss(state);
      const reads = readVarsWithoutFallback(css);
      const declared = declaredVars(css);

      const missing = [...reads].filter((v) => !declared.has(v));

      expect(
        missing,
        `${label}: read with no fallback and never declared: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  }
});

// --- WCAG contrast: chat bubble (surface text on accent background) -------

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [hi, lo] = lA > lB ? [lA, lB] : [lB, lA];
  return (hi + 0.05) / (lo + 0.05);
}

describe("chat bubble: surface-on-accent meets WCAG AA (>= 4.5)", () => {
  for (const paletteId of PALETTE_IDS) {
    it(paletteId, () => {
      const palette = PALETTES[paletteId];
      const ratio = contrastRatio(palette.surface, palette.accent);
      expect(
        ratio,
        `${paletteId}: surface ${palette.surface} vs accent ${palette.accent} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// --- N2: `Sheet initialFocus` is opt-in; Search and Chat's recipes are the
// only two that emit it (wave.md "### N2" — "New `Sheet initialFocus` ref
// is focused at settle; Search and Chat recipes emit it"). -----------------

describe("codegen: initialFocus ref wiring", () => {
  it("search: declares the ref, attaches it to the search field, and passes it to Sheet", () => {
    const state = applyRecipe(DEFAULT_STATE, "search");
    const jsx = printJsxFile(state);

    expect(jsx).toContain('import { useRef } from "react";');
    expect(jsx).toContain(
      "const initialFocusRef = useRef<HTMLInputElement>(null);",
    );
    expect(jsx).toContain("ref={initialFocusRef}");
    expect(jsx).toContain("initialFocus={initialFocusRef}");
    // The ref lands on the search input specifically, not some other
    // element — props print one per line when a tag doesn't fit inline, so
    // find the whole <input ... /> block and check it holds both.
    const inputStart = jsx.indexOf("<input");
    const inputBlock = jsx.slice(inputStart, jsx.indexOf("/>", inputStart) + 2);
    expect(inputBlock).toContain('type="search"');
    expect(inputBlock).toContain("ref={initialFocusRef}");
  });

  it("chat: declares the ref, attaches it to the composer field, and passes it to Sheet", () => {
    const state = applyRecipe(DEFAULT_STATE, "chat");
    const jsx = printJsxFile(state);

    expect(jsx).toContain('import { useRef } from "react";');
    expect(jsx).toContain(
      "const initialFocusRef = useRef<HTMLInputElement>(null);",
    );
    expect(jsx).toContain("ref={initialFocusRef}");
    expect(jsx).toContain("initialFocus={initialFocusRef}");
    const inputStart = jsx.indexOf("<input");
    const inputBlock = jsx.slice(inputStart, jsx.indexOf("/>", inputStart) + 2);
    expect(inputBlock).toContain('aria-label="Message"');
    expect(inputBlock).toContain("ref={initialFocusRef}");
  });

  it("every other recipe emits no ref, no useRef import, and no initialFocus prop", () => {
    const others: RecipeId[] = [
      "basic",
      "list",
      "grid",
      "nav",
      "media",
      "video",
    ];
    for (const recipeId of others) {
      const state = applyRecipe(DEFAULT_STATE, recipeId);
      const jsx = printJsxFile(state);
      expect(jsx, recipeId).not.toContain("useRef");
      expect(jsx, recipeId).not.toContain("initialFocus");
      expect(jsx, recipeId).not.toContain("ref={");
    }
  });
});
