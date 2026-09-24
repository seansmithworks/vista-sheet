"use client";

import { useContext, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  DirectChildContext,
  useVistaSheetInternal,
  useVistaSheetSlot,
} from "./context";
import type { SharedProps } from "./types";
import styles from "./styles.module.css";

// `process` is not declared in a Vite consumer's tsconfig — see Sheet.tsx's
// matching declaration/note.
declare const process: { env: { NODE_ENV?: string } };

let warnedNotDirectChild = false;
let warnedSizeMismatch = false;

// A few px, not zero: sub-pixel layout rounding is routine (fractional
// devicePixelRatio, border rounding) and is not the fixed-px-child trap this
// exists to catch.
const SIZE_MISMATCH_TOLERANCE_PX = 4;

/**
 * <VistaSheet.Shared> — the shared-element slot. Rendered TWICE: once inside
 * <VistaSheet.Trigger>, once inside <VistaSheet.Sheet>, with the same
 * children. It carries its own layoutId and its own spring
 * (transition.shared), independent of the surface morph.
 *
 * Structural rule enforced by construction: this renders as a SIBLING of the
 * trigger seed surface in Trigger.tsx, never nested inside it — see
 * docs/PACKAGE-DESIGN.md §1 and the nested-layoutId-inherits-parent-FLIP
 * landmine. Nesting it would make its projection inherit the surface's
 * close-morph FLIP and freeze it at the surface's transient mid-collapse box.
 *
 * `data-vista-sheet-slot="trigger" | "sheet"` (from SlotContext, provided by
 * <Trigger> and <Sheet>) is the mechanism behind two review findings at
 * once: it gives the trigger-side instance its inset circular clip (M7) and
 * gives the sheet-side instance an in-flow, non-clipping layout instead of
 * the single `.shared` rule that could never serve both correctly (B2).
 */
export function Shared({ children, className }: SharedProps) {
  const ctx = useVistaSheetInternal("Shared");
  const slot = useVistaSheetSlot();
  const isDirectChild = useContext(DirectChildContext);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (isDirectChild || warnedNotDirectChild) return;
    warnedNotDirectChild = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[vista-sheet] <VistaSheet.Shared> is not a direct child of " +
        "<VistaSheet.Trigger>/<VistaSheet.Sheet> — it is nested inside " +
        "<VistaSheet.Item>/<VistaSheet.Content> or another wrapper. Move it " +
        "to be a direct child of Trigger/Sheet: nesting makes its layoutId " +
        "projection inherit the wrapper's own FLIP and freeze mid-collapse.",
    );
  }, [isDirectChild]);

  // Dev-only: once the open settles (collapseProgress reaches 0 — see
  // Sheet.tsx's data-vista-sheet-settled note for the same threshold's
  // established meaning), check whether the rendered child disagrees with
  // the wrapper's own --vista-sheet-shared-size box. A child given a fixed
  // px width/height ignores the wrapper's CSS-var sizing and either
  // overflows the clip (trigger slot) or leaves a gap (sheet slot) —
  // silent, since nothing errors, just looks wrong.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (warnedSizeMismatch) return;
    const unsubscribe = ctx.collapseProgress.on("change", (v) => {
      if (v !== 0) return;
      const wrapper = wrapperRef.current;
      const child = wrapper?.firstElementChild;
      if (!wrapper || !child) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();
      const dw = Math.abs(wrapperRect.width - childRect.width);
      const dh = Math.abs(wrapperRect.height - childRect.height);
      if (
        dw <= SIZE_MISMATCH_TOLERANCE_PX &&
        dh <= SIZE_MISMATCH_TOLERANCE_PX
      ) {
        return;
      }
      warnedSizeMismatch = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[vista-sheet] <VistaSheet.Shared>'s child renders at " +
          `${Math.round(childRect.width)}x${Math.round(childRect.height)}px, ` +
          "which disagrees with the --vista-sheet-shared-size box " +
          `(${Math.round(wrapperRect.width)}x${Math.round(wrapperRect.height)}px). ` +
          "Size the child from --vista-sheet-shared-size (or 100%) instead of " +
          "a fixed px value, so it tracks the shared element through the morph.",
      );
    });
    return unsubscribe;
  }, [ctx.collapseProgress]);

  return (
    <motion.div
      ref={wrapperRef}
      layoutId={ctx.reduceMotion ? undefined : `${ctx.idBase}-shared`}
      className={`${styles.shared} ${className ?? ""}`}
      transition={ctx.transition.shared}
      data-vista-sheet-part="shared"
      data-vista-sheet-slot={slot}
      data-vista-sheet-shape={ctx.shape}
    >
      {children}
    </motion.div>
  );
}
