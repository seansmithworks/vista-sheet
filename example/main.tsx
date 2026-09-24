import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { DialRoot, useDialKit, useDialKitController } from "dialkit";
import "dialkit/styles.css";
import { VistaSheet, type TriggerShape } from "../src/index";
import { CloseMask } from "./CloseMask";
import { ALL_ANCHORS, DEFAULT_ANCHOR, type AnchorId } from "../src/anchors";
import "./example.css";

// Sized to 100% of its parent, not a fixed px value: <VistaSheet.Shared>'s two
// instances (trigger-side and sheet-side) are laid out at different sizes by the
// package itself (the trigger's inset circle, the sheet's margined circle), so
// the child inside must fill whatever box it's given rather than assert its
// own size. Passing two differently-sized children into the two slots is
// exactly the footgun docs/PACKAGE-DESIGN.md §7B warns about (E1).
// <VistaSheet.Shared> clips it to the trigger's shape, so it must not round itself.
function ColorCircle() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #48484a 0%, #1d1d1f 100%)",
      }}
    />
  );
}

// Test-only prop overrides via query string (e.g. ?zIndex=500&sheetMaxWidth=600),
// so geometry.spec.ts can assert M1/M2 (zIndex / sheetMaxWidth actually
// reaching the CSS) without a second, divergent example mount.
const testParams = new URLSearchParams(window.location.search);
const zIndexOverride = testParams.has("zIndex")
  ? Number(testParams.get("zIndex"))
  : undefined;
const sheetMaxWidthOverride = testParams.has("sheetMaxWidth")
  ? Number(testParams.get("sheetMaxWidth"))
  : undefined;
// Test-only: a consumer-supplied delay on transition.open, so geometry.spec.ts
// can assert D4 (Root.tsx's drivenOpenTransition used to force delay:0 on the
// collapseProgress clock while Sheet.tsx's layoutId transition kept the
// consumer's delay, desyncing the two clocks by exactly this amount).
const openDelayOverride = testParams.has("openDelay")
  ? Number(testParams.get("openDelay"))
  : undefined;

// Demo-only: a single persisted settings object driving every toggle/select
// in the "Design" VistaSheet below (iridescent glow, dark ground, surface
// palette, main trigger size, dial visibility). One key, one try/catch, so a
// reload keeps every setting together rather than scattering localStorage
// keys per control.
type GlowStrength = "Light" | "Medium" | "Bold";
// "Variable" wanders continuously between the Very slow and Fast fixed
// steps (see SPIN_SPEED_STEPS below) rather than picking one of them.
type SpinSpeed = (typeof SPIN_SPEED_STEPS)[number]["label"] | "Variable";

interface DemoSettings {
  iridescent: boolean;
  darkMode: boolean;
  surface: "neutral" | "warm";
  triggerSize: "small" | "default" | "large";
  showDials: boolean;
  glowStrength: GlowStrength;
  spinSpeed: SpinSpeed;
}
const DEFAULT_SETTINGS: DemoSettings = {
  iridescent: false,
  darkMode: false,
  surface: "neutral",
  triggerSize: "default",
  showDials: false,
  glowStrength: "Bold",
  spinSpeed: "Moderate",
};
const SETTINGS_KEY = "vista-sheet-example:settings";
function readRawSettings(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function readSettings(): DemoSettings {
  const rest = readRawSettings();
  if (!rest) return DEFAULT_SETTINGS;
  // Defensive parse: `darkGround` (pre-rename field) is ignored rather
  // than merged in — spreading it in would coexist with `darkMode` under
  // a name nothing reads anymore.
  const { darkGround: _darkGround, ...clean } = rest;
  return { ...DEFAULT_SETTINGS, ...clean };
}

// The main Root's persisted anchor — same key `usePersistedAnchor` falls
// back to (DEFAULT_STORAGE_KEY) since main.tsx's <VistaSheet.Root id="main">
// below passes no `persistKey` override. Read directly here (rather than
// waiting on `onAnchorChange`, which only fires from a live drag — the
// mount-time localStorage restore inside usePersistedAnchor sets React
// state directly and never calls it) so the settings sheet's initial anchor
// already accounts for a persisted top-right main sheet on first paint.
const MAIN_ANCHOR_STORAGE_KEY = "vista-sheet-anchor";
function readMainAnchor(): AnchorId {
  try {
    const raw = localStorage.getItem(MAIN_ANCHOR_STORAGE_KEY);
    if (raw && (ALL_ANCHORS as string[]).includes(raw)) return raw as AnchorId;
  } catch {
    // Storage unavailable — keep the default.
  }
  return DEFAULT_ANCHOR;
}

// Main trigger's triggerSize ramp per "Trigger size" select. "Default" passes
// undefined so Root falls back to its own default ramp rather than us
// duplicating it here.
const TRIGGER_SIZE_RAMPS: Record<
  DemoSettings["triggerSize"],
  { base: number; md: number; xl: number } | undefined
> = {
  small: { base: 72, md: 96, xl: 112 },
  default: undefined,
  large: { base: 112, md: 144, xl: 168 },
};

// Fixed spin-speed steps for the glow's rotation (item 1). "Variable" (see
// SpinSpeed above) isn't one of these — it wanders continuously between the
// slowest (Very slow) and fastest (Fast) rates instead of picking a step.
const SPIN_SPEED_STEPS = [
  { label: "Very slow", seconds: 24 },
  { label: "Slow", seconds: 16 },
  { label: "Moderate", seconds: 10 },
  { label: "Quick", seconds: 6 },
  { label: "Fast", seconds: 3 },
] as const;

// Nearest fixed step to a given spinSeconds value, ties going to the slower
// (larger-seconds) option — used both as the Speed select's default and to
// re-point it whenever a palette (with its own spinSeconds) is chosen.
function nearestSpinStep(
  spinSeconds: number,
): (typeof SPIN_SPEED_STEPS)[number]["label"] {
  let best: (typeof SPIN_SPEED_STEPS)[number] = SPIN_SPEED_STEPS[0];
  let bestDist = Infinity;
  for (const step of SPIN_SPEED_STEPS) {
    const dist = Math.abs(step.seconds - spinSeconds);
    if (dist < bestDist || (dist === bestDist && step.seconds > best.seconds)) {
      bestDist = dist;
      best = step;
    }
  }
  return best.label;
}

function SlidersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Palette presets for the "palette" select below — chosen for how they read
// on video, not for a rebuild of the glow. Selecting one pushes colours +
// saturation + spin onto the existing dials; the strength select
// (Light/Medium/Bold) then supplies opacity/length/blur for that palette.
// Every slider stays live and tweakable after either choice. One ordered
// array is the single source of truth for the palette list (mildest to
// wildest) — appending a palette here is the whole job, no other file to
// touch. Bold is each palette's original opacity/length/blur; Light/Medium
// were chosen 2026-09-13.
type GlowStrengthValues = { opacity: number; length: number; blur: number };
type IriPreset = {
  saturation: number;
  spinSeconds: number;
  colors: {
    one: string;
    two: string;
    three: string;
    four: string;
    five: string;
    six: string;
  };
  strengths: Record<GlowStrength, GlowStrengthValues>;
};
const IRI_PALETTE_LIST: Array<{ name: string; preset: IriPreset }> = [
  // Texture over hue shift: near-neutral stops with small value/temperature
  // steps, a bit more opacity/blur so the moving light reads as texture
  // rather than a colour wheel, and a slower spin.
  {
    name: "Mono",
    preset: {
      saturation: 0.5,
      spinSeconds: 14,
      colors: {
        one: "#f5f3f0",
        two: "#c9ced4",
        three: "#b9b3c4",
        four: "#4a4a50",
        five: "#ffffff",
        six: "#8a94a6",
      },
      strengths: {
        Light: { opacity: 0.32, length: 46, blur: 42 },
        Medium: { opacity: 0.5, length: 56, blur: 52 },
        Bold: { opacity: 0.65, length: 64, blur: 60 },
      },
    },
  },
  // Nissan R34 GT-R V-Spec "Midnight Purple III" (LV4) colour-flop pearl:
  // deep violet through plum, a teal-green flop, a bronze/copper glint, and
  // a magenta highlight. Slow spin so the flop reads as a paint shift.
  {
    name: "Midnight Purple",
    preset: {
      saturation: 1.3,
      spinSeconds: 16,
      colors: {
        one: "#3a1250",
        two: "#5c1f4a",
        three: "#1f5c52",
        four: "#a86a3d",
        five: "#b8228a",
        six: "#180a24",
      },
      strengths: {
        Light: { opacity: 0.3, length: 44, blur: 34 },
        Medium: { opacity: 0.44, length: 52, blur: 38 },
        Bold: { opacity: 0.55, length: 60, blur: 44 },
      },
    },
  },
  // Cool northern-lights drift — green/teal curtains with one violet-to-pink
  // flash and a deep-navy floor. Slow spin so the curtains read as drift,
  // not a spin.
  {
    name: "Aurora",
    preset: {
      saturation: 1.1,
      spinSeconds: 18,
      colors: {
        one: "#2ee59d",
        two: "#a6ffd9",
        three: "#18b3b0",
        four: "#6a4cff",
        five: "#d45cf0",
        six: "#121a4a",
      },
      strengths: {
        Light: { opacity: 0.26, length: 50, blur: 40 },
        Medium: { opacity: 0.42, length: 62, blur: 48 },
        Bold: { opacity: 0.55, length: 72, blur: 56 },
      },
    },
  },
  {
    name: "Rainbow",
    preset: {
      saturation: 1.15,
      spinSeconds: 8,
      colors: {
        one: "#ff6ec7",
        two: "#7cc4ff",
        three: "#6effc6",
        four: "#ffe66e",
        five: "#ff9f6e",
        six: "#b28bff",
      },
      strengths: {
        Light: { opacity: 0.26, length: 40, blur: 28 },
        Medium: { opacity: 0.38, length: 48, blur: 34 },
        Bold: { opacity: 0.5, length: 56, blur: 40 },
      },
    },
  },
  // Luminous, not metallic: amber/yellow/orange with a pale butter highlight,
  // higher saturation. Glow, not chrome. Bold is Sean's dialled "Version 1"
  // (2026-09-13): opacity 0.22, length 161, blur 69, spinSeconds 16 — Light
  // and Medium are scaled proportionally around it, preserving this
  // palette's old Light/Bold and Medium/Bold ratios (was Light 0.3/42/32,
  // Medium 0.45/52/40, Bold 0.6/60/46).
  {
    name: "Neon Gold",
    preset: {
      saturation: 1.4,
      spinSeconds: 16,
      colors: {
        one: "#ffb833",
        two: "#fff066",
        three: "#ff8c1a",
        four: "#fff3c2",
        five: "#ffd166",
        six: "#ff6a00",
      },
      strengths: {
        Light: { opacity: 0.11, length: 113, blur: 48 },
        Medium: { opacity: 0.17, length: 140, blur: 60 },
        Bold: { opacity: 0.22, length: 161, blur: 69 },
      },
    },
  },
  // Electric cyan against deep navy — bioluminescent plankton stirred in
  // dark water. Quick spin so the sparks read as agitation.
  {
    name: "Biolume",
    preset: {
      saturation: 1.5,
      spinSeconds: 7,
      colors: {
        one: "#00e5ff",
        two: "#0a3d7a",
        three: "#3d7bff",
        four: "#041a33",
        five: "#9ff6ff",
        six: "#0077b6",
      },
      strengths: {
        Light: { opacity: 0.28, length: 42, blur: 28 },
        Medium: { opacity: 0.46, length: 52, blur: 34 },
        Bold: { opacity: 0.6, length: 60, blur: 40 },
      },
    },
  },
  // Magenta/violet fire with gold and a pearl highlight. Quick spin, high
  // saturation — reads hot rather than jewel-toned.
  {
    name: "Demon Pink",
    preset: {
      saturation: 1.6,
      spinSeconds: 5,
      colors: {
        one: "#ffc53d",
        two: "#ff3d8b",
        three: "#ff2fd0",
        four: "#9a2bff",
        five: "#2a0845",
        six: "#ffd1f0",
      },
      strengths: {
        Light: { opacity: 0.25, length: 44, blur: 30 },
        Medium: { opacity: 0.41, length: 54, blur: 38 },
        Bold: { opacity: 0.55, length: 64, blur: 44 },
      },
    },
  },
  // Comic misprint: cyan/magenta/yellow/red with dark ink gaps between
  // them. Blur deliberately about half the length (vs. ~0.7x elsewhere) so
  // the stops stay separated rather than blending into a smooth wash, and
  // the fastest spin of the set.
  {
    name: "Glitch",
    preset: {
      saturation: 1.8,
      spinSeconds: 3,
      colors: {
        one: "#ff0a8c",
        two: "#00e0ff",
        three: "#1b1040",
        four: "#fff200",
        five: "#ff2a1a",
        six: "#2a0a2e",
      },
      strengths: {
        Light: { opacity: 0.27, length: 34, blur: 16 },
        Medium: { opacity: 0.45, length: 42, blur: 20 },
        Bold: { opacity: 0.6, length: 48, blur: 24 },
      },
    },
  },
];
const IRI_PALETTES: Record<string, IriPreset> = Object.fromEntries(
  IRI_PALETTE_LIST.map(({ name, preset }) => [name, preset]),
);

// Live dials for the glow, shown only while the toggle is on. Persisted under
// dialkit:morph-sheet-iridescent. That key predates the VistaSheet rename —
// changing it orphans Sean's saved dial history, so the id below stays as-is.
const IRI_DIALS = {
  palette: {
    type: "select" as const,
    options: IRI_PALETTE_LIST.map((p) => p.name),
    default: "Rainbow",
  },
  opacity: [0.5, 0, 1, 0.01] as [number, number, number, number],
  length: [56, 0, 240, 1] as [number, number, number, number],
  blur: [40, 0, 120, 1] as [number, number, number, number],
  saturation: [1.15, 0, 2, 0.05] as [number, number, number, number],
  spinSeconds: [8, 1, 30, 0.5] as [number, number, number, number],
  colors: {
    one: "#ff6ec7",
    two: "#7cc4ff",
    three: "#6effc6",
    four: "#ffe66e",
    five: "#ff9f6e",
    six: "#b28bff",
  },
};

// The Shadow crossfade window (Shadow.tsx reads these two vars via
// readVarPx: --vista-sheet-sheet-shadow-fade-start/-fade-end). Seeded so the
// heavy sheet shadow (`--vista-sheet-sheet-shadow`) is fully in at
// collapseProgress p=0 (open, at rest) and fully gone by p=0.25 — roughly
// where the silhouette has shrunk enough that the thin disc shadow
// (`--vista-sheet-shadow`) alone reads right, rather than a heavy blur on a
// small shape. Persisted under dialkit:morph-sheet-shadow-crossfade. That key
// predates the VistaSheet rename — changing it orphans Sean's saved dial
// history, so the id below stays as-is.
const SHADOW_CROSSFADE_DIALS = {
  fadeStart: [0, 0, 1, 0.01] as [number, number, number, number],
  fadeEnd: [0.25, 0, 1, 0.01] as [number, number, number, number],
};

function App() {
  const [settings, setSettings] = useState(readSettings);
  const iri = settings.iridescent;
  const updateSettings = (next: Partial<DemoSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } catch {
        // storage blocked — the settings still work for this page view
      }
      return merged;
    });
  };
  // Dark mode toggles body-level background/text, not just `.page` (the
  // page div has no explicit height, so a short page would leave the
  // original light body visible below the fold) — and, via example.css's
  // `body[data-dark-mode="true"]` block, the --vista-sheet-* consumer
  // tokens both sheets read, so they switch to dark chrome too.
  useEffect(() => {
    document.body.dataset.darkMode = settings.darkMode ? "true" : "false";
  }, [settings.darkMode]);
  // Surface (Neutral/Warm) also toggles on body, not an inline style on
  // `.page`: an inline custom property always wins the cascade over
  // body[data-dark-mode]'s dark tokens, which is what made Warm + Dark mode
  // paint cream sheets on a black page (bug fix 2026-09-13). The palette now
  // resolves from the (surface × darkMode) pair as four CSS cells in
  // example.css, with no inline override able to outrank dark mode.
  useEffect(() => {
    document.body.dataset.surface = settings.surface;
  }, [settings.surface]);

  // The settings sheet's anchor is derived, not a user choice: it takes
  // top-right unless the main sheet already occupies it, in which case it
  // takes top-left — so the two triggers can never overlap. `mainAnchor`
  // seeds from the persisted value at mount (readMainAnchor) and tracks
  // live drags via onAnchorChange below.
  const [mainAnchor, setMainAnchor] = useState<AnchorId>(readMainAnchor);
  const desiredSettingsAnchor: AnchorId =
    mainAnchor === "top-right" ? "top-left" : "top-right";
  // The settings Root is remounted on `key={appliedSettingsAnchor}` (anchor
  // is uncontrolled-only, docs/PACKAGE-DESIGN.md §8) — but remounting while
  // that sheet is open or closing skips its exit animation and focus
  // restore. So a change in the desired anchor is only ever applied while
  // the settings sheet is fully closed: held in `appliedSettingsAnchor`
  // until `onOpenChange` reports `false`. `settingsOpenRef` reads the
  // latest open state inside that same closure without adding it as an
  // effect dependency.
  const [appliedSettingsAnchor, setAppliedSettingsAnchor] = useState<AnchorId>(
    desiredSettingsAnchor,
  );
  const settingsOpenRef = useRef(false);
  useEffect(() => {
    if (!settingsOpenRef.current) {
      setAppliedSettingsAnchor(desiredSettingsAnchor);
    }
  }, [desiredSettingsAnchor]);
  const iriController = useDialKitController("Iridescent shadow", IRI_DIALS, {
    id: "morph-sheet-iridescent",
    persist: true,
  });
  const dials = iriController.values;
  // Applies a palette's preset values onto the live dials the moment the
  // "palette" select changes, so every slider updates but stays tweakable
  // afterward — colours, saturation and spin here; opacity/length/blur come
  // from the currently-selected glow strength (see the strength effect
  // below), same as today's palette apply pushes them all via setValue.
  // Guarded by a ref (not state) so it never re-fires just because a slider
  // moved, and never fires on mount for the default.
  const lastPalette = useRef(dials.palette);
  const lastStrength = useRef(settings.glowStrength);
  useEffect(() => {
    if (dials.palette === lastPalette.current) return;
    lastPalette.current = dials.palette;
    const preset = IRI_PALETTES[dials.palette];
    if (!preset) return;
    const strength = preset.strengths[lastStrength.current];
    iriController.setValue("opacity", strength.opacity);
    iriController.setValue("length", strength.length);
    iriController.setValue("blur", strength.blur);
    iriController.setValue("saturation", preset.saturation);
    iriController.setValue("spinSeconds", preset.spinSeconds);
    iriController.setValue("colors.one", preset.colors.one);
    iriController.setValue("colors.two", preset.colors.two);
    iriController.setValue("colors.three", preset.colors.three);
    iriController.setValue("colors.four", preset.colors.four);
    iriController.setValue("colors.five", preset.colors.five);
    iriController.setValue("colors.six", preset.colors.six);
    // Speed-select re-pointing is NOT done here: this effect also fires when
    // dialkit hydrates `dials.palette` from its own persisted storage after
    // mount, which looks identical to a user picking a new palette. Doing
    // it here clobbered a just-loaded `spinSpeed` on reload. The "Glow
    // colour" select's onChange below (a real user/test interaction only)
    // does the re-point instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dials.palette]);
  // Applies the newly-chosen strength's opacity/length/blur for the
  // currently-selected palette, leaving colours/saturation/spin untouched
  // (those are the palette effect's job) so switching strength never
  // silently resets a manually-chosen spin speed.
  useEffect(() => {
    if (settings.glowStrength === lastStrength.current) return;
    lastStrength.current = settings.glowStrength;
    const preset = IRI_PALETTES[dials.palette];
    if (!preset) return;
    const strength = preset.strengths[settings.glowStrength];
    iriController.setValue("opacity", strength.opacity);
    iriController.setValue("length", strength.length);
    iriController.setValue("blur", strength.blur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.glowStrength]);
  // Drives --iri-angle by rAF rather than a CSS animation-duration, so
  // switching speed (including into/out of "Variable") only ever changes
  // the rate the angle accumulates at, never its position — a duration
  // change on a running CSS animation would otherwise jump the rotation
  // phase (item 1). "Variable" oscillates the angular velocity smoothly and
  // continuously between the Very slow and Fast steps' rates (never
  // reversing direction) via a sine, so there is no jump entering or
  // leaving it either. Reduced motion: exactly as before, the glow simply
  // never turns (no rAF loop started).
  const iriAngleRef = useRef(0);
  const iriShadowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!iri) return;
    const el = iriShadowRef.current;
    if (!el) return;
    // Live rather than read-once: the old CSS-driven spin reacted to the OS
    // reduced-motion toggle mid-session (a media query in the stylesheet),
    // so this rAF replacement has to react the same way — subscribe to the
    // query's `change` event instead of just reading `.matches` on mount.
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const VARIABLE_PERIOD_MS = 24000;
    const vMin = 360 / SPIN_SPEED_STEPS[0].seconds; // Very slow
    const vMax = 360 / SPIN_SPEED_STEPS[SPIN_SPEED_STEPS.length - 1].seconds; // Fast
    let raf = 0;
    let last = performance.now();
    let start = last;
    const frame = (now: number) => {
      const dtSec = (now - last) / 1000;
      last = now;
      let velocityDegPerSec: number;
      if (settings.spinSpeed === "Variable") {
        const phase = ((now - start) / VARIABLE_PERIOD_MS) * Math.PI * 2;
        const t = (Math.sin(phase) + 1) / 2;
        velocityDegPerSec = vMin + (vMax - vMin) * t;
      } else {
        velocityDegPerSec = 360 / dials.spinSeconds;
      }
      iriAngleRef.current =
        (iriAngleRef.current + velocityDegPerSec * dtSec) % 360;
      el.style.setProperty("--iri-angle", `${iriAngleRef.current}deg`);
      raf = requestAnimationFrame(frame);
    };
    const start_ = () => {
      if (raf) return;
      last = performance.now();
      start = last;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    if (!media.matches) start_();
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        stop();
      } else {
        start_();
      }
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      stop();
    };
  }, [iri, settings.spinSpeed, dials.spinSeconds]);
  const shadowCrossfade = useDialKit(
    "Sheet shadow crossfade",
    SHADOW_CROSSFADE_DIALS,
    { id: "morph-sheet-shadow-crossfade", persist: true },
  );
  // Test-only: ?shape= for geometry.spec.ts shape repeats. P2 task 5 types
  // this. Placed here (not beside the other testParams overrides above)
  // so it doesn't shift naming.test.ts's line-number allowlist for the
  // frozen dialkit ids above.
  const SHAPE_PARAM_VALUES: readonly TriggerShape[] = [
    "circle",
    "squircle",
    "rounded-square",
    "square",
  ];
  const shapeParam = testParams.get("shape");
  const shapeOverride: TriggerShape | undefined = SHAPE_PARAM_VALUES.find(
    (s) => s === shapeParam,
  );
  const c = dials.colors;
  const iriStyle = {
    "--iri-opacity": dials.opacity,
    "--iri-length": `${dials.length}px`,
    "--iri-blur": `${dials.blur}px`,
    "--iri-saturation": dials.saturation,
    "--iri-colors": [c.one, c.two, c.three, c.four, c.five, c.six, c.one].join(
      ", ",
    ),
  } as CSSProperties;
  // Consumer-set crossfade dial, plumbed as CSS custom properties on an
  // ancestor of <VistaSheet.Shadow> — CSS custom properties inherit down the
  // DOM tree, and .shadow (or an asChild swap) isn't portalled, so Shadow.tsx's
  // readVarPx(el, ...) picks these up via getComputedStyle the same way it
  // already reads --vista-sheet-sheet-radius from wherever a consumer set it.
  const shadowCrossfadeStyle = {
    "--vista-sheet-sheet-shadow-fade-start": shadowCrossfade.fadeStart,
    "--vista-sheet-sheet-shadow-fade-end": shadowCrossfade.fadeEnd,
  } as CSSProperties;
  const pageStyle = shadowCrossfadeStyle;

  return (
    <div className="page" style={pageStyle}>
      {/* Gated on the same toggle as the glow dials (not rendered
          unconditionally): DialRoot's own "Versions" trigger button overlays
          the morph trigger at narrow viewports and intercepts its clicks,
          which broke 20 geometry.spec.ts tests when this was unconditional.
          The Sheet shadow crossfade panel registered below still shows up
          here once "Show dials" is on. `productionEnabled` unlocks
          dialkit's own dev-only default (it renders nothing in a production
          build otherwise) — still fully gated by the toggle above. */}
      {settings.showDials && (
        <DialRoot position="bottom-right" productionEnabled />
      )}
      <h1>vista-sheet</h1>
      <p className="sub">
        A bare trigger, morphing into a sheet. Tap the trigger (bottom-center by
        default) — drag it to any of the seven anchors first if you like.
      </p>

      <VistaSheet.Root
        shape={shapeOverride}
        id="main"
        zIndex={zIndexOverride}
        sheetMaxWidth={sheetMaxWidthOverride}
        triggerSize={TRIGGER_SIZE_RAMPS[settings.triggerSize]}
        onAnchorChange={setMainAnchor}
        transition={
          openDelayOverride !== undefined
            ? {
                open: {
                  type: "spring",
                  stiffness: 375,
                  damping: 42.5,
                  mass: 1.75,
                  delay: openDelayOverride,
                },
              }
            : undefined
        }
      >
        {iri ? (
          <VistaSheet.Shadow asChild>
            <div ref={iriShadowRef} className="iri-shadow" style={iriStyle} />
          </VistaSheet.Shadow>
        ) : (
          <VistaSheet.Shadow />
        )}

        <VistaSheet.Trigger aria-label="Open example sheet">
          <VistaSheet.Shared>
            <ColorCircle />
          </VistaSheet.Shared>
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="example-sheet-title">
          <VistaSheet.Shared>
            <ColorCircle />
          </VistaSheet.Shared>

          <VistaSheet.Close aria-label="Close" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <h2 id="example-sheet-title">Placeholder heading</h2>
            </VistaSheet.Item>
            <VistaSheet.Item>
              <p>
                Everything inside &lt;VistaSheet.Content&gt; is supplied by the
                consumer. This example ships a colored circle, this heading, and
                two links.
              </p>
            </VistaSheet.Item>
            <VistaSheet.Item>
              <nav
                aria-label="Example links"
                style={{ display: "flex", gap: 16 }}
              >
                <a href="https://example.com">Example.com</a>
                <a href="https://github.com">GitHub</a>
              </nav>
            </VistaSheet.Item>
          </VistaSheet.Content>
        </VistaSheet.Sheet>

        {/* CloseMask demonstrates the escape hatch: it rebuilds the
            trailing-paper close mask from OUTSIDE the package using only
            useVistaSheet().collapseProgress (+ its built-in getVelocity()) and
            triggerRect/sheetRect. It renders no DOM of its own — it finds the
            live sheet element by its documented data-vista-sheet-part="sheet"
            attribute and writes a mask-image directly onto it. See
            CloseMask.tsx. */}
        <CloseMask />
      </VistaSheet.Root>

      {/* A second, independent VistaSheet.Root: a small "Design" settings
          panel that restyles the demo above. Own id ("settings", vs the main
          sheet's "main") and own persistKey so its anchor never shares
          localStorage with the main sheet's. Rendered after (and painted
          above, via a higher zIndex) the main Root so the two triggers never
          fight over stacking order if they ever visually overlap. Not
          draggable — it is a fixed utility control, not the demo subject. */}
      <VistaSheet.Root
        // Remounted on its own applied anchor (`key`): anchor is
        // uncontrolled-only in v0.1 (docs/PACKAGE-DESIGN.md §8), so a
        // `defaultAnchor` change alone wouldn't move an already-mounted
        // Root. `appliedSettingsAnchor` only changes while this Root is
        // closed (see the effect above + onOpenChange below), so the key
        // never flips mid-animation and never interrupts this Root's own
        // open/close.
        key={appliedSettingsAnchor}
        id="settings"
        defaultAnchor={appliedSettingsAnchor}
        onOpenChange={(next) => {
          settingsOpenRef.current = next;
          if (!next) setAppliedSettingsAnchor(desiredSettingsAnchor);
        }}
        persistKey={false}
        draggable={false}
        triggerSize={40}
        zIndex={300}
      >
        <VistaSheet.Trigger aria-label="Design settings">
          <SlidersIcon />
        </VistaSheet.Trigger>

        <VistaSheet.Sheet aria-labelledby="settings-sheet-title">
          <VistaSheet.Close aria-label="Close settings" />

          <VistaSheet.Content>
            <VistaSheet.Item>
              <h2 id="settings-sheet-title">Design</h2>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-iridescent-label">
                  Iridescent shadow
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.iridescent}
                  aria-labelledby="setting-iridescent-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ iridescent: !settings.iridescent })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-palette">
                  Glow colour
                </label>
                <select
                  id="setting-palette"
                  className="settings-select"
                  value={dials.palette}
                  disabled={!settings.iridescent}
                  onChange={(e) => {
                    const next = e.target.value;
                    iriController.setValue("palette", next);
                    const preset = IRI_PALETTES[next];
                    if (preset) {
                      updateSettings({
                        spinSpeed: nearestSpinStep(preset.spinSeconds),
                      });
                    }
                  }}
                >
                  {IRI_DIALS.palette.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-strength">
                  Glow strength
                </label>
                <select
                  id="setting-strength"
                  className="settings-select"
                  value={settings.glowStrength}
                  disabled={!settings.iridescent}
                  onChange={(e) =>
                    updateSettings({
                      glowStrength: e.target.value as GlowStrength,
                    })
                  }
                >
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Bold">Bold</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-speed">
                  Shadow speed
                </label>
                <select
                  id="setting-speed"
                  className="settings-select"
                  value={settings.spinSpeed}
                  disabled={!settings.iridescent}
                  onChange={(e) => {
                    const next = e.target.value as SpinSpeed;
                    updateSettings({ spinSpeed: next });
                    if (next !== "Variable") {
                      const step = SPIN_SPEED_STEPS.find(
                        (s) => s.label === next,
                      );
                      if (step) {
                        iriController.setValue("spinSeconds", step.seconds);
                      }
                    }
                  }}
                >
                  {SPIN_SPEED_STEPS.map((step) => (
                    <option key={step.label} value={step.label}>
                      {step.label} ({step.seconds}s)
                    </option>
                  ))}
                  <option value="Variable">Variable</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-dark-mode-label">
                  Dark mode
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.darkMode}
                  aria-labelledby="setting-dark-mode-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ darkMode: !settings.darkMode })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label className="settings-label" htmlFor="setting-surface">
                  Surface
                </label>
                <select
                  id="setting-surface"
                  className="settings-select"
                  value={settings.surface}
                  onChange={(e) =>
                    updateSettings({
                      surface: e.target.value as DemoSettings["surface"],
                    })
                  }
                >
                  <option value="neutral">Neutral</option>
                  <option value="warm">Warm</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <label
                  className="settings-label"
                  htmlFor="setting-trigger-size"
                >
                  Trigger size
                </label>
                <select
                  id="setting-trigger-size"
                  className="settings-select"
                  value={settings.triggerSize}
                  onChange={(e) =>
                    updateSettings({
                      triggerSize: e.target
                        .value as DemoSettings["triggerSize"],
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="default">Default</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </VistaSheet.Item>

            <VistaSheet.Item>
              <div className="settings-row">
                <span className="settings-label" id="setting-show-dials-label">
                  Show dials
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showDials}
                  aria-labelledby="setting-show-dials-label"
                  className="demo-toggle-switch"
                  onClick={() =>
                    updateSettings({ showDials: !settings.showDials })
                  }
                >
                  <span className="demo-toggle-track" aria-hidden="true" />
                </button>
              </div>
            </VistaSheet.Item>
          </VistaSheet.Content>
        </VistaSheet.Sheet>
      </VistaSheet.Root>
    </div>
  );
}

// Not wrapped in <StrictMode>: React's dev double-invocation of effects
// makes the Playwright geometry/media/shadow-perframe specs' "runs once per
// frame" and drag/skew timing assertions flaky-to-failing (double reads,
// doubled RAF scheduling). The Trigger StrictMode-remount regression this
// fix addresses is covered by src/Trigger.strictmode.test.tsx (vitest),
// which exercises unmount/remount directly and doesn't need the app root
// wrapped here.
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
