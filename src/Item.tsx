"use client";

import { motion } from "motion/react";
import { DirectChildContext, useVistaSheetInternal } from "./context";
import type { ItemProps } from "./types";
import styles from "./styles.module.css";

/**
 * <VistaSheet.Item> — a staggered child of <VistaSheet.Content>. No props
 * beyond children/className: the stagger interval is internal (§3).
 */
export function Item({ children, className }: ItemProps) {
  const ctx = useVistaSheetInternal("Item");
  const variants = ctx.reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { type: "spring" as const, stiffness: 420, damping: 36 },
        },
      };

  return (
    <motion.div
      className={`${styles.item} ${className ?? ""}`}
      data-vista-sheet-part="item"
      variants={variants}
    >
      <DirectChildContext.Provider value={false}>
        {children}
      </DirectChildContext.Provider>
    </motion.div>
  );
}
