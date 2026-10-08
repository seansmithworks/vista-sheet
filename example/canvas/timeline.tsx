/**
 * The choreography timelines. Every number is imported from src/motion.ts;
 * spring durations are simulated from their constants (springs.ts). The
 * Open and Close timelines are the Motion Lab's scrubber.
 */
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
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
  PREVIEW_CLOSE_GRACE_MS,
  PREVIEW_HOVER_INTENT_MS,
  PREVIEW_LONG_PRESS_MS,
  PREVIEW_LONG_PRESS_SLOP_PX,
  RADIUS_HOLD_FRACTION,
  SURFACE_CLOSE_LEAD_DELAY_MS,
  TRIGGER_LABEL_REVEAL_START,
} from "../../src/motion";
import { crossing, simulate } from "./springs";

export interface Bar {
  label: string;
  start: number;
  end?: number;
  /** Instant markers inside the bar. */
  marks?: Array<{ at: number; label: string }>;
  note: string;
}

export interface Choreography {
  openBars: Bar[];
  closeBars: Bar[];
  previewBars: Bar[];
  /** Shared x-axis length, ms. */
  total: number;
  /** ms from the open click at which collapse reaches CLOSE_REVEAL_PROGRESS. */
  reveal: number;
}

export function choreography(): Choreography {
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

  const previewBars: Bar[] = [
    {
      label: "Hover intent",
      start: 0,
      end: PREVIEW_HOVER_INTENT_MS,
      note: `hover or focus rests ${PREVIEW_HOVER_INTENT_MS}ms, then opens`,
    },
    {
      label: "Close grace",
      start: 0,
      end: PREVIEW_CLOSE_GRACE_MS,
      note: `pointer out: ${PREVIEW_CLOSE_GRACE_MS}ms to reach the card`,
    },
    {
      label: "Long-press",
      start: 0,
      end: PREVIEW_LONG_PRESS_MS,
      note: `touch hold ${PREVIEW_LONG_PRESS_MS}ms · ${PREVIEW_LONG_PRESS_SLOP_PX}px slop cancels`,
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

  return { openBars, closeBars, previewBars, total, reveal };
}

/**
 * Bars on a shared ms axis. With `onSeek` it is a scrubber: a slider whose
 * rows take pointer drags (ms under the pointer) and arrow keys (one
 * display frame), and `playhead` draws the current time across every row.
 */
export function Timeline({
  title,
  bars,
  total,
  playhead,
  onSeek,
  onStep,
}: {
  title: string;
  bars: Bar[];
  total: number;
  playhead?: number;
  onSeek?: (ms: number) => void;
  /** ± display frames (arrow keys). */
  onStep?: (frames: number) => void;
}) {
  const W = 1000;
  const ROW = 34;
  const LABEL = 0;
  const x = (ms: number) => LABEL + (ms / total) * (W - LABEL);
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += 100) ticks.push(t);
  const scrub = Boolean(onSeek);

  function seekFrom(e: ReactPointerEvent<HTMLElement>) {
    const svg = e.currentTarget.querySelector(".dx-tl-svg");
    if (!svg || !onSeek) return;
    const r = svg.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    onSeek(f * total);
  }

  return (
    <figure className="dx-timeline" data-scrubber={scrub || undefined}>
      <figcaption>{title}</figcaption>
      <div
        className="dx-timeline-rows"
        {...(scrub && {
          role: "slider",
          tabIndex: 0,
          "aria-label": `${title}: playhead`,
          "aria-valuemin": 0,
          "aria-valuemax": total,
          "aria-valuenow": Math.round(playhead ?? 0),
          "aria-valuetext": `${Math.round(playhead ?? 0)}ms`,
          onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFrom(e);
          },
          onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFrom(e);
          },
          onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              onStep?.(e.key === "ArrowLeft" ? -1 : 1);
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              onSeek!(e.key === "Home" ? 0 : total);
            }
          },
        })}
      >
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
              {playhead !== undefined && (
                <line
                  x1={x(playhead)}
                  x2={x(playhead)}
                  y1={0}
                  y2={ROW}
                  className="dx-tl-playhead"
                />
              )}
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
