// Dev-only: feeds the tuner's state to html-review so a round Sean sends
// carries it. html-review has two host-facing hooks and this uses both:
//   1. a <script type="application/html-review+json"> tag the widget reads
//      at load and declares as the session's dials (first-wins);
//   2. POST /api/dials/:id {sessionId, value} to move a declared dial.
// A sent round snapshots every dial as {original, current, changed}.
// Dial kinds are range / toggle / segmented only, so colours are not dials:
// they travel inside the Copy CSS dial. Everything here is gated on
// import.meta.env.DEV, so `vite build` drops it.
// The page's dials are the only editor: surface.css hides the widget's own
// DIALS panel (under .cv-review), while its footer count and Send still use
// the values posted here.
import { loadReview } from "../canvas/review";
import { CLOSED_PRESETS, OPEN_PRESETS, copyCss, type TunerState } from "./model";
import type { Version } from "./history";
import { loadState, loadVersions } from "./storage";

type Value = number | boolean | string;

interface Dial {
  id: string;
  kind: "range" | "toggle" | "segmented";
  label: string;
  value: Value;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  steps?: Array<{ label: string; value: string }>;
  /** Derived from the other dials: posted when a round is sent, not on
   * every edit, so the widget's "N dials changed" counts only real dials. */
  derived?: boolean;
}

function dialsFor(state: TunerState, versions: Version[]): Dial[] {
  const out: Dial[] = [];
  const range = (
    id: string,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit?: string,
  ) => out.push({ id, kind: "range", label, value, min, max, step, unit });

  for (const theme of ["light", "dark"] as const) {
    const T = theme === "light" ? "Light" : "Dark";
    const { closed, open } = state[theme];
    const preset = (
      st: "closed" | "open",
      list: typeof CLOSED_PRESETS,
      value: string,
    ) =>
      out.push({
        id: `${theme}.${st}.preset`,
        kind: "segmented",
        label: `${T} ${st} preset`,
        value,
        steps: [...list, { id: "custom", label: "Custom" }].map((p) => ({
          label: p.label.replace(" (current default)", ""),
          value: p.id,
        })),
      });
    const layers = (
      st: "closed" | "open",
      shadow: TunerState["light"]["closed"]["shadow"],
    ) => {
      const big = st === "open";
      (["key", "ambient"] as const).forEach((name, i) => {
        const l = shadow[i];
        const id = `${theme}.${st}.${name}`;
        const label = `${T} ${st} ${name}`;
        out.push({
          id: `${id}.on`,
          kind: "toggle",
          label: `${label} on`,
          value: l.on,
        });
        range(`${id}.y`, `${label} y`, l.y, -16, big ? 64 : 32, 1, "px");
        range(`${id}.blur`, `${label} blur`, l.blur, 0, big ? 160 : 64, 1, "px");
        range(`${id}.spread`, `${label} spread`, l.spread, -24, 24, 1, "px");
        range(`${id}.opacity`, `${label} opacity`, l.opacity, 0, 1, 0.01);
      });
    };

    preset("closed", CLOSED_PRESETS, closed.preset);
    layers("closed", closed.shadow);
    range(`${theme}.closed.ring-width`, `${T} ring width`, closed.borderWidth, 0, 6, 0.5, "px");
    range(`${theme}.closed.ring-opacity`, `${T} ring opacity`, closed.border.opacity, 0, 1, 0.01);
    range(`${theme}.closed.hover-lift`, `${T} hover lift`, closed.hoverLift, 0, 6, 0.5, "px");
    range(`${theme}.closed.press-scale`, `${T} press scale`, closed.pressScale, 0.85, 1, 0.005);
    range(`${theme}.closed.highlight-opacity`, `${T} highlight opacity`, closed.highlight.opacity, 0, 1, 0.01);
    range(`${theme}.closed.highlight-size`, `${T} highlight size`, closed.highlightSize, 24, 240, 4, "px");
    range(`${theme}.closed.highlight-strength`, `${T} highlight strength`, closed.highlightStrength, 0, 1, 0.05);
    range(`${theme}.closed.press-tint-opacity`, `${T} press tint opacity`, closed.pressTint.opacity, 0, 1, 0.01);
    preset("open", OPEN_PRESETS, open.preset);
    layers("open", open.shadow);
  }

  const css = copyCss(state);
  out.push({
    id: "copy-css",
    kind: "segmented",
    label: "Copy CSS (both themes, incl. colours)",
    value: css,
    derived: true,
    steps: [{ label: "as first loaded", value: css }],
  });
  const saved = JSON.stringify(
    versions.map((v) => ({
      name: v.name,
      auto: v.auto,
      savedAt: new Date(v.savedAt).toISOString(),
      css: copyCss(v.state),
    })),
  );
  out.push({
    id: "saved-versions",
    kind: "segmented",
    label: `Saved versions (${versions.length})`,
    value: saved,
    derived: true,
    steps: [{ label: "as first loaded", value: saved }],
  });
  out.push({
    id: SYNC_ID,
    kind: "segmented",
    label: SYNC_LABEL,
    value: "sync",
    steps: [{ label: "sync", value: "sync" }],
  });
  return out;
}

// The widget re-reads the session only after its own actions, and has no
// public refresh. Clicking this dial's single, already-selected step makes
// it re-post the same value and re-read the session, so its footer count
// and Send button follow what the page posted. The value never changes.
const SYNC_ID = "sync";
const SYNC_LABEL = "Sync (internal)";

function nudgeWidget(): void {
  for (const line of document.querySelectorAll("#hw-dial-list .hw-dial")) {
    if (line.querySelector(".hw-dial-lab")?.textContent === SYNC_LABEL) {
      line.querySelector<HTMLElement>("[data-seg-value]")?.click();
    }
  }
}

const sessionId = () => new URLSearchParams(location.search).get("review");

/** Declares the tuner's dials from the persisted state, then loads the
 * widget. The tag must exist before widget.js runs. */
export function loadSurfaceReview(): void {
  if (!import.meta.env.DEV || !sessionId()) return;
  const tag = document.createElement("script");
  tag.type = "application/html-review+json";
  tag.textContent = JSON.stringify({
    dials: dialsFor(loadState(), loadVersions()),
  });
  document.head.append(tag);
  loadReview();
  document.addEventListener("click", beforeSend, true);
}

// Posts the derived dials (Copy CSS, saved versions) just before the
// widget's own Send handler runs, then lets the click through.
let resending = false;
async function beforeSend(e: MouseEvent): Promise<void> {
  const btn = (e.target as Element).closest?.("#hw-root button");
  if (resending || !btn || !/^Send to agent/.test(btn.textContent ?? "")) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  const id = sessionId();
  if (id && latest) {
    for (const d of dialsFor(latest.state, latest.versions)) {
      if (!d.derived) continue;
      try {
        await fetch(`/api/dials/${encodeURIComponent(d.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id, value: d.value }),
        });
      } catch {
        /* send anyway */
      }
    }
  }
  resending = true;
  (btn as HTMLElement).click();
  resending = false;
}

let latest: { state: TunerState; versions: Version[] } | null = null;
let pending: { state: TunerState; versions: Version[] } | null = null;
const sent = new Map<string, string>();
let ready: Promise<boolean> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

let flushing = false;

// The widget declares dials asynchronously; wait until the session has them.
function whenDeclared(id: string): Promise<boolean> {
  return (ready ??= (async () => {
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`/api/sessions/${id}`);
        if (r.ok && ((await r.json()).dials ?? []).length) return true;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  })());
}

// html-review's store is read-modify-write on one file per session, so
// parallel dial POSTs overwrite each other. Send them one at a time.
async function flush(id: string): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    if (!(await whenDeclared(id))) return;
    while (pending) {
      const { state, versions } = pending;
      pending = null;
      let posted = false;
      for (const d of dialsFor(state, versions)) {
        if (d.derived) continue;
        const json = JSON.stringify(d.value);
        if (sent.get(d.id) === json) continue;
        try {
          await fetch(`/api/dials/${encodeURIComponent(d.id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: id, value: d.value }),
          });
          sent.set(d.id, json);
          posted = true;
        } catch {
          /* retried on the next change */
        }
      }
      if (posted) nudgeWidget();
    }
  } finally {
    flushing = false;
  }
}

/** Mirrors the current state onto the session's dials (debounced). The
 * first call pushes everything, so a session that already held older
 * values is brought in line with the page. */
export function reportSurface(state: TunerState, versions: Version[]): void {
  const id = import.meta.env.DEV ? sessionId() : null;
  if (!id) return;
  latest = pending = { state, versions };
  clearTimeout(timer);
  timer = setTimeout(() => void flush(id), 150);
}
