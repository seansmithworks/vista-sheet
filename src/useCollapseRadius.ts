"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { readVarPx } from "./readVarPx";
import {
  collapseRadiusAt,
  resolveTriggerCornerRadius,
  supportsCornerShape,
} from "./shape";
import type { TriggerShape } from "./shape";

/**
 * useCollapseRadius — the hold-then-round border-radius curve as a numeric-px
 * MotionValue. Called from Sheet.tsx, which relays it into Root's stable
 * `ctx.collapseRadius` for Trigger.tsx to bind on close; keep the call where
 * it is, since moving it shifts effect order and costs the close-tracking
 * gate px. Reads the shape tokens off `varsElRef` (Sheet passes `sheetRef`).
 */
export function useCollapseRadius({
  collapseProgress,
  open,
  shape,
  triggerSize,
  varsElRef,
}: {
  collapseProgress: MotionValue<number>;
  open: boolean;
  shape: TriggerShape;
  triggerSize: number;
  varsElRef: MutableRefObject<HTMLElement | null>;
}): MotionValue<number> {
  // Read via a ref (not React state) so the useTransform closure below always
  // reads the latest values without needing a "tick" motion value to force
  // recomputation — Motion's array-form useTransform only recomputes when one
  // of the listed MotionValues changes, not on ordinary re-render.
  const radiusVarsRef = useRef({ sheetRadius: 48, triggerRadius: 9999 });

  // Read the shape tokens once per open — a designer's CSS override on
  // --orrery-iris-sheet-radius / --orrery-iris-trigger-radius is honored
  // without becoming a JS prop (docs/PACKAGE-DESIGN.md §3).
  useEffect(() => {
    if (!open) return;
    radiusVarsRef.current = {
      sheetRadius: readVarPx(
        varsElRef.current,
        "--orrery-iris-sheet-radius",
        48,
      ),
      triggerRadius: readVarPx(
        varsElRef.current,
        "--orrery-iris-trigger-radius",
        9999,
      ),
    };
  }, [open, varsElRef]);

  // A pure function of collapseProgress, never wall-clock time, so the hold
  // tracks how far the box has contracted however long the close spring
  // runs. The curve (collapseRadiusAt) is shared with Shadow.tsx. `shape` and
  // `triggerSize` are read live: Motion re-runs the latest closure each render.
  return useTransform(collapseProgress, (p: number) => {
    const { sheetRadius, triggerRadius } = radiusVarsRef.current;
    return collapseRadiusAt(
      p,
      sheetRadius,
      resolveTriggerCornerRadius({
        shape,
        triggerSize,
        token: triggerRadius,
        cornerShapeSupported: supportsCornerShape(),
      }),
    );
  });
}
