"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { TriggerBox } from "./shape";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import type { MotionValue, PanInfo } from "motion/react";
import {
  nearestAnchor,
  rectFromBox,
  rectsNear,
  restingLeft,
  restingTop,
} from "./anchors";
import type { AnchorId } from "./anchors";
import {
  SlotContext,
  TriggerSurfaceContext,
  createTriggerSurfaceStore,
  useVistaSheetInternal,
} from "./context";
import type { TriggerSurfaceStore } from "./context";
import { readVarPx } from "./readVarPx";
import { DRAG_THRESHOLD_PX, SNAP_SPRING, triggerLabelOpacity } from "./motion";
import {
  initialTriggerRestRadius,
  resolveTriggerCornerRadius,
  supportsCornerShape,
} from "./shape";
import { LinkTrigger } from "./LinkTrigger";
import { Shared } from "./Shared";
import { Media } from "./Media";
import { TriggerSurface } from "./TriggerSurface";
import type { Rect, TriggerComponentProps, TriggerProps } from "./types";
import styles from "./styles.module.css";

/** Jump the trigger's x/y motion values to the anchor's resting position. */
function seatAt(
  x: MotionValue<number>,
  y: MotionValue<number>,
  anchor: AnchorId,
  vpW: number,
  vpH: number,
  box: { width: number; height: number },
) {
  x.jump(restingLeft(anchor, vpW, box.width));
  y.jump(restingTop(anchor, vpH, box.height));
}

export function Trigger(props: TriggerComponentProps) {
  return props.asChild ? (
    <LinkTrigger>{props.children}</LinkTrigger>
  ) : (
    <ButtonTrigger {...props} />
  );
}

/**
 * <VistaSheet.Trigger> — the fixed drag wrapper + trigger button + morph
 * seed surface.
 *
 * Single-origin position model (docs/PACKAGE-DESIGN.md §1, and the
 * `reference_floating-disc-single-origin-transform` landmine): the wrapper is
 * `position: fixed` at the viewport origin and positioned ENTIRELY by
 * Motion's x/y transform, holding the trigger's top-left in viewport px.
 * Nothing ever changes CSS left/top after mount, so a snap is a plain x/y
 * animation with no FLIP and no one-frame transform desync.
 */
function ButtonTrigger({
  children,
  className,
  asChild: _asChild,
  ...aria
}: TriggerProps) {
  const ctx = useVistaSheetInternal("Trigger");
  const {
    open,
    setOpen,
    anchor,
    setAnchor,
    setIsDragging,
    draggable,
    shape,
    buttonSize,
    triggerBox,
    setMeasuredTriggerBox,
    reduceMotion,
    triggerId,
    sheetId,
    setTriggerRect,
    triggerElRef,
    sheetRect,
    collapseProgress,
  } = ctx;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Per-gesture travel, not sticky across gestures: reset on every
  // pointerdown, raised from onDrag's cumulative offset, read once by
  // handleClick. A drag that snaps to a new anchor releases the pointer off
  // the button, so no click ever lands there to clear a "was dragging" flag
  // — a ref that only handleClick or the sub-threshold branch of
  // handleDragEnd ever cleared stayed armed forever and silently ate the
  // next Enter/tap (a11y M1 = code M2). Deciding activation from THIS
  // gesture's own travel, not a flag left over from the last one, removes
  // the bug class instead of patching the one instance.
  const maxTravelRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const surfaceStoreRef = useRef<TriggerSurfaceStore | null>(null);
  if (!surfaceStoreRef.current) {
    surfaceStoreRef.current = createTriggerSurfaceStore();
  }
  // Stable identity across renders — an inline arrow ref would detach and
  // reattach on every render, remounting the portal (and the video inside
  // it) along with it.
  const attachSurfaceRef = useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    surfaceStoreRef.current!.set(el);
  }, []);
  const lastRectRef = useRef<Rect | null>(null);
  const rafRef = useRef<number | null>(null);
  // A resize while <Sheet> is mounted is deferred: this wrapper's x/y is an
  // ancestor of the FLIPping trigger surface, and jumping it mid-morph
  // compounds with Motion's in-flight projection transform. Flushed once
  // sheetRect returns to null.
  const pendingResizeRef = useRef(false);

  // Rectangle box measurement, held while the sheet is mounted — see
  // publishBox below.
  const sheetRectRef = useRef(sheetRect);
  sheetRectRef.current = sheetRect;
  const latestBoxRef = useRef<TriggerBox | null>(null);
  const publishedBoxRef = useRef<TriggerBox | null>(null);

  // Seed x/y at the anchor's resting position on mount and whenever the
  // anchor or trigger size changes while the sheet is not being dragged.
  //
  // Strawman (v0.2): for shape="rectangle" this reads the wrapper's DOM box
  // directly (wrapperRef.current, already attached by the time a layout
  // effect runs, since ref callbacks commit before effects) rather than
  // ctx.triggerBox — that context value is still the square triggerSize
  // fallback on this component's very first commit (the rectangle
  // measurement effect below hasn't published yet), and jumping to that
  // wrong position now, then jumping again to the right one once
  // setMeasuredTriggerBox lands, is a genuine two-commit layout change that
  // the surface's shared layoutId FLIPs smoothly instead of skipping — a
  // ~700ms drift across the viewport on first paint. Reading the DOM here
  // instead means both commits compute the identical target, so x/y never
  // actually moves and there is nothing for the layoutId to FLIP.
  useLayoutEffect(() => {
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const box =
      shape === "rectangle" && wrapperRef.current
        ? {
            width: wrapperRef.current.offsetWidth,
            height: wrapperRef.current.offsetHeight,
          }
        : triggerBox;
    seatAt(x, y, anchor, vpW, vpH, box);
  }, [anchor, shape, triggerBox.width, triggerBox.height, x, y]);

  // Resize: re-seat the trigger at its anchor's new resting position. While
  // <Sheet> is mounted (sheetRect !== null), defer instead of jumping now —
  // see pendingResizeRef above. The trigger's Shared/Media riders are gated
  // behind `{!open && ...}` below, and the label is held at opacity 0 by
  // triggerLabelOpacity, so nothing is visibly lost by waiting; the flush
  // effect re-seats at the CURRENT viewport size once the morph settles.
  useEffect(() => {
    const onResize = () => {
      if (sheetRect !== null) {
        pendingResizeRef.current = true;
        return;
      }
      seatAt(x, y, anchor, window.innerWidth, window.innerHeight, triggerBox);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchor, triggerBox.width, triggerBox.height, sheetRect, x, y]);

  // Flush a deferred resize once the morph is over (sheetRect settles back
  // to null at Sheet's onExitComplete, or was never set — the open case
  // where a resize is deferred until the sheet later closes).
  useEffect(() => {
    if (sheetRect !== null) return;
    if (!pendingResizeRef.current) return;
    pendingResizeRef.current = false;
    seatAt(x, y, anchor, window.innerWidth, window.innerHeight, triggerBox);
  }, [anchor, triggerBox.width, triggerBox.height, sheetRect, x, y]);

  // The trigger's resting corner radius as a live numeric MotionValue.
  // Motion's shared-layout radius mix only sees an inline value it manages,
  // never a CSS rule, so without this an open mixes the shape from 0 and its
  // first frame is a square. It equals where useCollapseRadius ends a close,
  // so the handoff between the two bound values is continuous.
  const triggerRestRadius = useMotionValue(
    initialTriggerRestRadius(
      shape,
      Math.min(triggerBox.width, triggerBox.height),
    ),
  );
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const token = readVarPx(el, "--vista-sheet-trigger-radius", 9999);
    triggerRestRadius.set(
      resolveTriggerCornerRadius({
        shape,
        triggerSize: Math.min(triggerBox.width, triggerBox.height),
        token,
        cornerShapeSupported: supportsCornerShape(),
      }),
    );
  }, [
    triggerBox.width,
    triggerBox.height,
    triggerRestRadius,
    sheetRect,
    open,
    shape,
  ]);

  // Report the trigger's live rect for the escape hatch (useVistaSheet().triggerRect)
  // and for Sheet's shadow-mask morph. Also writes --vista-sheet-trigger-x/-y
  // — documented as package-written/consumer-readable — directly on the
  // wrapper without a React re-render, mirroring the source site's bloom-
  // tracking pattern.
  //
  // setTriggerRect is React state on Root, so calling it synchronously here
  // would re-render the whole Root subtree on every pointer-move frame of a
  // drag. The imperative --vista-sheet-trigger-x/-y writes stay per-frame;
  // the React commit is rAF-coalesced to at most once per frame and skipped
  // entirely when the rect hasn't moved by more than half a pixel.
  useEffect(() => {
    const commit = () => {
      rafRef.current = null;
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = rectFromBox(rect.left, rect.top, rect.width, rect.height);
      const last = lastRectRef.current;
      if (last && rectsNear(last, next, 0.5)) return;
      lastRectRef.current = next;
      setTriggerRect(next);
    };

    const update = () => {
      wrapperRef.current?.style.setProperty(
        "--vista-sheet-trigger-x",
        `${x.get()}px`,
      );
      wrapperRef.current?.style.setProperty(
        "--vista-sheet-trigger-y",
        `${y.get()}px`,
      );
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    update();
    const unsubX = x.on("change", update);
    const unsubY = y.on("change", update);
    window.addEventListener("resize", update);
    // Strawman (v0.2): a plain mount-time getBoundingClientRect() can race a
    // same-commit CSS change (here, Root's scoped --vista-sheet-trigger-size
    // <style> block) in WebKit — observed via direct instrumentation: the
    // very first rAF after mount read the trigger button's width before
    // WebKit had resolved the @media rule that sizes it, committing a
    // radius many px too small into `triggerRect` with nothing (no resize,
    // no drag) left to ever re-measure it. A ResizeObserver reports the
    // element's SETTLED box size whenever it actually changes — including
    // that first post-CSS-application resize — so it self-corrects the
    // stale first measurement without guessing a delay.
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (resizeObserver && triggerRef.current) {
      resizeObserver.observe(triggerRef.current);
    }
    return () => {
      unsubX();
      unsubY();
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [x, y, setTriggerRect]);

  // Strawman (v0.2): a rectangle's measured size is held while the sheet is
  // mounted and published at exit-complete - re-seating the wrapper
  // mid-morph compounds with the surface FLIP (see pendingResizeRef).
  const publishBox = useCallback(
    (box: TriggerBox) => {
      latestBoxRef.current = box;
      if (sheetRectRef.current !== null) return;
      const last = publishedBoxRef.current;
      if (
        last &&
        Math.abs(last.width - box.width) < 0.5 &&
        Math.abs(last.height - box.height) < 0.5
      ) {
        return;
      }
      publishedBoxRef.current = box;
      setMeasuredTriggerBox(box);
    },
    [setMeasuredTriggerBox],
  );

  // The FIRST measurement is deferred one rAF. Publishing it in the mount
  // commit forces a second commit before paint, which Motion's layoutId
  // projection treats as a real layout change and FLIPs the surface in from
  // (0,0) across the viewport. Later resizes publish immediately through the
  // ResizeObserver; by then a FLIP is intended.
  useLayoutEffect(() => {
    if (shape !== "rectangle") return;
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () =>
      publishBox({ width: el.offsetWidth, height: el.offsetHeight });
    const raf = requestAnimationFrame(measure);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    resizeObserver?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
    };
  }, [shape, publishBox]);

  useEffect(() => {
    if (sheetRect === null && latestBoxRef.current) {
      publishBox(latestBoxRef.current);
    }
  }, [sheetRect, publishBox]);

  const handlePointerDown = useCallback(() => {
    maxTravelRef.current = 0;
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDrag = useCallback((_e: unknown, info: PanInfo) => {
    const travel = Math.hypot(info.offset.x, info.offset.y);
    if (travel > maxTravelRef.current) maxTravelRef.current = travel;
  }, []);

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      setIsDragging(false);
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      const travel = Math.hypot(info.offset.x, info.offset.y);
      if (travel < DRAG_THRESHOLD_PX) {
        x.set(restingLeft(anchor, vpW, triggerBox.width));
        y.set(restingTop(anchor, vpH, triggerBox.height));
        return;
      }

      let pickedAnchor = anchor;
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        pickedAnchor = nearestAnchor(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          vpW,
          vpH,
          rect.width,
          rect.height,
        );
      }

      if (pickedAnchor !== anchor) setAnchor(pickedAnchor);

      if (reduceMotion) {
        seatAt(x, y, pickedAnchor, vpW, vpH, triggerBox);
        return;
      }
      const snapSpring = { type: "spring" as const, ...SNAP_SPRING };
      animate(x, restingLeft(pickedAnchor, vpW, triggerBox.width), snapSpring);
      animate(y, restingTop(pickedAnchor, vpH, triggerBox.height), snapSpring);
    },
    [
      anchor,
      triggerBox.width,
      triggerBox.height,
      reduceMotion,
      setAnchor,
      x,
      y,
    ],
  );

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      // e.detail === 0 covers keyboard/AT activation (Enter/Space dispatch
      // a click with no mouse behind it), which never touches maxTravelRef
      // at all — a real click only opens when THIS gesture's own travel
      // stayed under the drag threshold.
      if (e.detail !== 0 && maxTravelRef.current >= DRAG_THRESHOLD_PX) return;
      setOpen(true);
    },
    [setOpen],
  );

  const labelUnsubRef = useRef<(() => void) | null>(null);
  const attachLabelRef = useCallback(
    (el: HTMLSpanElement | null) => {
      labelUnsubRef.current?.();
      labelUnsubRef.current = null;
      if (!el) return;
      const apply = (p: number) => {
        el.style.opacity = String(triggerLabelOpacity(p));
      };
      apply(collapseProgress.get());
      labelUnsubRef.current = collapseProgress.on("change", apply);
    },
    [collapseProgress],
  );

  // Strawman (v0.2): Shared and Media ride the morph and are never faded;
  // every other direct child is the label and fades in with
  // triggerLabelOpacity as a close lands. Only direct children are
  // classified - a Shared inside a fragment or component counts as label.
  // The label stays mounted while open (opacity 0) so a label-sized trigger
  // keeps its width.
  //
  // Strawman (v0.2): under reduced motion collapseProgress jumps to 1 on
  // close, so the label shows from the first close frame while the sheet
  // crossfades out.
  const riders: ReactNode[] = [];
  const label: ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    if (
      isValidElement(child) &&
      (child.type === Shared || child.type === Media)
    ) {
      riders.push(child);
    } else {
      label.push(child);
    }
  });

  return (
    <motion.div
      ref={(el) => {
        wrapperRef.current = el;
      }}
      className={`${styles.dragWrapper} ${className ?? ""}`}
      // width/height come from .dragWrapper's CSS rule (var(--vista-sheet-
      // trigger-size)), not an inline write of `triggerSize` — an inline
      // write here would win over Root's scoped @media block regardless of
      // viewport, reproducing D3 one level down (this element is the
      // ancestor .shared[data-vista-sheet-slot="trigger"] inherits from).
      // `x`/`y` still come from the live triggerSize for position math
      // (anchors.ts) — that's unaffected by D3, which is a BOX-SIZE defect,
      // not a position one.
      style={{ x, y }}
      data-vista-sheet-part="trigger-root"
      // Lift the trigger above the sheet (z + 103) during a CLOSE. The
      // `-shared` and `-surface` layoutId pairs crossfade on different
      // springs, so the sheet-side <Shared> fades out while the opaque sheet
      // still covers the trigger-side copy; lifting lets that copy paint
      // through the gap. Close only: while open, the invisible button would
      // sit over the sheet and swallow its clicks.
      data-vista-sheet-closing={sheetRect !== null && !open ? "" : undefined}
      drag={draggable && !open ? true : false}
      dragMomentum={false}
      dragElastic={reduceMotion ? 0 : 0.06}
      dragConstraints={{
        left: 0,
        right:
          typeof window !== "undefined"
            ? window.innerWidth - triggerBox.width
            : 0,
        top: 0,
        bottom:
          typeof window !== "undefined"
            ? window.innerHeight - triggerBox.height
            : 0,
      }}
      data-vista-sheet-shape={shape}
      data-vista-sheet-button-size={
        shape === "rectangle" ? buttonSize : undefined
      }
      onPointerDown={handlePointerDown}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      <button
        ref={(el) => {
          triggerRef.current = el;
          triggerElRef.current = el;
        }}
        type="button"
        className={styles.triggerButton}
        data-vista-sheet-part="trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        id={triggerId}
        onClick={handleClick}
        data-vista-sheet-shape={shape}
        data-vista-sheet-button-size={
          shape === "rectangle" ? buttonSize : undefined
        }
        {...aria}
      >
        {!open && (
          <TriggerSurface
            as="div"
            ref={attachSurfaceRef}
            className={styles.triggerSurface}
            data-vista-sheet-shape={shape}
            restRadius={triggerRestRadius}
          />
        )}
        <TriggerSurfaceContext.Provider value={surfaceStoreRef.current}>
          <SlotContext.Provider value="trigger">
            {!open && riders}
            {label.length > 0 && (
              <span
                ref={attachLabelRef}
                className={styles.triggerLabel}
                data-vista-sheet-part="trigger-label"
              >
                {label}
              </span>
            )}
          </SlotContext.Provider>
        </TriggerSurfaceContext.Provider>
      </button>
    </motion.div>
  );
}
