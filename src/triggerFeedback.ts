/**
 * Trigger hover/pressed feedback (styles.module.css, "Trigger feedback").
 *
 * One attribute, absent until the first interaction, written imperatively
 * on both painters of the resting trigger: the trigger button (its surface,
 * Shared and label take the transform) and <Iris.Shadow>'s element. Both read the same CSS vars,
 * so the shadow and the surface never disagree (DESIGN.md §4.1).
 *
 * - "hover" / "pressed": the lift or the press scale, transitioned.
 * - "rest": back to rest, transitioned.
 * - "none": back to rest instantly. Written before any open, because the
 *   morph's first frame is measured from the trigger's rendered box in the
 *   same task as the click; a transform still transitioning out would be
 *   measured as the morph's starting geometry.
 */
export type TriggerFeedback = "hover" | "pressed" | "rest" | "none";

const ATTR = "data-wicket-iris-feedback";

export function writeTriggerFeedback(
  els: ReadonlyArray<HTMLElement | null>,
  state: TriggerFeedback,
) {
  for (const el of els) el?.setAttribute(ATTR, state);
}
