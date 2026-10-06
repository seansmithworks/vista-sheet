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

export type PlayMessage =
  | { type: "vista-sheet-play:ready" }
  | {
      type: "vista-sheet-play:state";
      state: PlayState;
      overrides?: PlayStageOverrides;
    }
  // A drag report: the stage tells the shell where the specimen landed.
  | { type: "vista-sheet-play:anchor"; anchor: AnchorId }
  // A command: the shell tells the stage to move the specimen (Anchor
  // dropdown only). Never sent in response to a report — that round trip
  // is what looped forever before this type existed.
  | { type: "vista-sheet-play:set-anchor"; anchor: AnchorId };

export function isPlayMessage(data: unknown): data is PlayMessage {
  if (typeof data !== "object" || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return (
    type === "vista-sheet-play:ready" ||
    type === "vista-sheet-play:state" ||
    type === "vista-sheet-play:anchor" ||
    type === "vista-sheet-play:set-anchor"
  );
}
