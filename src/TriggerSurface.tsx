"use client";

import { motion } from "motion/react";
import type { MotionValue } from "motion/react";
import type { Ref } from "react";
import { useIrisInternal } from "./context";

type TriggerSurfaceProps = {
  /** The trigger's own resting corner radius. */
  restRadius: MotionValue<number>;
  className: string;
  "data-wicket-iris-shape"?: string;
  "aria-hidden"?: "true";
} & (
  | { as: "div"; ref: Ref<HTMLDivElement> }
  | { as: "span"; ref: Ref<HTMLSpanElement> }
);

/**
 * The trigger-side half of the shared `-surface` layoutId, for the button and
 * link triggers. Render it only while closed: it is the entering element on
 * close, so it takes transition.close and its layout animation starts Root's
 * collapseProgress clock in the same frameloop pass, sharing a start time.
 */
export function TriggerSurface(props: TriggerSurfaceProps) {
  const {
    idBase,
    reduceMotion,
    transition,
    startMorphClock,
    sheetRect,
    collapseRadius,
  } = useIrisInternal("Trigger");

  const shared = {
    layoutId: reduceMotion ? undefined : `${idBase}-surface`,
    className: props.className,
    transition: transition.close,
    onLayoutAnimationStart: () => startMorphClock("trigger"),
    "data-wicket-iris-part": "trigger-surface",
    "data-wicket-iris-shape": props["data-wicket-iris-shape"],
    "aria-hidden": props["aria-hidden"],
    // Bound as a MotionValue: Motion's radius correction ignores CSS rules
    // and var() strings, and React would clobber an imperative write on
    // re-render. While the sheet is mounted, the radius Sheet relays; at
    // rest, the trigger's own. collapseRadius starts at 48 before the first
    // open and reads its token off the sheet, so it is never the resting
    // trigger's radius.
    style: {
      borderRadius: sheetRect !== null ? collapseRadius : props.restRadius,
    },
  };

  return props.as === "span" ? (
    <motion.span ref={props.ref} {...shared} />
  ) : (
    <motion.div ref={props.ref} {...shared} />
  );
}
