import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { isPlayMessage } from "../play/messages";
import { groundFor } from "../play/state";
import { Dissection } from "./Dissection";
import { MAX_LIVE, useLiveSet, type LiveSet } from "./live";
import {
  CANVAS_SECTIONS,
  CANVAS_TILES,
  INTERACTION_NOTES,
  VIEWPORTS,
  type CanvasTile,
} from "./tiles";
import "../example.css";
import "./canvas.css";
import { loadReview } from "./review";

type View = "interactive" | "dissection";

function readView(): View {
  return new URLSearchParams(location.search).get("view") === "dissection"
    ? "dissection"
    : "interactive";
}

function tileGround(tile: CanvasTile): string {
  if (tile.kind === "play") return groundFor(tile.state);
  return tile.src.includes("dark=1") ? "#0b0b0c" : "#f5f5f7";
}

function Tile({ tile, lives }: { tile: CanvasTile; lives: LiveSet }) {
  const vp = VIEWPORTS[tile.viewport];
  const isLive = lives.live.has(tile.id);
  const isActive = lives.active === tile.id;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activateRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(0);
  const [shown, setShown] = useState(false);
  const [posterMissing, setPosterMissing] = useState(false);
  const wasActive = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  // `inert` on the iframe doesn't stop the specimen's own programmatic
  // focus (a default-open sheet focuses its panel on mount) from pulling
  // the canvas's focus into the frame in Chromium. While the tile isn't
  // active, any focus landing inside is handed straight back.
  const guardFocus = useCallback((frame: HTMLIFrameElement) => {
    frame.contentWindow?.addEventListener(
      "focusin",
      () => {
        if (activeRef.current) return;
        if (document.activeElement === frame) frame.blur();
      },
      true,
    );
  }, []);

  const observe = lives.observe(tile.id);
  const setFrame = useCallback(
    (el: HTMLDivElement | null) => {
      frameRef.current = el;
      observe(el);
    },
    [observe],
  );
  const { setActive } = lives;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / vp.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp.width]);

  useEffect(() => {
    if (!isLive) setShown(false);
  }, [isLive]);

  // The stage handshake: each stage posts `ready` to its parent on mount;
  // answer only the one whose window is this tile's iframe.
  useEffect(() => {
    if (!isLive || tile.kind !== "play") return;
    function onMessage(e: MessageEvent) {
      if (tile.kind !== "play") return;
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin || !isPlayMessage(e.data)) return;
      if (e.data.type !== "vista-sheet-play:ready") return;
      guardFocus(frame);
      frame.contentWindow?.postMessage(
        {
          type: "vista-sheet-play:state",
          state: tile.state,
          overrides: tile.overrides,
        },
        location.origin,
      );
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isLive, tile, guardFocus]);

  // Esc inside the specimen releases it. Capture phase on the iframe's own
  // window (same origin), so it fires even when the sheet also handles Esc.
  useEffect(() => {
    if (!isActive) return;
    const frame = iframeRef.current;
    frame?.focus();
    const win = frame?.contentWindow;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
    }
    win?.addEventListener("keydown", onKey, true);
    window.addEventListener("keydown", onKey);
    return () => {
      win?.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [isActive, isLive, setActive]);

  useEffect(() => {
    if (wasActive.current && !isActive) {
      activateRef.current?.focus({ preventScroll: true });
    }
    wasActive.current = isActive;
  }, [isActive]);

  const src = tile.kind === "play" ? "./play.html?stage=1" : `./${tile.src}`;

  return (
    <figure
      className="cv-tile"
      id={`tile-${tile.id}`}
      data-anchor-id={`tile-${tile.id}`}
      data-canvas-tile={tile.id}
      data-viewport={tile.viewport}
      data-active={isActive || undefined}
    >
      <figcaption>
        <span
          className="cv-tile-label"
          data-anchor-id={`tile-${tile.id}-label`}
        >
          {tile.label}
        </span>
        <code className="cv-tile-caption">{tile.caption}</code>
      </figcaption>
      <div
        ref={setFrame}
        className="cv-frame"
        data-canvas-tile-frame={tile.id}
        data-anchor-id={`tile-${tile.id}-frame`}
        style={{
          aspectRatio: `${vp.width} / ${vp.height}`,
          background: tileGround(tile),
        }}
      >
        {!posterMissing ? (
          <img
            className="cv-poster"
            data-anchor-id={`tile-${tile.id}-poster`}
            src={`./canvas/posters/${tile.id}.png`}
            alt=""
            loading="lazy"
            onError={() => setPosterMissing(true)}
          />
        ) : (
          <div className="cv-poster-empty" aria-hidden="true">
            {tile.label}
          </div>
        )}
        {isLive && scale > 0 && (
          <iframe
            ref={iframeRef}
            className="cv-iframe"
            data-shown={shown || undefined}
            title={`${tile.label} specimen`}
            src={src}
            inert={!isActive}
            tabIndex={isActive ? 0 : -1}
            onLoad={
              tile.kind === "page"
                ? (e) => {
                    guardFocus(e.currentTarget);
                    setShown(true);
                  }
                : undefined
            }
            style={{
              width: vp.width,
              height: vp.height,
              transform: `scale(${scale})`,
            }}
          />
        )}
        {!isActive && (
          <button
            ref={activateRef}
            type="button"
            className="cv-activate"
            onClick={() => setActive(tile.id)}
          >
            <span>Click to interact</span>
            <span className="cv-visually-hidden">: {tile.label}</span>
          </button>
        )}
      </div>
      {isActive && (
        <p className="cv-tile-hint">Esc or click outside to release</p>
      )}
    </figure>
  );
}

function Interactive() {
  const lives = useLiveSet();
  const { active, setActive } = lives;

  // The browser's own #hash scroll runs before React renders the sections.
  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  // Clicking anywhere outside the active tile returns it to inert. Clicks
  // inside its iframe never reach this document.
  useEffect(() => {
    if (!active) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Element | null;
      if (!t?.closest(`[data-canvas-tile="${active}"]`)) setActive(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, setActive]);

  return (
    <div className="cv-layout">
      <nav className="cv-index" aria-label="Sections">
        <ol>
          {CANVAS_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
          <li>
            <a href="#interactions">Interaction states</a>
          </li>
        </ol>
      </nav>
      <main className="cv-sections">
        {CANVAS_SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            data-anchor-id={`section-${s.id}`}
            className="cv-section"
          >
            <header>
              <h2>{s.title}</h2>
              <p>{s.description}</p>
            </header>
            <div className="cv-grid">
              {CANVAS_TILES.filter((t) => t.section === s.id).map((t) => (
                <Tile key={t.id} tile={t} lives={lives} />
              ))}
            </div>
          </section>
        ))}
        <section
          id="interactions"
          data-anchor-id="section-interactions"
          className="cv-section"
        >
          <header>
            <h2>Interaction states</h2>
            <p>Live only. Each one points at the tile to try it on.</p>
          </header>
          <ul className="cv-notes">
            {INTERACTION_NOTES.map((n) => {
              const tile = CANVAS_TILES.find((t) => t.id === n.tileId)!;
              return (
                <li key={n.id} data-anchor-id={`interaction-${n.id}`}>
                  <span className="cv-note-label">{n.label}</span>
                  <span className="cv-note-how">{n.how}</span>
                  <a href={`#tile-${n.tileId}`}>{tile.label}</a>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Canvas() {
  const [view, setView] = useState<View>(readView);

  function choose(next: View) {
    setView(next);
    const url = new URL(location.href);
    if (next === "interactive") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    history.replaceState(null, "", url);
  }

  return (
    <>
      <header className="cv-topbar">
        <div className="cv-title">
          <h1>vista-sheet</h1>
          <span>Canvas</span>
        </div>
        <div className="cv-switch" role="tablist" aria-label="View">
          {(["interactive", "dissection"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => choose(v)}
            >
              {v === "interactive" ? "Interactive" : "Dissection"}
            </button>
          ))}
        </div>
        <span className="cv-meta">
          {CANVAS_TILES.length} specimens · {MAX_LIVE} live at once
        </span>
      </header>
      {view === "interactive" ? <Interactive /> : <Dissection />}
    </>
  );
}

loadReview();

createRoot(document.getElementById("root")!).render(<Canvas />);
