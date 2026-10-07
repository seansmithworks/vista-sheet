"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutGroup,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { DEFAULT_ANCHOR, PREVIEW_DEFAULT_SIZE, type AnchorId } from "./anchors";
import { VistaSheetContext, type VistaSheetContextValue } from "./context";
import {
  PREVIEW_TRIGGER_RADIUS_PX,
  resolveMotion,
  SURFACE_CLOSE_LEAD_DELAY_MS,
} from "./motion";
import {
  DEFAULT_BUTTON_SIZE,
  DEFAULT_TRIGGER_SHAPE,
  resolveTriggerBox,
} from "./shape";
import type { TriggerBox } from "./shape";
import type { Transition } from "motion/react";
import type { Rect, RootComponentProps, SheetRect } from "./types";
import {
  MD_BREAKPOINT,
  resolveTriggerSize,
  useTriggerSize,
  XL_BREAKPOINT,
} from "./useTriggerSize";
import { usePersistedAnchor } from "./usePersistedAnchor";
import styles from "./styles.module.css";

/**
 * <VistaSheet.Root> — owns open state, anchor state, the LayoutGroup, the
 * shared context, and the reduced-motion decision.
 *
 * Anchor is uncontrolled-only in v0.1 (docs/PACKAGE-DESIGN.md §8): the
 * consumer gets onAnchorChange as a read-only notification, never a
 * controlled pair.
 */
export function Root({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  defaultAnchor = DEFAULT_ANCHOR,
  onAnchorChange,
  draggable = true,
  persistKey,
  triggerSize: triggerSizeProp,
  preview = false,
  sheetMaxWidth = preview ? PREVIEW_DEFAULT_SIZE.width : 480,
  // Strawman (v0.2): shape lives on Root because Trigger, Sheet, Shared and
  // Shadow all need it through context, like triggerSize.
  shape: shapeProp = DEFAULT_TRIGGER_SHAPE,
  buttonSize = DEFAULT_BUTTON_SIZE,
  buttonWidth,
  preset,
  transition,
  surfaceCloseLeadDelayMs: surfaceCloseLeadDelayMsProp,
  reduceMotion: reduceMotionProp,
  id,
  zIndex = 100,
  className,
}: RootComponentProps) {
  // A missing "use client" on the file that mounts <VistaSheet.Root> can't
  // be caught here or anywhere else in this package: index.ts exports only
  // the `VistaSheet` namespace object, so the only public path is the
  // property access `VistaSheet.Root`. In an RSC app that forgot the
  // directive, React/Next resolve that access to `undefined` via a
  // client-reference stub before this component's body — or any of this
  // package's own code — ever runs. Verified: a module-level probe placed
  // in index.ts never printed in that failure path. There is nothing to
  // guard with here; the README documents the actual (misleading, generic)
  // error a consumer will see instead.
  const idBase = id ?? useId();

  // A preview card morphs out of a text link: always the rectangle case.
  const shape = preview ? "rectangle" : shapeProp;

  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const [anchor, setAnchorState] = usePersistedAnchor(
    defaultAnchor,
    persistKey,
  );
  const setAnchor = useCallback(
    (next: AnchorId) => {
      setAnchorState(next);
      onAnchorChange?.(next);
    },
    [setAnchorState, onAnchorChange],
  );

  const triggerSize = useTriggerSize(triggerSizeProp);

  // Strawman (v0.2): a rectangle's measured size is held in state here and
  // resolved against the square triggerSize by resolveTriggerBox — every
  // other shape's box is just { triggerSize, triggerSize }.
  const [measuredTriggerBox, setMeasuredTriggerBox] =
    useState<TriggerBox | null>(null);
  const triggerBox = resolveTriggerBox({
    shape,
    triggerSize,
    measured: measuredTriggerBox,
  });

  // The trigger's painted size comes from CSS, not the JS `triggerSize`:
  // that resolves at vpW=0 for hydration safety and promotes after mount,
  // but Motion snapshots the shared-layoutId box at first paint, before the
  // promotion. A scoped @media <style> built from the same ramp sizes it
  // correctly on the first frame. JS `triggerSize` only feeds position math.
  // Scoped by idBase so several Roots can't collide; deterministic from
  // props, so server and client render byte-identical CSS.
  const sizeRule = (vpW: number) =>
    `[data-vista-sheet-root="${idBase}"]{--vista-sheet-trigger-size:${resolveTriggerSize(triggerSizeProp, vpW)}px}`;
  const triggerSizeCss = `${sizeRule(0)}@media (min-width:${MD_BREAKPOINT}px){${sizeRule(MD_BREAKPOINT)}}@media (min-width:${XL_BREAKPOINT}px){${sizeRule(XL_BREAKPOINT)}}`;

  const [isDragging, setIsDragging] = useState(false);

  const systemReduceMotion = useReducedMotion();
  const reduceMotion = reduceMotionProp ?? Boolean(systemReduceMotion);

  // ── The morph clock ────────────────────────────────────────────────────
  // collapseProgress: 0 = fully open (sheet), 1 = fully closed (trigger).
  // Owned here so Trigger, Sheet, Shared and Shadow all read the same live
  // value — this is the MotionValue useVistaSheet() exposes as the escape
  // hatch (§3).
  //
  // Seeded from the mount-time `open`, and so is prevOpenRef: a Root that
  // mounts open (defaultOpen, or controlled open) renders already settled,
  // with no morph. There is no edge at mount, so nothing for the clock to
  // start and nothing a re-render during mount could strand.
  const collapseProgress = useMotionValue(open ? 0 : 1);
  const prevOpenRef = useRef(open);

  // Sheet's drag="y" gesture writes into this directly (bound as its motion
  // `y` style) so Shadow can read the live drag offset without re-measuring
  // sheetRect every drag frame (docs: the D1 fix — sheetRect is measured
  // from offsetLeft/Top, which excludes transforms by definition, so it can
  // never see a drag on its own).
  const sheetDragY = useMotionValue(0);

  // Per-field precedence: an explicit prop wins over the same field on
  // `preset`, field by field — not a whole-object override. This is what
  // lets `preset={presets.snappy} transition={{ open: mySpring }}` keep
  // snappy's close/shared and take only the caller's open.
  const surfaceCloseLeadDelayMs =
    surfaceCloseLeadDelayMsProp ??
    preset?.surfaceCloseLeadDelayMs ??
    SURFACE_CLOSE_LEAD_DELAY_MS;

  // The shared element's transition is DIRECTION-AWARE. On the open it only
  // has to clear the growing sheet; on the close it has to arrive home
  // together with the collapsing trigger, which it cannot do on the same spring
  // because the surface's close FLIP starts surfaceCloseLeadDelayMs later
  // than it does. `open` is the direction: it is already true when the open
  // morph's layout animation is created and already false when the close
  // morph's is, so reading it here picks the right spring by construction.
  // See DEFAULT_SHARED_CLOSE_SPRING for the derivation of the close default.
  // The actual field-by-field / directional-fallback merge is
  // resolveMotion (motion.ts) — pulled out of this component body so it has
  // real unit coverage (motion.test.ts) instead of only being exercised
  // through the component tree.
  const {
    open: openTransition,
    close: closeTransition,
    shared: sharedTransition,
  } = resolveMotion({
    preset,
    transition,
    surfaceCloseLeadDelayMs,
    reduceMotion,
    open,
  });

  // ── Clock coupling ─────────────────────────────────────────────────────
  // collapseProgress and Motion's layout-projection clock must start
  // together. Motion's time.now() is cached per task, so an animate() called
  // from an effect back-dates to the top of the click task, while the layout
  // animation starts later from a fresh stamp. The gap equals the commit's
  // duration, so no fixed delay can fix it. Instead the layout effect below
  // arms the morph and the entering element's onLayoutAnimationStart (Sheet
  // on open, Trigger on close) starts it, on the projection's own timestamp.
  // It re-fires when Motion restarts the layout animation mid-morph, so the
  // shadow restarts on the same frame; `from` ignores the follow node.
  const morphRef = useRef<{
    to: number;
    transition: Transition;
    started: boolean;
  } | null>(null);

  const startMorphClock = useCallback(
    (from: "trigger" | "sheet") => {
      const morph = morphRef.current;
      if (!morph) return;
      if ((morph.to === 0) !== (from === "sheet")) return;
      // Already settled on target — an unrelated layout animation on an
      // idle trigger/sheet, not a morph to re-time.
      if (morph.started && collapseProgress.get() === morph.to) return;
      morph.started = true;
      // velocity: 0 because Motion's layout-projection spring always restarts
      // at 0; inheriting the in-flight velocity would let the two clocks
      // settle apart on a reversal or mid-morph relayout. The cast: animate()
      // wants motion-dom's ValueAnimationTransition, which isn't re-exported.
      animate(collapseProgress, morph.to, {
        ...morph.transition,
        velocity: 0,
      } as never);
    },
    [collapseProgress],
  );

  // Drive collapseProgress on genuine open/close transitions only — a
  // reference change on `transition` while the sheet is already open must
  // never re-trigger the bloom.
  //
  // A LAYOUT effect, deliberately: this only arms a ref and seeds a
  // MotionValue (no animate() call, so nothing side-effecting runs in the
  // render pass), and running during the commit is what guarantees the arm
  // lands BEFORE the microtask in which Motion creates the layout animation
  // and fires onLayoutAnimationStart. A passive effect happens to run first
  // on React 19 too, but only by scheduling accident; the ordering the fix
  // depends on should be the one React actually contracts.
  useLayoutEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    const isOpening = open && !wasOpen;
    const isClosing = !open && wasOpen;

    if (isOpening || isClosing) {
      if (reduceMotion) {
        morphRef.current = null;
        collapseProgress.jump(open ? 0 : 1);
      } else {
        // A reopen during a running close must reverse from the in-flight
        // value, as the surface does; forcing 1 would snap the shadow to
        // closed.
        if (isOpening && !collapseProgress.isAnimating()) {
          collapseProgress.set(1);
        }
        morphRef.current = {
          to: isOpening ? 0 : 1,
          transition: isOpening ? openTransition : closeTransition,
          started: false,
        };
      }
    }

    // Fallback for a morph Motion never reports a layout animation for (a
    // layout that measured unchanged). Owned by the ARMED MORPH, not by the
    // edge: every run of this effect, whatever re-ran it, re-schedules the
    // rAF while the morph is armed and unstarted, and its cleanup cancels
    // only this run's frame. Scheduling it on the edge run alone let the
    // next re-render (Sheet's own setSheetRect lands right after the open
    // commit) cancel it with nothing left to re-arm it. Cannot preempt the
    // real trigger — Motion creates the layout animation in a microtask
    // after the commit, and a rAF scheduled here cannot run before that
    // microtask has drained. Cleanup also covers an unmount before the
    // next paint, so animate() never runs on a dead tree.
    const morph = morphRef.current;
    if (!morph || morph.started) return;
    const raf = requestAnimationFrame(() => {
      if (morphRef.current === morph && !morph.started) {
        startMorphClock(morph.to === 0 ? "sheet" : "trigger");
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [
    open,
    collapseProgress,
    openTransition,
    closeTransition,
    reduceMotion,
    startMorphClock,
  ]);

  const [triggerRect, setTriggerRect] = useState<Rect | null>(null);
  const [sheetRect, setSheetRect] = useState<SheetRect | null>(null);

  const triggerElRef = useRef<HTMLElement | null>(null);
  const contentScrollElRef = useRef<HTMLDivElement | null>(null);

  // The single numeric-px border-radius MotionValue both crossfade
  // participants of the shared layoutId (audit M1) read — Sheet.tsx still
  // computes the actual hold/interpolation curve itself (unchanged from
  // pre-fix), then relays every tick into this stable container so
  // Trigger.tsx's triggerSurface can bind to the exact same painted values on
  // close. Owned here (not created fresh inside Sheet) purely so it's a
  // stable instance context can hand to both components regardless of
  // either one's mount lifecycle.
  const collapseRadius = useMotionValue(48);

  const closeRegisteredRef = useRef(0);
  const registerClose = useCallback(() => {
    closeRegisteredRef.current += 1;
    return () => {
      closeRegisteredRef.current = Math.max(0, closeRegisteredRef.current - 1);
    };
  }, []);
  const hasRegisteredClose = useCallback(
    () => closeRegisteredRef.current > 0,
    [],
  );

  // Preview only. Sheet and Shadow portal into ONE body-level layer, which
  // exists only while a card is armed (hover intent running), open or
  // morphing closed. Arming it ahead of the open is what lets it exist in
  // the commit the card mounts in.
  const [layerArmed, setLayerArmed] = useState(false);
  const [layerEl, setLayerEl] = useState<HTMLElement | null>(null);
  const previewPointerRef = useRef({ x: 0, y: 0 });

  const triggerId = `${idBase}-trigger`;
  const sheetId = `${idBase}-sheet`;

  const contextValue: VistaSheetContextValue = {
    open,
    setOpen,
    anchor,
    setAnchor,
    isDragging,
    setIsDragging,
    draggable,
    triggerSize,
    sheetMaxWidth,
    shape,
    buttonSize,
    triggerBox,
    setMeasuredTriggerBox,
    reduceMotion,
    zIndex,
    idBase,
    triggerId,
    sheetId,
    collapseProgress,
    collapseRadius,
    triggerRect,
    setTriggerRect,
    sheetRect,
    setSheetRect,
    sheetDragY,
    startMorphClock,
    transition: {
      open: openTransition,
      close: closeTransition,
      shared: sharedTransition,
    },
    registerClose,
    hasRegisteredClose,
    triggerElRef,
    preview,
    layerEl,
    setLayerArmed,
    previewPointerRef,
    contentScrollElRef,
  };

  if (preview) {
    // A <span>, so a link inside a <p> is valid HTML. Theme vars and the
    // consumer's className live on the layer, which is where the card renders.
    return (
      <VistaSheetContext.Provider value={contextValue}>
        <LayoutGroup id={idBase}>
          <span>
            {children}
            {(layerArmed || open || sheetRect !== null) &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={setLayerEl}
                  className={`${styles.previewLayer} ${className ?? ""}`}
                  data-vista-sheet-root={idBase}
                  style={{
                    ["--vista-sheet-z" as string]: String(zIndex),
                    ["--vista-sheet-sheet-max-width" as string]: `${sheetMaxWidth}px`,
                    ["--vista-sheet-preview-radius" as string]: `${PREVIEW_TRIGGER_RADIUS_PX}px`,
                  }}
                />,
                document.body,
              )}
          </span>
        </LayoutGroup>
      </VistaSheetContext.Provider>
    );
  }

  return (
    <VistaSheetContext.Provider value={contextValue}>
      <LayoutGroup id={idBase}>
        <style>{triggerSizeCss}</style>
        <div
          className={className}
          data-vista-sheet-root={idBase}
          style={{
            // The one ancestor of both <Trigger> and <Sheet>, so both inherit
            // these. --vista-sheet-trigger-size is deliberately absent: an
            // inline write would beat the scoped <style> block's @media rules.
            ["--vista-sheet-z" as string]: String(zIndex),
            ["--vista-sheet-sheet-max-width" as string]: `${sheetMaxWidth}px`,
            ...(buttonWidth !== undefined
              ? { ["--vista-sheet-button-width" as string]: `${buttonWidth}px` }
              : {}),
          }}
        >
          {children}
        </div>
      </LayoutGroup>
    </VistaSheetContext.Provider>
  );
}
