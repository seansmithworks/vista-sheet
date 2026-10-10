"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useIrisInternal } from "./context";
import {
  CLOSE_EXIT_SEC,
  CLOSE_FADE_IN_SEC,
  CLOSE_REVEAL_PROGRESS,
  CLOSE_REVEAL_ROTATE_DEG,
  CLOSE_REVEAL_ROTATE_SPRING,
  CLOSE_REVEAL_SPRING,
  CONTENT_FADE_OUT_MS,
} from "./motion";
import type { CloseProps } from "./types";
import styles from "./styles.module.css";

function DefaultCloseGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * <Iris.Close> — the close button. Registers itself in context on
 * mount so Root/Sheet can dev-warn if the sheet opens with no visible close
 * control rendered (docs/PACKAGE-DESIGN.md §1). Escape and backdrop click are
 * not a substitute.
 *
 * Reveals once the open has finished (collapseProgress reaches
 * CLOSE_REVEAL_PROGRESS): fades in and springs from scale 0 while turning
 * into place. A passive effect, so it reads collapseProgress after Root's
 * layout effect has reset it to 1 for this open. Also reveals immediately on
 * focus — a keyboard user can Tab onto Close before the spring settles (the
 * panel holds initial focus and the trap's first target is whatever's first
 * in DOM order), and a focused-but-invisible control (opacity 0, scale 0)
 * is a defect: still in the tab order, just not visible to a sighted
 * keyboard user.
 */
export function Close({ children, className, ...aria }: CloseProps) {
  const ctx = useIrisInternal("Close");
  const { registerClose, setOpen, collapseProgress, reduceMotion } = ctx;
  // Seeded from the clock so a sheet mounted open (already at rest) renders
  // Close in place instead of spinning it in.
  const [revealed, setRevealed] = useState(
    () => collapseProgress.get() <= CLOSE_REVEAL_PROGRESS,
  );

  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0, rotate: CLOSE_REVEAL_ROTATE_DEG };
  const shown = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, rotate: 0 };

  useEffect(() => registerClose(), [registerClose]);

  useEffect(() => {
    if (collapseProgress.get() <= CLOSE_REVEAL_PROGRESS) {
      setRevealed(true);
      return;
    }
    return collapseProgress.on("change", (v) => {
      if (v <= CLOSE_REVEAL_PROGRESS) setRevealed(true);
    });
  }, [collapseProgress]);

  return (
    <motion.button
      type="button"
      className={`${styles.closeButton} ${className ?? ""}`}
      data-orrery-iris-part="close"
      onClick={() => setOpen(false)}
      onFocus={() => setRevealed(true)}
      initial={hidden}
      animate={revealed ? shown : hidden}
      transition={{
        ...CLOSE_REVEAL_SPRING,
        rotate: CLOSE_REVEAL_ROTATE_SPRING,
        opacity: { duration: CLOSE_FADE_IN_SEC, ease: [0.23, 1, 0.32, 1] },
      }}
      exit={{
        ...hidden,
        transition: reduceMotion
          ? { duration: CONTENT_FADE_OUT_MS / 1000 }
          : {
              duration: CLOSE_EXIT_SEC,
              ease: [0.23, 1, 0.32, 1],
              opacity: { duration: CLOSE_EXIT_SEC, ease: "linear" },
            },
      }}
      {...aria}
    >
      {children ?? <DefaultCloseGlyph />}
    </motion.button>
  );
}
