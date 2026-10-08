import type { Transition } from "motion/react";
import type {
  MorphTransition,
  MotionPreset,
  Spring,
  SharedTransitionByDirection,
} from "./types";

// `process` is not declared in a Vite consumer's tsconfig (`types` is an
// allowlist, so @types/node never loads). Declare it locally rather than
// depending on the consumer's ambient globals — same pattern as Sheet.tsx.
declare const process: { env: { NODE_ENV?: string } };

/**
 * Default springs, verified against the source site's dialed values
 * (docs/PACKAGE-DESIGN.md §3). Each is exposed as a prop (transition.open /
 * .close / .shared); everything below the "internal" line is deliberately
 * NOT a prop — see §3's rationale for why each one stays a fixed constant.
 */
export const DEFAULT_OPEN_SPRING: Spring = {
  stiffness: 375,
  damping: 42.5,
  mass: 1.75,
};

/**
 * Close spring. Dialled by Sean on /tune, saved as "Version 4"
 * (docs/tuning/dialkit-morph-sheet-close.json): a judged value, not a
 * derived one. Slightly underdamped, so the box overshoots a few px into
 * the trigger at the end of a close. Re-dial on /tune; never hand-edit.
 */
export const DEFAULT_CLOSE_SPRING: Spring = {
  stiffness: 375,
  damping: 32,
  mass: 1,
};

/**
 * OPEN-direction shared spring. Stiff and near-critically damped (wn 22.4,
 * damping ratio 1.006) so the shared element clears the growing sheet without
 * overshoot.
 */
export const DEFAULT_SHARED_SPRING: Spring = {
  stiffness: 500,
  damping: 45,
};

/**
 * CLOSE-direction shared spring. The shared element starts its close with no
 * delay while the surface waits SURFACE_CLOSE_LEAD_DELAY_MS, so it leads the
 * box (a re-home, not a scale) and must still land with it. Dialled by eye in
 * the same "Version 4" pass as DEFAULT_CLOSE_SPRING; not derived, so don't
 * recompute it. This, the close spring and the lead delay are a dialled set:
 * change one and re-dial the others on /tune, or the shared element trails
 * the box and spills past the trigger's border ring.
 */
export const DEFAULT_SHARED_CLOSE_SPRING: Spring = {
  stiffness: 340,
  damping: 30,
  mass: 1,
};

/** Overdamped snap spring for the trigger's drag-end anchor snap. Not a prop. */
export const SNAP_SPRING: Spring = { stiffness: 700, damping: 52, mass: 1 };

// ── Internal choreography constants (docs/PACKAGE-DESIGN.md §3) ────────────
// Every one of these exists to suppress a specific artifact. None are props.

/** Fraction of the close progress spent holding sheetRadius before the shape
 * starts rounding toward the trigger. Prevents an over-rounded rectangle from
 * appearing before the box has actually contracted. Progress-based, not
 * time-based, so it holds correctly however long a consumer's close spring
 * runs. */
export const RADIUS_HOLD_FRACTION = 0.74;

/**
 * Delay (ms) before the surface box begins its close FLIP, so the shared
 * element visibly leads the shrink instead of scaling in lockstep. The
 * biggest lever on close duration; dialled as a set with
 * DEFAULT_SHARED_CLOSE_SPRING (see its note).
 */
export const SURFACE_CLOSE_LEAD_DELAY_MS = 35;

/** Delay (s) before sheet content starts revealing after the open bloom. */
export const OPEN_CONTENT_REVEAL_DELAY_SEC = 0.2;

/** Content fade-out duration (ms) on close, so content clears before
 * the box visibly collapses under it. */
export const CONTENT_FADE_OUT_MS = 80;

/** collapseProgress at or below which the open counts as finished, and
 * <Iris.Close> starts fading in, so the X never paints while the
 * surface is still scaling. Render Close as a direct child of <Sheet>, not
 * inside <Content>: Content's reveal transform makes it the X's containing
 * block, so an absolutely-positioned X jumps when that transform clears. */
export const CLOSE_REVEAL_PROGRESS = 0.01;

/** Strawman (v0.2): the collapseProgress at which a closing trigger's plain
 * children (everything except Shared/Media) start fading in, fully in at 1.
 * Derived from progress, never from spring velocity. */
export const TRIGGER_LABEL_REVEAL_START = 0.85;

/** Opacity of a closing trigger's plain-child label at collapse progress p. */
export function triggerLabelOpacity(p: number): number {
  if (!(p > TRIGGER_LABEL_REVEAL_START)) return 0;
  return Math.min(
    1,
    (p - TRIGGER_LABEL_REVEAL_START) / (1 - TRIGGER_LABEL_REVEAL_START),
  );
}

/** <Iris.Close> fade-in duration (s), once the open has finished. Shorter
 * than the spring below so the X is solid before its turn has landed. */
export const CLOSE_FADE_IN_SEC = 0.15;

/** <Iris.Close> reveal: scales 0 -> 1 while turning -90deg -> 0 (an X
 * is symmetric at 90deg, so the turn reads as a spin but lands seamlessly).
 * Light bounce only — this runs on every open. Movement is dropped under
 * reduced motion; the fade stays. */
export const CLOSE_REVEAL_ROTATE_DEG = -90;
export const CLOSE_REVEAL_SPRING = {
  type: "spring" as const,
  duration: 0.45,
  bounce: 0.25,
};
/** <Iris.Close> exit (s): the reveal in reverse — turns back to
 * CLOSE_REVEAL_ROTATE_DEG and scales to 0. A tween, not the spring, so it
 * clears fast; opacity is linear over the same span so the turn stays
 * visible instead of vanishing in the first frames. */
export const CLOSE_EXIT_SEC = 0.2;

/** Rotation's own spring, bouncier than scale's so the X over-rotates past
 * rest (~15deg on a 90deg turn) and swings back, without scale wobbling. */
export const CLOSE_REVEAL_ROTATE_SPRING = {
  type: "spring" as const,
  duration: 0.55,
  bounce: 0.5,
};

/** Stagger interval (s) between <Iris.Item> children. Widened from
 * 0.04 to 0.09 — settled (Sean, 2026-09-13) so title, body and actions read
 * as separate beats instead of one. */
export const ITEM_STAGGER_INTERVAL_SEC = 0.09;

/** Drag-vs-tap threshold, px. */
export const DRAG_THRESHOLD_PX = 5;

// Link-preview (Root `preview`) timings. Strawman: Sean's to dial.
/** Hover or keyboard focus must rest this long before a card opens. */
export const PREVIEW_HOVER_INTENT_MS = 150;
/** Grace after the pointer leaves link and card, to cross the gap. */
export const PREVIEW_CLOSE_GRACE_MS = 250;
/** Touch press-and-hold that opens a card. */
export const PREVIEW_LONG_PRESS_MS = 400;
/** Finger travel that turns a long-press into a scroll. */
export const PREVIEW_LONG_PRESS_SLOP_PX = 10;
/** Link-end corner radius of the morph (a text link has no radius to read). */
export const PREVIEW_TRIGGER_RADIUS_PX = 4;

/** Swipe-to-close thresholds. */
export const SWIPE_OFFSET_PX = 96;
export const SWIPE_VELOCITY_PX_S = 400;

/**
 * mergeTransition — a Spring shorthand or full Transition, falling back to a
 * default. Composes a `delay` onto the result only if the consumer did not
 * already specify one.
 */
export function mergeTransition(
  provided: Spring | Transition | undefined,
  fallback: Spring,
  delay?: number,
): Transition {
  // The `Spring | Transition` PROP TYPE cannot reject this at compile time:
  // Motion's own `Transition` structurally permits `mass` alongside
  // `visualDuration`/`bounce`, so `{visualDuration, bounce, mass}` typechecks
  // even though `DurationSpring` alone excludes `mass` (see its comment).
  // Dev-only runtime check for the footgun the type system can't catch —
  // NODE_ENV define-passthrough, same pattern as Sheet.tsx's warning (see
  // vite.lib.config.ts) — so production builds pay no cost and ship no extra
  // diagnostic string.
  if (
    process.env.NODE_ENV !== "production" &&
    provided &&
    "visualDuration" in provided &&
    "mass" in provided
  ) {
    console.warn(
      "[wicket-iris] A transition combines `visualDuration`/`bounce` with " +
        "`mass`. Motion resolves stiffness/damping/mass before it ever " +
        "looks at visualDuration/bounce, so `mass` silently discards both " +
        "and the spring falls back to Motion's defaults (measured: a " +
        "660ms settle becomes 2080ms). Remove `mass`, or switch to " +
        "`{ stiffness, damping, mass }` instead of the duration shorthand.",
    );
  }
  const base: Transition = provided
    ? isSpringShorthand(provided)
      ? { type: "spring", ...provided }
      : provided
    : { type: "spring", ...fallback };

  if (delay === undefined) return base;
  return "delay" in base && base.delay !== undefined
    ? base
    : { ...base, delay };
}

/**
 * Narrow `transition.shared` to its per-direction `{ open, close }` form. A
 * directional object carries one of those keys and none of a Transition's or a
 * Spring shorthand's own discriminators.
 */
export function isSharedByDirection(
  value: Spring | Transition | SharedTransitionByDirection,
): value is SharedTransitionByDirection {
  return (
    !("type" in value) &&
    !("stiffness" in value) &&
    !("duration" in value) &&
    ("open" in value || "close" in value)
  );
}

function isSpringShorthand(value: Spring | Transition): value is Spring {
  if ("type" in value || "duration" in value) return false;
  return (
    ("stiffness" in value && "damping" in value) ||
    // Motion's {visualDuration, bounce} shorthand — visualDuration is
    // spring-only, so its presence alone (with neither `type` nor
    // `duration` above) is enough to identify a spring.
    "visualDuration" in value
  );
}
// DurationSpring.bounce is required, not optional, even though Motion's own
// spring type marks it optional: Motion's duration-key list is
// ["duration", "bounce"] — visualDuration is NOT in it — so
// {visualDuration: 0.4} with no bounce never enters the duration-based
// resolution block at all and silently settles on Motion's plain defaults
// (1050ms on a 0->100 keyframe, vs. the intended ~400ms). Requiring bounce
// at the type level is the only thing closing that hole; do not make it
// optional to "match Motion's types" more closely. `bounce: 0` is still a
// perfectly valid, common value — Motion's own checks test `!== undefined`,
// not truthiness, so a zero bounce is unaffected by this requirement.

/**
 * Per-direction `shared` source, before it's merged against a package
 * default. `explicitShared` (the `transition.shared` prop) replaces
 * `presetShared` WHOLESALE when present — no deep merge across the three
 * possible shapes (Spring / Transition / {open, close}), same rule
 * `isSharedByDirection`'s caller documents. But "wholesale" only applies to
 * the shape the caller actually supplied: a directional `{ open }` object
 * that omits `close` must fall back to the PRESET's `close` for that
 * direction, not straight to the package default — otherwise
 * `preset={presets.snappy} transition={{ shared: { open: x } }}` silently
 * resets the close-direction shared spring to 340/30/1 instead of snappy's
 * 449.65/34.5, and the shared element trails the box by 45ms instead of
 * leading it (measured), spilling past the trigger's border ring.
 */
function resolveSharedForDirection(
  explicitShared: Spring | Transition | SharedTransitionByDirection | undefined,
  presetShared: Spring | Transition | SharedTransitionByDirection | undefined,
  open: boolean,
): Spring | Transition | undefined {
  // A single Spring/Transition applies to both directions.
  const pick = (
    shared: Spring | Transition | SharedTransitionByDirection | undefined,
  ) =>
    shared === undefined || !isSharedByDirection(shared)
      ? shared
      : open
        ? shared.open
        : shared.close;
  return pick(explicitShared) ?? pick(presetShared);
}

/**
 * Resolves every field an explicit `transition` prop and a `preset` can
 * touch into the three ready-to-use Transitions Root hands to Trigger/Sheet/
 * Shared: `open`, `close` and the direction-appropriate `shared`. Pulled out
 * of Root's component body so it can be unit tested directly (motion.test.ts)
 * rather than only through a re-declared copy of the same expression — see
 * the F3 finding this fixes.
 *
 * Field-by-field precedence for `open`/`close`: an explicit
 * `transition.<field>` wins over the same field on `preset.transition`, and
 * only then falls back to the package default. `shared` goes through
 * {@link resolveSharedForDirection} instead, since it is direction-aware and
 * replaced whole rather than merged.
 */
export function resolveMotion({
  preset,
  transition,
  surfaceCloseLeadDelayMs,
  reduceMotion,
  open,
}: {
  preset: MotionPreset | undefined;
  transition: MorphTransition | undefined;
  surfaceCloseLeadDelayMs: number;
  reduceMotion: boolean;
  open: boolean;
}): { open: Transition; close: Transition; shared: Transition } {
  const openTransition = mergeTransition(
    transition?.open ?? preset?.transition?.open,
    DEFAULT_OPEN_SPRING,
  );
  const closeTransition = mergeTransition(
    transition?.close ?? preset?.transition?.close,
    DEFAULT_CLOSE_SPRING,
    reduceMotion ? undefined : surfaceCloseLeadDelayMs / 1000,
  );
  const sharedForDirection = resolveSharedForDirection(
    transition?.shared,
    preset?.transition?.shared,
    open,
  );
  const sharedTransition = mergeTransition(
    sharedForDirection,
    open ? DEFAULT_SHARED_SPRING : DEFAULT_SHARED_CLOSE_SPRING,
  );
  return {
    open: openTransition,
    close: closeTransition,
    shared: sharedTransition,
  };
}

// ── Presets ──────────────────────────────────────────────────────────────
// `preset` is a named feel: exactly the two fields the /tune panel can
// actually export (MotionPreset, types.ts). `default` REFERENCES the
// constants above rather than retyping their numbers, so it is
// byte-identical to no-preset structurally, not by copy-paste luck — see
// the vitest `toBe` assertions in motion.test.ts.

const DEFAULT_PRESET: MotionPreset = {
  transition: {
    open: DEFAULT_OPEN_SPRING,
    close: DEFAULT_CLOSE_SPRING,
    shared: { open: DEFAULT_SHARED_SPRING, close: DEFAULT_SHARED_CLOSE_SPRING },
  },
  surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
};

/**
 * STRAWMEN, not dialled. Every spring below is DEFAULT_PRESET's frequency-
 * scaled by k = 1.15 (stiffness * k^2, damping * k, mass untouched: it
 * preserves the damping RATIO, so the CHARACTER of the motion is unchanged
 * and only its rate moves). `surfaceCloseLeadDelayMs` scales inversely
 * (35 / 1.15 ~= 30.4, rounded to 30ms) so the lead stays proportional to a
 * faster close. Nobody has looked at this by eye — Sean re-dials it on the
 * tuner (Phase 2) and it becomes a one-line values swap when he does.
 */
const SNAPPY_PRESET: MotionPreset = {
  transition: {
    open: { stiffness: 495.94, damping: 48.88, mass: 1.75 },
    close: { stiffness: 495.94, damping: 36.8, mass: 1 },
    shared: {
      open: { stiffness: 661.25, damping: 51.75 },
      close: { stiffness: 449.65, damping: 34.5, mass: 1 },
    },
  },
  surfaceCloseLeadDelayMs: 30,
};

/**
 * STRAWMEN, not dialled. Every spring below is DEFAULT_PRESET's frequency-
 * scaled by k = 0.85 (same k^2/k/untouched-mass trick as `snappy` above,
 * run the other direction). `surfaceCloseLeadDelayMs` scales inversely
 * (35 / 0.85 ~= 41.2, rounded to 41ms). Nobody has looked at this by eye —
 * Sean re-dials it on the tuner (Phase 2) and it becomes a one-line values
 * swap when he does.
 */
const GENTLE_PRESET: MotionPreset = {
  transition: {
    open: { stiffness: 270.94, damping: 36.13, mass: 1.75 },
    close: { stiffness: 270.94, damping: 27.2, mass: 1 },
    shared: {
      open: { stiffness: 361.25, damping: 38.25 },
      close: { stiffness: 245.65, damping: 25.5, mass: 1 },
    },
  },
  surfaceCloseLeadDelayMs: 41,
};

/** Recursively Object.freeze a preset tree (plain objects only — every leaf
 * here is a number or a nested plain object, never an array or class
 * instance). `presets.default.transition === DEFAULT_OPEN_SPRING` etc. by
 * reference (see above), so freezing DEFAULT_PRESET here also freezes those
 * shared constants — that is the point: `{...presets.default}` is a shallow
 * clone, so its `transition` is still the SAME frozen object, and mutating
 * it now throws (strict mode) or silently no-ops instead of poisoning
 * every other mount that reads `presets.default` or the DEFAULT_* constants. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export const presets = deepFreeze({
  default: DEFAULT_PRESET,
  snappy: SNAPPY_PRESET,
  gentle: GENTLE_PRESET,
} satisfies Record<"default" | "snappy" | "gentle", MotionPreset>);
