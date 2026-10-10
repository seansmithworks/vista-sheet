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
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { animate, frame, motion, useMotionValue } from "motion/react";
import type { PanInfo } from "motion/react";
import {
  adjacentAnchor,
  nearestAnchor,
  rectFromBox,
  rectsNear,
  restingLeft,
  restingTop,
} from "./anchors";
import type { AnchorId, ArrowKey } from "./anchors";
import {
  SlotContext,
  TriggerSurfaceContext,
  createTriggerSurfaceStore,
  useIrisInternal,
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
import { writeTriggerFeedback } from "./triggerFeedback";
import type { TriggerFeedback } from "./triggerFeedback";
import type { Rect, TriggerComponentProps, TriggerProps } from "./types";
import styles from "./styles.module.css";

const ARROW_KEYS: readonly string[] = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
] satisfies ArrowKey[];
const isArrowKey = (key: string): key is ArrowKey => ARROW_KEYS.includes(key);

/** Where x/y are seated, or springing to. */
interface Heading {
  left: number;
  top: number;
}

export function Trigger(props: TriggerComponentProps) {
  return props.asChild ? (
    <LinkTrigger>{props.children}</LinkTrigger>
  ) : (
    <ButtonTrigger {...props} />
  );
}

/**
 * <Iris.Trigger> — the fixed drag wrapper + trigger button + morph
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
  const ctx = useIrisInternal("Trigger");
  const {
    open,
    setOpen,
    anchor,
    commitAnchor,
    announceAnchor,
    snapToRef,
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
    triggerRectLive,
    triggerElRef,
    sheetRect,
    collapseProgress,
    shadowElRef,
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

  // The seat x/y are at or springing to. Every writer that gives x/y a new
  // destination records it here: seat() for a jump, snapTo() for a spring.
  // The anchor layout effect below reconciles the destination against
  // (anchor, box) and only moves x/y when the destination is WRONG, so it can
  // never cancel a spring that is already headed to the right seat (F12: it
  // used to jump x/y on every anchor change, killing the drag-release snap
  // in the same commit that set the anchor). A drag moves x/y without
  // touching this; its release hands over through snapTo.
  const headingRef = useRef<Heading | null>(null);
  const seat = useCallback(
    (to: AnchorId, box: { width: number; height: number }) => {
      const left = restingLeft(to, window.innerWidth, box.width);
      const top = restingTop(to, window.innerHeight, box.height);
      headingRef.current = { left, top };
      x.jump(left);
      y.jump(top);
    },
    [x, y],
  );

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
  //
  // An anchor change made through snapTo (drag release, arrow key, public
  // setAnchor) arrives here already headed to this seat, so nothing moves:
  // the spring keeps running. Any other change (mount, the persisted anchor
  // loading, a size change) is a jump.
  const seatBox = useCallback(
    () =>
      shape === "rectangle" && wrapperRef.current
        ? {
            width: wrapperRef.current.offsetWidth,
            height: wrapperRef.current.offsetHeight,
          }
        : { width: triggerBox.width, height: triggerBox.height },
    [shape, triggerBox.width, triggerBox.height],
  );
  useLayoutEffect(() => {
    const box = seatBox();
    const heading = headingRef.current;
    if (
      heading &&
      Math.abs(
        heading.left - restingLeft(anchor, window.innerWidth, box.width),
      ) < 0.5 &&
      Math.abs(
        heading.top - restingTop(anchor, window.innerHeight, box.height),
      ) < 0.5
    ) {
      return;
    }
    seat(anchor, box);
  }, [anchor, seatBox, seat]);

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
      seat(anchor, triggerBox);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchor, triggerBox.width, triggerBox.height, sheetRect, seat]);

  // Flush a deferred resize once the morph is over (sheetRect settles back
  // to null at Sheet's onExitComplete, or was never set — the open case
  // where a resize is deferred until the sheet later closes).
  useEffect(() => {
    if (sheetRect !== null) return;
    if (!pendingResizeRef.current) return;
    pendingResizeRef.current = false;
    seat(anchor, triggerBox);
  }, [anchor, triggerBox.width, triggerBox.height, sheetRect, seat]);

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
    const token = readVarPx(el, "--orrery-iris-trigger-radius", 9999);
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

  // Report the trigger's live rect for the escape hatch (useIris().triggerRect)
  // and for Sheet's shadow-mask morph.
  //
  // The rect is computed, not measured: x/y plus the button's layout box
  // inside the wrapper (the wrapper is fixed at the viewport origin and
  // moved only by x/y; hover/press feedback transforms the button's
  // children, never the button). It is written to triggerRectLive on every
  // x/y change, synchronously, so <Shadow> follows in the same frame Motion
  // paints the move. A getBoundingClientRect() in a later rAF could run
  // before Motion's render step and read the old seat.
  //
  // setTriggerRect is React state on Root, so calling it synchronously here
  // would re-render the whole Root subtree on every pointer-move frame of a
  // drag. The React commit is rAF-coalesced to at most once per frame and skipped
  // entirely when the rect hasn't moved by more than half a pixel.
  //
  // A layout effect so the first live rect is published before <Shadow>'s
  // passive effect first applies: one shadow write at mount, not two.
  useLayoutEffect(() => {
    const commit = () => {
      rafRef.current = null;
      const next = triggerRectLive.get();
      if (!next) return;
      const last = lastRectRef.current;
      if (last && rectsNear(last, next, 0.5)) return;
      lastRectRef.current = next;
      setTriggerRect(next);
    };

    const update = () => {
      const el = triggerRef.current;
      if (el) {
        const next = rectFromBox(
          x.get() + el.offsetLeft,
          y.get() + el.offsetTop,
          el.offsetWidth,
          el.offsetHeight,
        );
        const prev = triggerRectLive.get();
        // A no-op event (a resize or ResizeObserver tick that moved
        // nothing) must not make <Shadow> re-apply.
        if (!prev || !rectsNear(prev, next, 0.01)) triggerRectLive.set(next);
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    update();
    const unsubX = x.on("change", update);
    const unsubY = y.on("change", update);
    window.addEventListener("resize", update);
    // Strawman (v0.2): a plain mount-time getBoundingClientRect() can race a
    // same-commit CSS change (here, Root's scoped --orrery-iris-trigger-size
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
      // No trigger, no live rect: <Shadow> falls back to the sheet's rect.
      triggerRectLive.set(null);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [x, y, setTriggerRect, triggerRectLive]);

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

  // Hover/pressed feedback and the pointer highlight (triggerFeedback.ts).
  // Only at rest: while the sheet is mounted, the invisible trigger must
  // never move the shadow. Handlers live on the wrapper because Motion's
  // drag captures the pointer there, so pointerup after a drag never
  // reaches the button.
  //
  // The lift and press move the trigger surface, which is the morph's FLIP
  // source, so feedback has to be gone before Motion snapshots that source.
  // The snapshot happens in the commit; the only point guaranteed to precede
  // it on every open path (click, setOpen, a controlled `open` prop) is the
  // render that flips `open`. So that render drops feedback, instantly.
  const openRef = useRef(open);
  if (open && !openRef.current) {
    writeTriggerFeedback([triggerRef.current, shadowElRef.current], "none");
  }
  openRef.current = open;

  const setFeedback = useCallback(
    (state: TriggerFeedback) => {
      if (openRef.current || sheetRectRef.current !== null) return;
      // Reduced motion keeps the highlight (an opacity fade) but never moves
      // the shadow; the button's lift/scale rules are off via
      // data-orrery-iris-reduce-motion.
      writeTriggerFeedback(
        reduceMotion
          ? [triggerRef.current]
          : [triggerRef.current, shadowElRef.current],
        state,
      );
    },
    [reduceMotion, shadowElRef],
  );

  // Pointer-following highlight: written straight to the button's style, at
  // most once per frame, never through React state. Touch, keyboard and
  // reduced motion get it centred and static (no press tighten either):
  // data-orrery-iris-highlight="static".
  const highlightRafRef = useRef<number | null>(null);
  const highlightPointRef = useRef({ x: 0, y: 0 });
  const writeHighlightAt = useCallback((x: string, y: string) => {
    const el = triggerRef.current;
    if (!el) return;
    el.style.setProperty("--orrery-iris-trigger-highlight-x", x);
    el.style.setProperty("--orrery-iris-trigger-highlight-y", y);
    el.setAttribute(
      "data-orrery-iris-highlight",
      x === "50%" ? "static" : "follow",
    );
  }, []);
  const flushHighlight = useCallback(() => {
    highlightRafRef.current = null;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { x, y } = highlightPointRef.current;
    writeHighlightAt(`${x - rect.left}px`, `${y - rect.top}px`);
  }, [writeHighlightAt]);
  const trackHighlight = useCallback(
    (e: ReactPointerEvent, immediate: boolean) => {
      if (e.pointerType !== "mouse" || reduceMotion) {
        writeHighlightAt("50%", "50%");
        return;
      }
      highlightPointRef.current = { x: e.clientX, y: e.clientY };
      if (immediate) {
        if (highlightRafRef.current !== null) {
          cancelAnimationFrame(highlightRafRef.current);
        }
        flushHighlight();
      } else if (highlightRafRef.current === null) {
        highlightRafRef.current = requestAnimationFrame(flushHighlight);
      }
    },
    [reduceMotion, flushHighlight, writeHighlightAt],
  );
  useEffect(
    () => () => {
      if (highlightRafRef.current !== null) {
        cancelAnimationFrame(highlightRafRef.current);
      }
    },
    [],
  );

  const handlePointerEnter = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType !== "mouse") return;
      trackHighlight(e, true);
      setFeedback("hover");
    },
    [setFeedback, trackHighlight],
  );

  // A close that lands under a still mouse fires no pointerenter, so the
  // first move over the resting trigger restores hover. Not at the settle
  // frame itself: the trigger would land, then jump again, with no input.
  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (openRef.current || sheetRectRef.current !== null) return;
      trackHighlight(e, false);
      const current = triggerRef.current?.getAttribute(
        "data-orrery-iris-feedback",
      );
      if (current !== "hover" && current !== "pressed") setFeedback("hover");
    },
    [setFeedback, trackHighlight],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent) => {
      setFeedback(e.pointerType === "mouse" ? "hover" : "rest");
    },
    [setFeedback],
  );

  const handleFeedbackEnd = useCallback(
    () => setFeedback("rest"),
    [setFeedback],
  );

  // The one way the trigger moves to an anchor on purpose: a drag release,
  // an arrow key, or the public setAnchor. Records the destination, commits
  // the anchor (onAnchorChange, persistence, and the status text when
  // asked), then springs x/y there from wherever they are, keeping any
  // in-flight velocity, or seats them directly under reduced motion.
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const snapTo = useCallback(
    (to: AnchorId, { announce }: { announce: boolean }) => {
      const box = seatBox();
      const left = restingLeft(to, window.innerWidth, box.width);
      const top = restingTop(to, window.innerHeight, box.height);
      headingRef.current = { left, top };
      if (to !== anchorRef.current) {
        anchorRef.current = to;
        commitAnchor(to);
        if (announce) announceAnchor(to);
      }
      // Seated directly, never sprung, under reduced motion and while the
      // sheet is mounted: the trigger is hidden behind the open sheet, and
      // the close morph then lands on the new seat.
      if (reduceMotion || openRef.current || sheetRectRef.current !== null) {
        x.jump(left);
        y.jump(top);
        return;
      }
      // Started in Motion's update step, so the spring's clock starts on the
      // frame it first paints. Called straight from a key or click handler,
      // the clock starts in that task and a long frame after it skips the
      // start of the move (Motion caches time per task; see Root.tsx's
      // clock-coupling note). A drag release is already in the frameloop.
      frame.update(() => {
        const snapSpring = { type: "spring" as const, ...SNAP_SPRING };
        animate(x, left, snapSpring);
        animate(y, top, snapSpring);
      });
    },
    [seatBox, commitAnchor, announceAnchor, reduceMotion, x, y],
  );
  useLayoutEffect(() => {
    snapToRef.current = snapTo;
    return () => {
      if (snapToRef.current === snapTo) snapToRef.current = null;
    };
  }, [snapTo, snapToRef]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === " " && !e.repeat) {
        writeHighlightAt("50%", "50%");
        setFeedback("pressed");
        return;
      }
      // Arrow keys move the trigger one anchor (adjacentAnchor) while it can
      // be dragged and the sheet is closed. Every plain arrow is consumed
      // then, a move or not, so the page never scrolls under a focused
      // trigger; modified arrows are left to the browser.
      if (!isArrowKey(e.key) || !draggable || open) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const to = adjacentAnchor(anchorRef.current, e.key);
      if (to) snapTo(to, { announce: true });
    },
    [setFeedback, writeHighlightAt, draggable, open, snapTo],
  );

  const handleKeyUp = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === " ") setFeedback("rest");
    },
    [setFeedback],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      maxTravelRef.current = 0;
      if (e.button === 0) {
        trackHighlight(e, true);
        setFeedback("pressed");
      }
    },
    [setFeedback, trackHighlight],
  );

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

      // A drag is its own feedback: it never writes the status region.
      snapTo(pickedAnchor, { announce: false });
    },
    [anchor, triggerBox.width, triggerBox.height, snapTo, x, y],
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
      // width/height come from .dragWrapper's CSS rule (var(--orrery-iris-
      // trigger-size)), not an inline write of `triggerSize` — an inline
      // write here would win over Root's scoped @media block regardless of
      // viewport, reproducing D3 one level down (this element is the
      // ancestor .shared[data-orrery-iris-slot="trigger"] inherits from).
      // `x`/`y` still come from the live triggerSize for position math
      // (anchors.ts) — that's unaffected by D3, which is a BOX-SIZE defect,
      // not a position one.
      style={{ x, y }}
      data-orrery-iris-part="trigger-root"
      // Lift the trigger above the sheet (z + 103) during a CLOSE. The
      // `-shared` and `-surface` layoutId pairs crossfade on different
      // springs, so the sheet-side <Shared> fades out while the opaque sheet
      // still covers the trigger-side copy; lifting lets that copy paint
      // through the gap. Close only: while open, the invisible button would
      // sit over the sheet and swallow its clicks.
      data-orrery-iris-closing={sheetRect !== null && !open ? "" : undefined}
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
      data-orrery-iris-shape={shape}
      data-orrery-iris-button-size={
        shape === "rectangle" ? buttonSize : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handleFeedbackEnd}
      onPointerCancel={handleFeedbackEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleFeedbackEnd}
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
        data-orrery-iris-part="trigger"
        data-orrery-iris-reduce-motion={reduceMotion ? "" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        id={triggerId}
        onClick={handleClick}
        data-orrery-iris-shape={shape}
        data-orrery-iris-button-size={
          shape === "rectangle" ? buttonSize : undefined
        }
        {...aria}
      >
        {!open && (
          <TriggerSurface
            as="div"
            ref={attachSurfaceRef}
            className={styles.triggerSurface}
            data-orrery-iris-shape={shape}
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
                data-orrery-iris-part="trigger-label"
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
