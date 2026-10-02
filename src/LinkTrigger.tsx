"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { ReactElement, SyntheticEvent } from "react";
import { motion, useMotionValue } from "motion/react";
import { useVistaSheetInternal } from "./context";
import {
  PREVIEW_CLOSE_GRACE_MS,
  PREVIEW_HOVER_INTENT_MS,
  PREVIEW_LONG_PRESS_MS,
  PREVIEW_LONG_PRESS_SLOP_PX,
  PREVIEW_TRIGGER_RADIUS_PX,
} from "./motion";
import { mergeShadowRef } from "./Shadow";
import styles from "./styles.module.css";

/**
 * One card open at a time, across every preview Root on the page: opening a
 * card closes the one before it. Only touched from event handlers and timers,
 * so it is SSR-safe.
 */
let closeCurrent: (() => void) | null = null;

type ChildProps = Record<string, unknown> & {
  children?: unknown;
  className?: string;
  ref?: React.Ref<HTMLElement>;
};

/** Run the consumer's own handler first, then ours. */
function compose<E extends SyntheticEvent>(
  theirs: unknown,
  ours: (e: E) => void,
) {
  return (e: E) => {
    if (typeof theirs === "function") theirs(e);
    ours(e);
  };
}

/**
 * LinkTrigger — preview mode's trigger. The consumer's single `<a>` child IS
 * the trigger: it keeps being an ordinary link (focus, navigation, its own
 * name), and gains hover intent, keyboard-focus intent, and touch long-press.
 *
 * The morph surface (the shared-layoutId element the card grows out of and
 * shrinks back into) is a transparent span injected into the link. A link
 * that wraps across lines is several boxes, and an absolutely-positioned
 * child of an inline sizes against first-box-start to last-box-end, which is
 * not any box the reader sees. So the surface is pinned, with inline
 * left/top/width/height, to the ONE line box under the pointer, from
 * intent-start on — at least one hover-intent beat before the open. The
 * card's `triggerRect` is that same line box, never the link's union rect.
 *
 * Every close lands the surface on the link's CURRENT line box: the surface
 * remounts on close (re-pinned as it attaches) and a layout effect
 * re-measures `triggerRect` in the same commit, so a card dismissed by
 * scrolling returns to where the link now is.
 */
export function LinkTrigger({ children }: { children: ReactElement }) {
  const ctx = useVistaSheetInternal("Trigger");
  const {
    open,
    setOpen,
    idBase,
    sheetId,
    sheetRect,
    collapseRadius,
    reduceMotion,
    transition,
    startMorphClock,
    setTriggerRect,
    setLayerArmed,
    triggerElRef,
    previewPointerRef,
  } = ctx;

  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error("<VistaSheet.Trigger asChild> needs a single element child.");
  }
  const childProps = child.props as ChildProps;

  const linkRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLSpanElement | null>(null);
  const lineRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const openRef = useRef(open);
  openRef.current = open;
  // How the open was started: "pointer" cards close on leave, "touch" and
  // "keyboard" ones do not.
  const modeRef = useRef<"pointer" | "touch" | "keyboard">("pointer");
  const intentRef = useRef<number | undefined>(undefined);
  const graceRef = useRef<number | undefined>(undefined);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const restRadius = useMotionValue(PREVIEW_TRIGGER_RADIUS_PX);

  const childRefRef = useRef(childProps.ref);
  childRefRef.current = childProps.ref;
  const attachLink = useCallback(
    (node: HTMLElement | null) => {
      linkRef.current = node;
      triggerElRef.current = node;
      mergeShadowRef(childRefRef.current, () => {})(node);
    },
    [triggerElRef],
  );

  // The client rect of line `lineRef` (clamped), and the first line's, which
  // is the origin an absolutely-positioned child of an inline measures from.
  const lineRects = () => {
    const rects = linkRef.current?.getClientRects();
    if (!rects || rects.length === 0) return null;
    return { line: rects[Math.min(lineRef.current, rects.length - 1)], first: rects[0] };
  };

  // Choose the line under clientY (the first, when none is) and pin the
  // surface to it.
  const pin = (clientY?: number) => {
    const rects = linkRef.current?.getClientRects();
    if (rects && clientY !== undefined) {
      const hit = Array.from(rects).findIndex(
        (r) => clientY >= r.top && clientY <= r.bottom,
      );
      lineRef.current = Math.max(hit, 0);
    }
    const found = lineRects();
    const surface = surfaceRef.current;
    if (!found || !surface) return;
    surface.style.left = `${found.line.left - found.first.left}px`;
    surface.style.top = `${found.line.top - found.first.top}px`;
    surface.style.width = `${found.line.width}px`;
    surface.style.height = `${found.line.height}px`;
  };

  const attachSurface = useCallback((node: HTMLSpanElement | null) => {
    surfaceRef.current = node;
    if (node) pin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measureLine = () => {
    const found = lineRects();
    if (!found) return null;
    const { left, top, width, height } = found.line;
    return {
      cx: left + width / 2,
      cy: top + height / 2,
      halfWidth: width / 2,
      halfHeight: height / 2,
    };
  };

  const clearTimers = () => {
    window.clearTimeout(intentRef.current);
    window.clearTimeout(graceRef.current);
    intentRef.current = graceRef.current = undefined;
  };

  const hide = useCallback(() => {
    clearTimers();
    setLayerArmed(false);
    setOpen(false);
  }, [setLayerArmed, setOpen]);
  const hideRef = useRef(hide);
  hideRef.current = hide;
  const closeSelf = useCallback(() => hideRef.current(), []);

  const show = () => {
    clearTimers();
    const rect = measureLine();
    if (!rect) return;
    pin();
    previewPointerRef.current = pointerRef.current;
    setTriggerRect(rect);
    if (closeCurrent && closeCurrent !== closeSelf) closeCurrent();
    closeCurrent = closeSelf;
    setLayerArmed(false);
    setOpen(true);
  };

  // Arm the layer now so it is in the DOM by the time the card mounts.
  const startIntent = (delayMs: number, onFire: () => void) => {
    window.clearTimeout(intentRef.current);
    setLayerArmed(true);
    intentRef.current = window.setTimeout(onFire, delayMs);
  };
  const cancelIntent = () => {
    if (intentRef.current === undefined) return;
    window.clearTimeout(intentRef.current);
    intentRef.current = undefined;
    setLayerArmed(false);
  };

  // Every close, however it started (Escape, an outside press, a scroll, the
  // grace timer, blur), re-measures the link's current line box in the same
  // commit the surface remounts in, so Shadow and the surface head for the
  // same place even after the page has scrolled.
  const wasOpenRef = useRef(open);
  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!wasOpen || open) return;
    pin();
    const rect = measureLine();
    if (rect) setTriggerRect(rect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (closeCurrent === closeSelf) closeCurrent = null;
      return;
    }
    // Hoverable card (WCAG 1.4.13): a card opened by the pointer stays while
    // the pointer is on the link or the card, and closes a grace period
    // after it leaves both, so crossing the gap between them is allowed.
    if (modeRef.current !== "pointer") return;
    const startGrace = () => {
      if (graceRef.current === undefined) {
        graceRef.current = window.setTimeout(hide, PREVIEW_CLOSE_GRACE_MS);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = e.target;
      const inside =
        t instanceof Node &&
        (linkRef.current?.contains(t) === true ||
          document.getElementById(sheetId)?.contains(t) === true);
      if (inside) {
        window.clearTimeout(graceRef.current);
        graceRef.current = undefined;
      } else startGrace();
    };
    document.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", startGrace);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", startGrace);
      window.clearTimeout(graceRef.current);
      graceRef.current = undefined;
    };
  }, [open, sheetId, hide, closeSelf]);

  useEffect(
    () => () => {
      clearTimers();
      if (closeCurrent === closeSelf) closeCurrent = null;
    },
    [closeSelf],
  );

  const cancelPress = () => {
    pressRef.current = null;
    if (!longPressedRef.current) cancelIntent();
  };

  const handlers = {
    onPointerEnter: compose<React.PointerEvent>(
      childProps.onPointerEnter,
      (e) => {
        if (e.pointerType === "touch") return;
        pointerRef.current = { x: e.clientX, y: e.clientY };
        window.clearTimeout(graceRef.current);
        graceRef.current = undefined;
        if (openRef.current) return;
        modeRef.current = "pointer";
        pin(e.clientY);
        startIntent(PREVIEW_HOVER_INTENT_MS, show);
      },
    ),
    onPointerLeave: compose<React.PointerEvent>(
      childProps.onPointerLeave,
      (e) => {
        if (e.pointerType !== "touch") cancelIntent();
      },
    ),
    onPointerDown: compose<React.PointerEvent>(
      childProps.onPointerDown,
      (e) => {
        longPressedRef.current = false;
        if (e.pointerType !== "touch") return;
        modeRef.current = "touch";
        pressRef.current = pointerRef.current = { x: e.clientX, y: e.clientY };
        pin(e.clientY);
        startIntent(PREVIEW_LONG_PRESS_MS, () => {
          longPressedRef.current = true;
          show();
        });
      },
    ),
    onPointerMove: compose<React.PointerEvent>(
      childProps.onPointerMove,
      (e) => {
        if (e.pointerType === "touch") {
          const start = pressRef.current;
          if (
            start &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) >
              PREVIEW_LONG_PRESS_SLOP_PX
          ) {
            cancelPress();
          }
          return;
        }
        pointerRef.current = { x: e.clientX, y: e.clientY };
        // Still deciding: follow the pointer onto another line of a wrapped
        // link, so the card grows from the line it is actually on.
        if (intentRef.current !== undefined) pin(e.clientY);
      },
    ),
    onPointerUp: compose<React.PointerEvent>(childProps.onPointerUp, cancelPress),
    onPointerCancel: compose<React.PointerEvent>(
      childProps.onPointerCancel,
      cancelPress,
    ),
    // The release after a long-press would otherwise follow the link.
    onClick: compose<React.MouseEvent>(childProps.onClick, (e) => {
      if (longPressedRef.current) {
        e.preventDefault();
        longPressedRef.current = false;
      }
    }),
    // Android fires contextmenu on a long-press; the press already did its job.
    onContextMenu: compose<React.MouseEvent>(childProps.onContextMenu, (e) => {
      if (pressRef.current || longPressedRef.current) e.preventDefault();
    }),
    onFocus: compose<React.FocusEvent<HTMLElement>>(childProps.onFocus, (e) => {
      if (openRef.current || !e.currentTarget.matches(":focus-visible")) return;
      const r = e.currentTarget.getBoundingClientRect();
      pointerRef.current = { x: r.left + r.width / 2, y: r.top };
      modeRef.current = "keyboard";
      lineRef.current = 0;
      pin();
      startIntent(PREVIEW_HOVER_INTENT_MS, show);
    }),
    onBlur: compose<React.FocusEvent>(childProps.onBlur, () => {
      cancelIntent();
      if (openRef.current && modeRef.current === "keyboard") hide();
    }),
  };

  return cloneElement(
    child as ReactElement<ChildProps>,
    {
      ...handlers,
      ref: attachLink,
      className: `${styles.previewTrigger} ${childProps.className ?? ""}`,
      "data-vista-sheet-part": "trigger",
    },
    childProps.children as never,
    !open && (
      <motion.span
        key="surface"
        ref={attachSurface}
        layoutId={reduceMotion ? undefined : `${idBase}-surface`}
        className={styles.previewSurface}
        transition={transition.close}
        onLayoutAnimationStart={() => startMorphClock("trigger")}
        data-vista-sheet-part="trigger-surface"
        aria-hidden="true"
        style={{
          borderRadius: sheetRect !== null ? collapseRadius : restRadius,
        }}
      />
    ),
  );
}
