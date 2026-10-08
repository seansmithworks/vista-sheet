import { createContext, useContext } from "react";
import type { MutableRefObject } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";
import type {
  VistaSheetState,
  Rect,
  TriggerShape,
  ButtonSize,
} from "./types";
import type { TriggerBox } from "./shape";

/**
 * Internal context value — everything Trigger, Sheet, Shared, Content, Close
 * and Shadow need to coordinate, plus the subset re-exported publicly by
 * useVistaSheet(). Keeping the internal shape richer than the public one means
 * widening useVistaSheet() later is additive, not a breaking change.
 */
export interface VistaSheetContextValue extends VistaSheetState {
  /** Internal only — record a new anchor (state, persistence,
   * onAnchorChange) without moving the trigger. Trigger's snapTo is the
   * mover; this is what it commits through. */
  commitAnchor: (anchor: AnchorId) => void;
  /** Internal only — write the anchor's announcement into Root's
   * role="status" region (anchorAnnouncement, or the default text). */
  announceAnchor: (anchor: AnchorId) => void;
  /** Internal only — Trigger registers its snapTo here so the public
   * setAnchor animates exactly like a drag release. */
  snapToRef: MutableRefObject<
    ((anchor: AnchorId, opts: { announce: boolean }) => void) | null
  >;
  setIsDragging: (dragging: boolean) => void;
  draggable: boolean;
  sheetMaxWidth: number;
  /** Internal only — not part of the public VistaSheetState/useVistaSheet. */
  shape: TriggerShape;
  /** Internal only — s/m/l for a shape="rectangle" trigger. */
  buttonSize: ButtonSize;
  /** Internal only — the trigger's actual box (label-sized for rectangle,
   * square triggerSize for every other shape). */
  triggerBox: TriggerBox;
  /** Internal only — Trigger.tsx publishes its measured rectangle box here. */
  setMeasuredTriggerBox: (box: TriggerBox) => void;
  reduceMotion: boolean;
  zIndex: number;
  idBase: string;
  triggerId: string;
  sheetId: string;
  transition: {
    open: Transition;
    close: Transition;
    shared: Transition;
  };
  /** Publishes a rect to both triggerRect (React state) and
   * triggerRectLive. */
  setTriggerRect: (rect: Rect | null) => void;
  /** Internal only — the trigger's rect, written in the same task as every
   * x/y change (ButtonTrigger) or alongside setTriggerRect (LinkTrigger).
   * <Shadow> positions from this, never from the React state, so it moves
   * in the frame the trigger does. */
  triggerRectLive: MotionValue<Rect | null>;
  setSheetRect: (rect: Rect | null) => void;
  /** A stable numeric-px border-radius MotionValue, owned by Root, that
   * Sheet.tsx relays its own useCollapseRadius() output into every tick so
   * Trigger.tsx's `.triggerSurface` can bind to the same painted values
   * through a close (audit M1) — see the note on useCollapseRadius.ts for
   * why this is a relay rather than a directly-shared instance. Sheet.tsx's
   * own `.sheet` binds to its local computation directly, not to this. */
  collapseRadius: MotionValue<number>;
  /** Starts the armed collapseProgress morph (audit M2). Root arms a pending
   * morph in its own layout effect; whichever of Sheet's `.sheet` (open) or
   * Trigger's `.triggerSurface` (close) receives Motion's
   * `onLayoutAnimationStart` calls this, so the shadow clock and Motion's
   * layout-projection clock are created in the SAME frameloop pass and
   * therefore share a start time. See the long note in Root.tsx. No-op when
   * nothing is armed. */
  startMorphClock: (from: "trigger" | "sheet") => void;
  /** Live drag-y offset (px) of the sheet's `drag="y"` gesture, 0 at rest.
   * Sheet.tsx binds this as its motion `y` style so drag writes into it
   * directly; Shadow.tsx reads it to keep the silhouette locked to the
   * sheet's dragged position instead of its measured (pre-drag) rect —
   * offsetLeft/Top used for sheetRect excludes transforms by definition, so
   * this is the only signal that carries the drag. */
  sheetDragY: MotionValue<number>;
  /** Dev-only: Close registers itself here so Root can warn if the sheet
   * opens with no visible close control rendered. */
  registerClose: () => () => void;
  hasRegisteredClose: () => boolean;
  /** The trigger button element — Sheet focuses it back on exit-complete. */
  triggerElRef: MutableRefObject<HTMLElement | null>;
  /** <VistaSheet.Shadow>'s element — the trigger writes its hover/pressed
   * feedback attribute here too (triggerFeedback.ts). */
  shadowElRef: MutableRefObject<HTMLElement | null>;
  /** Link-preview mode (Root `preview`). Fixed for the Root's lifetime. */
  preview: boolean;
  /** Preview only: the element Sheet and Shadow portal into; null when no
   * card is armed, open or morphing. */
  layerEl: HTMLElement | null;
  /** Preview only: ask for the layer ahead of the open. */
  setLayerArmed: (armed: boolean) => void;
  /** Preview only: where the card is placed from, set just before open. */
  previewPointerRef: MutableRefObject<{ x: number; y: number }>;
  /** The Content scroll region element — Sheet's swipe-to-close must not fire
   * while this is mid-scroll (docs/PACKAGE-DESIGN.md §1, Content). */
  contentScrollElRef: MutableRefObject<HTMLDivElement | null>;
}

export const VistaSheetContext = createContext<VistaSheetContextValue | null>(
  null,
);

/**
 * SlotContext — the trigger/sheet slot discriminator. Provided by <Trigger>
 * and <Sheet> around their children, read by <Shared> to decide which of the
 * two shapes it renders (docs/PACKAGE-DESIGN.md's B2/M7 fix): the
 * trigger-side instance is an inset, circular clip; the sheet-side instance
 * is an in-flow, margined circle. One mechanism serves both findings.
 */
export type VistaSheetSlot = "trigger" | "sheet";

export const SlotContext = createContext<VistaSheetSlot | null>(null);

export function useVistaSheetSlot(): VistaSheetSlot | undefined {
  const slot = useContext(SlotContext);
  return slot ?? undefined;
}

/**
 * TriggerSurfaceStore — publishes the trigger surface's DOM node so
 * <VistaSheet.Media> can portal its trigger-side instance inside it and ride
 * the close FLIP, instead of popping in at the trigger's resting spot. A
 * pub/sub, not useState or a ref: <Media> must re-portal when the surface
 * node is recreated, without re-rendering the Trigger.
 */
export interface TriggerSurfaceStore {
  get(): HTMLDivElement | null;
  set(el: HTMLDivElement | null): void;
  subscribe(listener: () => void): () => void;
}

export function createTriggerSurfaceStore(): TriggerSurfaceStore {
  let current: HTMLDivElement | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (el) => {
      if (el === current) return;
      current = el;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const TriggerSurfaceContext = createContext<TriggerSurfaceStore | null>(
  null,
);

/**
 * useVistaSheet — the public escape hatch. Throws outside <VistaSheet.Root>.
 *
 * useVistaSheet().collapseProgress is the raw MotionValue the package's own radius,
 * mask and opacity transforms read (0 = fully open, 1 = fully closed).
 * Combined with triggerRect/sheetRect, it is enough to rebuild any of the
 * internal choreography externally — see example/CloseMask.tsx.
 */
export function useVistaSheet(): VistaSheetState {
  const ctx = useContext(VistaSheetContext);
  if (!ctx) {
    throw new Error(
      "useVistaSheet() must be called from inside <VistaSheet.Root>.",
    );
  }
  const {
    open,
    setOpen,
    anchor,
    setAnchor,
    isDragging,
    triggerSize,
    collapseProgress,
    triggerRect,
    sheetRect,
  } = ctx;
  return {
    open,
    setOpen,
    anchor,
    setAnchor,
    isDragging,
    triggerSize,
    collapseProgress,
    triggerRect,
    sheetRect,
  };
}

/** Internal-only accessor, used by the compound components themselves. */
export function useVistaSheetInternal(
  componentName: string,
): VistaSheetContextValue {
  const ctx = useContext(VistaSheetContext);
  if (!ctx) {
    throw new Error(
      `<VistaSheet.${componentName}> must be rendered inside <VistaSheet.Root>.`,
    );
  }
  return ctx;
}

export type { MotionValue };
