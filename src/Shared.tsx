"use client";

import { motion } from "motion/react";
import { useIrisInternal, useIrisSlot } from "./context";
import type { SharedProps } from "./types";
import styles from "./styles.module.css";

/**
 * <Iris.Shared> — the shared-element slot. Rendered TWICE: once inside
 * <Iris.Trigger>, once inside <Iris.Sheet>, with the same
 * children. It carries its own layoutId and its own spring
 * (transition.shared), independent of the surface morph.
 *
 * Structural rule enforced by construction: this renders as a SIBLING of the
 * trigger seed surface in Trigger.tsx, never nested inside it — see
 * docs/PACKAGE-DESIGN.md §1 and the nested-layoutId-inherits-parent-FLIP
 * landmine. Nesting it would make its projection inherit the surface's
 * close-morph FLIP and freeze it at the surface's transient mid-collapse box.
 *
 * `data-orrery-iris-slot="trigger" | "sheet"` (from SlotContext, provided by
 * <Trigger> and <Sheet>) is the mechanism behind two review findings at
 * once: it gives the trigger-side instance its inset circular clip (M7) and
 * gives the sheet-side instance an in-flow, non-clipping layout instead of
 * the single `.shared` rule that could never serve both correctly (B2).
 */
export function Shared({ children, className }: SharedProps) {
  const ctx = useIrisInternal("Shared");
  const slot = useIrisSlot();
  return (
    <motion.div
      layoutId={ctx.reduceMotion ? undefined : `${ctx.idBase}-shared`}
      className={`${styles.shared} ${className ?? ""}`}
      transition={ctx.transition.shared}
      data-orrery-iris-part="shared"
      data-orrery-iris-slot={slot}
      data-orrery-iris-shape={ctx.shape}
    >
      {children}
    </motion.div>
  );
}
