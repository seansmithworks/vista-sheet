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
import type { PanInfo } from "motion/react";
import { nearestAnchor, restingLeft, restingTop } from "./anchors";
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
import { Shared } from "./Shared";
import { Media } from "./Media";
import type { TriggerProps } from "./types";
import styles from "./styles.module.css";

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
export function Trigger({ children, className, ...aria }: TriggerProps) {
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
    transition,
    triggerElRef,
    sheetRect,
    collapseRadius,
    startMorphClock,
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
  const mountedRef = useRef(false);
  const lastRectRef = useRef<{
    cx: number;
    cy: number;
    halfWidth: number;
    halfHeight: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  // Set while <Sheet> is mounted (open, or closing but not yet exit-complete
  // — Sheet.tsx nulls this at onExitComplete). While it's non-null, trigger-
  // surface may be mid-FLIP (it's the entering element on close), and this
  // wrapper's own x/y transform is an ANCESTOR of that FLIPping element —
  // jumping it instantly compounds with Motion's still-interpolating
  // projection transform on the child, producing a large multi-frame
  // desync. Defer the resize re-seat until the morph is provably over
  // rather than fighting it live.
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
    if (typeof window === "undefined") return;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const box =
      shape === "rectangle" && wrapperRef.current
        ? {
            width: wrapperRef.current.offsetWidth,
            height: wrapperRef.current.offsetHeight,
          }
        : triggerBox;
    const targetX = restingLeft(anchor, vpW, box.width);
    const targetY = restingTop(anchor, vpH, box.height);
    if (!mountedRef.current) {
      x.jump(targetX);
      y.jump(targetY);
      mountedRef.current = true;
    } else {
      x.jump(targetX);
      y.jump(targetY);
    }
  }, [anchor, shape, triggerBox.width, triggerBox.height, x, y]);

  // Resize: re-seat the trigger at its anchor's new resting position. While
  // <Sheet> is mounted (sheetRect !== null), defer instead of jumping now —
  // see pendingResizeRef above. The trigger's Shared/Media riders are gated
  // behind `{!open && ...}` below, and the label is held at opacity 0 by
  // triggerLabelOpacity, so nothing is visibly lost by waiting; the flush
  // effect re-seats at the CURRENT viewport size once the morph settles.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (sheetRect !== null) {
        pendingResizeRef.current = true;
        return;
      }
      x.jump(restingLeft(anchor, window.innerWidth, triggerBox.width));
      y.jump(restingTop(anchor, window.innerHeight, triggerBox.height));
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
    if (typeof window === "undefined") return;
    x.jump(restingLeft(anchor, window.innerWidth, triggerBox.width));
    y.jump(restingTop(anchor, window.innerHeight, triggerBox.height));
  }, [anchor, triggerBox.width, triggerBox.height, sheetRect, x, y]);

  // The trigger's RESTING shape, as a number Motion can mix from.
  //
  // Motion's shared-layout border-radius handling only sees a radius it
  // manages as an inline value — a CSS rule is invisible to it (the note on
  // the trigger surface's style binding below). The morph binding used to
  // be scoped to `sheetRect !== null`, i.e. only while a sheet exists, which
  // left the trigger carrying NO parseable radius at rest. So on every
  // open, Motion mixed the shape from 0 instead of from the circle:
  // measured on both example pages, the first painted frame of an open was
  // the trigger's box (128x128, unmoved) painted with `border-radius: 0%` —
  // a perfect circle becoming a perfect square in one frame, before any
  // growth was visible, then rounding back up over the next ~300ms
  // (roundness 1.00 -> 0.00 -> 0.14 at +130ms). That pop was the single
  // largest discontinuity in the morph.
  //
  // Publishing the resting shape as a live numeric MotionValue fixes it at
  // the source and keeps every other resting guarantee: it equals
  // min(--vista-sheet-trigger-radius, triggerSize / 2), which is a perfect
  // circle for the default 9999px token, honours a consumer's smaller
  // override, and re-derives on the trigger-size ramp's own breakpoints
  // (triggerSize is kept live across resizes by useTriggerSize). It is also
  // exactly the value useCollapseRadius's curve now ends a close on, so the
  // handoff between the two bound values is continuous — no frame where
  // they disagree.
  // Shape-aware: every shape resolves through resolveTriggerCornerRadius
  // (src/shape.ts), the circle branch of which reproduces the min(token,
  // triggerSize/2) math above exactly.
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

  // Report the trigger's live rect for the escape hatch (usePKG().triggerRect)
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
      const next = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        halfWidth: rect.width / 2,
        halfHeight: rect.height / 2,
      };
      const last = lastRectRef.current;
      if (
        last &&
        Math.abs(last.cx - next.cx) < 0.5 &&
        Math.abs(last.cy - next.cy) < 0.5 &&
        Math.abs(last.halfWidth - next.halfWidth) < 0.5 &&
        Math.abs(last.halfHeight - next.halfHeight) < 0.5
      ) {
        return;
      }
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

  // Strawman (v0.2): the FIRST measurement is deferred one rAF rather than
  // published synchronously in this layout effect (as the ResizeObserver's
  // own callback below does for every later one) — measured directly:
  // publishing it in the same commit as mount forces a SECOND React commit
  // before paint (Root's triggerBox state flows back through context), and
  // Motion's layoutId projection treats that second commit as a genuine
  // layout update rather than the settled result of a mount it hasn't
  // finished registering yet, FLIPping the surface in from (0,0) — a
  // one-time ~300ms drift across the viewport on cold load, visible in nothing
  // this package's existing (pre-rectangle) shapes ever triggered, since none
  // of them cause a second commit between a layoutId child's mount and its
  // first paint. One rAF is enough for Motion's own mount bookkeeping to
  // settle; a later resize (real box change) still applies through the
  // ResizeObserver callback with no delay, since by then there is a real,
  // intentional layout change to FLIP.
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
      const vpW = typeof window !== "undefined" ? window.innerWidth : 1440;
      const vpH = typeof window !== "undefined" ? window.innerHeight : 900;

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

      const snapSpring = reduceMotion
        ? { type: "tween" as const, duration: 0 }
        : { type: "spring" as const, ...SNAP_SPRING };

      const targetX = restingLeft(pickedAnchor, vpW, triggerBox.width);
      const targetY = restingTop(pickedAnchor, vpH, triggerBox.height);

      if (pickedAnchor !== anchor) setAnchor(pickedAnchor);

      if (reduceMotion) {
        x.jump(targetX);
        y.jump(targetY);
      } else {
        animate(x, targetX, snapSpring);
        animate(y, targetY, snapSpring);
      }
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
      // Lift the trigger's stacking context above the sheet's for the
      // duration of a CLOSE. `.dragWrapper` is `position: fixed` with a
      // z-index, so it is a stacking context: everything inside it —
      // including the trigger-side <Shared> instance — is capped at
      // `--vista-sheet-z` (100) and painted under the sheet at z + 102.
      //
      // That cap put a hole in the middle of every close. The two layoutId
      // pairs crossfade on DIFFERENT springs: `-shared` runs on
      // transition.shared (500/45 on open, DEFAULT_SHARED_CLOSE_SPRING on
      // close), `-surface` on transition.close plus
      // SURFACE_CLOSE_LEAD_DELAY_MS. Measured per frame on both example
      // pages, the sheet-side <Shared> had faded to opacity 0 by 229ms while
      // the sheet element it sits on was STILL at opacity 1 until 246ms —
      // and the trigger-side copy, already at opacity 1 since 87ms and
      // exactly co-located, was underneath that opaque sheet background.
      // Composited visibility of the shared element at its worst frame
      // (screencast pixels sampled at its live centre, 1.0 = its own
      // colour, 0.0 = fully washed to the surface behind it): 0.021 on
      // index at 238ms, 0.000 on flagship at 238ms. The crossfade was
      // correct; the compositing was not — a circle that vanished and came
      // back.
      //
      // Lifting the wrapper to z + 103 lets the trigger-side copy paint
      // through, so it covers the gap the sheet-side copy leaves: worst
      // frame 0.987 (index) / 0.981 (flagship). Both surfaces are the same
      // --vista-sheet-surface, co-located and same-radius by construction
      // mid-FLIP, so the reordered pair reads identically; the sheet's
      // content is already at opacity 0 by 80ms (CONTENT_FADE_OUT_MS), long
      // before trigger-surface has any opacity at all (0 until 121ms).
      //
      // Gated to the close, NOT to `sheetRect !== null`: while the sheet is
      // OPEN this button still renders (only its Shared/Media riders are
      // behind `{!open && ...}`; the label stays mounted at opacity 0), so
      // lifting it then would float an invisible trigger-size hit target
      // over the open sheet and swallow its clicks.
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
          <motion.div
            ref={attachSurfaceRef}
            layoutId={reduceMotion ? undefined : `${ctx.idBase}-surface`}
            className={styles.triggerSurface}
            // This trigger surface is the ENTERING element on close (it is
            // gated behind `{!open && ...}`, so it mounts only once open
            // flips false), and with a shared layoutId the entering side's
            // transition governs the FLIP. This must be transition.close,
            // not transition.open — see the matching note on Sheet.tsx's
            // layoutId transition for why the transposition mattered.
            transition={transition.close}
            // audit M2: this element is the entering side of the shared
            // layoutId on CLOSE, so it is the close's equivalent of Sheet's
            // own onLayoutAnimationStart — it starts Root's collapseProgress
            // clock inside the same frameloop pass that creates Motion's
            // layout animation, so both share a start time. No-op unless Root
            // has a morph armed. See Root.tsx's clock-coupling note.
            onLayoutAnimationStart={() => startMorphClock("trigger")}
            data-vista-sheet-part="trigger-surface"
            data-vista-sheet-shape={shape}
            // Framer Motion's shared-layout border-radius correction only
            // tracks a border-radius it manages as an inline style value —
            // it can't see the CSS module's border-radius rule. Without this,
            // the crossfade handoff from <Sheet>'s animated borderRadius
            // writes an inline `border-radius: 0` here once the FLIP settles,
            // leaving the trigger square.
            //
            // audit M1: this used to be a `var()` STRING, which Motion can't
            // parse or scale-correct, so it painted the literal 9999px
            // fallback on a sheet-sized box for the whole close regardless of
            // what RADIUS_HOLD_FRACTION/RADIUS_CLOSE_DELAY_SEC intended. The
            // fix is `ctx.collapseRadius`, a numeric MotionValue Sheet.tsx
            // relays its own hold/interpolation curve into (context.ts,
            // useCollapseRadius.ts) — bound here through Motion's `style`
            // prop specifically, not written imperatively via a ref+effect.
            // Trigger re-renders on every context change (Root's context
            // value isn't memoized), and React's own reconciler re-applies a
            // plain `style` prop's string value on each such render,
            // clobbering any manual `el.style.borderRadius` write between
            // "change" events — an earlier version of this fix did exactly
            // that and silently regressed the close back to painting
            // ~9999px most frames (caught by geometry.spec.ts's own test
            // (k), added for this fix). Binding it as a MotionValue keeps
            // Motion itself responsible for every write, bypassing React's
            // render diff.
            //
            // This line was once believed to cost geometry.spec.ts's
            // shadow-vs-surface CLOSE gate 6.1-7.4px against its 6px bound
            // (the theory being that a SECOND layoutId node carrying a live
            // numeric radius doubled Motion's per-frame correction work). It
            // does not. That overage was M2 — the shadow's collapseProgress
            // clock and Motion's layout-projection clock starting from two
            // different timestamps, an error whose magnitude scaled with how
            // much work the close commit did, which is why adding work here
            // looked causal. With the two clocks coupled (Root.tsx's
            // startMorphClock) the close measures 0.1-0.4px worst |Δtop| on
            // both example pages at every tested viewport with this binding
            // live and unchanged.
            //
            // Scoped to `sheetRect !== null` (mirrors the same signal
            // Trigger.tsx's own pendingResizeRef logic above already uses
            // for "Sheet is mounted — open, or closing but not yet exit-
            // complete") rather than bound unconditionally: collapseRadius's
            // hold/gate mechanism (RADIUS_CLOSE_DELAY_SEC, motion.ts) is
            // TIME-based, not tied to when a close visually finishes, so for
            // up to ~1.4s after a normal-speed close settles (and on first
            // page load, before any open has ever happened) it still reads
            // the SHEET's rounded-rect radius, not the trigger's circular
            // one — caught visually (a squared-off trigger at rest) before
            // this guard existed. Once Sheet's onExitComplete nulls
            // sheetRect (the morph is provably over), this falls back to
            // `undefined` and the CSS module's own resting default
            // (`var(--vista-sheet-trigger-radius, 9999px)`,
            // styles.module.css) takes over — correct immediately, no 1.4s
            // lag.
            style={{
              borderRadius:
                sheetRect !== null ? collapseRadius : triggerRestRadius,
            }}
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
