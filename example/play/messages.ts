import type { AnchorId } from "../../src/index";
import type { PlayState } from "./state";

/**
 * Renderer-only Root props for an embedder that shows fixed specimens (the
 * canvas page). Never part of PlayState, so codegen and the copy output
 * never see them. Read by the stage on the specimen's mount only, like the
 * Root props themselves (defaultOpen is an initial value).
 */
export interface PlayStageOverrides {
  defaultOpen?: boolean;
  reduceMotion?: boolean;
  preset?: "default" | "snappy" | "gentle";
}

/** The Motion Lab's scene: open from rest, or close from settled. Time is
 * ms since that scene's click. */
export type LabDirection = "open" | "close";

/** Commands to a `?clock=1` stage's lab (example/play/clock-lab.ts). */
export type ClockCommand =
  | { op: "play" }
  | { op: "pause" }
  | { op: "speed"; speed: number }
  /** ± frames (FRAME_TICKS fine ticks each, about 16ms), as a seek. */
  | { op: "step"; frames: number }
  | { op: "seek"; ms: number }
  | { op: "scene"; direction: LabDirection; endMs: number };

/** What a `?clock=1` stage reports back after every change. */
export interface LabState {
  direction: LabDirection;
  /** Virtual ms since the scene's click (0 before it). */
  t: number;
  endMs: number;
  playing: boolean;
  speed: number;
  /** Seeking (reset + fast-forward) in progress. */
  busy: boolean;
  /** The package's own collapseProgress, read off the Shadow layer. */
  collapse: number | null;
}

export type PlayMessage =
  | { type: "orrery-iris-play:ready" }
  | {
      type: "orrery-iris-play:state";
      state: PlayState;
      overrides?: PlayStageOverrides;
    }
  // A drag report: the stage tells the shell where the specimen landed.
  | { type: "orrery-iris-play:anchor"; anchor: AnchorId }
  // A command: the shell tells the stage to move the specimen (Anchor
  // dropdown only). Never sent in response to a report — that round trip
  // is what looped forever before this type existed.
  | { type: "orrery-iris-play:set-anchor"; anchor: AnchorId }
  // Remount the specimen at rest (renderer-only; PlayState is untouched).
  | { type: "orrery-iris-play:reset" }
  // Motion Lab: a clock command in, the lab's state out.
  | { type: "orrery-iris-play:clock"; command: ClockCommand }
  | { type: "orrery-iris-play:clock-state"; state: LabState };

export function isPlayMessage(data: unknown): data is PlayMessage {
  if (typeof data !== "object" || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return (
    type === "orrery-iris-play:ready" ||
    type === "orrery-iris-play:state" ||
    type === "orrery-iris-play:anchor" ||
    type === "orrery-iris-play:set-anchor" ||
    type === "orrery-iris-play:reset" ||
    type === "orrery-iris-play:clock" ||
    type === "orrery-iris-play:clock-state"
  );
}
