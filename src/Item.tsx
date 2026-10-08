"use client";

import { motion } from "motion/react";
import { useIrisInternal } from "./context";
import type { ItemProps } from "./types";
import styles from "./styles.module.css";

/**
 * <Iris.Item> — a staggered child of <Iris.Content>. No props
 * beyond children/className: the stagger interval is internal (§3).
 */
export function Item({ children, className }: ItemProps) {
  const ctx = useIrisInternal("Item");
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
      data-wicket-iris-part="item"
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
