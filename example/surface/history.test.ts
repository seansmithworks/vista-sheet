import { describe, expect, it } from "vitest";
import {
  autoSnapshot,
  commit,
  initHistory,
  redo,
  undo,
  type Version,
} from "./history";
import { defaultState } from "./model";

const at = (hoverLift: number) => {
  const s = defaultState();
  s.light.closed.hoverLift = hoverLift;
  return s;
};

describe("tuner history", () => {
  it("coalesces a drag on one dial into a single undo step", () => {
    let h = initHistory(at(1));
    h = commit(h, at(2), "lift", 0);
    h = commit(h, at(3), "lift", 100);
    h = commit(h, at(4), "lift", 200);
    expect(h.past).toHaveLength(1);
    h = undo(h);
    expect(h.state.light.closed.hoverLift).toBe(1);
    h = redo(h);
    expect(h.state.light.closed.hoverLift).toBe(4);
  });

  it("starts a new step for another dial, after a pause, or with no key", () => {
    let h = initHistory(at(1));
    h = commit(h, at(2), "lift", 0);
    h = commit(h, at(3), "scale", 100);
    h = commit(h, at(4), "scale", 5000);
    h = commit(h, at(5), null, 5100);
    h = commit(h, at(6), null, 5200);
    expect(h.past).toHaveLength(5);
  });

  it("clears redo on a new change", () => {
    let h = initHistory(at(1));
    h = commit(h, at(2), null, 0);
    h = undo(h);
    h = commit(h, at(3), null, 10);
    expect(h.future).toHaveLength(0);
  });
});

describe("auto snapshots", () => {
  it("saves a state once and skips one that is already saved", () => {
    let list: Version[] = [];
    list = autoSnapshot(list, at(3), "Auto", 1, "a");
    list = autoSnapshot(list, at(3), "Auto", 2, "b");
    expect(list).toHaveLength(1);
    list = autoSnapshot(list, at(4), "Auto", 3, "c");
    expect(list.map((v) => v.id)).toEqual(["c", "a"]);
  });
});
