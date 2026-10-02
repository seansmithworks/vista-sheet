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
import { previewSheetPlacement, sheetPlacement } from "./anchors";
import type { SheetPlacement } from "./anchors";
import { SlotContext, useVistaSheetInternal } from "./context";
import {
  CLOSE_REVEAL_PROGRESS,
  SWIPE_OFFSET_PX,
  SWIPE_VELOCITY_PX_S,
} from "./motion";
import { useCollapseRadius } from "./useCollapseRadius";
import { Layer } from "./Layer";
import { useDialogBehavior } from "./useDialogBehavior";
import type { SheetProps, SheetRect } from "./types";
import styles from "./styles.module.css";

// `process` is not declared in a Vite consumer's tsconfig (`types` is an
// allowlist, so @types/node never loads). Declare it locally rather than
// depending on the consumer's ambient globals.
declare const process: { env: { NODE_ENV?: string } };

/**
 * <VistaSheet.Sheet> — the modal surface. Shares the trigger's layoutId so
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
  const ctx = useVistaSheetInternal("Sheet");
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

  // Outlives `open` through the whole close animation: `open` flips false
  // the instant a close is REQUESTED, but AnimatePresence keeps the panel
  // mounted and interactive until onExitComplete below. useDialogBehavior's
  // scroll lock, background aria-hiding and Tab trap key on this, not on
  // `open`, so they stay live for exactly as long as the panel is actually
  // on screen. Seeded from `open` so a defaultOpen mount doesn't need a
  // first render + effect round trip to become present.
  const [isPresent, setIsPresent] = useState(open);
  useEffect(() => {
    if (open) setIsPresent(true);
  }, [open]);

  useDialogBehavior({
    isOpen: open,
    isPresent,
    panelRef: sheetRef,
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

  // data-vista-sheet-settled no longer gates any style of ours — the sheet
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
      sheetRef.current?.hasAttribute("data-vista-sheet-settled") ?? false;
    const apply = (v: number) => {
      const next = open && v <= CLOSE_REVEAL_PROGRESS;
      if (next === settled) return;
      settled = next;
      sheetRef.current?.toggleAttribute("data-vista-sheet-settled", next);
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
        "[vista-sheet] <VistaSheet.Sheet> opened with no <VistaSheet.Close> registered. " +
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
  const lastSheetRectRef = useRef<SheetRect | null>(null);
  const measureSheetRect = useCallback(
    (force: boolean) => {
      const el = sheetRef.current;
      if (!el) return;
      const next: SheetRect = {
        cx: el.offsetLeft + el.offsetWidth / 2,
        cy: el.offsetTop + el.offsetHeight / 2,
        halfWidth: el.offsetWidth / 2,
        halfHeight: el.offsetHeight / 2,
      };
      const last = lastSheetRectRef.current;
      if (
        !force &&
        last &&
        Math.abs(last.cx - next.cx) < 0.25 &&
        Math.abs(last.cy - next.cy) < 0.25 &&
        Math.abs(last.halfWidth - next.halfWidth) < 0.25 &&
        Math.abs(last.halfHeight - next.halfHeight) < 0.25
      ) {
        return;
      }
      lastSheetRectRef.current = next;
      setSheetRect(next);
    },
    [setSheetRect],
  );

  useLayoutEffect(() => {
    if (!open) return;
    measureSheetRect(true);
  }, [open, measureSheetRect]);

  // The sheet's own box can change AFTER the open commit that measured it —
  // a web font landing, an image finishing, a scrollbar appearing. Motion's
  // layout projection re-targets the surface on that relayout; without this,
  // Shadow.tsx keeps interpolating toward the box measured above and holds
  // the resulting error for the rest of the morph and beyond (measured on
  // the flagship example at 390x844: the sheet's first open grew 592 -> 618px
  // when its text fonts landed ~40ms in, and the shadow sat 26px off the
  // surface from that frame onward — the second open, fonts cached, tracked
  // to 0.2px). A callback ref rather than an effect so the observer's
  // lifetime is exactly the sheet element's own: attached while it is in the
  // DOM, still attached through the whole exit animation (same principle as
  // the resize listener below), detached when React removes the node.
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

  // Resize listener, deliberately NOT gated on `open`: the sheet DOM node
  // stays mounted for the entire close animation (AnimatePresence only
  // removes it once the exit finishes), and its CSS geometry (`bottom: 16px`
  // etc.) keeps re-laying-out live if the viewport resizes mid-close —
  // Trigger.tsx's resting position re-seats on the very same resize. Gating this
  // listener's registration on `open` (the previous shape: one effect doing
  // both the initial measure AND the listener, keyed on [open]) tore the
  // listener down the INSTANT `open` flipped false, i.e. exactly when the
  // close starts, freezing the sheet's cached rect for the whole ~1s close
  // while the trigger re-seated live — reproduced a 481.7px Δtop. Same
  // principle as sheetRect's own release below: state a leaving element's
  // siblings still need is released on completion, never on the state
  // change that begins the exit.
  useEffect(() => {
    const measure = () => measureSheetRect(true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [measureSheetRect]);

  // Extracted (audit M1) so the exact same hold/interpolation curve is
  // available to Trigger.tsx's triggerSurface too — see useCollapseRadius.ts.
  // Called from HERE (not hoisted to Root) deliberately: same component,
  // same hook position, same effect-commit ordering relative to Sheet's
  // other effects (sheetRect measurement, the resize listener) as before
  // this fix existed. Moving the CALL SITE to Root while keeping the hook's
  // logic identical measurably cost geometry.spec.ts's close-tracking gate
  // ~3-4px — apparently from the ordering shift itself, not from anything
  // about the computation. The effect below relays every tick into
  // ctx.collapseRadius (a stable container Root owns) so Trigger.tsx can bind
  // to the exact same painted values on close without needing this hook
  // called from its own position in the tree.
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

  const vpW = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vpH = typeof window !== "undefined" ? window.innerHeight : 900;
  const modalPlacement = sheetPlacement(
    anchor,
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
    ["--vista-sheet-sheet-left" as string]: `${placement.anchorX}px`,
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
    if (!dismissOnSwipe) return;
    const scrollTop = contentScrollElRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    if (
      info.offset.y > SWIPE_OFFSET_PX ||
      info.velocity.y > SWIPE_VELOCITY_PX_S
    ) {
      // Once AnimatePresence starts the exit, the box's PAINTED position is
      // governed by the layoutId FLIP target, not by the drag gesture's own
      // y value — but the drag's elastic release/snap-back animation on
      // sheetDragY keeps running in the background regardless, still
      // updating a value nothing renders anymore. Shadow.tsx reads that
      // value live, so it kept tracking a phantom in-flight release while
      // the actual surface sat frozen at its lead-delay hold position — a
      // flat ~30px error across the whole swipe-dismiss close. stop()
      // freezes sheetDragY at exactly the value it holds at the moment of
      // dismiss (matching where the surface is actually still painted, mid
      // elastic-drag, right up until the FLIP takes over).
      sheetDragY.stop();
      setOpen(false);
    }
  }

  return (
    <Layer>
      {/* Invisible click-catcher for outside-click dismissal — not a
          visible scrim. <VistaSheet.Backdrop> (a visual dim layer) is cut
          from v0.1 (docs/PACKAGE-DESIGN.md §8); dismiss-on-outside-click is
          Root/Sheet behavior and costs nothing visually by default.
          Deliberately a SIBLING of <AnimatePresence>, gated on `open` alone
          (audit M11) — the previous shape rendered this inside
          AnimatePresence's `{open && ...}` child, so it survived the whole
          exit animation at zIndex + 101 (above the trigger's zIndex 100),
          eating every click/tap over the trigger for the ~400-1000ms the close
          spring/hold takes to settle. Gating on `open` alone means the
          backdrop unmounts the instant the close STARTS, so the trigger is
          tappable — and the close interruptible — from frame one. */}
      {open && modal && dismissOnBackdrop && (
        <div
          aria-hidden="true"
          data-vista-sheet-part="backdrop"
          style={{ position: "fixed", inset: 0, zIndex: zIndex + 101 }}
          onClick={() => setOpen(false)}
        />
      )}
      <AnimatePresence
        onExitComplete={() => {
          if (modal) triggerElRef.current?.focus();
          // Exit-complete is when the close morph is actually done — the
          // correct moment to drop sheetRect (see the measure effect above)
          // and to release the scroll lock / aria-hiding / Tab trap that
          // isPresent keeps alive through the animation.
          setSheetRect(null);
          setIsPresent(false);
        }}
      >
        {open && (
          <motion.div
            ref={attachSheetRef}
            id={sheetId}
            className={`${styles.sheet} ${className ?? ""}`}
            data-vista-sheet-part="sheet"
            data-vista-sheet-shape={shape}
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
                  // The SHEET is the entering element on open (Trigger's surface
                  // is the entering element on close, gated behind
                  // `{!open && ...}`), and with a shared layoutId the
                  // ENTERING side's transition governs the FLIP. This must be
                  // transition.open, not transition.close — passing .close
                  // here made the open morph run the close spring (plus its
                  // baked-in SURFACE_CLOSE_LEAD_DELAY_MS) while
                  // collapseProgress ran the open spring with no delay,
                  // which is why the shadow silhouette and this box visibly
                  // separated on open.
                  transition: transition.open,
                  // audit M2: this element is the entering side of the shared
                  // layoutId on OPEN, so its layout animation is the one that
                  // moves the box — starting Root's collapseProgress clock
                  // from here puts both animations in the same frameloop pass
                  // with the same start time. Root ignores this unless it has
                  // a morph armed, so the layout animations Motion runs for
                  // anything else (a resize-driven relayout, say) can't
                  // re-trigger the bloom. See Root.tsx's clock-coupling note.
                  onLayoutAnimationStart: () => startMorphClock("sheet"),
                  style: {
                    // Bound directly to the locally-computed value (not the
                    // relayed ctx.collapseRadius container Trigger.tsx reads) —
                    // zero extra hop for this element's own paint.
                    borderRadius: sheetBorderRadius,
                    zIndex: zIndex + 102,
                    // Bound as our own MotionValue (not left for Motion's
                    // drag gesture to create internally) so Shadow.tsx can
                    // subscribe to the live drag offset — see the D1 fix
                    // note on sheetDragY in context.ts.
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
    </Layer>
  );
}
