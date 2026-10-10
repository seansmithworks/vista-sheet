"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  previewSheetPlacement,
  rectFromBox,
  rectsNear,
  sheetPlacement,
} from "./anchors";
import type { SheetPlacement } from "./anchors";
import { SlotContext, useIrisInternal } from "./context";
import {
  CLOSE_REVEAL_PROGRESS,
  SWIPE_OFFSET_PX,
  SWIPE_VELOCITY_PX_S,
} from "./motion";
import { useCollapseRadius } from "./useCollapseRadius";
import { Layer } from "./Layer";
import { useDialogBehavior } from "./useDialogBehavior";
import type { Rect, SheetProps } from "./types";
import styles from "./styles.module.css";

// `process` is not declared in a Vite consumer's tsconfig (`types` is an
// allowlist, so @types/node never loads). Declare it locally rather than
// depending on the consumer's ambient globals.
declare const process: { env: { NODE_ENV?: string } };

/**
 * <Iris.Sheet> — the modal surface. Shares the trigger's layoutId so
 * Motion FLIPs the box between the two, and drives border-radius as a pure
 * function of collapseProgress (docs/PACKAGE-DESIGN.md §3) rather than an
 * independent spring, so the trigger shape can never appear before the box has
 * actually contracted.
 */
export function Sheet({
  children,
  className,
  dismissOnSwipe = true,
  dismissOnBackdrop = true,
  aspectRatio,
  initialFocus,
  ...labelled
}: SheetProps) {
  const ctx = useIrisInternal("Sheet");
  const {
    open,
    setOpen,
    anchor,
    triggerBox,
    sheetMaxWidth,
    shape,
    reduceMotion,
    zIndex,
    idBase,
    sheetId,
    collapseProgress,
    setSheetRect,
    sheetDragY,
    transition,
    triggerElRef,
    contentScrollElRef,
    hasRegisteredClose,
    collapseRadius,
    startMorphClock,
    preview,
    triggerRect,
    previewPointerRef,
  } = ctx;
  // A preview card is non-modal: no backdrop, swipe or focus move.
  const modal = !preview;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // Outlives `open` through the whole close animation: `open` flips false
  // the instant a close is REQUESTED, but AnimatePresence keeps the panel
  // mounted and interactive until onExitComplete below. useDialogBehavior's
  // scroll lock and the focus guards key on this, not on `open`, so they
  // stay live for exactly as long as the panel is actually on screen (the
  // inert page keys on `open`; see useDialogBehavior). Seeded from `open`
  // so a defaultOpen mount doesn't need a first render + effect round trip
  // to become present.
  const [isPresent, setIsPresent] = useState(open);
  useEffect(() => {
    if (open) setIsPresent(true);
  }, [open]);

  const { startGuardRef, endGuardRef, onStartGuardFocus, onEndGuardFocus } =
    useDialogBehavior({
      isOpen: open,
      isPresent,
      panelRef: sheetRef,
      backdropRef,
      collapseProgress,
      onClose: () => setOpen(false),
      initialFocus,
      modal,
      triggerRef: triggerElRef,
    });

  // Reset the drag offset on every open — a value left over from the
  // previous open's drag (or its dismiss) must not leak into a fresh mount;
  // Shadow.tsx reads sheetDragY unconditionally, even before the user has
  // dragged at all this time.
  useEffect(() => {
    if (open) sheetDragY.jump(0);
  }, [open, sheetDragY]);

  // data-orrery-iris-settled no longer gates any style of ours — the sheet
  // paints no box-shadow of its own (Shadow.tsx is the single painter, see
  // .sheet in styles.module.css), and <Close> tracks its own reveal off
  // collapseProgress directly rather than this attribute. It's kept as a DOM
  // marker at the same CLOSE_REVEAL_PROGRESS threshold for consumers/tests to
  // hook: present once the open has settled, dropped the moment a close
  // starts. Written to the DOM directly, and only on change, so the per-frame
  // collapseProgress ticks never re-render or re-style the sheet.
  useEffect(() => {
    // Seeded from the DOM, not false: this effect re-runs when `open` flips,
    // and a fresh false would match the closing state and skip the removal.
    let settled =
      sheetRef.current?.hasAttribute("data-orrery-iris-settled") ?? false;
    const apply = (v: number) => {
      const next = open && v <= CLOSE_REVEAL_PROGRESS;
      if (next === settled) return;
      settled = next;
      sheetRef.current?.toggleAttribute("data-orrery-iris-settled", next);
    };
    apply(collapseProgress.get());
    return collapseProgress.on("change", apply);
  }, [open, collapseProgress]);

  useEffect(() => {
    if (
      open &&
      modal &&
      process.env.NODE_ENV !== "production" &&
      !hasRegisteredClose()
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[orrery-iris] <Iris.Sheet> opened with no <Iris.Close> registered. " +
          "Escape and backdrop dismissal are not a substitute for a visible close control.",
      );
    }
  }, [open, modal, hasRegisteredClose]);

  // Measure the sheet's settled CSS geometry (offsetLeft/Top, not
  // getBoundingClientRect — the latter includes the in-flight FLIP transform
  // and would produce a jumping rect). `force` skips the unchanged-box guard,
  // for the callers that must publish a rect even if it matches the last one
  // (the open below, after sheetRect has been released to null on the
  // previous exit-complete).
  const lastSheetRectRef = useRef<Rect | null>(null);
  const measureSheetRect = useCallback(
    (force: boolean) => {
      const el = sheetRef.current;
      if (!el) return;
      const next = rectFromBox(
        el.offsetLeft,
        el.offsetTop,
        el.offsetWidth,
        el.offsetHeight,
      );
      const last = lastSheetRectRef.current;
      if (!force && last && rectsNear(last, next, 0.25)) return;
      lastSheetRectRef.current = next;
      setSheetRect(next);
    },
    [setSheetRect],
  );

  useLayoutEffect(() => {
    if (!open) return;
    measureSheetRect(true);
  }, [open, measureSheetRect]);

  // The sheet's box can change after the open commit measured it (a font
  // landing, an image loading). Motion re-targets the surface on that
  // relayout, so Shadow needs the new rect too. A callback ref, so the
  // observer lives exactly as long as the node, exit animation included.
  const sheetResizeObserverRef = useRef<ResizeObserver | null>(null);
  const attachSheetRef = useCallback(
    (node: HTMLDivElement | null) => {
      sheetRef.current = node;
      sheetResizeObserverRef.current?.disconnect();
      sheetResizeObserverRef.current = null;
      if (!node || typeof ResizeObserver === "undefined") {
        lastSheetRectRef.current = null;
        return;
      }
      const observer = new ResizeObserver(() => measureSheetRect(false));
      observer.observe(node);
      sheetResizeObserverRef.current = observer;
    },
    [measureSheetRect],
  );

  // Not gated on `open`: the node stays mounted and re-lays-out through the
  // whole close, so a resize mid-close must still re-measure it. State a
  // leaving element's siblings need is released on exit-complete, never
  // when the exit begins.
  useEffect(() => {
    const measure = () => measureSheetRect(true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [measureSheetRect]);

  // Called here, not hoisted to Root: moving the call site shifts effect
  // order and cost the close-tracking gate ~3-4px. The effect below relays
  // every tick into ctx.collapseRadius so Trigger can bind the same values.
  const sheetBorderRadius = useCollapseRadius({
    collapseProgress,
    open,
    shape,
    triggerSize: Math.min(triggerBox.width, triggerBox.height),
    varsElRef: sheetRef,
  });

  useEffect(() => {
    collapseRadius.set(sheetBorderRadius.get());
    return sheetBorderRadius.on("change", (v) => collapseRadius.set(v));
  }, [sheetBorderRadius, collapseRadius]);

  // A sheet on screen holds the placement of the anchor it opened at: a
  // setAnchor() while it is open re-seats the hidden trigger, and the close
  // morph carries the sheet there, instead of the open sheet sliding across
  // the viewport. Taken at every open edge (including a reopen mid-close)
  // and whenever no panel is present.
  const placedAnchorRef = useRef(anchor);
  const placedOpenRef = useRef(open);
  if (!isPresent || (open && !placedOpenRef.current)) {
    placedAnchorRef.current = anchor;
  }
  placedOpenRef.current = open;

  const vpW = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 900;
  const modalPlacement = sheetPlacement(
    placedAnchorRef.current,
    vpW,
    vpH,
    triggerBox.width,
    sheetMaxWidth,
    aspectRatio,
  );
  // A preview card is placed once, at open, and holds that spot through the
  // close: re-placing against a link that scrolled would slide it mid-exit.
  const heldRef = useRef<SheetPlacement | null>(null);
  const placed = useMemo(
    () =>
      preview && open && triggerRect
        ? previewSheetPlacement(
            previewPointerRef.current,
            triggerRect,
            vpW,
            vpH,
            sheetMaxWidth,
            aspectRatio,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, open],
  );
  if (placed) heldRef.current = placed;
  const placement = (preview && heldRef.current) || modalPlacement;

  // Always written (never conditionally), all five properties, as direct
  // inline properties rather than a var — that's what lets a top-pinned,
  // bottom-pinned, or both-pinned (center) anchor all resolve correctly
  // regardless of cascade order, with no per-anchor branch here. maxHeight
  // is derived per anchor by sheetPlacement (anchors.ts) — the CSS default
  // in .sheet only covers the pre-hydration/SSR fallback. width/height are
  // written unconditionally too — framer-motion never clears an inline
  // style when its key leaves the style prop, so an aspectRatio sheet that
  // closes and reopens without one must see the SHEET_DEFAULT_* strings
  // written back explicitly rather than relying on the value disappearing.
  const placementStyle: Record<string, string> = {
    ["--orrery-iris-sheet-left" as string]: `${placement.anchorX}px`,
    top: placement.topPx !== undefined ? `${placement.topPx}px` : "auto",
    bottom:
      placement.bottomPx !== undefined ? `${placement.bottomPx}px` : "auto",
    maxHeight: placement.maxHeight,
    width: placement.width,
    height: placement.height,
  };

  function handleDragEnd(
    _e: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) {
    const scrollTop = contentScrollElRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    if (
      info.offset.y > SWIPE_OFFSET_PX ||
      info.velocity.y > SWIPE_VELOCITY_PX_S
    ) {
      // Once the exit starts the FLIP owns the painted box, but the drag's
      // release animation keeps moving sheetDragY, which Shadow reads.
      // Freeze it where the surface is actually painted.
      sheetDragY.stop();
      setOpen(false);
    }
  }

  // `open ||`: isPresent only catches up an effect after the open commit,
  // and the guards must exist in that commit so the inert walk keeps them.
  const focusGuard = (
    ref: typeof startGuardRef,
    onFocus: typeof onStartGuardFocus,
  ) =>
    modal && (open || isPresent) ? (
      <span
        ref={ref}
        tabIndex={0}
        aria-hidden="true"
        data-orrery-iris-focus-guard=""
        style={{ position: "fixed", width: 1, height: 1, overflow: "hidden" }}
        onFocus={onFocus}
      />
    ) : null;

  return (
    <Layer>
      {/* Invisible click-catcher for outside-click dismissal, not a scrim.
          Outside AnimatePresence and gated on `open` alone, so it unmounts
          the instant a close starts and the trigger stays tappable (and the
          close interruptible) from the first frame. */}
      {open && modal && dismissOnBackdrop && (
        <div
          ref={backdropRef}
          aria-hidden="true"
          data-orrery-iris-part="backdrop"
          style={{ position: "fixed", inset: 0, zIndex: zIndex + 101 }}
          onClick={() => setOpen(false)}
        />
      )}
      {focusGuard(startGuardRef, onStartGuardFocus)}
      {/* initial={false}: a sheet already open when this first renders (a
          Root mounted open) is at rest — its content, items and Close skip
          their entrance. Later opens are unaffected. */}
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          // Only reclaim focus that the close left stranded (on the body, or
          // still in the leaving panel). The page is live from the close
          // request, so a control the user clicked mid-close keeps focus.
          const active = document.activeElement;
          if (
            modal &&
            (!active ||
              active === document.body ||
              sheetRef.current?.contains(active))
          ) {
            triggerElRef.current?.focus();
          }
          // Exit-complete is when the close morph is actually done — the
          // correct moment to drop sheetRect (see the measure effect above)
          // and to release the scroll lock / focus guards that isPresent
          // keeps alive through the animation.
          setSheetRect(null);
          setIsPresent(false);
        }}
      >
        {open && (
          <motion.div
            ref={attachSheetRef}
            id={sheetId}
            className={`${styles.sheet} ${className ?? ""}`}
            data-orrery-iris-part="sheet"
            data-orrery-iris-shape={shape}
            {...(modal
              ? { role: "dialog", "aria-modal": "true", tabIndex: -1 }
              : { "aria-hidden": true })}
            {...labelled}
            {...(reduceMotion
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.2 },
                  style: { zIndex: zIndex + 102, ...placementStyle },
                }
              : {
                  layoutId: `${idBase}-surface`,
                  // The entering element on open governs the FLIP, so this is
                  // transition.open, matching collapseProgress's spring.
                  transition: transition.open,
                  // Starts Root's collapseProgress clock in the same frameloop
                  // pass as this layout animation (Root's clock-coupling note).
                  onLayoutAnimationStart: () => startMorphClock("sheet"),
                  style: {
                    borderRadius: sheetBorderRadius,
                    zIndex: zIndex + 102,
                    // Our own MotionValue, so Shadow can read the drag offset.
                    y: sheetDragY,
                    ...placementStyle,
                  },
                })}
            drag={reduceMotion || !modal || !dismissOnSwipe ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
          >
            <SlotContext.Provider value="sheet">
              {children}
            </SlotContext.Provider>
          </motion.div>
        )}
      </AnimatePresence>
      {focusGuard(endGuardRef, onEndGuardFocus)}
    </Layer>
  );
}
