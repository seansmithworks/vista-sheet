"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useIrisInternal } from "./context";
import {
  CONTENT_FADE_OUT_MS,
  ITEM_STAGGER_INTERVAL_SEC,
  OPEN_CONTENT_REVEAL_DELAY_SEC,
} from "./motion";
import type { ContentProps } from "./types";
import styles from "./styles.module.css";

/**
 * <Iris.Content> — holds sheet content at opacity 0 through the bloom
 * and reveals it after, then fades it out first on close. Owns the scroll
 * region: applies overflow-y:auto to itself and reports its scroll element
 * into context so Sheet's swipe-to-close handler can gate on scrollTop
 * (docs/PACKAGE-DESIGN.md §1 — this coupling is easy to lose in an
 * extraction).
 */
export function Content({ children, className }: ContentProps) {
  const ctx = useIrisInternal("Content");
  const { reduceMotion, contentScrollElRef } = ctx;

  // When the content is taller than the scroll region, the region itself
  // needs a tab stop (a11y B1/m1) — otherwise a sheet whose content has no
  // interactive controls of its own (long text, a video, a static list) is
  // unreachable by keyboard/AT: nothing inside it is tabbable, so the trap
  // holds focus on the panel forever and PageDown/arrow scrolling never
  // gets a target. Recomputed at mount and on resize; content that changes
  // height after that (an image loading, a live update) is not covered —
  // out of scope for this fix.
  const [tabbable, setTabbable] = useState(false);
  useEffect(() => {
    const el = contentScrollElRef.current;
    if (!el) return;
    const check = () => setTabbable(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [contentScrollElRef]);

  const variants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.18 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : {
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            delay: OPEN_CONTENT_REVEAL_DELAY_SEC,
            duration: 0.26,
            // delayChildren, not `when: "beforeChildren"`, so the stagger runs
            // under the container's fade instead of after it. Deliberate
            // tradeoff: the first Item paints while the box is still scaling
            // its last few percent, in exchange for a much earlier reveal.
            delayChildren: OPEN_CONTENT_REVEAL_DELAY_SEC,
            staggerChildren: ITEM_STAGGER_INTERVAL_SEC,
          },
        },
        exit: {
          opacity: 0,
          y: 6,
          transition: {
            duration: CONTENT_FADE_OUT_MS / 1000,
          },
        },
      };

  return (
    <motion.div
      ref={contentScrollElRef}
      className={`${styles.content} ${className ?? ""}`}
      data-wicket-iris-part="content"
      tabIndex={tabbable ? 0 : undefined}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
