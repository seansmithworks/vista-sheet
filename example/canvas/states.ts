/**
 * The Dissection's "States & API" rows, and PROP_COVERAGE: every public prop
 * of every part mapped to the row that shows (or documents) it. The map is
 * typed `Record<keyof Props, …>`, so a new prop in src/types.ts fails tsc
 * until it has a row; states.test.ts checks the same thing by parsing
 * types.ts, so vitest catches it too.
 */
import type {
  CloseProps,
  ContentProps,
  ItemProps,
  MediaProps,
  PreviewTriggerProps,
  RootProps,
  ShadowProps,
  SharedProps,
  SheetProps,
  TriggerProps,
} from "../../src/types";
import {
  PREVIEW_CLOSE_GRACE_MS,
  PREVIEW_HOVER_INTENT_MS,
  PREVIEW_LONG_PRESS_MS,
  PREVIEW_LONG_PRESS_SLOP_PX,
} from "../../src/motion";
import { DRAG_TILE_ID } from "./tiles";

export type Status =
  | { kind: "captured"; seq: string; frame: number }
  | { kind: "live"; tileId: string }
  | { kind: "anatomy" }
  /** No visual of its own; `tileId` points at where it acts, if anywhere. */
  | { kind: "api"; tileId?: string };

export interface StateRow {
  name: string;
  surface: string;
  status: Status;
}

export const STATE_ROWS: StateRow[] = [
  // Lifecycle
  {
    name: "Closed, at rest",
    surface: "default",
    status: { kind: "captured", seq: "morph-circle", frame: 0 },
  },
  {
    name: "Opening, mid-morph",
    surface: "collapseProgress 1 → 0",
    status: { kind: "captured", seq: "morph-circle", frame: 2 },
  },
  {
    name: "Open, settled",
    surface: "data-orrery-iris-settled",
    status: { kind: "captured", seq: "morph-circle", frame: 5 },
  },
  {
    name: "Closing",
    surface: "data-orrery-iris-closing",
    status: { kind: "captured", seq: "morph-circle", frame: 6 },
  },
  {
    name: "Close button reveal",
    surface: "<Iris.Close>",
    status: { kind: "captured", seq: "close-reveal", frame: 2 },
  },
  {
    name: "Shadow crossfade",
    surface: "<Iris.Shadow>",
    status: { kind: "captured", seq: "shadow-crossfade", frame: 4 },
  },
  // Interaction
  {
    name: "Hover",
    surface: ":hover",
    status: { kind: "captured", seq: "trigger-states-disc", frame: 1 },
  },
  {
    name: "Focus visible",
    surface: ":focus-visible",
    status: { kind: "captured", seq: "trigger-states-disc", frame: 2 },
  },
  {
    name: "Pressed",
    surface: ":active",
    status: { kind: "captured", seq: "trigger-states-button", frame: 3 },
  },
  {
    name: "Phone, touch",
    surface: "390×844",
    status: { kind: "captured", seq: "morph-phone", frame: 5 },
  },
  {
    name: "Drag and snap",
    surface: "draggable",
    status: { kind: "live", tileId: DRAG_TILE_ID },
  },
  {
    name: "Anchor change callback",
    surface: "onAnchorChange",
    status: { kind: "api", tileId: DRAG_TILE_ID },
  },
  {
    name: "Esc dismiss",
    surface: "Escape key",
    status: { kind: "live", tileId: "open-basic" },
  },
  {
    name: "Backdrop dismiss",
    surface: "dismissOnBackdrop (default on)",
    status: { kind: "live", tileId: "open-basic" },
  },
  {
    name: "Backdrop click ignored",
    surface: "dismissOnBackdrop={false}",
    status: { kind: "live", tileId: "behaviour-no-backdrop-dismiss" },
  },
  {
    name: "Swipe to dismiss",
    surface: "dismissOnSwipe",
    status: { kind: "live", tileId: "behaviour-swipe-dismiss" },
  },
  // Configuration
  {
    name: "Shape",
    surface: "shape · data-orrery-iris-shape",
    status: { kind: "live", tileId: "shape-squircle" },
  },
  {
    name: "Button size",
    surface: "buttonSize · data-orrery-iris-button-size",
    status: { kind: "live", tileId: "button-m-icon-text" },
  },
  {
    name: "Button width",
    surface: "buttonWidth",
    status: { kind: "live", tileId: "button-fixed-width" },
  },
  {
    name: "Trigger size",
    surface: "triggerSize",
    status: { kind: "live", tileId: "size-128" },
  },
  {
    name: "Anchor",
    surface: "defaultAnchor",
    status: { kind: "live", tileId: "anchor-top-right" },
  },
  {
    name: "Sheet max width",
    surface: "sheetMaxWidth",
    status: { kind: "live", tileId: "geometry-width-640" },
  },
  {
    name: "Aspect ratio",
    surface: "Sheet / Media aspectRatio",
    status: { kind: "live", tileId: "open-video" },
  },
  {
    name: "Default open",
    surface: "defaultOpen",
    status: { kind: "live", tileId: "open-basic" },
  },
  {
    name: "Motion presets",
    surface: "preset",
    status: { kind: "live", tileId: "motion-snappy" },
  },
  {
    name: "Reduced motion",
    surface: "reduceMotion",
    status: { kind: "captured", seq: "reduced-motion", frame: 2 },
  },
  {
    name: "Media playing",
    surface: "Media src",
    status: { kind: "live", tileId: "content-video" },
  },
  {
    name: "Media poster, reduced motion",
    surface: "Media poster",
    status: { kind: "live", tileId: "reduced-motion-media" },
  },
  // Link preview
  {
    name: "Link preview",
    surface: "<Root preview>",
    status: { kind: "captured", seq: "morph-link-preview", frame: 5 },
  },
  {
    name: "Preview trigger",
    surface: "Trigger asChild",
    status: { kind: "live", tileId: "link-preview" },
  },
  {
    name: "Preview hover intent",
    surface: `PREVIEW_HOVER_INTENT_MS = ${PREVIEW_HOVER_INTENT_MS}ms`,
    status: { kind: "live", tileId: "link-preview" },
  },
  {
    name: "Preview close grace",
    surface: `PREVIEW_CLOSE_GRACE_MS = ${PREVIEW_CLOSE_GRACE_MS}ms`,
    status: { kind: "live", tileId: "link-preview" },
  },
  {
    name: "Preview long-press",
    surface: `PREVIEW_LONG_PRESS_MS = ${PREVIEW_LONG_PRESS_MS}ms · slop ${PREVIEW_LONG_PRESS_SLOP_PX}px`,
    status: { kind: "live", tileId: "link-preview" },
  },
  {
    name: "Link preview, dark",
    surface: "<Root preview>",
    status: { kind: "live", tileId: "link-preview-dark" },
  },
  // Structure
  {
    name: "Parts",
    surface: "children · data-orrery-iris-part",
    status: { kind: "anatomy" },
  },
  {
    name: "Slots",
    surface: "data-orrery-iris-slot",
    status: { kind: "anatomy" },
  },
  // API-only
  { name: "Controlled open", surface: "open", status: { kind: "api" } },
  {
    name: "Open change callback",
    surface: "onOpenChange",
    status: { kind: "api" },
  },
  { name: "Stacking base", surface: "zIndex", status: { kind: "api" } },
  {
    name: "Anchor persistence",
    surface: "persistKey",
    status: { kind: "api" },
  },
  {
    name: "Move announcement",
    surface: "anchorAnnouncement",
    status: { kind: "api" },
  },
  { name: "Custom springs", surface: "transition", status: { kind: "api" } },
  {
    name: "Close lead delay",
    surface: "surfaceCloseLeadDelayMs (preset field)",
    status: { kind: "api" },
  },
  { name: "Initial focus", surface: "initialFocus", status: { kind: "api" } },
  {
    name: "Class names",
    surface: "className (every part)",
    status: { kind: "api" },
  },
  { name: "Root id", surface: "id", status: { kind: "api" } },
  {
    name: "Accessible names",
    surface: "aria-label · aria-labelledby · Media alt",
    status: { kind: "api" },
  },
  {
    name: "Custom Close glyph",
    surface: "Close children",
    status: { kind: "api" },
  },
  {
    name: "Shadow asChild",
    surface: "Shadow asChild + child",
    status: { kind: "api" },
  },
];

type Keys<T> = T extends unknown ? keyof T : never;
type RowName = (typeof STATE_ROWS)[number]["name"];

/** Every public prop → the row that covers it. */
export const PROP_COVERAGE: {
  Root: Record<Keys<RootProps> | "preview", RowName>;
  Trigger: Record<Keys<TriggerProps | PreviewTriggerProps>, RowName>;
  Sheet: Record<Keys<SheetProps>, RowName>;
  Shared: Record<Keys<SharedProps>, RowName>;
  Content: Record<Keys<ContentProps>, RowName>;
  Item: Record<Keys<ItemProps>, RowName>;
  Close: Record<Keys<CloseProps>, RowName>;
  Media: Record<Keys<MediaProps>, RowName>;
  Shadow: Record<Keys<ShadowProps>, RowName>;
} = {
  Root: {
    children: "Parts",
    preview: "Link preview",
    defaultOpen: "Default open",
    open: "Controlled open",
    onOpenChange: "Open change callback",
    defaultAnchor: "Anchor",
    onAnchorChange: "Anchor change callback",
    draggable: "Drag and snap",
    persistKey: "Anchor persistence",
    anchorAnnouncement: "Move announcement",
    triggerSize: "Trigger size",
    sheetMaxWidth: "Sheet max width",
    shape: "Shape",
    buttonSize: "Button size",
    buttonWidth: "Button width",
    preset: "Motion presets",
    transition: "Custom springs",
    reduceMotion: "Reduced motion",
    id: "Root id",
    zIndex: "Stacking base",
    className: "Class names",
  },
  Trigger: {
    asChild: "Preview trigger",
    children: "Parts",
    className: "Class names",
    "aria-label": "Accessible names",
  },
  Sheet: {
    "aria-label": "Accessible names",
    "aria-labelledby": "Accessible names",
    children: "Parts",
    className: "Class names",
    dismissOnSwipe: "Swipe to dismiss",
    dismissOnBackdrop: "Backdrop dismiss",
    aspectRatio: "Aspect ratio",
    initialFocus: "Initial focus",
  },
  Shared: { children: "Parts", className: "Class names" },
  Content: { children: "Parts", className: "Class names" },
  Item: { children: "Parts", className: "Class names" },
  Close: {
    children: "Custom Close glyph",
    className: "Class names",
    "aria-label": "Accessible names",
  },
  Media: {
    src: "Media playing",
    poster: "Media poster, reduced motion",
    aspectRatio: "Aspect ratio",
    alt: "Accessible names",
    className: "Class names",
  },
  Shadow: {
    className: "Class names",
    asChild: "Shadow asChild",
    children: "Shadow asChild",
  },
};
