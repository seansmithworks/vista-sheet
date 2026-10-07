import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  sheetPlacement,
  SHEET_DEFAULT_HEIGHT,
  SHEET_DEFAULT_WIDTH,
} from "../../src/anchors";
import { isPlayMessage } from "../play/messages";
import { groundFor } from "../play/state";
import { Dissection } from "./Dissection";
import { MAX_LIVE, useLiveSet, type LiveSet } from "./live";
import { PUBLIC_TOKENS } from "./readme";
import {
  CANVAS_SECTIONS,
  CANVAS_TILES,
  forAppearance,
  posterName,
  VIEWPORTS,
  type Appearance,
  type CanvasTile,
  type SectionId,
} from "./tiles";
import "../example.css";
import "./canvas.css";
import { loadReview } from "./review";

type View = "interactive" | "dissection";
type AppearanceChoice = Appearance | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The choice, resolved against the OS when it's System. */
function useAppearance(choice: AppearanceChoice): Appearance {
  const [systemDark, setSystemDark] = useState(
    () => matchMedia(DARK_QUERY).matches,
  );
  useEffect(() => {
    const mq = matchMedia(DARK_QUERY);
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (choice !== "system") return choice;
  return systemDark ? "dark" : "light";
}

function readView(): View {
  return new URLSearchParams(location.search).get("view") === "dissection"
    ? "dissection"
    : "interactive";
}

function tileGround(tile: CanvasTile): string {
  if (tile.kind === "play") return groundFor(tile.state);
  return tile.src.includes("dark=1") ? "#0b0b0c" : "#f5f5f7";
}

function Tile({
  tile,
  lives,
  poster,
}: {
  /** Already resolved for the page appearance (forAppearance). */
  tile: CanvasTile;
  lives: LiveSet;
  poster: string;
}) {
  const vp = VIEWPORTS[tile.viewport];
  const fluid = tile.viewport === "fluid";
  const isLive = lives.live.has(tile.id);
  const isActive = lives.active === tile.id;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activateRef = useRef<HTMLButtonElement>(null);
  const readyRef = useRef(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const [shown, setShown] = useState(false);
  const [posterMissing, setPosterMissing] = useState(false);
  // A fluid frame is shown 1:1; the others scale a fixed logical viewport.
  const scale = fluid ? (frameWidth > 0 ? 1 : 0) : frameWidth / vp.width;
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
      setFrameWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The appearance swaps the poster file; a miss on one isn't a miss on both.
  useEffect(() => setPosterMissing(false), [poster]);

  const src = tile.kind === "play" ? "./play.html?stage=1" : `./${tile.src}`;

  // A page tile's src changes with the appearance: the iframe remounts
  // (keyed on src) and fades in again on its own load.
  useEffect(() => {
    if (!isLive) readyRef.current = false;
    setShown(false);
  }, [isLive, src]);

  const postState = useCallback(() => {
    if (tile.kind !== "play") return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "vista-sheet-play:state",
        state: tile.state,
        overrides: tile.overrides,
      },
      location.origin,
    );
  }, [tile]);

  // The stage handshake: each stage posts `ready` to its parent on mount;
  // answer only the one whose window is this tile's iframe.
  useEffect(() => {
    if (!isLive || tile.kind !== "play") return;
    function onMessage(e: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin || !isPlayMessage(e.data)) return;
      if (e.data.type !== "vista-sheet-play:ready") return;
      readyRef.current = true;
      guardFocus(frame);
      postState();
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isLive, tile.kind, guardFocus, postState]);

  // An appearance switch repaints a mounted stage in place: same message,
  // new palette, no reload.
  useEffect(() => {
    if (readyRef.current) postState();
  }, [postState]);

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
        {tile.seeAlso && (
          <a className="cv-tile-see" href={`#${tile.seeAlso}`}>
            See {CANVAS_SECTIONS.find((s) => s.id === tile.seeAlso)!.title}
          </a>
        )}
      </figcaption>
      <div
        ref={setFrame}
        className="cv-frame"
        data-canvas-tile-frame={tile.id}
        data-anchor-id={`tile-${tile.id}-frame`}
        style={{
          ...(fluid
            ? { height: vp.height }
            : { aspectRatio: `${vp.width} / ${vp.height}` }),
          background: tileGround(tile),
        }}
      >
        {!posterMissing ? (
          <img
            className="cv-poster"
            data-anchor-id={`tile-${tile.id}-poster`}
            src={`./canvas/posters/${poster}`}
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
            key={src}
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
              width: fluid ? frameWidth : vp.width,
              height: vp.height,
              transform: fluid ? undefined : `scale(${scale})`,
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

/** One label/value row per sheet default, read from the package: the
 * README theming table, the .sheet CSS twins in anchors.ts, and the
 * per-anchor max-height that sheetPlacement writes. */
function GeometryDefaults() {
  const token = (name: string) =>
    PUBLIC_TOKENS.find((t) => t.name === name)!.defaultValue;
  const maxHeight = (anchor: "bottom-center" | "top-center" | "center") =>
    sheetPlacement(anchor, 1280, 800, 96, 480).maxHeight;
  const rows: Array<[string, string]> = [
    ["Max width", token("--vista-sheet-sheet-max-width")],
    ["Width", SHEET_DEFAULT_WIDTH],
    ["Height", `${SHEET_DEFAULT_HEIGHT} (no minimum)`],
    ["Max height, bottom anchors", maxHeight("bottom-center")],
    ["Max height, top anchors", maxHeight("top-center")],
    ["Max height, center", maxHeight("center")],
    ["Corner radius", token("--vista-sheet-sheet-radius")],
    ["Padding", token("--vista-sheet-sheet-padding")],
  ];
  return (
    <dl className="cv-defaults" data-anchor-id="geometry-defaults">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <code>{value}</code>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const SECTION_EXTRA: Partial<Record<SectionId, () => ReactNode>> = {
  geometry: GeometryDefaults,
};

/** The section whose top has passed the sticky chrome, or the last one once
 * the page can't scroll further. */
function useSectionInView(ids: string[]): string {
  const [current, setCurrent] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      const line =
        parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) + 8;
      const atEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      let next = ids[0];
      if (atEnd) next = ids[ids.length - 1];
      else
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= line) next = id;
        }
      setCurrent(next);
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);
  return current;
}

const SECTION_IDS = CANVAS_SECTIONS.map((s) => s.id);

function Interactive({ appearance }: { appearance: Appearance }) {
  const lives = useLiveSet();
  const { active, setActive } = lives;
  const current = useSectionInView(SECTION_IDS);
  const indexRef = useRef<HTMLElement>(null);
  const tiles = useMemo(
    () => CANVAS_TILES.map((t) => forAppearance(t, appearance)),
    [appearance],
  );

  // On phone the index is a horizontal strip: keep the current link in it.
  useEffect(() => {
    const nav = indexRef.current;
    const link = nav?.querySelector<HTMLElement>(`a[href="#${current}"]`);
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.offsetLeft - nav.clientWidth / 2 + link.offsetWidth / 2;
    nav.scrollTo({ left, behavior: "smooth" });
  }, [current]);

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
      <nav ref={indexRef} className="cv-index" aria-label="Sections">
        <ol>
          {CANVAS_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={current === s.id ? "true" : undefined}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <main className="cv-sections">
        {CANVAS_SECTIONS.map((s) => {
          const Extra = SECTION_EXTRA[s.id];
          return (
            <section
              key={s.id}
              id={s.id}
              data-anchor-id={`section-${s.id}`}
              className="cv-section"
            >
              <header>
                <h2>{s.title}</h2>
                <p>{s.description}</p>
                {Extra && <Extra />}
              </header>
              <div className="cv-grid">
                {tiles
                  .filter((t) => t.section === s.id)
                  .map((t) => (
                    <Tile
                      key={t.id}
                      tile={t}
                      lives={lives}
                      poster={posterName(t, appearance)}
                    />
                  ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

const APPEARANCE_CHOICES: Array<[AppearanceChoice, string]> = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "System"],
];

function Canvas() {
  const [view, setView] = useState<View>(readView);
  const [choice, setChoice] = useState<AppearanceChoice>("system");
  const appearance = useAppearance(choice);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
  }, [appearance]);

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
        <div
          className="cv-switch cv-appearance"
          role="radiogroup"
          aria-label="Appearance"
        >
          {APPEARANCE_CHOICES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              onClick={() => setChoice(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="cv-meta">
          {CANVAS_TILES.length} specimens · {MAX_LIVE} live at once
        </span>
      </header>
      {view === "interactive" ? (
        <Interactive appearance={appearance} />
      ) : (
        <Dissection />
      )}
    </>
  );
}

loadReview();

createRoot(document.getElementById("root")!).render(<Canvas />);
