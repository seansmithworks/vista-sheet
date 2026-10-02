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
import type { Rect } from "./types";
import styles from "./styles.module.css";

/** One card open at a time across every preview Root: opening closes the last. */
let closeCurrent: (() => void) | null = null;

type ChildProps = Record<string, unknown> & {
  children?: unknown;
  className?: string;
  ref?: React.Ref<HTMLElement>;
};

type Mode = "pointer" | "touch" | "keyboard";

/**
 * LinkTrigger — preview mode's trigger. The consumer's single `<a>` stays an
 * ordinary link and gains hover intent, keyboard-focus intent and touch
 * long-press.
 *
 * The morph surface (the shared-layoutId span the card grows out of and
 * shrinks back into) is pinned, with inline left/top/width/height, to the ONE
 * line box under the pointer. A link that wraps is several boxes; an
 * absolutely-positioned child of an inline would size against first-box-start
 * to last-box-end, which is no box the reader sees. The card's `triggerRect`
 * is that same line box, re-measured in the commit the surface remounts on
 * every close, so a card dismissed by scrolling returns to where the link is.
 */
export function LinkTrigger({ children }: { children: ReactElement }) {
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
  } = useVistaSheetInternal("Trigger");

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
  // How the open started: pointer cards close on leave, the others do not.
  const modeRef = useRef<Mode>("pointer");
  const timer = useRef<{ intent?: number; grace?: number }>({});
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);
  const restRadius = useMotionValue(PREVIEW_TRIGGER_RADIUS_PX);

  const childRefRef = useRef(childProps.ref);
  childRefRef.current = childProps.ref;
  const attachLink = useCallback(
    (node: HTMLElement | null) => {
      linkRef.current = node;
      triggerElRef.current = node;
      const r = childRefRef.current;
      if (typeof r === "function") r(node);
      else if (r) (r as { current: HTMLElement | null }).current = node;
    },
    [triggerElRef],
  );

  const stop = (k: "intent" | "grace") => {
    window.clearTimeout(timer.current[k]);
    timer.current[k] = undefined;
  };

  const lines = () => Array.from(linkRef.current?.getClientRects() ?? []);
  const currentLine = (all: DOMRect[]): DOMRect | undefined =>
    all[Math.min(lineRef.current, all.length - 1)];

  // Choose the line under clientY (the first, when none is) and pin the
  // surface to it.
  const pin = (clientY?: number) => {
    const all = lines();
    if (clientY !== undefined) {
      const hit = all.findIndex((r) => clientY >= r.top && clientY <= r.bottom);
      lineRef.current = Math.max(hit, 0);
    }
    const r = currentLine(all);
    if (!r || !surfaceRef.current) return;
    Object.assign(surfaceRef.current.style, {
      left: `${r.left - all[0].left}px`,
      top: `${r.top - all[0].top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };
  const attachSurface = useCallback((node: HTMLSpanElement | null) => {
    surfaceRef.current = node;
    if (node) pin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measure = (): Rect | null => {
    const r = currentLine(lines());
    return r
      ? {
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          halfWidth: r.width / 2,
          halfHeight: r.height / 2,
        }
      : null;
  };

  const hideRef = useRef(() => {});
  hideRef.current = () => {
    stop("intent");
    stop("grace");
    setLayerArmed(false);
    setOpen(false);
  };
  const closeSelf = useCallback(() => hideRef.current(), []);

  const show = () => {
    stop("intent");
    stop("grace");
    const rect = measure();
    if (!rect) {
      setLayerArmed(false);
      return;
    }
    pin();
    previewPointerRef.current = pointerRef.current;
    setTriggerRect(rect);
    if (closeCurrent && closeCurrent !== closeSelf) closeCurrent();
    closeCurrent = closeSelf;
    setLayerArmed(false);
    setOpen(true);
    if (modeRef.current === "touch") longPressedRef.current = true;
  };

  // Start the hover / long-press / focus beat. The layer is armed now so it
  // is in the DOM by the time the card mounts.
  const begin = (mode: Mode, at: { x: number; y: number }, delayMs: number) => {
    modeRef.current = mode;
    pointerRef.current = at;
    pin(mode === "keyboard" ? undefined : at.y);
    stop("intent");
    setLayerArmed(true);
    timer.current.intent = window.setTimeout(show, delayMs);
  };
  const cancelIntent = () => {
    if (timer.current.intent === undefined) return;
    stop("intent");
    setLayerArmed(false);
  };
  const cancelPress = () => {
    pressRef.current = null;
    if (!longPressedRef.current) cancelIntent();
  };

  // Every close (Escape, outside press, scroll, grace timer, blur) lands the
  // surface and `triggerRect` on the link's CURRENT line box.
  const wasOpenRef = useRef(open);
  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!wasOpen || open) return;
    pin();
    const rect = measure();
    if (rect) setTriggerRect(rect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (closeCurrent === closeSelf) closeCurrent = null;
      return;
    }
    // Hoverable card (WCAG 1.4.13): a pointer-opened card stays while the
    // pointer is on the link or the card, and closes a grace period after it
    // leaves both, so the gap between them can be crossed.
    if (modeRef.current !== "pointer") return;
    const startGrace = () => {
      timer.current.grace ??= window.setTimeout(closeSelf, PREVIEW_CLOSE_GRACE_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = e.target;
      const inside =
        t instanceof Node &&
        (linkRef.current?.contains(t) === true ||
          document.getElementById(sheetId)?.contains(t) === true);
      if (inside) stop("grace");
      else startGrace();
    };
    document.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", startGrace);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", startGrace);
      stop("grace");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheetId, closeSelf]);

  useEffect(
    () => () => {
      stop("intent");
      stop("grace");
      if (closeCurrent === closeSelf) closeCurrent = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closeSelf],
  );

  // Run the consumer's own handler first, then ours.
  const on = <E extends SyntheticEvent>(name: string, ours: (e: E) => void) => {
    const theirs = childProps[name];
    return (e: E) => {
      if (typeof theirs === "function") theirs(e);
      ours(e);
    };
  };
  const at = (e: React.PointerEvent) => ({ x: e.clientX, y: e.clientY });

  const handlers = {
    onPointerEnter: on<React.PointerEvent>("onPointerEnter", (e) => {
      if (e.pointerType === "touch") return;
      stop("grace");
      if (!openRef.current) begin("pointer", at(e), PREVIEW_HOVER_INTENT_MS);
    }),
    onPointerLeave: on<React.PointerEvent>("onPointerLeave", (e) => {
      if (e.pointerType !== "touch") cancelIntent();
    }),
    onPointerDown: on<React.PointerEvent>("onPointerDown", (e) => {
      longPressedRef.current = false;
      if (e.pointerType !== "touch") return;
      pressRef.current = at(e);
      begin("touch", pressRef.current, PREVIEW_LONG_PRESS_MS);
    }),
    onPointerMove: on<React.PointerEvent>("onPointerMove", (e) => {
      if (e.pointerType === "touch") {
        const s = pressRef.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > PREVIEW_LONG_PRESS_SLOP_PX) {
          cancelPress();
        }
        return;
      }
      pointerRef.current = at(e);
      // Still deciding: follow the pointer onto another line of a wrapped link.
      if (timer.current.intent !== undefined) pin(e.clientY);
    }),
    onPointerUp: on<React.PointerEvent>("onPointerUp", cancelPress),
    onPointerCancel: on<React.PointerEvent>("onPointerCancel", cancelPress),
    // The release after a long-press would otherwise follow the link.
    onClick: on<React.MouseEvent>("onClick", (e) => {
      if (longPressedRef.current) {
        e.preventDefault();
        longPressedRef.current = false;
      }
    }),
    // Android fires contextmenu on a long-press.
    onContextMenu: on<React.MouseEvent>("onContextMenu", (e) => {
      if (pressRef.current || longPressedRef.current) e.preventDefault();
    }),
    onFocus: on<React.FocusEvent<HTMLElement>>("onFocus", (e) => {
      if (openRef.current || !e.currentTarget.matches(":focus-visible")) return;
      const r = e.currentTarget.getBoundingClientRect();
      lineRef.current = 0;
      begin("keyboard", { x: r.left + r.width / 2, y: r.top }, PREVIEW_HOVER_INTENT_MS);
    }),
    onBlur: on<React.FocusEvent>("onBlur", () => {
      cancelIntent();
      if (openRef.current && modeRef.current === "keyboard") closeSelf();
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
