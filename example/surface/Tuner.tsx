import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLOSED_PRESETS,
  LAYER_NAMES,
  OPEN_PRESETS,
  copyCss,
  defaultLook,
  defaultState,
  lookVars,
  presetShadow,
  shadowCss,
  type ClosedLook,
  type LayeredShadow,
  type Paint,
  type ShadowLayer,
  type ShadowPreset,
  type Theme,
  type ThemeLook,
  type TunerState,
} from "./model";
import type { SpecimenKind } from "./Stage";

const STORE_KEY = "vista-sheet:surface-tuner:v1";
const THEME_KEY = "vista-sheet:surface-tuner:theme";

function load(): TunerState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaultState(), ...(JSON.parse(raw) as TunerState) };
  } catch {
    /* fall through to defaults */
  }
  return defaultState();
}

/** Writes one theme's vars onto a specimen iframe's body (inline, so it
 * outranks example.css's body[data-dark-mode] cell). */
function applyToFrame(frame: HTMLIFrameElement, theme: Theme, look: ThemeLook) {
  const body = frame.contentDocument?.body;
  if (!body) return;
  body.dataset.darkMode = theme === "dark" ? "true" : "false";
  for (const [k, v] of Object.entries(lookVars(look))) {
    body.style.setProperty(k, v);
  }
  body.style.setProperty(
    "--surface-tuner-ring-width",
    `${look.closed.borderWidth}px`,
  );
}

// ── Controls ──────────────────────────────────────────────────────────────

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const { label, value, min, max, step, unit = "", onChange, disabled } = props;
  return (
    <label className="st-row" data-disabled={disabled || undefined}>
      <span className="st-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="st-value">
        {value}
        {unit}
      </span>
    </label>
  );
}

function PaintControl(props: {
  label: string;
  value: Paint;
  onChange: (v: Paint) => void;
  disabled?: boolean;
}) {
  const { label, value, onChange, disabled } = props;
  return (
    <>
      <label className="st-row" data-disabled={disabled || undefined}>
        <span className="st-label">{label}</span>
        <input
          type="color"
          value={value.color}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
        />
        <span className="st-value">{value.color}</span>
      </label>
      <Slider
        label="Opacity"
        value={value.opacity}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        onChange={(opacity) => onChange({ ...value, opacity })}
      />
    </>
  );
}

function Group(props: {
  anchor: string;
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="st-group" data-anchor-id={props.anchor}>
      <header className="st-group-head">
        <h3>{props.title}</h3>
        {props.aside}
      </header>
      {props.children}
    </section>
  );
}

function ShadowControls(props: {
  state: "closed" | "open";
  presets: ShadowPreset[];
  preset: string;
  shadow: LayeredShadow;
  theme: Theme;
  onPreset: (id: string, shadow: LayeredShadow) => void;
  onLayers: (shadow: LayeredShadow) => void;
}) {
  const { state, presets, preset, shadow, theme, onPreset, onLayers } = props;
  const setLayer = (i: 0 | 1, patch: Partial<ShadowLayer>) => {
    const next = [...shadow] as LayeredShadow;
    next[i] = { ...next[i], ...patch };
    onLayers(next);
  };
  const big = state === "open";
  return (
    <>
      <Group
        anchor={`${state}-shadow-preset`}
        title={state === "closed" ? "Trigger shadow" : "Sheet shadow"}
      >
        <div
          className="st-presets"
          role="group"
          aria-label={`${state} shadow preset`}
        >
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              data-preset={p.id}
              aria-pressed={preset === p.id}
              onClick={() => onPreset(p.id, presetShadow(p, theme))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <code className="st-css" data-shadow-css={state}>
          {shadowCss(shadow)}
        </code>
      </Group>
      {([0, 1] as const).map((i) => {
        const l = shadow[i];
        return (
          <Group
            key={i}
            anchor={`${state}-shadow-${LAYER_NAMES[i].toLowerCase()}`}
            title={`${LAYER_NAMES[i]} layer`}
            aside={
              <label className="st-toggle">
                <input
                  type="checkbox"
                  checked={l.on}
                  data-layer-toggle={`${state}-${i}`}
                  onChange={(e) => setLayer(i, { on: e.target.checked })}
                />
                On
              </label>
            }
          >
            <Slider
              label="Offset y"
              value={l.y}
              min={-16}
              max={big ? 64 : 32}
              step={1}
              unit="px"
              disabled={!l.on}
              onChange={(y) => setLayer(i, { y })}
            />
            <Slider
              label="Blur"
              value={l.blur}
              min={0}
              max={big ? 160 : 64}
              step={1}
              unit="px"
              disabled={!l.on}
              onChange={(blur) => setLayer(i, { blur })}
            />
            <Slider
              label="Spread"
              value={l.spread}
              min={-24}
              max={24}
              step={1}
              unit="px"
              disabled={!l.on}
              onChange={(spread) => setLayer(i, { spread })}
            />
            <PaintControl
              label="Colour"
              value={{ color: l.color, opacity: l.opacity }}
              disabled={!l.on}
              onChange={(p) => setLayer(i, p)}
            />
          </Group>
        );
      })}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const SPECIMENS: Array<{ kind: SpecimenKind; label: string; note: string }> = [
  { kind: "disc", label: "Disc trigger", note: "Closed. Hover and press it." },
  {
    kind: "button",
    label: "Rectangle trigger",
    note: "Closed. Hover and press it.",
  },
  {
    kind: "sheet",
    label: "Open sheet",
    note: "Open at rest (defaultOpen). Close it to watch the crossfade.",
  },
];

export function Tuner() {
  const [state, setState] = useState<TunerState>(load);
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light",
  );
  const [copied, setCopied] = useState(false);
  const frames = useRef<Partial<Record<SpecimenKind, HTMLIFrameElement>>>({});
  const look = state[theme];

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    for (const f of Object.values(frames.current)) {
      if (f) applyToFrame(f, theme, state[theme]);
    }
  }, [state, theme]);

  const latest = useRef({ state, theme });
  latest.current = { state, theme };
  const onFrameLoad = useCallback((f: HTMLIFrameElement) => {
    const { state: s, theme: t } = latest.current;
    applyToFrame(f, t, s[t]);
  }, []);

  const setClosed = (patch: Partial<ClosedLook>) =>
    setState((s) => ({
      ...s,
      [theme]: { ...s[theme], closed: { ...s[theme].closed, ...patch } },
    }));
  const setOpen = (patch: Partial<ThemeLook["open"]>) =>
    setState((s) => ({
      ...s,
      [theme]: { ...s[theme], open: { ...s[theme].open, ...patch } },
    }));

  const css = useMemo(() => copyCss(state), [state]);
  const c = look.closed;

  return (
    <div className="st-page">
      <main className="st-stage">
        <header className="st-top">
          <div>
            <h1>Surface &amp; shadow</h1>
            <p>
              Live specimens. Every dial writes a <code>--vista-sheet-*</code>{" "}
              var; <code>&lt;VistaSheet.Shadow&gt;</code> paints both looks.
            </p>
          </div>
          <div className="st-seg" role="group" aria-label="Theme">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-theme-button={t}
                aria-pressed={theme === t}
                onClick={() => setTheme(t)}
              >
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </header>
        <div className="st-specimens">
          {SPECIMENS.map((s) => (
            <figure
              key={s.kind}
              className="st-specimen"
              data-kind={s.kind}
              data-anchor-id={`specimen-${s.kind}`}
            >
              <iframe
                title={s.label}
                src={`/surface.html?stage=${s.kind}`}
                data-specimen={s.kind}
                ref={(el) => {
                  if (el) frames.current[s.kind] = el;
                }}
                onLoad={(e) => onFrameLoad(e.currentTarget)}
              />
              <figcaption>
                <strong>{s.label}</strong> {s.note}
              </figcaption>
            </figure>
          ))}
        </div>
      </main>

      <aside className="st-panel" aria-label="Surface and shadow dials">
        <div className="st-panel-head">
          <h2>
            Dials <span>({theme})</span>
          </h2>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({ ...s, [theme]: defaultLook(theme) }))
            }
          >
            Reset {theme}
          </button>
        </div>

        <h2 className="st-state">Closed state</h2>
        <ShadowControls
          state="closed"
          presets={CLOSED_PRESETS}
          preset={c.preset}
          shadow={c.shadow}
          theme={theme}
          onPreset={(preset, shadow) => setClosed({ preset, shadow })}
          onLayers={(shadow) => setClosed({ preset: "custom", shadow })}
        />
        <Group anchor="closed-ring" title="Surface border ring">
          <Slider
            label="Width"
            value={c.borderWidth}
            min={0}
            max={6}
            step={0.5}
            unit="px"
            onChange={(borderWidth) => setClosed({ borderWidth })}
          />
          <p className="st-note">
            Width is preview only: the package fixes the ring at 2px (no token
            yet).
          </p>
          <PaintControl
            label="Colour"
            value={c.border}
            onChange={(border) => setClosed({ border })}
          />
        </Group>
        <Group anchor="closed-feedback" title="Hover lift and press">
          <Slider
            label="Hover lift"
            value={c.hoverLift}
            min={0}
            max={6}
            step={0.5}
            unit="px"
            onChange={(hoverLift) => setClosed({ hoverLift })}
          />
          <Slider
            label="Press scale"
            value={c.pressScale}
            min={0.85}
            max={1}
            step={0.005}
            onChange={(pressScale) => setClosed({ pressScale })}
          />
        </Group>
        <Group anchor="closed-highlight" title="Highlight">
          <PaintControl
            label="Colour"
            value={c.highlight}
            onChange={(highlight) => setClosed({ highlight })}
          />
          <Slider
            label="Size"
            value={c.highlightSize}
            min={24}
            max={240}
            step={4}
            unit="px"
            onChange={(highlightSize) => setClosed({ highlightSize })}
          />
          <Slider
            label="Strength"
            value={c.highlightStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={(highlightStrength) => setClosed({ highlightStrength })}
          />
        </Group>
        <Group anchor="closed-press-tint" title="Press tint">
          <PaintControl
            label="Colour"
            value={c.pressTint}
            onChange={(pressTint) => setClosed({ pressTint })}
          />
        </Group>

        <h2 className="st-state">Open state</h2>
        <ShadowControls
          state="open"
          presets={OPEN_PRESETS}
          preset={look.open.preset}
          shadow={look.open.shadow}
          theme={theme}
          onPreset={(preset, shadow) => setOpen({ preset, shadow })}
          onLayers={(shadow) => setOpen({ preset: "custom", shadow })}
        />

        <Group
          anchor="copy-css"
          title="Copy CSS"
          aside={
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(css).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? "Copied" : "Copy"}
            </button>
          }
        >
          <pre className="st-out" data-copy-css>
            {css}
          </pre>
        </Group>
      </aside>
    </div>
  );
}
