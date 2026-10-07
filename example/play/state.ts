import type { AnchorId, ButtonSize, TriggerShape } from "../../src/index";
import { getRecipe, type RecipeId } from "./recipes";

export type TriggerSize = "responsive" | 56 | 72 | 96 | 128 | 160;
export type SheetMaxWidth = 320 | 360 | 420 | 480 | 560 | 640;
export type PaletteId = "warm" | "warm-dark" | "neutral" | "neutral-dark";
export type ButtonContent = "icon" | "icon-text" | "text";
export type ButtonWidthOption = "label" | 200 | 240 | 280 | 320;

export interface PlayState {
  recipe: RecipeId;
  shape: TriggerShape;
  anchor: AnchorId;
  triggerSize: TriggerSize;
  draggable: boolean;
  shadow: boolean;
  sheetMaxWidth: SheetMaxWidth;
  dismissOnSwipe: boolean;
  dismissOnBackdrop: boolean;
  sheetRadius: number;
  sheetPadding: number;
  palette: PaletteId | "custom";
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  accent: string;
  triggerShadow: string;
  sheetShadow: string;
  buttonSize: ButtonSize;
  buttonContent: ButtonContent;
  buttonWidth: ButtonWidthOption;
}

/** README theming-table defaults (package defaults, "Neutral" palette). */
export const PACKAGE_DEFAULTS = {
  surface: "#fafafa",
  surfaceElevated: "#ffffff",
  border: "#e5e5e5",
  text: "#1d1d1f",
  accent: "#1d1d1f",
  triggerShadow:
    "0 1px 4px rgba(26, 22, 16, 0.14), 0 6px 24px rgba(0, 0, 0, 0.15)",
  sheetShadow: "0 8px 48px rgba(0, 0, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.12)",
} as const;

export const ANCHORS: AnchorId[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
];

export const SHAPES: Array<{ id: TriggerShape; label: string }> = [
  { id: "circle", label: "Circle" },
  { id: "squircle", label: "Squircle" },
  { id: "rounded-square", label: "Rounded square" },
  { id: "square", label: "Square" },
  { id: "rectangle", label: "Rectangle" },
];

interface PaletteDef {
  label: string;
  ground: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  accent: string;
  triggerShadow: string;
  sheetShadow: string;
}

const DARK_SHADOW =
  "0 1px 4px rgba(0, 0, 0, 0.4), 0 6px 24px rgba(0, 0, 0, 0.45)";
const DARK_SHEET_SHADOW =
  "0 8px 48px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35)";

// Strawman (v0.2): "Neutral" is the default palette because it equals the
// package's own README defaults — the first copy the playground shows has
// no var-override block at all, which is the clearest possible starting
// point for a stranger reading the copied CSS.
export const PALETTES: Record<PaletteId, PaletteDef> = {
  warm: {
    label: "Warm",
    ground: "#eeede8",
    surface: "#faf7f2",
    surfaceElevated: "#f4f0e8",
    border: "#e6dfd2",
    text: "#1a1610",
    accent: "#1a1610",
    triggerShadow: PACKAGE_DEFAULTS.triggerShadow,
    sheetShadow: PACKAGE_DEFAULTS.sheetShadow,
  },
  "warm-dark": {
    label: "Warm dark",
    ground: "#0b0b0c",
    surface: "#1f1b17",
    surfaceElevated: "#29241f",
    border: "#3a332b",
    text: "#f2ece3",
    accent: "#f2ece3",
    triggerShadow: DARK_SHADOW,
    sheetShadow: DARK_SHEET_SHADOW,
  },
  neutral: {
    label: "Neutral",
    ground: "#f5f5f7",
    surface: "#fafafa",
    surfaceElevated: "#ffffff",
    border: "#e5e5e5",
    text: "#1d1d1f",
    accent: "#1d1d1f",
    triggerShadow: PACKAGE_DEFAULTS.triggerShadow,
    sheetShadow: PACKAGE_DEFAULTS.sheetShadow,
  },
  "neutral-dark": {
    label: "Neutral dark",
    ground: "#0b0b0c",
    surface: "#1c1c1e",
    surfaceElevated: "#2c2c2e",
    border: "rgba(255, 255, 255, 0.1)",
    text: "#f5f5f7",
    accent: "#f5f5f7",
    triggerShadow: DARK_SHADOW,
    sheetShadow: DARK_SHEET_SHADOW,
  },
};

export const DEFAULT_STATE: PlayState = {
  recipe: "basic",
  shape: "circle",
  anchor: "bottom-center",
  triggerSize: "responsive",
  draggable: true,
  shadow: true,
  sheetMaxWidth: 480,
  dismissOnSwipe: true,
  dismissOnBackdrop: true,
  sheetRadius: 48,
  sheetPadding: 24,
  palette: "neutral",
  surface: PALETTES.neutral.surface,
  surfaceElevated: PALETTES.neutral.surfaceElevated,
  border: PALETTES.neutral.border,
  text: PALETTES.neutral.text,
  accent: PALETTES.neutral.accent,
  triggerShadow: PALETTES.neutral.triggerShadow,
  sheetShadow: PALETTES.neutral.sheetShadow,
  buttonSize: "m",
  buttonContent: "icon-text",
  buttonWidth: "label",
};

export function groundFor(state: PlayState): string {
  if (state.palette === "custom") return "#f5f5f7";
  return PALETTES[state.palette].ground;
}

export function applyPalette(state: PlayState, id: PaletteId): PlayState {
  const p = PALETTES[id];
  return {
    ...state,
    palette: id,
    surface: p.surface,
    surfaceElevated: p.surfaceElevated,
    border: p.border,
    text: p.text,
    accent: p.accent,
    triggerShadow: p.triggerShadow,
    sheetShadow: p.sheetShadow,
  };
}

export function applyRecipe(state: PlayState, id: RecipeId): PlayState {
  const recipe = getRecipe(id);
  // Strawman (v0.2): the recipe decides disc vs button (and media its
  // squircle); Shared/Media aren't supported inside a rectangle trigger.
  const shape = recipe.button
    ? "rectangle"
    : (recipe.shape ?? (state.shape === "rectangle" ? "circle" : state.shape));
  return {
    ...state,
    recipe: id,
    shape,
    sheetMaxWidth: recipe.layout.sheetMaxWidth,
    sheetPadding: recipe.layout.sheetPadding,
    sheetRadius: recipe.layout.sheetRadius,
  };
}

function norm(v: string): string {
  return v.trim().toLowerCase();
}

type PaletteColorKey = keyof PaletteDef & keyof PlayState;

const PALETTE_COLOR_KEYS: PaletteColorKey[] = [
  "surface",
  "surfaceElevated",
  "border",
  "text",
  "accent",
  "triggerShadow",
  "sheetShadow",
];

export function matchPalette(state: PlayState): PaletteId | "custom" {
  for (const id of Object.keys(PALETTES) as PaletteId[]) {
    const palette = PALETTES[id];
    const matches = PALETTE_COLOR_KEYS.every(
      (key) => norm(String(palette[key])) === norm(String(state[key])),
    );
    if (matches) return id;
  }
  return "custom";
}
