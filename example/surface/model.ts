// Surface & shadow tuner model. Pure data: dial values, presets, and the
// --orrery-iris-* vars they produce. The page writes these vars onto each
// live specimen; <Iris.Shadow> is still the only thing that paints a
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

type LayerGeometry = {
  y: number;
  blur: number;
  spread: number;
  color?: string;
};

/** A preset layer: geometry, colour, and its alpha on light and on dark
 * grounds (a dark ground needs more alpha to read, DESIGN.md §3). `dark`
 * overrides the geometry and colour on dark, for a preset whose dark look is
 * a different shadow (the shipped default's dark glow). */
type PresetLayer =
  | (LayerGeometry & {
      alpha: [light: number, dark: number];
      dark?: Partial<LayerGeometry>;
    })
  | null;

const WHITE = "#ffffff";

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
      {
        y: 2,
        blur: 16,
        spread: -4,
        alpha: [0.03, 0.14],
        dark: { y: 2, blur: 4, spread: -2, color: WHITE },
      },
      {
        y: 6,
        blur: 20,
        spread: -4,
        alpha: [0.08, 0.15],
        dark: { y: 8, blur: 12, spread: 0, color: WHITE },
      },
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
      {
        y: 12,
        blur: 16,
        spread: -12,
        alpha: [0.12, 0.1],
        dark: { y: 4, blur: 20, spread: 0, color: WHITE },
      },
      {
        y: 8,
        blur: 22,
        spread: -4,
        alpha: [0.12, 0.15],
        dark: { y: 16, blur: 28, spread: -8, color: WHITE },
      },
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
  const layer = (p: PresetLayer, fallback: ShadowLayer): ShadowLayer => {
    if (!p) return { ...fallback, on: false };
    const g = { ...p, ...(theme === "dark" ? p.dark : undefined) };
    return {
      on: true,
      y: g.y,
      blur: g.blur,
      spread: g.spread,
      color: g.color ?? "#000000",
      opacity: p.alpha[i],
    };
  };
  return [
    layer(preset.layers[0], OFF_LAYER),
    layer(preset.layers[1], OFF_LAYER),
  ];
}

function presetById(list: ShadowPreset[], id: string): ShadowPreset {
  return list.find((p) => p.id === id) ?? list[0];
}

/** Current package defaults (README theming table) and the example pages'
 * dark cell (example/example.css). Sean's dial, 2026-10-07. */
export function defaultLook(theme: Theme): ThemeLook {
  const dark = theme === "dark";
  return {
    closed: {
      preset: "soft",
      shadow: presetShadow(presetById(CLOSED_PRESETS, "soft"), theme),
      borderWidth: 1,
      border: dark
        ? { color: "#ffffff", opacity: 0.1 }
        : { color: "#e5e5e5", opacity: 0.6 },
      hoverLift: 1,
      pressScale: 0.97,
      highlight: dark
        ? { color: "#ffffff", opacity: 0.1 }
        : { color: "#1d1d1f", opacity: 0.07 },
      highlightSize: 96,
      highlightStrength: dark ? 1 : 0.75,
      pressTint: dark
        ? { color: "#ffffff", opacity: 0.15 }
        : { color: "#000000", opacity: 0.06 },
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

/** The --orrery-iris-* vars one theme's look sets. */
export function lookVars(look: ThemeLook): Record<string, string> {
  const c = look.closed;
  return {
    "--orrery-iris-shadow": shadowCss(c.shadow),
    "--orrery-iris-sheet-shadow": shadowCss(look.open.shadow),
    "--orrery-iris-surface-border": paint(c.border),
    "--orrery-iris-surface-border-width": px(c.borderWidth),
    "--orrery-iris-trigger-hover-lift": px(c.hoverLift),
    "--orrery-iris-trigger-press-scale": num(c.pressScale),
    "--orrery-iris-trigger-highlight-color": paint(c.highlight),
    "--orrery-iris-trigger-highlight-size": px(c.highlightSize),
    "--orrery-iris-trigger-highlight-strength": num(c.highlightStrength),
    "--orrery-iris-trigger-press-tint": paint(c.pressTint),
  };
}

function block(selector: string, look: ThemeLook): string {
  const body = Object.entries(lookVars(look))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

export function copyCss(state: TunerState): string {
  return (
    `/* orrery-iris surface & shadow — light */\n${block(":root", state.light)}` +
    `\n\n/* dark — use your own dark-palette selector */\n` +
    `${block('[data-theme="dark"]', state.dark)}`
  );
}
