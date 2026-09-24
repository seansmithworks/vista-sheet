"use client";

import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  DirectChildContext,
  TriggerSurfaceContext,
  useVistaSheetInternal,
  useVistaSheetSlot,
} from "./context";

// `process` is not declared in a Vite consumer's tsconfig — see Sheet.tsx's
// matching declaration/note.
declare const process: { env: { NODE_ENV?: string } };

let warnedMediaNotDirectChild = false;
import { mediaCoverBox, mediaCounterScale } from "./mediaFit";
import type { MediaProps } from "./types";
import styles from "./styles.module.css";

function noopSubscribe() {
  return () => {};
}

/**
 * <VistaSheet.Media> — the video/img cover fill for a trigger or sheet.
 * Rendered twice, like <VistaSheet.Shared>: once inside <VistaSheet.Trigger>,
 * once inside <VistaSheet.Sheet>, each a direct child (documented, not
 * guarded).
 *
 * Strawman (v0.2): no playback-time handoff between the trigger and sheet
 * instances — both start at 0, and the poster is frame 0, so there's no
 * visible seam either way. Deferred to BACKLOG.
 *
 * Strawman (v0.2): decorative (aria-hidden) by default; pass `alt` to make it
 * meaningful content instead.
 */
export function Media({
  src,
  poster,
  aspectRatio,
  alt,
  className,
}: MediaProps) {
  const ctx = useVistaSheetInternal("Media");
  const slot = useVistaSheetSlot();
  const store = useContext(TriggerSurfaceContext);
  const isDirectChild = useContext(DirectChildContext);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (isDirectChild || warnedMediaNotDirectChild) return;
    warnedMediaNotDirectChild = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[vista-sheet] <VistaSheet.Media> is not a direct child of " +
        "<VistaSheet.Trigger>/<VistaSheet.Sheet> — it is nested inside " +
        "<VistaSheet.Item>/<VistaSheet.Content> or another wrapper. Move it " +
        "to be a direct child of Trigger/Sheet.",
    );
  }, [isDirectChild]);

  // WHY THIS DESIGN (DESIGN.md §4.1, "one surface, one clock"): during the
  // FLIP, Motion scales the surface non-uniformly (a square disc becoming a
  // 9:16 sheet, or vice versa). The media element is laid out at its own
  // cover box and then counter-scaled from the surface's ACTUAL rendered
  // box, read inside a MutationObserver on the surface's style attribute —
  // the same task Motion's own transform write lands in, before paint. So
  // the media is slaved to Motion's projection and never runs its own clock.
  //
  // On close the TRIGGER surface is the entering element (it FLIPs from the
  // sheet's box and fades in above it) — the trigger-side Media has to live
  // INSIDE that surface, or it would sit full-size at the trigger's resting
  // spot from the first close frame instead of riding the FLIP. That's what
  // the portal below is for.
  const portalTarget = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => store?.get() ?? null,
    () => null,
  );

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  // Strawman (v0.2): scale is read from the surface's rendered box (via a
  // MutationObserver on its style attribute), never recomputed from
  // collapseProgress — exact by construction, and no second clock.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const el = elementRef.current;
    if (!wrapper || !el) return;

    const surface = wrapper.closest<HTMLElement>(
      '[data-vista-sheet-part="sheet"], [data-vista-sheet-part="trigger-surface"]',
    );

    // Sentinel, not NaN: `Math.abs(NaN - x)` is NaN, and NaN never compares
    // greater than the threshold below, so a NaN seed would make the
    // write-guard's very first comparison fail — and since only a passing
    // comparison ever updates `lastScaleX/Y`, it would then fail FOREVER,
    // permanently suppressing the counter-scale write (caught by the
    // red-proof gate below: without this, no transform is ever painted and
    // the video simply inherits the surface's raw ambient scale).
    let lastScaleX = Infinity;
    let lastScaleY = Infinity;

    function layout() {
      if (!wrapper || !el) return;
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      if (cw === 0 || ch === 0) return;
      const box = mediaCoverBox(cw, ch, aspectRatio);
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
      el.style.left = `${box.left}px`;
      el.style.top = `${box.top}px`;
    }

    function applyScale() {
      if (!wrapper || !el) return;
      const rect = wrapper.getBoundingClientRect();
      if (wrapper.offsetWidth === 0 || wrapper.offsetHeight === 0) return;
      const sx = rect.width / wrapper.offsetWidth;
      const sy = rect.height / wrapper.offsetHeight;
      const s = mediaCounterScale({
        containerWidth: wrapper.clientWidth,
        containerHeight: wrapper.clientHeight,
        aspectRatio,
        surfaceScaleX: sx,
        surfaceScaleY: sy,
      });
      if (
        Math.abs(s.scaleX - lastScaleX) > 1e-4 ||
        Math.abs(s.scaleY - lastScaleY) > 1e-4
      ) {
        lastScaleX = s.scaleX;
        lastScaleY = s.scaleY;
        el.style.transform = `scale(${s.scaleX}, ${s.scaleY})`;
      }
    }

    layout();
    applyScale();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            layout();
            applyScale();
          })
        : null;
    resizeObserver?.observe(wrapper);

    let mutationObserver: MutationObserver | null = null;
    if (surface && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => applyScale());
      mutationObserver.observe(surface, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
    // Never put width/height/left/top/transform in a React style prop —
    // React re-renders would clobber these imperative writes.
  }, [aspectRatio, portalTarget, ctx.reduceMotion, src]);

  // Strawman (v0.2): no playback-time handoff — both instances start at 0.
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !(el instanceof HTMLVideoElement)) return;
    el.muted = true;
    if (!ctx.reduceMotion) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [ctx.reduceMotion, src]);

  const node = (
    <div
      ref={wrapperRef}
      className={`${styles.media} ${className ?? ""}`}
      data-vista-sheet-part="media"
      data-vista-sheet-slot={slot}
    >
      {src ? (
        <video
          key={ctx.reduceMotion ? "still" : "live"}
          ref={(el) => {
            elementRef.current = el;
          }}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={!ctx.reduceMotion}
          preload="auto"
          disablePictureInPicture
          aria-hidden={alt ? undefined : true}
          aria-label={alt || undefined}
          className={styles.mediaElement}
        />
      ) : (
        <img
          ref={(el) => {
            elementRef.current = el;
          }}
          src={poster}
          alt={alt ?? ""}
          draggable={false}
          className={styles.mediaElement}
        />
      )}
    </div>
  );

  // Strawman (v0.2): Media must be a direct child of Trigger or Sheet
  // (documented, not guarded).
  if (slot === "trigger") {
    return portalTarget ? createPortal(node, portalTarget) : null;
  }
  return node;
}
