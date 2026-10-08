/**
 * The Motion Lab's driver, inside a `?clock=1` stage. One scene at a time
 * (open from rest, or close from settled) on one tick grid: TICK_MS
 * (1/640 s), anchored at the scene's click. Playback, frame steps and seeks
 * all run the same ticks, so the same virtual time is the same frame.
 *
 * Springs can't run backwards, so a seek that goes back re-arms: remount
 * the specimen at rest, pre-roll in coarse ticks (COARSE_MS) (the trigger measures
 * itself in a rAF), click, and for a close scene run the whole open
 * coarsely to settled plus the Dissection's 1400ms grace before clicking
 * Close. Only then does the fine grid start. A first play re-arms too: a
 * fresh page load and a remount can differ (Motion keeps document-level
 * projection state), and the lab only ever plays remounts.
 *
 * Everything runs through one queue, so playback and a seek never tick
 * concurrently; seek requests coalesce (latest wins).
 */
import type { ClockCommand, LabDirection, LabState } from "./messages";
import { COARSE_MS, TICK_MS, type VirtualClock } from "./virtual-clock";

/** Ticks per display frame, for frame steps. */
export const FRAME_TICKS = 10;
const PREROLL_MS = 500;
const DRAIN_MS = 500;
const SETTLE_CAP_MS = 3000;
const CLOSE_HOLD_MS = 1400;

const q = (sel: string) => document.querySelector<HTMLElement>(sel);

export interface Lab {
  command(c: ClockCommand): void;
  /** Resolves once nothing is queued or running (tests). */
  idle(): Promise<void>;
  seek(ms: number): Promise<void>;
  /** Play at the current speed and stop exactly at `ms` (tests). */
  playTo(ms: number): Promise<void>;
  state(): LabState;
}

declare global {
  interface Window {
    __vistaLab?: Lab;
  }
}

export function createLab(
  clock: VirtualClock,
  /** false: unmount the specimen; true: mount a fresh one at rest. */
  reset: (mounted: boolean) => void,
  report: (s: LabState) => void,
): Lab {
  let direction: LabDirection = "open";
  let endMs = 1000;
  let speed = 0.25;
  let playing = false;
  /** Fine ticks since the click; -1 before the scene is armed. */
  let k = -1;
  let busy = false;
  let wantK: number | null = null;
  let queue = Promise.resolve();
  let pending = 0;

  const endK = () => Math.round(endMs / TICK_MS);
  const clampK = (n: number) => Math.max(0, Math.min(endK(), Math.round(n)));

  function collapse(): number | null {
    let best: number | null = null;
    for (const e of document.querySelectorAll<HTMLElement>(
      '[data-wicket-iris-part="shadow"]',
    )) {
      const c = parseFloat(e.style.getPropertyValue("--wicket-iris-collapse"));
      if (!Number.isNaN(c) && (best === null || c < best)) best = c;
    }
    return best;
  }

  const state = (): LabState => ({
    direction,
    t: Math.max(0, k) * TICK_MS,
    endMs,
    playing,
    speed,
    busy,
    collapse: collapse(),
  });
  const emit = () => report(state());

  function enqueue(job: () => Promise<void>): Promise<void> {
    pending++;
    queue = queue
      .then(job)
      .catch((e) => console.error("clock-lab", e))
      .finally(() => {
        pending--;
      });
    return queue;
  }

  async function coarse(ms: number) {
    for (let n = Math.round(ms / COARSE_MS); n > 0; n--) {
      await clock.tick(COARSE_MS);
    }
  }

  /** Whatever the browser does on its own rendering step after a state
   * change (resize and scroll events when the scroll lock lands, style
   * and focus bookkeeping) happens here, at the same tick on every path. */
  async function realFrames() {
    await clock.realFrame();
    await clock.realFrame();
  }

  async function arm() {
    k = -1;
    reset(false);
    await coarse(DRAIN_MS);
    reset(true);
    await realFrames();
    await coarse(PREROLL_MS);
    q('[data-wicket-iris-part="trigger"]')?.click();
    await realFrames();
    if (direction === "close") {
      for (
        let n = 0;
        !q("[data-wicket-iris-settled]") && n < SETTLE_CAP_MS / COARSE_MS;
        n++
      ) {
        await clock.tick(COARSE_MS);
      }
      await coarse(CLOSE_HOLD_MS);
      await realFrames();
      q(
        '[data-wicket-iris-part="sheet"] [data-wicket-iris-part="close"]',
      )?.click();
      await realFrames();
    }
    k = 0;
  }

  async function fine() {
    await clock.tick(TICK_MS);
    k++;
  }

  /** Drain seek requests: re-arm when going back, fast-forward otherwise. */
  async function seekWork() {
    busy = true;
    emit();
    while (wantK !== null) {
      const target = wantK;
      if (k < 0 || target < k) await arm();
      while (k < target && wantK === target) {
        await fine();
        if (k % 60 === 0) emit();
      }
      if (wantK === target) wantK = null;
    }
    // Let the browser's own rendering step land before this seek counts
    // as done (and before a screenshot).
    await realFrames();
    busy = false;
    emit();
  }

  function seek(ms: number): Promise<void> {
    playing = false;
    const queued = wantK !== null;
    wantK = clampK(ms / TICK_MS);
    if (queued) return queue;
    return enqueue(seekWork);
  }

  function play(stopAt = endK()) {
    if (playing) return queue;
    playing = true;
    return enqueue(async () => {
      if (!playing) return;
      if (k < 0 || k >= stopAt) {
        wantK = 0;
        const still = playing;
        await seekWork();
        playing = still;
      }
      emit();
      let last = await clock.realFrame();
      let acc = 0;
      while (playing) {
        const ts = await clock.realFrame();
        acc += (ts - last) * speed;
        last = ts;
        while (playing && acc >= TICK_MS && k < stopAt) {
          acc -= TICK_MS;
          await fine();
        }
        if (k >= stopAt) playing = false;
        emit();
      }
    });
  }

  function command(c: ClockCommand) {
    switch (c.op) {
      case "play":
        void play();
        break;
      case "pause":
        playing = false;
        emit();
        break;
      case "speed":
        speed = c.speed;
        emit();
        break;
      case "step":
        void seek((Math.max(0, k) + c.frames * FRAME_TICKS) * TICK_MS);
        break;
      case "seek":
        void seek(c.ms);
        break;
      case "scene":
        playing = false;
        endMs = c.endMs;
        if (c.direction !== direction) {
          direction = c.direction;
          k = -1;
          void seek(0);
        } else emit();
        break;
    }
  }

  return {
    command,
    seek,
    playTo: (ms) => {
      play(clampK(ms / TICK_MS));
      return queue;
    },
    idle: async () => {
      while (pending > 0) await queue;
    },
    state,
  };
}
