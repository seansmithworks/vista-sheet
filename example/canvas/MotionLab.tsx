/**
 * Motion Lab: one live specimen on a virtual clock (play.html?stage=1&
 * clock=1, see play/virtual-clock.ts and play/clock-lab.ts), so the real
 * morph runs slowed down, a frame at a time, or scrubbed. The Open/Close
 * choreography timeline is the scrubber; its playhead is virtual time since
 * the scene's click. Captured strip frames seek it (`request`).
 *
 * Default preset only: the timeline's markers and the strips' timings are
 * the default springs, so another preset would make both lie. The video
 * recipe is excluded (its <video> runs on its own clock).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  isPlayMessage,
  type ClockCommand,
  type LabDirection,
  type LabState,
} from "../play/messages";
import { groundFor } from "../play/state";
import { choreography, Timeline } from "./timeline";
import { CANVAS_TILES, VIEWPORTS, type PlayTile } from "./tiles";

export interface LabRequest {
  tileId: string;
  direction: LabDirection;
  ms: number;
  /** A new object per click, so the same frame clicked twice seeks twice. */
  nonce: number;
}

const PICKER = CANVAS_TILES.filter(
  (t): t is PlayTile =>
    t.kind === "play" && t.section === "content" && t.state.recipe !== "video",
);
const SPEEDS = [0.1, 0.25, 1] as const;
const FRAME_MS = 1000 / 60;

function labTile(id: string): PlayTile {
  const t = CANVAS_TILES.find((x) => x.id === id) as PlayTile;
  // A scene always starts at rest.
  const { defaultOpen: _, ...overrides } = t.overrides ?? {};
  return { ...t, overrides };
}

export function MotionLab({ request }: { request: LabRequest | null }) {
  const [tileId, setTileId] = useState(PICKER[0].id);
  const tile = useMemo(() => labTile(tileId), [tileId]);
  const vp = VIEWPORTS[tile.viewport];
  const [direction, setDirection] = useState<LabDirection>("open");
  const [lab, setLab] = useState<LabState | null>(null);
  const [scale, setScale] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { openBars, closeBars, total } = useMemo(choreography, []);
  // Applied once the (re)mounted stage says it's ready.
  const pending = useRef<{ direction: LabDirection; ms: number }>({
    direction: "open",
    ms: 0,
  });

  const send = (command: ClockCommand) =>
    iframeRef.current?.contentWindow?.postMessage(
      { type: "vista-sheet-play:clock", command },
      location.origin,
    );

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
    function onMessage(e: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (e.origin !== location.origin || !isPlayMessage(e.data)) return;
      if (e.data.type === "vista-sheet-play:clock-state") {
        setLab(e.data.state);
        return;
      }
      if (e.data.type !== "vista-sheet-play:ready") return;
      const win = frame.contentWindow!;
      // Every re-arm opens a modal sheet, which focuses its panel; keep
      // the canvas's focus (the transport keys live on this page).
      win.addEventListener("focusin", () => frame.blur(), true);
      win.postMessage(
        {
          type: "vista-sheet-play:state",
          state: tile.state,
          overrides: tile.overrides,
        },
        location.origin,
      );
      const p = pending.current;
      send({ op: "scene", direction: p.direction, endMs: total });
      send({ op: "seek", ms: p.ms });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tile, total]);

  // A strip frame asks for a tile, scene and time.
  useEffect(() => {
    if (!request) return;
    setDirection(request.direction);
    pending.current = { direction: request.direction, ms: request.ms };
    if (request.tileId !== tileId) {
      setLab(null);
      setTileId(request.tileId);
    } else {
      send({ op: "scene", direction: request.direction, endMs: total });
      send({ op: "seek", ms: request.ms });
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Only a new request should act, not a tile change it caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  function chooseDirection(d: LabDirection) {
    setDirection(d);
    pending.current = { direction: d, ms: 0 };
    send({ op: "scene", direction: d, endMs: total });
  }

  const t = lab?.t ?? 0;
  const playing = lab?.playing ?? false;
  const step = (frames: number) => send({ op: "step", frames });
  const seek = (ms: number) => send({ op: "seek", ms });

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.defaultPrevented) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "SELECT" || tag === "INPUT") return;
    if (e.key === " " && tag !== "BUTTON") {
      e.preventDefault();
      send({ op: playing ? "pause" : "play" });
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    }
  }

  const picked = PICKER.some((p) => p.id === tileId);

  return (
    <div
      ref={rootRef}
      className="dx-lab"
      data-motion-lab
      data-lab-tile={tileId}
      onKeyDown={onKeyDown}
    >
      <div className="dx-lab-specimen">
        <div
          ref={frameRef}
          className="cv-frame dx-lab-frame"
          style={{
            aspectRatio: `${vp.width} / ${vp.height}`,
            background: groundFor(tile.state),
          }}
        >
          {scale > 0 && (
            <iframe
              key={tileId}
              ref={iframeRef}
              className="cv-iframe"
              data-shown={lab ? "" : undefined}
              title={`${tile.label} specimen on the Motion Lab clock`}
              src="./play.html?stage=1&clock=1"
              tabIndex={-1}
              aria-hidden="true"
              inert
              style={{
                width: vp.width,
                height: vp.height,
                transform: `scale(${scale})`,
              }}
            />
          )}
          {!lab && <div className="dx-loading">loading…</div>}
        </div>
      </div>
      <div className="dx-lab-controls">
        <div className="dx-lab-transport" role="toolbar" aria-label="Playback">
          <button
            type="button"
            className="dx-lab-play"
            onClick={() => send({ op: playing ? "pause" : "play" })}
            disabled={!lab}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            aria-label="Back one frame"
            onClick={() => step(-1)}
            disabled={!lab}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Forward one frame"
            onClick={() => step(1)}
            disabled={!lab}
          >
            ›
          </button>
          <Segmented label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={(lab?.speed ?? 0.25) === s}
                onClick={() => send({ op: "speed", speed: s })}
              >
                {s}×
              </button>
            ))}
          </Segmented>
          <Segmented label="Scene">
            {(["open", "close"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={direction === d}
                onClick={() => chooseDirection(d)}
              >
                {d === "open" ? "Open" : "Close"}
              </button>
            ))}
          </Segmented>
          <label className="dx-lab-pick">
            <span className="cv-visually-hidden">Specimen</span>
            <select
              value={tileId}
              onChange={(e) => {
                pending.current = { direction, ms: 0 };
                setLab(null);
                setTileId(e.currentTarget.value);
              }}
            >
              {PICKER.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              {!picked && <option value={tileId}>{tile.label}</option>}
            </select>
          </label>
        </div>
        <p className="dx-lab-readout" aria-live="off">
          <code data-lab-t>
            +{t.toFixed(1)}ms · frame {Math.round(t / FRAME_MS)}
          </code>
          <code>
            collapse{" "}
            {lab?.collapse === null || lab?.collapse === undefined
              ? "—"
              : lab.collapse.toFixed(3)}
          </code>
          <code>{tile.id}</code>
          {lab?.busy && <code>seeking…</code>}
        </p>
        <Timeline
          title={
            direction === "open"
              ? "Open · ms from the click"
              : "Close · ms from the click"
          }
          bars={direction === "open" ? openBars : closeBars}
          total={total}
          playhead={t}
          onSeek={seek}
          onStep={step}
        />
        <p className="dx-note">
          Drag the timeline to scrub, ← → for one frame, Space to play. Every
          frame is the real component on a virtual clock; going back replays
          from the click.
        </p>
      </div>
    </div>
  );
}

function Segmented({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="cv-switch dx-lab-seg" role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}
