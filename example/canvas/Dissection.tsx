/**
 * The static Dissection view. Everything on it is either a real capture
 * (frames.json, written by scripts/capture-canvas.ts), a frozen live
 * specimen measured through its iframe's DOM, or a number imported from
 * src/motion.ts and the README contract. Nothing is drawn to look like the
 * component.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LabDirection } from "../play/messages";
import { groundFor, PALETTES, type PaletteId } from "../play/state";
import type { Spring } from "../../src/types";
import {
  CLOSE_REVEAL_ROTATE_SPRING,
  CLOSE_REVEAL_SPRING,
  SNAP_SPRING,
  presets,
} from "../../src/motion";
import {
  inlineCode,
  PART_CONTRACT,
  PUBLIC_TOKENS,
  RUNTIME_VARS,
} from "./readme";
import {
  boxKey,
  foundationOf,
  type AnatomyRecipe,
  type VariantGroup,
} from "./anatomy";
import { Exploded } from "./Exploded";
import { MotionLab, type LabRequest } from "./MotionLab";
import { freezeSpecimen, measure, partKey, type PartBox } from "./parts";
import { dampingRatio, simulate } from "./springs";
import { choreography, Timeline } from "./timeline";
import { STATE_ROWS, type Status } from "./states";
import { CANVAS_TILES, VIEWPORTS, type PlayTile } from "./tiles";
import "./dissection.css";

// ---------- frames.json ----------

export interface FrameMeta {
  file: string;
  label: string;
  collapse: number | null;
  ms?: number;
  shadowOpacity?: number;
  sheetShadowOpacity?: number;
  detail?: string;
  width: number;
  height: number;
  identicalTo?: string;
}

export interface SequenceMeta {
  id: string;
  group:
    "morph" | "close-reveal" | "shadow" | "trigger-states" | "reduced-motion";
  title: string;
  description: string;
  tileId: string;
  viewport: "phone" | "desktop";
  deviceScaleFactor: number;
  frames: FrameMeta[];
}

export interface FramesManifest {
  capturedAt: string;
  gitHead: string;
  sequences: SequenceMeta[];
  /** Per-recipe part sets (capture-canvas --only=anatomy). */
  anatomy?: AnatomyRecipe[];
}

const frameAnchor = (seqId: string, i: number) =>
  `frame-${seqId}-${String(i).padStart(2, "0")}`;

function useFrames() {
  const [state, setState] = useState<FramesManifest | Error | null>(null);
  useEffect(() => {
    fetch("./canvas/frames.json")
      .then((r) => {
        if (!r.ok) throw new Error(`frames.json: HTTP ${r.status}`);
        return r.json() as Promise<FramesManifest>;
      })
      .then(setState, (e: Error) => setState(e));
  }, []);
  return state;
}

// ---------- sections ----------

const SECTIONS = [
  { id: "anatomy", title: "Anatomy" },
  { id: "morph", title: "Morph sequences" },
  { id: "details", title: "Detail captures" },
  { id: "choreography", title: "Choreography" },
  { id: "springs", title: "Springs & presets" },
  { id: "tokens", title: "Tokens" },
  { id: "states", title: "States & API" },
] as const;

export function Dissection() {
  const frames = useFrames();
  const [labRequest, setLabRequest] = useState<LabRequest | null>(null);
  const seekLab = useCallback(
    (r: Omit<LabRequest, "nonce">) =>
      setLabRequest({ ...r, nonce: performance.now() }),
    [],
  );

  // The browser's own #hash scroll runs before the sections exist.
  useEffect(() => {
    if (!location.hash || !frames || frames instanceof Error) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [frames]);

  return (
    <div className="cv-layout" data-dissection>
      <nav className="cv-index" aria-label="Sections">
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <main className="cv-sections">
        <Anatomy frames={frames} />
        <section id="morph" data-anchor-id="dx-morph" className="cv-section">
          <header>
            <h2>Morph sequences</h2>
            <p>
              The Motion Lab runs the real specimen on a virtual clock: slow,
              frame by frame, or scrubbed on its timeline. Below it, captured
              frames, each labelled with the package's own collapseProgress (1
              closed, 0 open) at the tick it was taken; click one to see that
              moment in the lab.
            </p>
          </header>
          <MotionLab request={labRequest} />
          <Strips frames={frames} groups={["morph"]} onSeek={seekLab} />
        </section>
        <section
          id="details"
          data-anchor-id="dx-details"
          className="cv-section"
        >
          <header>
            <h2>Detail captures</h2>
            <p>
              Close reveal, the shadow on its own, trigger states and reduced
              motion.
            </p>
          </header>
          <Strips
            frames={frames}
            onSeek={seekLab}
            groups={[
              "close-reveal",
              "shadow",
              "trigger-states",
              "reduced-motion",
            ]}
          />
        </section>
        <Choreography />
        <Springs />
        <Tokens />
        <StatesTable frames={frames} />
        {frames && !(frames instanceof Error) && (
          <p className="dx-provenance">
            Frames captured {frames.capturedAt.slice(0, 16).replace("T", " ")}{" "}
            UTC at {frames.gitHead} by <code>npm run capture:canvas</code>.
          </p>
        )}
      </main>
    </div>
  );
}

// ---------- Anatomy ----------

const PART_DESC = new Map(PART_CONTRACT.map((r) => [r.part, r.element]));

/** One specimen, mounted live, opened by script if asked, then measured and
 * left inert. Callouts are the measured boxes, scaled with the frame. */
function AnatomySpecimen({
  tile,
  open,
  title,
  numbering,
}: {
  tile: PlayTile;
  open: boolean;
  title: string;
  /** The parts to call out (the foundation), each with its number. */
  numbering: Map<string, number>;
}) {
  const vp = VIEWPORTS[tile.viewport];
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [boxes, setBoxes] = useState<PartBox[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / vp.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp.width]);

  useEffect(() => {
    const signal = { cancelled: false };
    freezeSpecimen(() => iframeRef.current, tile, open, signal).then(
      (doc) => {
        if (signal.cancelled) return;
        setBoxes(
          measure(doc)
            .filter((b) => numbering.has(partKey(b)))
            .map((b) => ({ ...b, n: numbering.get(partKey(b))! }))
            .sort((a, b) => a.n - b.n),
        );
      },
      () => !signal.cancelled && setFailed(true),
    );
    return () => {
      signal.cancelled = true;
    };
  }, [tile, open, numbering]);

  // Badges sit on each box's top-left corner, nudged right past any badge
  // already placed there (nested parts share a corner).
  const BADGE = 18;
  const placed: Array<{ x: number; y: number }> = [];
  const badges =
    boxes?.map((b) => {
      let x = Math.max(0, b.x * scale);
      const y = Math.max(0, b.y * scale);
      while (
        placed.some(
          (p) => Math.abs(p.x - x) < BADGE && Math.abs(p.y - y) < BADGE,
        )
      ) {
        x += BADGE + 2;
      }
      placed.push({ x, y });
      return { b, x, y };
    }) ?? [];

  return (
    <figure
      className="dx-specimen"
      data-anatomy={open ? "open" : "rest"}
      data-anatomy-tile={tile.id}
    >
      <figcaption>
        <span className="cv-tile-label">{title}</span>
        <code className="cv-tile-caption">
          {tile.id} · {open ? "opened, settled" : "at rest"}
        </code>
      </figcaption>
      <div
        ref={frameRef}
        className="cv-frame dx-anatomy-frame"
        style={{
          aspectRatio: `${vp.width} / ${vp.height}`,
          background: groundFor(tile.state),
        }}
      >
        {scale > 0 && (
          <iframe
            ref={iframeRef}
            className="cv-iframe"
            data-shown={boxes ? "" : undefined}
            title={`${title} specimen (frozen)`}
            src="./play.html?stage=1"
            tabIndex={-1}
            aria-hidden="true"
            style={{
              width: vp.width,
              height: vp.height,
              transform: `scale(${scale})`,
            }}
          />
        )}
        {/* Above the iframe, so it's frozen to every pointer too. */}
        <div className="dx-callouts" aria-hidden="true">
          {badges.map(({ b, x, y }) => (
            <div key={b.n}>
              <div
                className="dx-box"
                data-part={b.part}
                style={{
                  left: b.x * scale,
                  top: b.y * scale,
                  width: b.w * scale,
                  height: b.h * scale,
                }}
              />
              <span className="dx-badge" style={{ left: x, top: y }}>
                {b.n}
              </span>
            </div>
          ))}
        </div>
        {!boxes && !failed && <div className="dx-loading">measuring…</div>}
        {failed && <div className="dx-loading">specimen did not settle</div>}
      </div>
      {boxes && (
        <ol className="dx-legend">
          {boxes.map((b) => (
            <li key={b.n} data-part-row={partKey(b)}>
              <span className="dx-legend-n">{b.n}</span>
              <span>
                <code>{b.part}</code>
                {b.slot && <code className="dx-slot"> slot={b.slot}</code>}
                <span className="dx-legend-desc">
                  <Cell text={PART_DESC.get(b.part) ?? ""} />
                </span>
              </span>
              <code className="dx-legend-size">
                {Math.round(b.w)}×{Math.round(b.h)}
              </code>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

const RECIPE_NAME = (r: AnatomyRecipe) =>
  CANVAS_TILES.find((t) => t.id === r.tileId)?.label ?? r.recipe;

/** A recipe group's opened capture, with only the parts it adds outlined
 * and the foundation's boxes dimmed. */
function VariantCard({ group }: { group: VariantGroup }) {
  const r = group.recipes[0];
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / r.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [r.width]);
  const openKeys = new Set(r.boxes.map(boxKey));
  return (
    <figure
      className="dx-specimen dx-variant"
      data-variant={group.recipes.map((x) => x.recipe).join(" ")}
    >
      <figcaption>
        <span className="cv-tile-label">
          {group.recipes.map(RECIPE_NAME).join(", ")}
        </span>
        <code className="cv-tile-caption">
          foundation + {group.added.join(" · ")}
        </code>
      </figcaption>
      <div
        ref={frameRef}
        className="cv-frame dx-anatomy-frame"
        style={{ aspectRatio: `${r.width} / ${r.height}` }}
      >
        <img
          className="cv-poster"
          src={`./${r.file}`}
          alt={`${RECIPE_NAME(r)} recipe, opened`}
          loading="lazy"
        />
        <div className="dx-callouts" aria-hidden="true">
          {r.boxes.map((b, i) => (
            <div
              key={i}
              className="dx-box"
              data-part={b.part}
              data-added={group.added.includes(boxKey(b)) || undefined}
              style={{
                left: b.x * scale,
                top: b.y * scale,
                width: b.w * scale,
                height: b.h * scale,
              }}
            />
          ))}
        </div>
      </div>
      <ul className="dx-legend dx-variant-legend">
        {group.added.map((k) => {
          const [part, slot] = k.split(":");
          return (
            <li key={k} data-part-row={k}>
              <span className="dx-legend-n">+</span>
              <span>
                <code>{part}</code>
                {slot && <code className="dx-slot"> slot={slot}</code>}
                <span className="dx-legend-desc">
                  <Cell text={PART_DESC.get(part) ?? ""} />
                </span>
              </span>
              {!openKeys.has(k) && (
                <code className="dx-legend-size">at rest</code>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function Anatomy({ frames }: { frames: FramesManifest | Error | null }) {
  const recipes =
    frames && !(frames instanceof Error) ? (frames.anatomy ?? []) : [];
  const { foundation, groups, plain } = useMemo(
    () => foundationOf(recipes),
    [recipes],
  );
  const numbering = useMemo(
    () => new Map(foundation.map((k, i) => [k, i + 1])),
    [foundation],
  );
  const basic = CANVAS_TILES.find((t) => t.id === "content-basic") as PlayTile;
  return (
    <section id="anatomy" data-anchor-id="dx-anatomy" className="cv-section">
      <header>
        <h2>Anatomy</h2>
        <p>
          Every recipe is one foundation plus the parts it adds. Every box is a
          measured <code>data-wicket-iris-part</code> element.
        </p>
      </header>
      {recipes.length === 0 ? (
        <p className="dx-note">
          No part sets measured. Run{" "}
          <code>npm run capture:canvas -- --only=anatomy</code>.
        </p>
      ) : (
        <>
          <h3 className="dx-h3 dx-h3-first">
            Foundation · all {recipes.length} recipes
          </h3>
          <p className="dx-note dx-anatomy-note">
            The {foundation.length} parts every recipe renders, numbered on a
            live Basic specimen, frozen.
          </p>
          <div className="dx-anatomy" data-foundation={foundation.join(" ")}>
            <AnatomySpecimen
              tile={basic}
              open={false}
              title="At rest"
              numbering={numbering}
            />
            <AnatomySpecimen
              tile={basic}
              open
              title="Opened"
              numbering={numbering}
            />
          </div>
          <h3 className="dx-h3">What each recipe adds</h3>
          <p className="dx-note dx-anatomy-note">
            Captured opened by <code>capture:canvas</code>; only the added parts
            are outlined. Recipes that add the same parts share a card.
          </p>
          <div className="dx-anatomy">
            {groups.map((g) => (
              <VariantCard key={g.added.join(" ")} group={g} />
            ))}
          </div>
          {plain.length > 0 && (
            <p className="dx-note dx-anatomy-note" data-variant-plain>
              {plain.map(RECIPE_NAME).join(", ")}: foundation parts only,
              different Item content.
            </p>
          )}
        </>
      )}
      <Exploded tile={basic} />
    </section>
  );
}

// ---------- Frame strips ----------

const STRIP_HEIGHT: Record<SequenceMeta["group"], number> = {
  morph: 220,
  shadow: 220,
  "reduced-motion": 220,
  "close-reveal": 132,
  "trigger-states": 132,
};

function frameCaption(f: FrameMeta): string {
  const parts: string[] = [];
  if (f.collapse !== null) parts.push(`collapse ${f.collapse.toFixed(3)}`);
  if (f.ms !== undefined) parts.push(`+${f.ms}ms`);
  return parts.join(" · ");
}

/** Where a captured frame sits on the Motion Lab's clock, or null for
 * frames it can't replay (trigger states, the link preview, video). */
function labTarget(
  s: SequenceMeta,
  f: FrameMeta,
): Omit<LabRequest, "nonce"> | null {
  const tile = CANVAS_TILES.find((t) => t.id === s.tileId);
  if (!tile || tile.kind !== "play" || tile.state.recipe === "video") {
    return null;
  }
  if (s.group === "trigger-states") return null;
  const { total, reveal } = choreography();
  const at = (direction: LabDirection, ms: number) => ({
    tileId: s.tileId,
    direction,
    ms,
  });
  if (s.group === "close-reveal") {
    return f.ms === undefined ? null : at("open", reveal + f.ms);
  }
  if (f.label === "rest") return at("open", 0);
  if (f.label === "settled") return at("open", total);
  if (f.label === "closed") return at("close", total);
  if (f.ms === undefined) return null;
  return at(f.label.startsWith("close") ? "close" : "open", f.ms);
}

function Strips({
  frames,
  groups,
  onSeek,
}: {
  frames: FramesManifest | Error | null;
  groups: Array<SequenceMeta["group"]>;
  onSeek: (r: Omit<LabRequest, "nonce">) => void;
}) {
  if (frames === null) return <p className="dx-note">Loading frames…</p>;
  if (frames instanceof Error) {
    return (
      <p className="dx-note">
        No captures ({frames.message}). Run <code>npm run capture:canvas</code>.
      </p>
    );
  }
  const seqs = frames.sequences.filter((s) => groups.includes(s.group));
  return (
    <div className="dx-strips">
      {seqs.map((s) => (
        <article
          key={s.id}
          className="dx-seq"
          id={`seq-${s.id}`}
          data-anchor-id={`seq-${s.id}`}
          data-sequence={s.id}
        >
          <header>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            <code className="cv-tile-caption">
              tile {s.tileId} · {s.viewport} · {s.frames.length} frames
            </code>
          </header>
          <div
            className="dx-strip"
            tabIndex={0}
            aria-label={`${s.title} frames`}
          >
            {s.frames.map((f, i) => {
              const same = f.identicalTo
                ? s.frames.find((g) => g.file === f.identicalTo)
                : undefined;
              const h = STRIP_HEIGHT[s.group];
              return (
                <figure
                  key={f.file}
                  className="dx-frame"
                  id={frameAnchor(s.id, i)}
                  data-anchor-id={frameAnchor(s.id, i)}
                >
                  {(() => {
                    const img = (
                      <img
                        src={`./${f.file}`}
                        data-anchor-id={`${frameAnchor(s.id, i)}-img`}
                        width={Math.round((h * f.width) / f.height)}
                        height={h}
                        alt={`${s.title}, ${f.label}`}
                        loading="lazy"
                        decoding="async"
                      />
                    );
                    const target = labTarget(s, f);
                    if (!target) return img;
                    return (
                      <button
                        type="button"
                        className="dx-frame-seek"
                        data-lab-seek={`${target.direction}:${Math.round(target.ms)}`}
                        title={`Show this moment in the Motion Lab (${target.direction} +${Math.round(target.ms)}ms)`}
                        onClick={() => onSeek(target)}
                      >
                        {img}
                      </button>
                    );
                  })()}
                  <figcaption>
                    <span className="dx-frame-label">
                      {String(i).padStart(2, "0")} {f.label}
                    </span>
                    {frameCaption(f) && <code>{frameCaption(f)}</code>}
                    {f.shadowOpacity !== undefined && (
                      <code>
                        thin {f.shadowOpacity.toFixed(2)} · heavy{" "}
                        {f.sheetShadowOpacity!.toFixed(2)}
                      </code>
                    )}
                    {f.detail && <code>{f.detail}</code>}
                    {same && (
                      <code className="dx-same">
                        = {same.label}, pixel-identical
                      </code>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------- Choreography ----------

function Choreography() {
  const { previewBars, total } = choreography();
  return (
    <section
      id="choreography"
      data-anchor-id="dx-choreography"
      className="cv-section"
    >
      <header>
        <h2>Choreography</h2>
        <p>
          Every number is imported from <code>src/motion.ts</code>. The Open and
          Close timelines are the Motion Lab's scrubber, at the top of{" "}
          <a href="#morph">Morph sequences</a>.
        </p>
      </header>
      <Timeline
        title="Link preview · ms from the pointer or finger"
        bars={previewBars}
        total={total}
      />
    </section>
  );
}

// ---------- Springs & presets ----------

function springText(s: Spring | undefined): string {
  if (!s) return "—";
  if ("stiffness" in s) {
    return `${s.stiffness} / ${s.damping}${s.mass !== undefined ? ` / ${s.mass}` : ""}`;
  }
  return `${s.visualDuration}s · bounce ${s.bounce}`;
}

function springMeta(s: Spring | undefined): string {
  if (!s || !("stiffness" in s)) return "";
  return `ζ ${dampingRatio(s).toFixed(2)} · ~${simulate(s).settleMs}ms`;
}

function Springs() {
  const names = ["default", "snappy", "gentle"] as const;
  type Shared = { open?: Spring; close?: Spring };
  const rows: Array<{
    key: string;
    get: (n: (typeof names)[number]) => Spring | number | undefined;
  }> = [
    { key: "open", get: (n) => presets[n].transition?.open as Spring },
    { key: "close", get: (n) => presets[n].transition?.close as Spring },
    {
      key: "shared.open",
      get: (n) => (presets[n].transition?.shared as Shared).open,
    },
    {
      key: "shared.close",
      get: (n) => (presets[n].transition?.shared as Shared).close,
    },
    {
      key: "surfaceCloseLeadDelayMs",
      get: (n) => presets[n].surfaceCloseLeadDelayMs,
    },
  ];
  const internal: Array<{ name: string; value: string; meta: string }> = [
    {
      name: "SNAP_SPRING",
      value: springText(SNAP_SPRING),
      meta: springMeta(SNAP_SPRING),
    },
    {
      name: "CLOSE_REVEAL_SPRING",
      value: `${CLOSE_REVEAL_SPRING.duration}s · bounce ${CLOSE_REVEAL_SPRING.bounce}`,
      meta: "Close scale",
    },
    {
      name: "CLOSE_REVEAL_ROTATE_SPRING",
      value: `${CLOSE_REVEAL_ROTATE_SPRING.duration}s · bounce ${CLOSE_REVEAL_ROTATE_SPRING.bounce}`,
      meta: "Close turn",
    },
  ];
  return (
    <section id="springs" data-anchor-id="dx-springs" className="cv-section">
      <header>
        <h2>Springs & presets</h2>
        <p>
          <code>presets</code> from <code>src/motion.ts</code>, live. Stiffness
          / damping / mass, with damping ratio and simulated settle.
        </p>
      </header>
      <div className="dx-table-wrap" tabIndex={0}>
        <table className="dx-table" data-table="presets">
          <thead>
            <tr>
              <th>Key</th>
              {names.map((n) => (
                <th key={n}>
                  <code>presets.{n}</code>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  <code>{r.key}</code>
                </th>
                {names.map((n) => {
                  const v = r.get(n);
                  return (
                    <td key={n}>
                      {typeof v === "number" ? (
                        <code>{v}ms</code>
                      ) : (
                        <>
                          <code>{springText(v)}</code>
                          <span className="dx-sub">{springMeta(v)}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="dx-h3">Internal springs</h3>
      <div className="dx-table-wrap" tabIndex={0}>
        <table className="dx-table">
          <tbody>
            {internal.map((r) => (
              <tr key={r.name}>
                <th scope="row">
                  <code>{r.name}</code>
                </th>
                <td>
                  <code>{r.value}</code>
                </td>
                <td className="dx-sub">{r.meta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Tokens ----------

const TOKEN_CONTROLS: Record<string, string> = {
  "--wicket-iris-surface": "Trigger fill",
  "--wicket-iris-surface-elevated": "Sheet fill",
  "--wicket-iris-surface-border": "Hairline on trigger and sheet",
  "--wicket-iris-text": "Sheet text and Close glyph",
  "--wicket-iris-accent": "Focus rings",
  "--wicket-iris-sheet-max-width": "Sheet width cap",
  "--wicket-iris-shared-size": "Shared element size in the sheet",
  "--wicket-iris-sheet-radius": "Sheet corner radius at rest",
  "--wicket-iris-trigger-radius": "Trigger corner radius",
  "--wicket-iris-sheet-padding": "Sheet inner padding",
  "--wicket-iris-shadow": "Thin shadow look (trigger)",
  "--wicket-iris-sheet-shadow": "Heavy shadow look (open sheet)",
  "--wicket-iris-sheet-shadow-fade-start":
    "Crossfade window start (collapseProgress)",
  "--wicket-iris-sheet-shadow-fade-end":
    "Crossfade window end (collapseProgress)",
  "--wicket-iris-z": "Base z-index of the layer stack",
};

type PaletteKey =
  | "surface"
  | "surfaceElevated"
  | "border"
  | "text"
  | "accent"
  | "triggerShadow"
  | "sheetShadow";

/** Which play palette field sets each token (play/codegen writes them). */
const PALETTE_FIELD: Record<string, PaletteKey> = {
  "--wicket-iris-surface": "surface",
  "--wicket-iris-surface-elevated": "surfaceElevated",
  "--wicket-iris-surface-border": "border",
  "--wicket-iris-text": "text",
  "--wicket-iris-accent": "accent",
  "--wicket-iris-shadow": "triggerShadow",
  "--wicket-iris-sheet-shadow": "sheetShadow",
};

const PALETTE_ORDER: PaletteId[] = [
  "neutral",
  "warm",
  "neutral-dark",
  "warm-dark",
];

function Cell({ text }: { text: string }) {
  return (
    <>
      {inlineCode(text).map((s, i) =>
        s.code ? <code key={i}>{s.text}</code> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function Swatch({ token, palette }: { token: string; palette: PaletteId }) {
  const field = PALETTE_FIELD[token];
  if (!field) return <span className="dx-sub">—</span>;
  const p = PALETTES[palette];
  const value = p[field];
  const isShadow = field === "triggerShadow" || field === "sheetShadow";
  return (
    <span className="dx-swatch-cell" title={value}>
      {isShadow ? (
        <span className="dx-swatch-ground" style={{ background: p.ground }}>
          <span
            className="dx-swatch dx-swatch-shadow"
            style={{ boxShadow: value, background: p.surfaceElevated }}
          />
        </span>
      ) : (
        <span className="dx-swatch" style={{ background: value }} />
      )}
      {!isShadow && <code>{value}</code>}
    </span>
  );
}

function Tokens() {
  return (
    <section id="tokens" data-anchor-id="dx-tokens" className="cv-section">
      <header>
        <h2>Tokens</h2>
        <p>
          The public <code>--wicket-iris-*</code> set, read from the README
          theming table, with what each of the four play palettes sets it to.
        </p>
      </header>
      <div className="dx-table-wrap" tabIndex={0}>
        <table className="dx-table dx-tokens" data-table="tokens">
          <thead>
            <tr>
              <th>Token</th>
              <th>Default</th>
              <th>Controls</th>
              {PALETTE_ORDER.map((p) => (
                <th key={p}>{PALETTES[p].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PUBLIC_TOKENS.map((t) => (
              <tr key={t.name} data-token={t.name}>
                <th scope="row">
                  <code>{t.name}</code>
                </th>
                <td className="dx-default">
                  <Cell text={t.defaultValue} />
                </td>
                <td>{TOKEN_CONTROLS[t.name] ?? ""}</td>
                {PALETTE_ORDER.map((p) => (
                  <td key={p}>
                    <Swatch token={t.name} palette={p} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="dx-internal">
        <summary>
          Internal (runtime) · {RUNTIME_VARS.length} vars the package writes;
          read them, don't set them
        </summary>
        <ul>
          {RUNTIME_VARS.map((v) => (
            <li key={v}>
              <code>{v}</code>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------- States & API ----------

function StatusCell({
  status,
  frames,
}: {
  status: Status;
  frames: FramesManifest | null;
}) {
  switch (status.kind) {
    case "captured": {
      const seq = frames?.sequences.find((s) => s.id === status.seq);
      const f = seq?.frames[status.frame];
      return (
        <>
          <span className="dx-status" data-status="captured">
            Captured
          </span>
          {f ? (
            <a href={`#${frameAnchor(status.seq, status.frame)}`}>
              {status.seq} · {f.label}
            </a>
          ) : (
            <span className="dx-sub">not captured yet</span>
          )}
        </>
      );
    }
    case "live": {
      const tile = CANVAS_TILES.find((t) => t.id === status.tileId);
      return (
        <>
          <span className="dx-status" data-status="live">
            Live
          </span>
          <a href={`./canvas.html#tile-${status.tileId}`}>
            {tile?.label ?? status.tileId}
          </a>
        </>
      );
    }
    case "anatomy":
      return (
        <>
          <span className="dx-status" data-status="live">
            Live
          </span>
          <a href="#anatomy">Anatomy</a>
        </>
      );
    case "api": {
      const tile = status.tileId
        ? CANVAS_TILES.find((t) => t.id === status.tileId)
        : undefined;
      return (
        <>
          <span className="dx-status" data-status="api">
            API-only
          </span>
          {status.tileId && (
            <a href={`./canvas.html#tile-${status.tileId}`}>
              fires on {tile?.label ?? status.tileId}
            </a>
          )}
        </>
      );
    }
  }
}

function StatesTable({ frames }: { frames: FramesManifest | Error | null }) {
  const manifest = frames && !(frames instanceof Error) ? frames : null;
  return (
    <section id="states" data-anchor-id="dx-states" className="cv-section">
      <header>
        <h2>States & API</h2>
        <p>
          Every state and data attribute, and where to see it. API-only rows
          have nothing to look at.
        </p>
      </header>
      <div className="dx-table-wrap" tabIndex={0}>
        <table className="dx-table" data-table="states">
          <thead>
            <tr>
              <th>State</th>
              <th>Surface</th>
              <th>Where</th>
            </tr>
          </thead>
          <tbody>
            {STATE_ROWS.map((r) => (
              <tr
                key={r.name}
                data-anchor-id={`state-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                data-state-kind={r.status.kind}
              >
                <th scope="row">{r.name}</th>
                <td>
                  <code>{r.surface}</code>
                </td>
                <td className="dx-where">
                  <StatusCell status={r.status} frames={manifest} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
