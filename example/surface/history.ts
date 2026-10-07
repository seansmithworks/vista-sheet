// Undo/redo and saved versions for the surface tuner. Pure functions, so the
// page and the tests share one implementation.
import type { TunerState } from "./model";

// ── Undo / redo ───────────────────────────────────────────────────────────

export interface History {
  state: TunerState;
  past: TunerState[];
  future: TunerState[];
  /** Which dial made the last change, to coalesce a drag into one step. */
  lastKey: string | null;
  lastAt: number;
}

/** Changes to the same dial inside this window (measured from the previous
 * change) are one undo step: a slider drag, or a run of arrow keys. */
export const COALESCE_MS = 800;
const MAX_STEPS = 200;

export function initHistory(state: TunerState): History {
  return { state, past: [], future: [], lastKey: null, lastAt: 0 };
}

/** Apply a change. `key` names the dial; null (presets, reset, restore)
 * always starts a new step. */
export function commit(
  h: History,
  next: TunerState,
  key: string | null,
  now: number,
): History {
  if (next === h.state) return h;
  const merge =
    key !== null &&
    key === h.lastKey &&
    now - h.lastAt < COALESCE_MS &&
    h.past.length > 0;
  return {
    state: next,
    past: merge ? h.past : [...h.past, h.state].slice(-MAX_STEPS),
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return {
    state: h.past[h.past.length - 1],
    past: h.past.slice(0, -1),
    future: [h.state, ...h.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return {
    state: h.future[0],
    past: [...h.past, h.state],
    future: h.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}

// ── Saved versions ────────────────────────────────────────────────────────

export interface Version {
  id: string;
  name: string;
  savedAt: number;
  /** Taken automatically before a preset click, Reset or restore. */
  auto: boolean;
  state: TunerState;
}

const MAX_AUTO = 30;

const same = (a: TunerState, b: TunerState) =>
  JSON.stringify(a) === JSON.stringify(b);

export function addVersion(
  list: Version[],
  v: Omit<Version, "id">,
  id: string,
): Version[] {
  const next = [{ ...v, id }, ...list];
  // Keep every named version; cap only the automatic ones (oldest go first).
  let autos = 0;
  return next.filter((x) => !x.auto || ++autos <= MAX_AUTO);
}

/** Snapshot `state` as an automatic version, unless an identical state is
 * already saved (nothing would be lost). */
export function autoSnapshot(
  list: Version[],
  state: TunerState,
  name: string,
  now: number,
  id: string,
): Version[] {
  if (list.some((v) => same(v.state, state))) return list;
  return addVersion(list, { name, savedAt: now, auto: true, state }, id);
}
