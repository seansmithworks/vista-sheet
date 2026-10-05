import { RADIUS_HOLD_FRACTION } from "./motion";

/**
 * The trigger's shape family. Default "circle" keeps every existing consumer
 * behaviour-identical — see resolveTriggerCornerRadius/initialTriggerRestRadius
 * below, whose circle branch reproduces today's min(token, size/2) exactly.
 */
export const TRIGGER_SHAPES = [
  "circle",
  "squircle",
  "rounded-square",
  "square",
  "rectangle",
] as const;

export type TriggerShape = (typeof TRIGGER_SHAPES)[number];

export const DEFAULT_TRIGGER_SHAPE: TriggerShape = "circle";

export const BUTTON_SIZES = ["s", "m", "l"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];
export const DEFAULT_BUTTON_SIZE: ButtonSize = "m";

export interface TriggerBox {
  width: number;
  height: number;
}

/**
 * Resolve the trigger's actual box: for shape="rectangle" this is the
 * measured DOM size (label-sized by default, or the consumer's fixed
 * buttonWidth via CSS); every other shape is the square triggerSize.
 * Returns the square fallback whenever no measurement has landed yet, so
 * callers never have to null-check on first render.
 */
export function resolveTriggerBox({
  shape,
  triggerSize,
  measured,
}: {
  shape: TriggerShape;
  triggerSize: number;
  measured: TriggerBox | null;
}): TriggerBox {
  if (shape === "rectangle" && measured !== null) return measured;
  return { width: triggerSize, height: triggerSize };
}

// Strawman (v0.2): plain radius, 25% of trigger size, awaiting Sean's dial
// pass (DESIGN.md §3).
export const ROUNDED_SQUARE_RADIUS_FRACTION = 0.25;

// Strawman (v0.2): plain-radius stand-in where CSS corner-shape is
// unsupported (Safari, Firefox); chosen so the corner's 45° point matches the
// n=4 superellipse: (1 − 2^−¼) / (2(1 − 2^−½)); awaiting dial.
export const SQUIRCLE_FALLBACK_RADIUS_FRACTION = 0.2716;

let cornerShapeSupportMemo: boolean | undefined;

/** Module-level memo: CSS.supports("corner-shape", "squircle") never changes
 * within a session, so this is computed once. Node has no `CSS` global, so
 * this is `false` under vitest and during SSR. */
export function supportsCornerShape(): boolean {
  if (cornerShapeSupportMemo !== undefined) return cornerShapeSupportMemo;
  cornerShapeSupportMemo =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("corner-shape", "squircle");
  return cornerShapeSupportMemo;
}

/**
 * The trigger's resting corner radius in px. `token` is
 * --vista-sheet-trigger-radius and caps every shape (defaults to today's
 * 9999px CSS fallback). `triggerSize` means the trigger's shorter side —
 * callers with a non-square trigger (rectangle) pass
 * min(width, height). Exhaustive switch — a shape added to TRIGGER_SHAPES
 * without a case here fails to compile.
 */
export function resolveTriggerCornerRadius({
  shape,
  triggerSize,
  token = 9999,
  cornerShapeSupported = false,
}: {
  shape: TriggerShape;
  triggerSize: number;
  token?: number;
  cornerShapeSupported?: boolean;
}): number {
  switch (shape) {
    case "circle":
      return Math.min(token, triggerSize / 2);
    case "squircle":
      return cornerShapeSupported
        ? Math.min(token, triggerSize / 2)
        : Math.min(token, triggerSize * SQUIRCLE_FALLBACK_RADIUS_FRACTION);
    case "rounded-square":
      return Math.min(token, triggerSize * ROUNDED_SQUARE_RADIUS_FRACTION);
    case "square":
      return 0;
    // Strawman (v0.2): a rectangle's corners follow the circle rule on its
    // shorter side (callers pass min(width, height)) - a pill by default,
    // capped by --vista-sheet-trigger-radius.
    case "rectangle":
      return Math.min(token, triggerSize / 2);
    default: {
      const exhaustive: never = shape;
      return exhaustive;
    }
  }
}

/**
 * First-render seed for the trigger's resting radius, before the
 * --vista-sheet-trigger-radius token can be read from the DOM.
 *
 * Strawman (v0.2): squircle seeds 9999 so Chromium's first frame is the
 * exact squircle; Safari shows one frame of circle at load.
 */
export function initialTriggerRestRadius(
  shape: TriggerShape,
  triggerSize: number,
): number {
  switch (shape) {
    case "circle":
    case "squircle":
    case "rectangle":
      return 9999;
    case "rounded-square":
      return triggerSize * ROUNDED_SQUARE_RADIUS_FRACTION;
    case "square":
      return 0;
    default: {
      const exhaustive: never = shape;
      return exhaustive;
    }
  }
}

/**
 * The surface's hold-then-round curve: holds at `sheetRadius` until
 * RADIUS_HOLD_FRACTION, then interpolates linearly to `triggerCornerRadius`
 * by p=1. Shared by useCollapseRadius.ts and Shadow.tsx.
 */
export function collapseRadiusAt(
  p: number,
  sheetRadius: number,
  triggerCornerRadius: number,
): number {
  if (p <= RADIUS_HOLD_FRACTION) return sheetRadius;
  const t = Math.min(
    1,
    (p - RADIUS_HOLD_FRACTION) / (1 - RADIUS_HOLD_FRACTION),
  );
  return sheetRadius + (triggerCornerRadius - sheetRadius) * t;
}
