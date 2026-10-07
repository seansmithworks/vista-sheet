import type { PlayState } from "./state";
import { getRecipe, INITIAL_FOCUS_PROP, type PlayNode } from "./recipes";

type PropValue = string | number | boolean;
type ElementNode = Extract<PlayNode, { type: string }>;

const INITIAL_FOCUS_REF_NAME = "initialFocusRef";

function isText(node: PlayNode): node is { text: string } {
  return "text" in node;
}

/** True if `node` or any descendant carries INITIAL_FOCUS_PROP (Search and
 * Chat's recipes mark their field; see recipes.ts). Every other recipe's
 * printed JSX is unaffected — no ref, no import, no `initialFocus` prop. */
function hasInitialFocusMarker(node: PlayNode): boolean {
  if (isText(node)) return false;
  if (node.props.some(([name]) => name === INITIAL_FOCUS_PROP)) return true;
  return node.children.some(hasInitialFocusMarker);
}

/**
 * Builds the same PlayNode tree the stage renders (one codegen model drives
 * both sides — see the copy-tool spec's "structurally impossible" drift
 * strawman). Root props omit every value equal to the package default so
 * the copied JSX reads as a minimal diff from `<VistaSheet.Root>`.
 */
export function buildSpecimenTree(state: PlayState): PlayNode {
  const recipe = getRecipe(state.recipe);

  const rootProps: Array<[string, PropValue]> = [["className", "vs-theme"]];
  if (state.shape !== "circle") rootProps.push(["shape", state.shape]);
  if (state.anchor !== "bottom-center") {
    rootProps.push(["defaultAnchor", state.anchor]);
  }
  if (state.triggerSize !== "responsive") {
    rootProps.push(["triggerSize", state.triggerSize]);
  }
  if (state.sheetMaxWidth !== 480) {
    rootProps.push(["sheetMaxWidth", state.sheetMaxWidth]);
  }
  if (state.draggable === false) rootProps.push(["draggable", false]);
  if (state.shape === "rectangle") {
    if (state.buttonSize !== "m")
      rootProps.push(["buttonSize", state.buttonSize]);
    if (state.buttonWidth !== "label") {
      rootProps.push(["buttonWidth", state.buttonWidth]);
    }
  }

  const slotNode = (): PlayNode => {
    if (recipe.media) {
      const m = recipe.media;
      return {
        type: "VistaSheet.Media",
        props: [
          ["src", m.src],
          ["poster", m.poster],
          ["aspectRatio", m.aspectRatio],
        ],
        children: [],
      };
    }
    // Only called for shared/media recipes (see triggerChildren and the
    // sheet-children spread below), so recipe.shared is always defined here.
    return {
      type: "VistaSheet.Shared",
      props: [],
      children: [recipe.shared as PlayNode],
    };
  };

  const buttonTextNode = (text: string): PlayNode => ({
    type: "span",
    props: [["className", "vs-button-text"]],
    children: [{ text }],
  });

  const triggerChildren = (): PlayNode[] => {
    if (recipe.button) {
      const { icon, text } = recipe.button;
      if (state.shape !== "rectangle") return [icon];
      if (state.buttonContent === "icon") return [icon];
      if (state.buttonContent === "text") return [buttonTextNode(text)];
      return [icon, buttonTextNode(text)];
    }
    return [slotNode()];
  };

  const children: PlayNode[] = [];
  if (state.shadow) {
    children.push({ type: "VistaSheet.Shadow", props: [], children: [] });
  }

  children.push({
    type: "VistaSheet.Trigger",
    props: [["aria-label", recipe.triggerLabel]],
    children: triggerChildren(),
  });

  const sheetProps: Array<[string, PropValue]> = recipe.sheetLabel
    ? [["aria-label", recipe.sheetLabel]]
    : [["aria-labelledby", "vs-sheet-title"]];
  if (recipe.media) sheetProps.push(["aspectRatio", recipe.media.aspectRatio]);
  if (!state.dismissOnSwipe) sheetProps.push(["dismissOnSwipe", false]);
  if (!state.dismissOnBackdrop) sheetProps.push(["dismissOnBackdrop", false]);

  const itemNodes: PlayNode[] = recipe.items.map((itemChildren) => ({
    type: "VistaSheet.Item",
    props: [],
    children: itemChildren,
  }));

  children.push({
    type: "VistaSheet.Sheet",
    props: sheetProps,
    children: [
      ...(recipe.button ? [] : [slotNode()]),
      {
        type: "VistaSheet.Close",
        props: [["aria-label", "Close"]],
        children: [],
      },
      ...(recipe.items.length > 0
        ? [
            {
              type: "VistaSheet.Content",
              props: [],
              children: itemNodes,
            } as PlayNode,
          ]
        : []),
    ],
  });

  return { type: "VistaSheet.Root", props: rootProps, children };
}

function formatPropValue(value: PropValue): string {
  if (typeof value === "number" || typeof value === "boolean") {
    return `{${value}}`;
  }
  if (/["\\]/.test(value)) return `{${JSON.stringify(value)}}`;
  return `"${value}"`;
}

function formatPropPair([name, value]: [string, PropValue]): string {
  return `${name}=${formatPropValue(value)}`;
}

function renderText(raw: string): string {
  const needsExpr = /[{}<>]/.test(raw) || /^\s|\s$/.test(raw);
  return needsExpr ? `{${JSON.stringify(raw)}}` : raw;
}

function buildOpeningTagInline(
  tag: string,
  propStrings: string[],
  selfClose: boolean,
): string {
  const propsStr = propStrings.map((p) => ` ${p}`).join("");
  return `<${tag}${propsStr}${selfClose ? " />" : ">"}`;
}

function printNode(
  node: PlayNode,
  indent: number,
  focusRefName: string | null,
  treeHasFocus: boolean,
): string[] {
  if (isText(node)) return [`${" ".repeat(indent)}${renderText(node.text)}`];
  return printElement(node, indent, focusRefName, treeHasFocus);
}

function printElement(
  node: ElementNode,
  indent: number,
  focusRefName: string | null,
  treeHasFocus: boolean,
): string[] {
  const { type: tag, props, children } = node;
  const marked =
    focusRefName !== null &&
    props.some(([name]) => name === INITIAL_FOCUS_PROP);
  const isSheet = tag === "VistaSheet.Sheet";

  const propStrings = props
    .filter(([name]) => name !== INITIAL_FOCUS_PROP)
    .map(formatPropPair);
  // `ref`/`initialFocus` are JS identifiers, not string/number/boolean
  // PropValues — appended as raw text rather than routed through
  // formatPropPair, which always quotes or brace-wraps its input.
  if (marked) propStrings.push(`ref={${focusRefName}}`);
  if (isSheet && treeHasFocus && focusRefName) {
    propStrings.push(`initialFocus={${focusRefName}}`);
  }

  const selfClose = children.length === 0;
  const inlineOpen = buildOpeningTagInline(tag, propStrings, selfClose);
  const fitsInline = indent + inlineOpen.length <= 80;

  let openLines: string[];
  if (fitsInline) {
    openLines = [`${" ".repeat(indent)}${inlineOpen}`];
  } else {
    const lines = [`${" ".repeat(indent)}<${tag}`];
    for (const propStr of propStrings) {
      lines.push(`${" ".repeat(indent + 2)}${propStr}`);
    }
    lines.push(`${" ".repeat(indent)}${selfClose ? "/>" : ">"}`);
    openLines = lines;
  }

  if (selfClose) return openLines;

  if (children.length === 1 && isText(children[0])) {
    const textStr = renderText((children[0] as { text: string }).text);
    if (openLines.length === 1) {
      const candidate = `${openLines[0]}${textStr}</${tag}>`;
      if (candidate.length <= 80) return [candidate];
    }
    return [
      ...openLines,
      `${" ".repeat(indent + 2)}${textStr}`,
      `${" ".repeat(indent)}</${tag}>`,
    ];
  }

  const lines = [...openLines];
  for (const child of children) {
    lines.push(...printNode(child, indent + 2, focusRefName, treeHasFocus));
  }
  lines.push(`${" ".repeat(indent)}</${tag}>`);
  return lines;
}

/**
 * Serialises `state` into the same JSX a consumer would paste into their own
 * file — real Unicode, never HTML entities; defaults omitted (Strawman
 * (v0.2)); component name fixed to VistaSheetExample (Strawman (v0.2)); a
 * CSS-comment pointer replaces a CSS import (Strawman (v0.2)), since the
 * playground has no bundler-relative path to hand a consumer.
 */
export function printJsxFile(state: PlayState): string {
  const tree = buildSpecimenTree(state);
  const treeHasFocus = hasInitialFocusMarker(tree);
  const focusRefName = treeHasFocus ? INITIAL_FOCUS_REF_NAME : null;
  const body = printNode(tree, 4, focusRefName, treeHasFocus).join("\n");

  const lines = ['"use client";', ""];
  if (treeHasFocus) lines.push('import { useRef } from "react";');
  lines.push(
    'import { VistaSheet } from "@seansmithworks/vista-sheet";',
    "// Styles: paste the CSS output into your global stylesheet.",
    "",
    "export default function VistaSheetExample() {",
  );
  if (treeHasFocus) {
    lines.push(`  const ${focusRefName} = useRef<HTMLInputElement>(null);`);
  }
  lines.push("  return (", body, "  );", "}", "");

  return lines.join("\n");
}

// Hard rule (DESIGN.md §4.1 single painter; Motion owns transforms, per
// ORCHESTRATOR.md "Fragile areas"): neither BASE_CSS nor any recipe's css
// may declare box-shadow, filter or transform — those are the package's own
// single-painter Shadow layer and Motion's job respectively, never a
// consumer override. transition/preset/snappy/gentle never appear either
// (the un-dialled motion presets stay out of the copy tool).
//
// BASE_CSS also carries every rule shared by more than one recipe
// (.vs-button-icon, .vs-button-text) — buildCss only ever emits the ACTIVE
// recipe's own css block, so a rule two recipes both use has to live here or
// the second recipe renders it unstyled (see Bug B, chat's icon/composer).
const BASE_CSS = `.vs-button-icon {
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vs-button-text {
  font-size: 15px;
  font-weight: 500;
}

/* The 44px close sits concentric with the sheet's corner (its centre on the
 * corner arc's centre), so it clears the curve like the content does. */
.vs-theme [data-vista-sheet-part="close"] {
  position: absolute;
  top: max(16px, calc(var(--vista-sheet-sheet-radius, 48px) - 22px));
  right: max(16px, calc(var(--vista-sheet-sheet-radius, 48px) - 22px));
}

/* The bottom inset is the sheet radius, so the last line sits above where
 * the corner curve starts and clears it by the same gutter as the sides. */
.vs-theme [data-vista-sheet-part="content"] {
  padding-bottom: max(
    var(--vista-sheet-sheet-padding, 24px),
    var(--vista-sheet-sheet-radius, 48px)
  );
}

.vs-theme [data-vista-sheet-part="item"] {
  padding-top: 16px;
}

.vs-theme [data-vista-sheet-part="item"]:first-of-type {
  padding-top: 24px;
}

/* A sheet that opens on its title (no Shared element above it) puts the
 * title on the close button's centre line, clear of the corner curve. 13px
 * is half the h2's 26px line. */
.vs-theme
  [data-vista-sheet-part="sheet"]:not(:has([data-vista-sheet-part="shared"]))
  [data-vista-sheet-part="item"]:first-of-type {
  padding-top: max(25px, calc(var(--vista-sheet-sheet-radius, 48px) - 13px));
}

.vs-theme [data-vista-sheet-part="content"] h2 {
  font-size: 20px;
  line-height: 1.3;
  margin: 0;
}

.vs-theme [data-vista-sheet-part="item"]:has(h2) + [data-vista-sheet-part="item"] {
  padding-top: 8px;
}

.vs-theme [data-vista-sheet-part="content"] p {
  margin: 0;
  line-height: 1.5;
  color: color-mix(in srgb, var(--vista-sheet-text) 72%, transparent);
}`;

/**
 * Builds the CSS pane: a `.vs-theme` var block declaring every palette token
 * for the CURRENT palette, the always-present base content styling ported
 * from example.css (also the home for any rule shared by more than one
 * recipe — see BASE_CSS), then the active recipe's own css.
 *
 * The var block is never omitted, even when the current palette equals the
 * package's own README defaults (Warm): a recipe's css can read any
 * `--vista-sheet-*` token via `var(...)` with no fallback (e.g. the chat
 * bubble's `background: var(--vista-sheet-accent)`), so the copied CSS must
 * be self-contained on every palette or that token resolves to nothing.
 * (Previously this block was emitted only for values that differed from
 * PACKAGE_DEFAULTS, which meant Warm — the default palette — never declared
 * it at all.)
 */
export function buildCss(state: PlayState): string {
  const recipe = getRecipe(state.recipe);
  const varLines: string[] = [
    `  --vista-sheet-surface: ${state.surface};`,
    `  --vista-sheet-surface-elevated: ${state.surfaceElevated};`,
    `  --vista-sheet-surface-border: ${state.border};`,
    `  --vista-sheet-text: ${state.text};`,
    `  --vista-sheet-accent: ${state.accent};`,
  ];
  if (state.sheetRadius !== 48) {
    varLines.push(`  --vista-sheet-sheet-radius: ${state.sheetRadius}px;`);
  }
  if (state.sheetPadding !== 24) {
    varLines.push(`  --vista-sheet-sheet-padding: ${state.sheetPadding}px;`);
  }
  varLines.push(`  --vista-sheet-shadow: ${state.triggerShadow};`);
  varLines.push(`  --vista-sheet-sheet-shadow: ${state.sheetShadow};`);

  const blocks: string[] = [`.vs-theme {\n${varLines.join("\n")}\n}`];
  blocks.push(BASE_CSS);
  blocks.push(recipe.css);

  return `${blocks.join("\n\n")}\n`;
}
