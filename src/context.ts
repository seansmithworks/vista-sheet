import { createContext, useContext } from "react";
import type { MutableRefObject } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";
import type {
  VistaSheetState,
  Rect,
  SheetRect,
  TriggerShape,
  ButtonSize,
} from "./types";
import type { TriggerBox } from "./shape";

/**
 * Internal context value — everything Trigger, Sheet, Shared, Content, Close
 * and Shadow need to coordinate, plus the subset re-exported publicly by
 * useVistaSheet(). Keeping the internal shape richer than the public one means
 * widening usePKG() later (if ever needed) is additive, not a breaking change.
 */
export interface VistaSheetContextValue extends VistaSheetState {
  setAnchor: (anchor: AnchorId) => void;
  onAnchorChange?: (anchor: AnchorId) => void;
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
  setTriggerRect: (rect: Rect | null) => void;
  setSheetRect: (rect: SheetRect | null) => void;
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
  triggerElRef: MutableRefObject<HTMLButtonElement | null>;
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
 * TriggerSurfaceStore — publishes the trigger surface's DOM node
 * (`.triggerSurface`, `data-vista-sheet-part="trigger-surface"`) so
 * <VistaSheet.Media> can portal its trigger-side instance INSIDE that
 * element rather than in place. The trigger surface is the entering element
 * on close (Trigger.tsx's `{!open && ...}` gating), so it FLIPs from the
 * sheet's box and fades in above it; a Media instance living outside that
 * surface would pop in at the trigger's resting spot from the first close
 * frame instead of riding the FLIP. A small pub/sub rather than a plain ref
 * so <Media> (a descendant of the surface's own children, mounted after it)
 * can re-render/re-portal if the surface node is ever recreated.
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
 * DirectChildContext — dev-only structural check. Defaults to `true` (a bare
 * <Shared>/<Media> under <Trigger>/<Sheet> with no wrapper is the documented
 * shape). <Item> and <Content> re-provide `false` around their own children,
 * since a <Shared>/<Media> nested inside either would inherit the wrong
 * FLIP/projection (see Shared.tsx's structural-rule comment) — cheaper than
 * DOM-walking, since it only requires each wrapper to flip a flag rather than
 * every consumer walking parentElement chains.
 */
export const DirectChildContext = createContext(true);

/**
 * useVistaSheet — the public escape hatch. Throws outside <VistaSheet.Root>.
 *
 * usePKG().collapseProgress is the raw MotionValue the package's own radius,
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
