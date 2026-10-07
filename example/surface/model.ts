// Surface & shadow tuner model. Pure data: dial values, presets, and the
// --vista-sheet-* vars they produce. The page writes these vars onto each
// live specimen; <VistaSheet.Shadow> is still the only thing that paints a
// shadow (::before = closed look, ::after = open look, DESIGN.md §3).

export type Theme = "light" | "dark";

export interface ShadowLayer {
  on: boolean;
  y: number;
  blur: number;
  spread: number;
  /** #rrggbb */
  color: string;
  opacity: number;
}

/** Two layers: [key, ambient]. */
export type LayeredShadow = [ShadowLayer, ShadowLayer];

export interface Paint {
  /** #rrggbb */
  color: string;
  opacity: number;
}

export interface ClosedLook {
  preset: string;
  shadow: LayeredShadow;
  borderWidth: number;
  border: Paint;
  hoverLift: number;
  pressScale: number;
  highlight: Paint;
  highlightSize: number;
  highlightStrength: number;
  pressTint: Paint;
}

export interface OpenLook {
  preset: string;
  shadow: LayeredShadow;
}

export interface ThemeLook {
  closed: ClosedLook;
  open: OpenLook;
}

export type TunerState = Record<Theme, ThemeLook>;

export const LAYER_NAMES = ["Key", "Ambient"] as const;

/** A preset layer: geometry, colour, and its alpha on light and on dark
 * grounds (a dark ground needs more alpha to read, DESIGN.md §3). */
type PresetLayer = {
  y: number;
  blur: number;
  spread: number;
  color?: string;
  alpha: [light: number, dark: number];
} | null;

export interface ShadowPreset {
  id: string;
  label: string;
  layers: [PresetLayer, PresetLayer];
}

const GLOW = "#7c5cff";

export const CLOSED_PRESETS: ShadowPreset[] = [
  { id: "none", label: "None", layers: [null, null] },
  {
    id: "hairline",
    label: "Hairline ring",
    layers: [{ y: 0, blur: 0, spread: 1, alpha: [0.08, 0.4] }, null],
  },
  {
    id: "soft",
    label: "Soft (current default)",
    layers: [
      { y: 1, blur: 2, spread: 0, alpha: [0.06, 0.3] },
      { y: 4, blur: 12, spread: 0, alpha: [0.08, 0.3] },
    ],
  },
  {
    id: "ambient",
    label: "Ambient",
    layers: [null, { y: 2, blur: 16, spread: 0, alpha: [0.1, 0.4] }],
  },
  {
    id: "lifted",
    label: "Lifted",
    layers: [
      { y: 2, blur: 4, spread: 0, alpha: [0.08, 0.35] },
      { y: 8, blur: 20, spread: -2, alpha: [0.12, 0.45] },
    ],
  },
  {
    id: "floating",
    label: "Floating",
    layers: [
      { y: 4, blur: 10, spread: -2, alpha: [0.06, 0.3] },
      { y: 16, blur: 40, spread: -6, alpha: [0.16, 0.55] },
    ],
  },
  {
    id: "glow",
    label: "Coloured glow",
    layers: [
      { y: 0, blur: 6, spread: 0, color: GLOW, alpha: [0.35, 0.5] },
      { y: 0, blur: 24, spread: 2, color: GLOW, alpha: [0.25, 0.4] },
    ],
  },
];

export const OPEN_PRESETS: ShadowPreset[] = [
  { id: "none", label: "None", layers: [null, null] },
  {
    id: "hairline",
    label: "Hairline ring",
    layers: [{ y: 0, blur: 0, spread: 1, alpha: [0.08, 0.4] }, null],
  },
  {
    id: "soft",
    label: "Soft (current default)",
    layers: [
      { y: 2, blur: 8, spread: 0, alpha: [0.12, 0.35] },
      { y: 8, blur: 48, spread: 0, alpha: [0.24, 0.55] },
    ],
  },
  {
    id: "ambient",
    label: "Ambient",
    layers: [null, { y: 0, blur: 64, spread: 0, alpha: [0.18, 0.5] }],
  },
  {
    id: "lifted",
    label: "Lifted",
    layers: [
      { y: 4, blur: 12, spread: 0, alpha: [0.12, 0.4] },
      { y: 16, blur: 48, spread: -8, alpha: [0.24, 0.6] },
    ],
  },
  {
    id: "floating",
    label: "Floating",
    layers: [
      { y: 8, blur: 24, spread: -4, alpha: [0.1, 0.4] },
      { y: 32, blur: 96, spread: -12, alpha: [0.28, 0.7] },
    ],
  },
  {
    id: "glow",
    label: "Coloured glow",
    layers: [
      { y: 0, blur: 16, spread: 0, color: GLOW, alpha: [0.3, 0.45] },
      { y: 0, blur: 64, spread: 4, color: GLOW, alpha: [0.25, 0.4] },
    ],
  },
];

const OFF_LAYER: ShadowLayer = {
  on: false,
  y: 0,
  blur: 0,
  spread: 0,
  color: "#000000",
  opacity: 0,
};

export function presetShadow(
  preset: ShadowPreset,
  theme: Theme,
): LayeredShadow {
  const i = theme === "light" ? 0 : 1;
  const layer = (p: PresetLayer, fallback: ShadowLayer): ShadowLayer =>
    p
      ? {
          on: true,
          y: p.y,
          blur: p.blur,
          spread: p.spread,
          color: p.color ?? "#000000",
          opacity: p.alpha[i],
        }
      : { ...fallback, on: false };
  return [
    layer(preset.layers[0], OFF_LAYER),
    layer(preset.layers[1], OFF_LAYER),
  ];
}

function presetById(list: ShadowPreset[], id: string): ShadowPreset {
  return list.find((p) => p.id === id) ?? list[0];
}

/** Current package defaults (README theming table) and the example pages'
 * dark cell (example/example.css). */
export function defaultLook(theme: Theme): ThemeLook {
  const dark = theme === "dark";
  return {
    closed: {
      preset: "soft",
      shadow: presetShadow(presetById(CLOSED_PRESETS, "soft"), theme),
      borderWidth: 2,
      border: dark
        ? { color: "#ffffff", opacity: 0.1 }
        : { color: "#e5e5e5", opacity: 1 },
      hoverLift: 1,
      pressScale: 0.97,
      highlight: dark
        ? { color: "#ffffff", opacity: 0.1 }
        : { color: "#1d1d1f", opacity: 0.07 },
      highlightSize: 96,
      highlightStrength: 1,
      pressTint: { color: "#000000", opacity: dark ? 0.2 : 0.05 },
    },
    open: {
      preset: "soft",
      shadow: presetShadow(presetById(OPEN_PRESETS, "soft"), theme),
    },
  };
}

export function defaultState(): TunerState {
  return { light: defaultLook("light"), dark: defaultLook("dark") };
}

function num(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function px(n: number): string {
  return n === 0 ? "0" : `${num(n)}px`;
}

export function paint({ color, opacity }: Paint): string {
  if (opacity >= 1) return color;
  const v = parseInt(color.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${num(opacity)})`;
}

export function shadowCss(shadow: LayeredShadow): string {
  const parts = shadow
    .filter((l) => l.on)
    .map(
      (l) =>
        `0 ${px(l.y)} ${px(l.blur)}${l.spread ? ` ${px(l.spread)}` : ""} ${paint(l)}`,
    );
  return parts.length ? parts.join(", ") : "none";
}

/** The --vista-sheet-* vars one theme's look sets. */
export function lookVars(look: ThemeLook): Record<string, string> {
  const c = look.closed;
  return {
    "--vista-sheet-shadow": shadowCss(c.shadow),
    "--vista-sheet-sheet-shadow": shadowCss(look.open.shadow),
    "--vista-sheet-surface-border": paint(c.border),
    "--vista-sheet-trigger-hover-lift": px(c.hoverLift),
    "--vista-sheet-trigger-press-scale": num(c.pressScale),
    "--vista-sheet-trigger-highlight-color": paint(c.highlight),
    "--vista-sheet-trigger-highlight-size": px(c.highlightSize),
    "--vista-sheet-trigger-highlight-strength": num(c.highlightStrength),
    "--vista-sheet-trigger-press-tint": paint(c.pressTint),
  };
}

function block(selector: string, look: ThemeLook): string {
  const body = Object.entries(lookVars(look))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

function borderWidthNote(look: ThemeLook, theme: Theme): string {
  const w = look.closed.borderWidth;
  if (w === 2) return "";
  return (
    `\n\n/* ${theme}: trigger ring width ${w}px. Not a token yet: the package ` +
    `fixes it at 2px (and Shared's 2px inset matches it). Preview only. */`
  );
}

export function copyCss(state: TunerState): string {
  return (
    `/* vista-sheet surface & shadow — light */\n${block(":root", state.light)}` +
    `\n\n/* dark — use your own dark-palette selector */\n` +
    `${block('[data-theme="dark"]', state.dark)}` +
    borderWidthNote(state.light, "light") +
    borderWidthNote(state.dark, "dark")
  );
}
