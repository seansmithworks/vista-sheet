/**
 * The static Dissection view. Everything on it is either a real capture
 * (frames.json, written by scripts/capture-canvas.ts), a frozen live
 * specimen measured through its iframe's DOM, or a number imported from
 * src/motion.ts and the README contract. Nothing is drawn to look like the
 * component.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isPlayMessage } from "../play/messages";
import { groundFor, PALETTES, type PaletteId } from "../play/state";
import type { Spring } from "../../src/types";
import {
  CLOSE_EXIT_SEC,
  CLOSE_FADE_IN_SEC,
  CLOSE_REVEAL_PROGRESS,
  CLOSE_REVEAL_ROTATE_SPRING,
  CLOSE_REVEAL_SPRING,
  CONTENT_FADE_OUT_MS,
  DEFAULT_CLOSE_SPRING,
  DEFAULT_OPEN_SPRING,
  DEFAULT_SHARED_CLOSE_SPRING,
  DEFAULT_SHARED_SPRING,
  ITEM_STAGGER_INTERVAL_SEC,
  OPEN_CONTENT_REVEAL_DELAY_SEC,
  RADIUS_HOLD_FRACTION,
  SNAP_SPRING,
  SURFACE_CLOSE_LEAD_DELAY_MS,
  TRIGGER_LABEL_REVEAL_START,
  presets,
} from "../../src/motion";
import {
  inlineCode,
  PART_CONTRACT,
  PUBLIC_TOKENS,
  RUNTIME_VARS,
} from "./readme";
import { crossing, dampingRatio, simulate } from "./springs";
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
        <Anatomy />
        <section id="morph" className="cv-section">
          <header>
            <h2>Morph sequences</h2>
            <p>
              Captured frames, each labelled with the package's own
              collapseProgress (1 closed, 0 open) at the tick it was taken.
            </p>
          </header>
          <Strips frames={frames} groups={["morph"]} />
        </section>
        <section id="details" className="cv-section">
          <header>
            <h2>Detail captures</h2>
            <p>
              Close reveal, the shadow on its own, trigger states and reduced
              motion.
            </p>
          </header>
          <Strips
            frames={frames}
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

interface PartBox {
  n: number;
  part: string;
  slot: string | null;
  parent: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  z: string;
  position: string;
}

const partKey = (b: Pick<PartBox, "part" | "slot">) =>
  b.slot ? `${b.part}:${b.slot}` : b.part;

const PART_DESC = new Map(PART_CONTRACT.map((r) => [r.part, r.element]));

function wait(fn: () => boolean, timeout = 8000): Promise<void> {
  const until = performance.now() + timeout;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (fn()) return resolve();
      if (performance.now() > until) return reject(new Error("timeout"));
      setTimeout(tick, 50);
    };
    tick();
  });
}

function measure(doc: Document): PartBox[] {
  const win = doc.defaultView!;
  return [...doc.querySelectorAll<HTMLElement>("[data-vista-sheet-part]")].map(
    (el, i) => {
      const r = el.getBoundingClientRect();
      const cs = win.getComputedStyle(el);
      const parentEl = el.parentElement?.closest<HTMLElement>(
        "[data-vista-sheet-part]",
      );
      return {
        n: i + 1,
        part: el.dataset.vistaSheetPart!,
        slot: el.dataset.vistaSheetSlot ?? null,
        parent: parentEl
          ? partKey({
              part: parentEl.dataset.vistaSheetPart!,
              slot: parentEl.dataset.vistaSheetSlot ?? null,
            })
          : null,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        z: cs.zIndex,
        position: cs.position,
      };
    },
  );
}

/** One specimen, mounted live, opened by script if asked, then measured and
 * left inert. Callouts are the measured boxes, scaled with the frame. */
function AnatomySpecimen({
  tile,
  open,
  title,
  onMeasured,
}: {
  tile: PlayTile;
  open: boolean;
  title: string;
  onMeasured: (boxes: PartBox[]) => void;
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
    let cancelled = false;
    async function onMessage(e: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin || !isPlayMessage(e.data)) return;
      if (e.data.type !== "vista-sheet-play:ready") return;
      const win = frame.contentWindow!;
      // Opening the sheet focuses its panel; keep the canvas's focus.
      win.addEventListener("focusin", () => frame.blur(), true);
      win.postMessage(
        { type: "vista-sheet-play:state", state: tile.state },
        location.origin,
      );
      const doc = frame.contentDocument!;
      try {
        const trigger = () =>
          doc.querySelector<HTMLElement>('[data-vista-sheet-part="trigger"]');
        await wait(() => Boolean(trigger()));
        if (open) {
          trigger()!.click();
          await wait(() =>
            Boolean(doc.querySelector("[data-vista-sheet-settled]")),
          );
        }
        // Content reveal, Item stagger and the Close spin all land well
        // inside this.
        await new Promise((r) => setTimeout(r, 1400));
        if (cancelled) return;
        const measured = measure(doc);
        setBoxes(measured);
        onMeasured(measured);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [tile, open, onMeasured]);

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

const ANATOMY: Array<{
  key: string;
  tileId: string;
  open: boolean;
  title: string;
}> = [
  {
    key: "basic-rest",
    tileId: "content-basic",
    open: false,
    title: "Trigger, Shared",
  },
  {
    key: "basic-open",
    tileId: "content-basic",
    open: true,
    title: "Sheet, Content, Item, Close",
  },
  {
    key: "video-rest",
    tileId: "content-video",
    open: false,
    title: "Media at rest",
  },
  {
    key: "video-open",
    tileId: "content-video",
    open: true,
    title: "Media in the sheet",
  },
];

interface ZNode {
  key: string;
  z: string;
  position: string;
  children: ZNode[];
}

/** Every distinct part across the measured specimens, nested under its
 * nearest part ancestor, siblings ordered by computed z-index (top first). */
function zTree(all: PartBox[]): ZNode[] {
  const nodes = new Map<string, ZNode & { parent: string | null }>();
  for (const b of all) {
    const key = partKey(b);
    if (!nodes.has(key)) {
      nodes.set(key, {
        key,
        z: b.z,
        position: b.position,
        children: [],
        parent: b.parent,
      });
    }
  }
  const roots: ZNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parent ? nodes.get(n.parent) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  const zNum = (z: string) => (z === "auto" ? 0 : Number(z));
  const sort = (list: ZNode[]) => {
    list.sort((a, b) => zNum(b.z) - zNum(a.z));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function ZList({ nodes }: { nodes: ZNode[] }) {
  return (
    <ol>
      {nodes.map((n) => (
        <li key={n.key} data-z-part={n.key}>
          <span className="dx-z-row">
            <code>{n.key}</code>
            <code className="dx-z-val">
              z {n.z} · {n.position}
            </code>
          </span>
          {n.children.length > 0 && <ZList nodes={n.children} />}
        </li>
      ))}
    </ol>
  );
}

function Anatomy() {
  const [measured, setMeasured] = useState<Record<string, PartBox[]>>({});
  const callbacks = useRef(new Map<string, (b: PartBox[]) => void>());
  const onMeasured = useCallback((key: string) => {
    let cb = callbacks.current.get(key);
    if (!cb) {
      cb = (boxes) => setMeasured((m) => ({ ...m, [key]: boxes }));
      callbacks.current.set(key, cb);
    }
    return cb;
  }, []);
  const all = Object.values(measured).flat();

  return (
    <section id="anatomy" className="cv-section">
      <header>
        <h2>Anatomy</h2>
        <p>
          Live specimens, frozen. Every box is a measured{" "}
          <code>data-vista-sheet-part</code> element.
        </p>
      </header>
      <div className="dx-anatomy">
        {ANATOMY.map((a) => (
          <AnatomySpecimen
            key={a.key}
            tile={CANVAS_TILES.find((t) => t.id === a.tileId) as PlayTile}
            open={a.open}
            title={a.title}
            onMeasured={onMeasured(a.key)}
          />
        ))}
      </div>
      <div className="dx-zstack">
        <h3>Z-stack</h3>
        <p className="dx-note">
          Computed z-index of each part, nested under its nearest part ancestor,
          top layer first.
        </p>
        {all.length > 0 ? (
          <ZList nodes={zTree(all)} />
        ) : (
          <p className="dx-note">measuring…</p>
        )}
      </div>
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

function Strips({
  frames,
  groups,
}: {
  frames: FramesManifest | Error | null;
  groups: Array<SequenceMeta["group"]>;
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
                >
                  <img
                    src={`./${f.file}`}
                    width={Math.round((h * f.width) / f.height)}
                    height={h}
                    alt={`${s.title}, ${f.label}`}
                    loading="lazy"
                    decoding="async"
                  />
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

interface Bar {
  label: string;
  start: number;
  end?: number;
  /** Instant markers inside the bar. */
  marks?: Array<{ at: number; label: string }>;
  note: string;
}

function Timeline({
  title,
  bars,
  total,
}: {
  title: string;
  bars: Bar[];
  total: number;
}) {
  const W = 1000;
  const ROW = 34;
  const LABEL = 0;
  const x = (ms: number) => LABEL + (ms / total) * (W - LABEL);
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += 100) ticks.push(t);
  return (
    <figure className="dx-timeline">
      <figcaption>{title}</figcaption>
      <div className="dx-timeline-rows">
        {bars.map((b) => (
          <div key={b.label} className="dx-tl-row">
            <div className="dx-tl-label">
              <span>{b.label}</span>
              <code>{b.note}</code>
            </div>
            <svg
              viewBox={`0 0 ${W} ${ROW}`}
              preserveAspectRatio="none"
              className="dx-tl-svg"
              role="img"
              aria-label={`${b.label}: ${b.note}`}
            >
              {ticks.map((t) => (
                <line
                  key={t}
                  x1={x(t)}
                  x2={x(t)}
                  y1={0}
                  y2={ROW}
                  className="dx-tl-grid"
                />
              ))}
              {b.end !== undefined ? (
                <rect
                  x={x(b.start)}
                  y={10}
                  width={Math.max(2, x(b.end) - x(b.start))}
                  height={14}
                  rx={3}
                  className="dx-tl-bar"
                />
              ) : (
                <rect
                  x={x(b.start) - 1}
                  y={6}
                  width={3}
                  height={22}
                  className="dx-tl-tick"
                />
              )}
              {b.marks?.map((m) => (
                <rect
                  key={m.label}
                  x={x(m.at) - 1}
                  y={4}
                  width={2.5}
                  height={26}
                  className="dx-tl-mark"
                />
              ))}
            </svg>
          </div>
        ))}
        <div className="dx-tl-row dx-tl-axis">
          <div className="dx-tl-label" />
          <div className="dx-tl-axis-labels">
            {ticks
              .filter((t) => t % 200 === 0)
              .map((t) => (
                <code key={t} style={{ left: `${(t / total) * 100}%` }}>
                  {t}
                </code>
              ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function Choreography() {
  const open = simulate(DEFAULT_OPEN_SPRING);
  const sharedOpen = simulate(DEFAULT_SHARED_SPRING);
  const close = simulate(DEFAULT_CLOSE_SPRING, 0, 1);
  const sharedClose = simulate(DEFAULT_SHARED_CLOSE_SPRING, 0, 1);
  const reveal = crossing(open, CLOSE_REVEAL_PROGRESS);
  const lead = SURFACE_CLOSE_LEAD_DELAY_MS;
  const radiusAt = lead + crossing(close, RADIUS_HOLD_FRACTION, 0);
  const labelAt = lead + crossing(close, TRIGGER_LABEL_REVEAL_START, 0);
  const contentAt = OPEN_CONTENT_REVEAL_DELAY_SEC * 1000;
  const stagger = ITEM_STAGGER_INTERVAL_SEC * 1000;
  const ITEMS = 3;

  const openBars: Bar[] = [
    {
      label: "Surface",
      start: 0,
      end: open.settleMs,
      marks: [{ at: reveal, label: "reveal" }],
      note: `open spring · settles ${open.settleMs}ms · collapse ≤ ${CLOSE_REVEAL_PROGRESS} at ${reveal}ms`,
    },
    {
      label: "Shared",
      start: 0,
      end: sharedOpen.settleMs,
      note: `shared.open spring · settles ${sharedOpen.settleMs}ms`,
    },
    {
      label: "Content",
      start: contentAt,
      note: `starts at OPEN_CONTENT_REVEAL_DELAY ${contentAt}ms`,
    },
    ...Array.from({ length: ITEMS }, (_, i) => ({
      label: `Item ${i + 1}`,
      start: contentAt + i * stagger,
      end: contentAt + (i + 1) * stagger,
      note: `starts ${Math.round(contentAt + i * stagger)}ms (+${stagger}ms stagger)`,
    })),
    {
      label: "Close · fade",
      start: reveal,
      end: reveal + CLOSE_FADE_IN_SEC * 1000,
      note: `${CLOSE_FADE_IN_SEC * 1000}ms from ${reveal}ms`,
    },
    {
      label: "Close · scale",
      start: reveal,
      end: reveal + CLOSE_REVEAL_SPRING.duration * 1000,
      note: `spring ${CLOSE_REVEAL_SPRING.duration * 1000}ms · bounce ${CLOSE_REVEAL_SPRING.bounce}`,
    },
    {
      label: "Close · turn",
      start: reveal,
      end: reveal + CLOSE_REVEAL_ROTATE_SPRING.duration * 1000,
      note: `spring ${CLOSE_REVEAL_ROTATE_SPRING.duration * 1000}ms · bounce ${CLOSE_REVEAL_ROTATE_SPRING.bounce}`,
    },
  ];

  const closeBars: Bar[] = [
    {
      label: "Content",
      start: 0,
      end: CONTENT_FADE_OUT_MS,
      note: `fades out ${CONTENT_FADE_OUT_MS}ms`,
    },
    {
      label: "Close",
      start: 0,
      end: CLOSE_EXIT_SEC * 1000,
      note: `exits ${CLOSE_EXIT_SEC * 1000}ms`,
    },
    {
      label: "Shared",
      start: 0,
      end: sharedClose.settleMs,
      note: `shared.close spring · settles ${sharedClose.settleMs}ms`,
    },
    {
      label: "Surface",
      start: lead,
      end: lead + close.settleMs,
      marks: [
        { at: radiusAt, label: "radius" },
        { at: labelAt, label: "label" },
      ],
      note: `waits ${lead}ms lead · close spring · settles ${lead + close.settleMs}ms`,
    },
    {
      label: "Radius",
      start: radiusAt,
      end: lead + close.settleMs,
      note: `held to collapse ${RADIUS_HOLD_FRACTION} (${radiusAt}ms), then rounds`,
    },
    {
      label: "Trigger label",
      start: labelAt,
      end: lead + close.settleMs,
      note: `fades in from collapse ${TRIGGER_LABEL_REVEAL_START} (${labelAt}ms)`,
    },
  ];

  const total =
    Math.ceil(
      Math.max(
        open.settleMs,
        reveal + CLOSE_REVEAL_ROTATE_SPRING.duration * 1000,
        lead + close.settleMs,
      ) / 100,
    ) * 100;

  return (
    <section id="choreography" className="cv-section">
      <header>
        <h2>Choreography</h2>
        <p>
          Every number is imported from <code>src/motion.ts</code>. Spring
          durations are simulated from their constants; the strips above are the
          measured record.
        </p>
      </header>
      <Timeline
        title="Open · ms from the click"
        bars={openBars}
        total={total}
      />
      <Timeline
        title="Close · ms from the click"
        bars={closeBars}
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
    <section id="springs" className="cv-section">
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
  "--vista-sheet-surface": "Trigger fill",
  "--vista-sheet-surface-elevated": "Sheet fill",
  "--vista-sheet-surface-border": "Hairline on trigger and sheet",
  "--vista-sheet-text": "Sheet text and Close glyph",
  "--vista-sheet-accent": "Focus rings",
  "--vista-sheet-sheet-max-width": "Sheet width cap",
  "--vista-sheet-shared-size": "Shared element size in the sheet",
  "--vista-sheet-sheet-radius": "Sheet corner radius at rest",
  "--vista-sheet-trigger-radius": "Trigger corner radius",
  "--vista-sheet-sheet-padding": "Sheet inner padding",
  "--vista-sheet-shadow": "Thin shadow look (trigger)",
  "--vista-sheet-sheet-shadow": "Heavy shadow look (open sheet)",
  "--vista-sheet-sheet-shadow-fade-start":
    "Crossfade window start (collapseProgress)",
  "--vista-sheet-sheet-shadow-fade-end":
    "Crossfade window end (collapseProgress)",
  "--vista-sheet-z": "Base z-index of the layer stack",
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
  "--vista-sheet-surface": "surface",
  "--vista-sheet-surface-elevated": "surfaceElevated",
  "--vista-sheet-surface-border": "border",
  "--vista-sheet-text": "text",
  "--vista-sheet-accent": "accent",
  "--vista-sheet-shadow": "triggerShadow",
  "--vista-sheet-sheet-shadow": "sheetShadow",
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
    <section id="tokens" className="cv-section">
      <header>
        <h2>Tokens</h2>
        <p>
          The public <code>--vista-sheet-*</code> set, read from the README
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

type Status =
  | { kind: "captured"; seq: string; frame: number }
  | { kind: "live"; tileId: string }
  | { kind: "anatomy" }
  | { kind: "api" };

interface StateRow {
  name: string;
  surface: string;
  status: Status;
}

const STATE_ROWS: StateRow[] = [
  {
    name: "Closed, at rest",
    surface: "default",
    status: { kind: "captured", seq: "morph-circle", frame: 0 },
  },
  {
    name: "Opening, mid-morph",
    surface: "collapseProgress 1 → 0",
    status: { kind: "captured", seq: "morph-circle", frame: 2 },
  },
  {
    name: "Open, settled",
    surface: "data-vista-sheet-settled",
    status: { kind: "captured", seq: "morph-circle", frame: 5 },
  },
  {
    name: "Closing",
    surface: "data-vista-sheet-closing",
    status: { kind: "captured", seq: "morph-circle", frame: 6 },
  },
  {
    name: "Close button reveal",
    surface: "<VistaSheet.Close>",
    status: { kind: "captured", seq: "close-reveal", frame: 2 },
  },
  {
    name: "Shadow crossfade",
    surface: "<VistaSheet.Shadow>",
    status: { kind: "captured", seq: "shadow-crossfade", frame: 4 },
  },
  {
    name: "Hover",
    surface: ":hover",
    status: { kind: "captured", seq: "trigger-states-disc", frame: 1 },
  },
  {
    name: "Focus visible",
    surface: ":focus-visible",
    status: { kind: "captured", seq: "trigger-states-disc", frame: 2 },
  },
  {
    name: "Pressed",
    surface: ":active",
    status: { kind: "captured", seq: "trigger-states-button", frame: 3 },
  },
  {
    name: "Reduced motion",
    surface: "reduceMotion",
    status: { kind: "captured", seq: "reduced-motion", frame: 2 },
  },
  {
    name: "Link preview, hover intent",
    surface: "<Root preview>",
    status: { kind: "captured", seq: "morph-link-preview", frame: 5 },
  },
  {
    name: "Phone, touch",
    surface: "390×844",
    status: { kind: "captured", seq: "morph-phone", frame: 5 },
  },
  {
    name: "Shape",
    surface: "data-vista-sheet-shape",
    status: { kind: "live", tileId: "shape-squircle" },
  },
  {
    name: "Button size",
    surface: "data-vista-sheet-button-size",
    status: { kind: "live", tileId: "button-m-icon-text" },
  },
  {
    name: "Default open",
    surface: "defaultOpen",
    status: { kind: "live", tileId: "open-basic" },
  },
  {
    name: "Drag and snap",
    surface: "draggable",
    status: { kind: "live", tileId: "behaviour-draggable" },
  },
  {
    name: "Swipe to dismiss",
    surface: "dismissOnSwipe",
    status: { kind: "live", tileId: "behaviour-swipe-dismiss" },
  },
  {
    name: "Backdrop click ignored",
    surface: "dismissOnBackdrop={false}",
    status: { kind: "live", tileId: "behaviour-no-backdrop-dismiss" },
  },
  {
    name: "Motion presets",
    surface: "preset",
    status: { kind: "live", tileId: "motion-snappy" },
  },
  {
    name: "Media, reduced motion",
    surface: "<VistaSheet.Media>",
    status: { kind: "live", tileId: "reduced-motion-media" },
  },
  {
    name: "Link preview, dark",
    surface: "<Root preview>",
    status: { kind: "live", tileId: "link-preview-dark" },
  },
  {
    name: "Link preview, long-press",
    surface: "touch hold",
    status: { kind: "live", tileId: "link-preview-light" },
  },
  {
    name: "Parts",
    surface: "data-vista-sheet-part",
    status: { kind: "anatomy" },
  },
  {
    name: "Slots",
    surface: "data-vista-sheet-slot",
    status: { kind: "anatomy" },
  },
  {
    name: "Controlled open",
    surface: "open / onOpenChange",
    status: { kind: "api" },
  },
  { name: "Stacking base", surface: "zIndex", status: { kind: "api" } },
  {
    name: "Anchor persistence",
    surface: "persistKey",
    status: { kind: "api" },
  },
  { name: "Custom springs", surface: "transition", status: { kind: "api" } },
  {
    name: "Close lead delay",
    surface: "surfaceCloseLeadDelayMs",
    status: { kind: "api" },
  },
  { name: "Element swap", surface: "asChild", status: { kind: "api" } },
  { name: "Initial focus", surface: "initialFocus", status: { kind: "api" } },
];

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
    case "api":
      return (
        <span className="dx-status" data-status="api">
          API-only
        </span>
      );
  }
}

function StatesTable({ frames }: { frames: FramesManifest | Error | null }) {
  const manifest = frames && !(frames instanceof Error) ? frames : null;
  return (
    <section id="states" className="cv-section">
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
              <tr key={r.name} data-state-kind={r.status.kind}>
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
