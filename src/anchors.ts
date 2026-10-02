/**
 * anchors — the seven-anchor model: nearestAnchor, restingLeft/Top, anchorCenter,
 * sheetPlacement.
 *
 * Two axes per anchor — vertical (top | middle | bottom) and horizontal
 * (left | center | right) — each mapped to an alignment number (0 / 0.5 / 1).
 * `ANCHOR_AXES` is the single source of truth: every function below reads
 * numbers out of that table. None of them parse the AnchorId string itself
 * (no startsWith/endsWith, no `=== "center"` branches) — that is what let
 * `"center"` (vertical middle, horizontal center) join the model as a normal
 * anchor rather than a special case.
 *
 * Each anchor expresses the trigger's resting position as CSS edge offsets,
 * resolved against the live viewport. All functions here are pure — no DOM
 * reads, no window access beyond the values passed in — so the resting
 * position is always accurate regardless of orientation changes, window
 * resizes, or scroll behavior.
 *
 * Ported from seansmithdesign.com's anchorPositions.ts. The nav-spike helpers
 * (satelliteOffset, arcSide, bloomFromAnchor) are NOT ported — out of scope
 * for this package (see docs/PACKAGE-DESIGN.md §8). sheetPlacement below is a
 * generic replacement for bloomFromAnchor scoped to what Sheet.tsx needs:
 * left-edge px + which edge(s) the sheet pins to.
 */

export type AnchorId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center";

/** Which vertical band an anchor lives in. */
export type AnchorVertical = "top" | "middle" | "bottom";

/** Which horizontal third an anchor lives in. */
export type AnchorHorizontal = "left" | "center" | "right";

/** Fixed 16px inset from the viewport edge, for every anchor. */
export const EDGE_MARGIN = 16;

/** Default anchor for a fresh session. */
export const DEFAULT_ANCHOR: AnchorId = "bottom-center";

/**
 * The two-axis alignment table. Adding an anchor means adding a row here —
 * every other function derives its behavior from this table alone. There is
 * deliberately no "middle-left"/"middle-right" row: Sean approved center-only,
 * no middle-column siblings.
 */
export const ANCHOR_AXES: Record<
  AnchorId,
  { vertical: AnchorVertical; horizontal: AnchorHorizontal }
> = {
  "top-left": { vertical: "top", horizontal: "left" },
  "top-center": { vertical: "top", horizontal: "center" },
  "top-right": { vertical: "top", horizontal: "right" },
  "bottom-left": { vertical: "bottom", horizontal: "left" },
  "bottom-center": { vertical: "bottom", horizontal: "center" },
  "bottom-right": { vertical: "bottom", horizontal: "right" },
  center: { vertical: "middle", horizontal: "center" },
};

export const ALL_ANCHORS: AnchorId[] = Object.keys(ANCHOR_AXES) as AnchorId[];

const VERTICAL_ALIGNMENT: Record<AnchorVertical, number> = {
  top: 0,
  middle: 0.5,
  bottom: 1,
};

const HORIZONTAL_ALIGNMENT: Record<AnchorHorizontal, number> = {
  left: 0,
  center: 0.5,
  right: 1,
};

/** Reverse lookup, built once from ANCHOR_AXES, so nearestAnchor never has
 * to string-parse an AnchorId to get back to it. */
const AXES_TO_ANCHOR = new Map<string, AnchorId>(
  (
    Object.entries(ANCHOR_AXES) as [
      AnchorId,
      { vertical: AnchorVertical; horizontal: AnchorHorizontal },
    ][]
  ).map(([id, axes]) => [`${axes.vertical}:${axes.horizontal}`, id]),
);

function axesToAnchor(
  vertical: AnchorVertical,
  horizontal: AnchorHorizontal,
): AnchorId {
  // There is no middle-left/middle-right row in ANCHOR_AXES, so an
  // out-of-model combination can't come from nearestAnchor's own branches
  // below — this fallback exists so the function's return type stays a
  // guaranteed-valid AnchorId even if that ever changes.
  return AXES_TO_ANCHOR.get(`${vertical}:${horizontal}`) ?? DEFAULT_ANCHOR;
}

/**
 * Derive which anchor a drag-released trigger center belongs to.
 *
 * Regions are thirds (halves for side-column rows) of the room the trigger
 * can travel in, measured from its leading edge — the range
 * `[0, vpW - triggerWidth]` / `[0, vpH - triggerHeight]`. That is the same
 * range as Trigger.tsx's dragConstraints, and the inverse view of
 * restingLeft/restingTop (which place a trigger at alignment 0 / 0.5 / 1
 * within that same range).
 *
 * A zero-size trigger reproduces the old viewport thirds exactly: `offsetX`
 * collapses to `triggerCenterX` and `roomX` to `vpW`, so `offsetX*3 < roomX`
 * is `triggerCenterX < vpW/3`, etc.
 *
 * Any trigger's resting spot maps back to its own anchor while it has more
 * than 48px of room: restingLeft/Top place it at exactly 0, half, or all of
 * its room, and thirds boundaries sit at room/3 and 2*room/3 — at least 16px
 * from either end once room exceeds 48px.
 *
 * Strawman (v0.2): a trigger with no room to travel on an axis resolves to
 * the centre column / middle (bottom in side columns).
 */
export function nearestAnchor(
  triggerCenterX: number,
  triggerCenterY: number,
  vpW: number,
  vpH: number,
  triggerWidth: number,
  triggerHeight: number,
): AnchorId {
  const offsetX = triggerCenterX - triggerWidth / 2;
  const roomX = vpW - triggerWidth;
  let horizontal: AnchorHorizontal;
  if (roomX <= 0) {
    horizontal = "center";
  } else if (offsetX * 3 < roomX) {
    horizontal = "left";
  } else if (offsetX * 3 < roomX * 2) {
    horizontal = "center";
  } else {
    horizontal = "right";
  }

  const offsetY = triggerCenterY - triggerHeight / 2;
  const roomY = vpH - triggerHeight;
  let vertical: AnchorVertical;
  if (horizontal === "center") {
    if (roomY <= 0) {
      vertical = "middle";
    } else if (offsetY * 3 < roomY) {
      vertical = "top";
    } else if (offsetY * 3 < roomY * 2) {
      vertical = "middle";
    } else {
      vertical = "bottom";
    }
  } else {
    vertical = roomY <= 0 || offsetY * 2 >= roomY ? "bottom" : "top";
  }

  return axesToAnchor(vertical, horizontal);
}

/**
 * Left edge (viewport px) of the trigger at its resting position for the
 * given anchor: `EDGE_MARGIN + (vpW - triggerWidth - 2*EDGE_MARGIN) * alignment`,
 * where alignment is the anchor's horizontal alignment (0 / 0.5 / 1). This
 * collapses to the original per-case formulas exactly: alignment 0 ->
 * EDGE_MARGIN, alignment 1 -> vpW - triggerWidth - EDGE_MARGIN, alignment 0.5
 * -> vpW/2 - triggerWidth/2.
 */
export function restingLeft(
  anchor: AnchorId,
  vpW: number,
  triggerWidth: number,
): number {
  const alignment = HORIZONTAL_ALIGNMENT[ANCHOR_AXES[anchor].horizontal];
  return EDGE_MARGIN + (vpW - triggerWidth - 2 * EDGE_MARGIN) * alignment;
}

/**
 * Top edge (viewport px) of the trigger at its resting position for the
 * given anchor. Same alignment formula as restingLeft, on the vertical axis
 * — the "middle" vertical value (center anchor only) is new; the "top"/
 * "bottom" cases collapse to the original formulas exactly.
 */
export function restingTop(
  anchor: AnchorId,
  vpH: number,
  triggerHeight: number,
): number {
  const alignment = VERTICAL_ALIGNMENT[ANCHOR_AXES[anchor].vertical];
  return EDGE_MARGIN + (vpH - triggerHeight - 2 * EDGE_MARGIN) * alignment;
}

/**
 * Trigger center position (viewport px) for a given anchor.
 */
export function anchorCenter(
  anchor: AnchorId,
  vpW: number,
  vpH: number,
  triggerWidth: number,
  triggerHeight: number,
): { x: number; y: number } {
  return {
    x: restingLeft(anchor, vpW, triggerWidth) + triggerWidth / 2,
    y: restingTop(anchor, vpH, triggerHeight) + triggerHeight / 2,
  };
}

/** Resolved sheet placement derived from an AnchorId. */
export interface SheetPlacement {
  /** Sheet's left edge in viewport px. */
  anchorX: number;
  /** Sheet's pinned top offset in viewport px, or undefined ("auto") when
   * the sheet's top edge is not pinned. */
  topPx: number | undefined;
  /** Sheet's pinned bottom offset in viewport px, or undefined ("auto") when
   * the sheet's bottom edge is not pinned. */
  bottomPx: number | undefined;
  /** CSS max-height value for this anchor. See `sheetMaxHeight`. */
  maxHeight: string;
  /** CSS width. A px value when a valid aspectRatio was passed to
   * sheetPlacement; otherwise SHEET_DEFAULT_WIDTH (the .sheet CSS default). */
  width: string;
  /** CSS height. A px value when a valid aspectRatio was passed to
   * sheetPlacement; otherwise SHEET_DEFAULT_HEIGHT (the .sheet CSS default). */
  height: string;
}

/**
 * CSS max-height for a given anchor's vertical alignment.
 *
 * - top-only (grows downward from a pinned top edge): the sheet may use the
 *   full viewport below the pinned top edge, minus that edge's own 16px
 *   margin and a matching 16px margin at the bottom —
 *   `calc(100dvh - 32px)`. There is no separate 88dvh cap: nothing pins the
 *   bottom edge, so 88dvh would cut the sheet short for no reason (this was
 *   the exact regression introduced when a single shared `.sheet` rule
 *   replaced this per-anchor override — see d020d91 vs f55cb3d).
 * - bottom-only (grows upward from a pinned bottom edge): unchanged from
 *   the original six-anchor model, `88dvh` flat.
 * - middle (center anchor, both edges pinned): needs both caps, since
 *   nothing else stops the fit-content box from touching either margin on
 *   a very short viewport — `min(88dvh, calc(100dvh - 32px))`.
 */
function sheetMaxHeight(anchor: AnchorId): string {
  const vertical = ANCHOR_AXES[anchor].vertical;
  if (vertical === "top") {
    return `calc(100dvh - ${EDGE_MARGIN * 2}px)`;
  }
  if (vertical === "middle") {
    return `min(88dvh, calc(100dvh - ${EDGE_MARGIN * 2}px))`;
  }
  return "88dvh";
}

/**
 * Numeric px twin of `sheetMaxHeight`, for the aspect-ratio contain-fit
 * below, which needs an actual number to multiply by the ratio rather than a
 * CSS string. Must mirror sheetMaxHeight's CSS strings exactly (dvh treated
 * as vh, since this runs against a live vpH already read from the DOM): top
 * -> vpH - EDGE_MARGIN*2; middle -> min(0.88*vpH, vpH - EDGE_MARGIN*2);
 * bottom -> 0.88*vpH.
 */
function sheetMaxHeightPx(anchor: AnchorId, vpH: number): number {
  const vertical = ANCHOR_AXES[anchor].vertical;
  if (vertical === "top") {
    return vpH - EDGE_MARGIN * 2;
  }
  if (vertical === "middle") {
    return Math.min(0.88 * vpH, vpH - EDGE_MARGIN * 2);
  }
  return 0.88 * vpH;
}

/** Default CSS width for .sheet — must equal the .sheet rule in
 * styles.module.css (enforced by the parity test in anchors.test.ts). */
export const SHEET_DEFAULT_WIDTH =
  "min(var(--vista-sheet-sheet-max-width, 480px), calc(100vw - 32px))";

/** Default CSS height for .sheet — must equal the .sheet rule in
 * styles.module.css (enforced by the parity test in anchors.test.ts). */
export const SHEET_DEFAULT_HEIGHT = "fit-content";

/**
 * sheetPlacement — derive the sheet's pinned edge(s) + horizontal position
 * from an AnchorId, clamped so the full sheet stays on-screen.
 *
 *   vertical alignment < 1 (top, middle) -> top pinned at 16px
 *   vertical alignment > 0 (middle, bottom) -> bottom pinned at 16px
 *
 * top-*    anchors (alignment 0) -> top only    -> sheet grows downward
 * bottom-* anchors (alignment 1) -> bottom only  -> sheet grows upward
 * center   (alignment 0.5)       -> both pinned  -> sheet centers vertically
 *   (via .sheet's `margin-block: auto` + `height: fit-content` in
 *   styles.module.css — this function only supplies the two offsets).
 */
export function sheetPlacement(
  anchor: AnchorId,
  vpW: number,
  vpH: number,
  triggerWidth: number,
  sheetMaxWidth: number,
  aspectRatio?: number,
): SheetPlacement {
  const SHEET_MARGIN = 16;
  const centerX = restingLeft(anchor, vpW, triggerWidth) + triggerWidth / 2;

  const hasValidRatio =
    typeof aspectRatio === "number" &&
    Number.isFinite(aspectRatio) &&
    aspectRatio > 0;

  let sheetHalfWidth: number;
  let width: string;
  let height: string;
  if (hasValidRatio) {
    const resolvedWidth = Math.min(
      Math.min(sheetMaxWidth, vpW - 32),
      sheetMaxHeightPx(anchor, vpH) * aspectRatio,
    );
    const resolvedHeight = resolvedWidth / aspectRatio;
    sheetHalfWidth = resolvedWidth / 2;
    // Strawman (v0.2): no px rounding.
    width = `${resolvedWidth}px`;
    height = `${resolvedHeight}px`;
  } else {
    sheetHalfWidth = Math.min(sheetMaxWidth, vpW - 32) / 2;
    width = SHEET_DEFAULT_WIDTH;
    height = SHEET_DEFAULT_HEIGHT;
  }

  const clampedSheetCenterX = Math.min(
    Math.max(centerX, sheetHalfWidth + SHEET_MARGIN),
    vpW - sheetHalfWidth - SHEET_MARGIN,
  );
  const clampedAnchorX = Math.max(
    SHEET_MARGIN,
    clampedSheetCenterX - sheetHalfWidth,
  );

  const verticalAlignment = VERTICAL_ALIGNMENT[ANCHOR_AXES[anchor].vertical];
  const topPx =
    verticalAlignment < 1 ? Math.max(SHEET_MARGIN, EDGE_MARGIN) : undefined;
  const bottomPx = verticalAlignment > 0 ? SHEET_MARGIN : undefined;

  return {
    anchorX: clampedAnchorX,
    topPx,
    bottomPx,
    maxHeight: sheetMaxHeight(anchor),
    width,
    height,
  };
}

/** Gap between a link line and its preview card. */
export const PREVIEW_GAP_PX = 8;

/** Which side of the link line the preview card prefers. The card flips to
 * the other side when the preferred one has no room. Sean's dial: "above"
 * covers text the reader has already read; "below" is the Wikipedia/GitHub
 * convention. */
export const PREVIEW_PREFERRED_SIDE: "above" | "below" = "above";

/** Card size when <Sheet> is given no aspectRatio in preview mode (360x520). */
export const PREVIEW_DEFAULT_ASPECT_RATIO = 360 / 520;

export interface PreviewPlacementResult {
  /** Card left edge, viewport px. */
  left: number;
  /** Card top edge, viewport px. */
  top: number;
  side: "above" | "below";
}

/**
 * previewPlacement — where a link-preview card goes. Pure and computed once
 * at open: it prefers PREVIEW_PREFERRED_SIDE of the link line with a
 * PREVIEW_GAP_PX gap, flips to the other side when that has no room, and is
 * horizontally centred on the pointer x, clamped to a 16px viewport gutter.
 * When neither side fits it takes the side with more room and clamps the
 * card into the viewport.
 */
export function previewPlacement(
  pointer: { x: number; y: number },
  line: { top: number; bottom: number },
  sheet: { width: number; height: number },
  viewport: { width: number; height: number },
): PreviewPlacementResult {
  const minLeft = EDGE_MARGIN;
  const maxLeft = Math.max(minLeft, viewport.width - EDGE_MARGIN - sheet.width);
  const left = Math.min(Math.max(pointer.x - sheet.width / 2, minLeft), maxLeft);

  const minTop = EDGE_MARGIN;
  const maxTop = viewport.height - EDGE_MARGIN - sheet.height;
  const aboveTop = line.top - PREVIEW_GAP_PX - sheet.height;
  const belowTop = line.bottom + PREVIEW_GAP_PX;
  const fits = {
    above: aboveTop >= minTop,
    below: belowTop <= maxTop,
  };

  const preferred = PREVIEW_PREFERRED_SIDE;
  const other = preferred === "above" ? "below" : "above";
  let side: "above" | "below";
  if (fits[preferred]) side = preferred;
  else if (fits[other]) side = other;
  else {
    const roomAbove = line.top - PREVIEW_GAP_PX - EDGE_MARGIN;
    const roomBelow =
      viewport.height - EDGE_MARGIN - line.bottom - PREVIEW_GAP_PX;
    side = roomAbove >= roomBelow ? "above" : "below";
  }

  const rawTop = side === "above" ? aboveTop : belowTop;
  const top = Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxTop));
  return { left, top, side };
}

/**
 * previewSheetPlacement — previewPlacement expressed as the SheetPlacement
 * <Sheet> writes inline. The card contain-fits sheetMaxWidth, the viewport
 * (minus the gutter) and the aspect ratio, so its size is known before it
 * mounts.
 */
export function previewSheetPlacement(
  pointer: { x: number; y: number },
  line: { top: number; bottom: number },
  vpW: number,
  vpH: number,
  sheetMaxWidth: number,
  aspectRatio: number,
): SheetPlacement {
  const width = Math.min(
    sheetMaxWidth,
    vpW - EDGE_MARGIN * 2,
    (vpH - EDGE_MARGIN * 2) * aspectRatio,
  );
  const height = width / aspectRatio;
  const { left, top } = previewPlacement(
    pointer,
    line,
    { width, height },
    { width: vpW, height: vpH },
  );
  return {
    anchorX: left,
    topPx: top,
    bottomPx: undefined,
    maxHeight: `calc(100dvh - ${EDGE_MARGIN * 2}px)`,
    width: `${width}px`,
    height: `${height}px`,
  };
}
