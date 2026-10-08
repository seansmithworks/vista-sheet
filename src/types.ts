import type { ReactElement, ReactNode, RefObject } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";
import type { TriggerShape, ButtonSize } from "./shape";

export type { AnchorId };
export type { TriggerShape };
export type { ButtonSize };

export interface StiffnessSpring {
  stiffness: number;
  damping: number;
  mass?: number;
}

/** Motion's spring shorthand — two numbers instead of stiffness/damping.
 * `visualDuration` is spring-only, which lets mergeTransition tell this
 * apart from a full Transition. No `mass`: Motion resolves
 * stiffness/damping/mass first, so `mass` silently discards both fields.
 * `bounce` is required — see the note under isSpringShorthand (motion.ts). */
export interface DurationSpring {
  visualDuration: number;
  bounce: number;
}

export type Spring = StiffnessSpring | DurationSpring;

/** Per-direction override for <Iris.Shared>. Either key may be omitted;
 * the package default for that direction is used instead. */
export interface SharedTransitionByDirection {
  open?: Spring | Transition;
  close?: Spring | Transition;
}

export interface MorphTransition {
  /** Trigger to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to trigger. Default: { stiffness: 375, damping: 32, mass: 1 } */
  close?: Spring | Transition;
  /**
   * The <Iris.Shared> element's own morph. Direction-aware, because the
   * two directions have different jobs: on the open the shared element only
   * has to clear the growing sheet, on the close it has to arrive home
   * together with the collapsing trigger.
   *
   * A single Spring/Transition applies to BOTH directions. Pass
   * `{ open, close }` to set them independently.
   *
   * Defaults: open { stiffness: 500, damping: 45 },
   *           close { stiffness: 340, damping: 30, mass: 1 }.
   */
  shared?: Spring | Transition | SharedTransitionByDirection;
}

/**
 * A named feel, carrying exactly the two fields the tuner can actually
 * export ({@link MorphTransition} and the surface close lead delay —
 * `triggerSize` is a separate geometry prop, not part of a feel). Explicit
 * `transition` prop on Root wins over a preset's `transition`, field by
 * field — see RootProps.preset. `surfaceCloseLeadDelayMs` is preset-only.
 */
export interface MotionPreset {
  transition?: MorphTransition;
  surfaceCloseLeadDelayMs?: number;
}

export interface RootProps {
  children: ReactNode;

  /** Default false: a draggable button opening a modal sheet. */
  preview?: false;

  // Open state
  /** Uncontrolled initial state. Default false. */
  defaultOpen?: boolean;
  /** Controlled. When provided, the package never sets open itself. */
  open?: boolean;
  /** Fires on every requested state change, controlled or not. */
  onOpenChange?: (open: boolean) => void;

  // Position
  /** Uncontrolled initial anchor. Default "bottom-center". */
  defaultAnchor?: AnchorId;
  /** Fires once per move to a new anchor: a drag release, an arrow key on
   * the focused trigger, or useIris().setAnchor. */
  onAnchorChange?: (anchor: AnchorId) => void;
  /** Default true. False renders a fixed trigger with no drag affordance. */
  draggable?: boolean;
  /**
   * localStorage key for the chosen anchor.
   * Default "wicket-iris-anchor". Pass false to disable persistence entirely.
   */
  persistKey?: string | false;
  /**
   * The polite status text written when the trigger moves by keyboard or by
   * useIris().setAnchor (never by a drag). Default
   * `Moved to bottom right.` style text. Return false to announce nothing.
   */
  anchorAnnouncement?: (anchor: AnchorId) => string | false;

  // Geometry
  /**
   * Trigger diameter in px. Object form is a breakpoint ramp.
   * Default { base: 96, md: 128, xl: 144 } at 0 / 768 / 1600.
   */
  triggerSize?: number | { base: number; md?: number; xl?: number };
  /** Sheet max width in px. Default 480. */
  sheetMaxWidth?: number;
  /**
   * Trigger shape. Default "circle". The surface, Shadow, both
   * <Iris.Shared> slots and the focus ring follow it;
   * --wicket-iris-trigger-radius caps the corner radius for every shape.
   * "squircle" is a true superellipse where CSS corner-shape is supported
   * and a close border-radius approximation elsewhere. "rectangle" is a
   * label-sized button trigger (plain children; Shared and Media are not
   * supported inside it in v0.2).
   */
  shape?: TriggerShape;
  /**
   * Height and inline padding of a shape="rectangle" trigger: s 36px / m
   * 44px / l 52px. Default "m". Ignored for other shapes.
   */
  buttonSize?: ButtonSize;
  /**
   * Fixed width in px for a rectangle trigger. Default sizes to its label.
   */
  buttonWidth?: number;

  // Motion
  /**
   * A named feel from `presets` (or a hand-built {@link MotionPreset}).
   * `transition` below wins over its `transition` field by field — pass
   * `preset={presets.snappy} transition={{ open: mySpring }}` to take snappy's close/shared and override only open.
   */
  preset?: MotionPreset;
  transition?: MorphTransition;
  /** Force reduced-motion behavior. Default: the media query. */
  reduceMotion?: boolean;

  // Plumbing
  /** Base for generated aria ids and layoutIds. Default useId(). */
  id?: string;
  /** Base z-index. Default 100. */
  zIndex?: number;
  className?: string;
}

/**
 * Link-preview mode: `<Iris.Root preview>`. The Trigger is `asChild`
 * over the consumer's own `<a>`, the Sheet floats beside it, nothing is
 * modal. Only the props that still apply are accepted.
 */
type PreviewKept =
  | "children"
  | "onOpenChange"
  | "sheetMaxWidth"
  | "preset"
  | "transition"
  | "reduceMotion"
  | "id"
  | "zIndex"
  | "className";

export type PreviewRootProps = Pick<RootProps, PreviewKept> & {
  /** Fixed for the Root's lifetime. Sheet max width defaults to 360. */
  preview: true;
} & Partial<Record<Exclude<keyof RootProps, PreviewKept | "preview">, never>>;

/** What <Iris.Root> accepts: the modal shape or the preview shape. */
export type RootComponentProps = RootProps | PreviewRootProps;

export interface TriggerProps {
  asChild?: false;
  children?: ReactNode;
  className?: string;
  /** Required. This is the button's accessible name. */
  "aria-label": string;
}

export interface PreviewTriggerProps {
  /** Preview mode: the single child (an `<a>`) is the trigger. */
  asChild: true;
  children: ReactElement;
  className?: never;
  "aria-label"?: never;
}

/** What <Iris.Trigger> accepts. */
export type TriggerComponentProps = TriggerProps | PreviewTriggerProps;

export type Labelled =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export type SheetProps = Labelled & {
  children: ReactNode;
  className?: string;
  /** Drag the sheet down past threshold to close. Default true. */
  dismissOnSwipe?: boolean;
  /** Click outside the sheet to close. Default true. */
  dismissOnBackdrop?: boolean;
  /** Width / height, e.g. 9 / 16. The sheet contain-fits this ratio inside
   * sheetMaxWidth and the anchor's max height. A value that is not a finite
   * positive number is ignored. */
  aspectRatio?: number;
  /**
   * Focused once the open settles (docs/PACKAGE-DESIGN.md §6). Opt-in: by
   * default the dialog panel itself keeps focus at the open commit and holds
   * it, so opening a sheet never pre-highlights a control. Pass a ref at a
   * text-entry control (a search field, a chat composer) to move focus there
   * once the sheet has visibly arrived. Skipped if focus has already moved
   * off the panel by settle time, whether that's the user tabbing away or a
   * consumer focusing something itself.
   */
  initialFocus?: RefObject<HTMLElement | null>;
};

interface SlotProps {
  children: ReactNode;
  className?: string;
}

export type SharedProps = SlotProps;
export type ContentProps = SlotProps;
export type ItemProps = SlotProps;

export interface CloseProps {
  children?: ReactNode;
  className?: string;
  "aria-label": string;
}

export interface MediaProps {
  /** Video source. Omit to render just the poster as a static `<img>`. */
  src?: string;
  /** The still, frame-0 image. Also what reduced-motion users see, paused. */
  poster: string;
  /**
   * Required: the media's intrinsic width / height. Sizes the media on the
   * first frame, before the file itself has loaded any metadata, which is
   * what keeps the morph from squashing it — not inherited from Sheet's own
   * `aspectRatio`, since the trigger-side instance can't see Sheet's props.
   */
  aspectRatio: number;
  /** Set to make the media meaningful content (not aria-hidden). */
  alt?: string;
  className?: string;
}

export interface ShadowProps {
  className?: string;
  /** Render a single child in place of the default shadow div, merging the
   * fixed positioning, z-index, aria-hidden, pointer-events, data-* attributes
   * and --wicket-iris-shadow-* custom properties onto it. */
  asChild?: boolean;
  children?: ReactNode;
}

/** The trigger button's live viewport box.
 * Strawman (v0.2): half extents replace radius so a non-square trigger has
 * a true silhouette; breaking for useIris().triggerRect readers, free
 * pre-publish. */
export interface Rect {
  cx: number;
  cy: number;
  halfWidth: number;
  halfHeight: number;
}

/** Public state + escape hatch returned by useIris(). */
export interface IrisState {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: AnchorId;
  /** Move the trigger to `anchor` with the same spring as a drag release
   * (seated directly under reduced motion). Fires onAnchorChange and the
   * status announcement when the anchor actually changes. */
  setAnchor: (anchor: AnchorId) => void;
  isDragging: boolean;
  triggerSize: number;
  /** 0 = fully open (sheet), 1 = fully closed (trigger). Live MotionValue. */
  collapseProgress: MotionValue<number>;
  /** Live viewport rects, null before first measure. */
  triggerRect: Rect | null;
  sheetRect: Rect | null;
}
