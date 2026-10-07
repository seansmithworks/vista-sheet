/**
 * Virtual clock for the stage iframe (`play.html?stage=1&clock=1` only).
 * The canvas's Motion Lab uses it to run the real specimen in slow motion,
 * frame by frame, and to seek: time only moves when `tick()` is called.
 *
 * Load order is load-bearing. Motion captures the global
 * requestAnimationFrame when its frameloop module evaluates, and React's
 * scheduler captures setTimeout/performance.now the same way, so this
 * module must evaluate before either. It is therefore the ONLY static
 * import of play/main.tsx, which loads every other module through a
 * dynamic import after it — in dev and in a `vite build` alike. Without
 * `?clock=1` it does nothing.
 *
 * What it owns, once installed:
 * - requestAnimationFrame / cancelAnimationFrame: queued, run once per tick.
 * - setTimeout / setInterval / clear*: fired by virtual due time.
 * - performance.now: the virtual time. (So React's scheduler never
 *   time-slices inside a tick, and any React timeout freezes while paused.
 *   That is intended; the specimen has no Suspense.)
 * - Element.prototype.animate: every WAAPI animation on a connected
 *   element is born paused and positioned from the clock, with no real-time
 *   gap. When one passes its end it is finished inside the tick and its
 *   `onfinish` handler is called synchronously: the browser would otherwise
 *   dispatch that event on the next real frame, which during a fast-forward
 *   is an arbitrary virtual time. Motion's own completion (commit the final
 *   style, cancel, resolve `finished` for AnimatePresence) lives in that
 *   handler.
 * - ResizeObserver: real ones deliver in the browser's rendering step, so
 *   during a fast-forward (hundreds of ticks per real frame) the Sheet's
 *   and Trigger's re-measure would land on whatever tick is current. Here
 *   each tick compares every observed element's computed size and calls
 *   back for the ones that changed, after the rAF queue, like a frame.
 *   (src's callbacks ignore the entries; they're built for shape only.)
 * Not owned: Date.now (src uses none), MessageChannel (React's commits run
 * on it; each tick yields to it), media elements (the video recipe is
 * excluded).
 */

export const TICK_MS = 1000 / 600;

export interface VirtualClock {
  /** Virtual ms (what performance.now returns in the stage). */
  now(): number;
  /** Advance by `ms`: owned animations, then due timers, then the rAF
   * queue, then yield to React's scheduler. */
  tick(ms: number): Promise<void>;
  /** One real browser frame (the pre-patch requestAnimationFrame). */
  realFrame(): Promise<number>;
  /** Real wall-clock ms (the pre-patch performance.now). */
  realNow(): number;
}

declare global {
  interface Window {
    __vistaClock?: VirtualClock;
  }
}

// Guarded so Node (Playwright specs importing TICK_MS) can load the module.
const params = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);
export const CLOCK_ENABLED = params.has("stage") && params.get("clock") === "1";

if (CLOCK_ENABLED) window.__vistaClock = install();

function install(): VirtualClock {
  const realRaf = window.requestAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const realAnimate = Element.prototype.animate;
  let now = realNow();

  // ---- requestAnimationFrame ----
  let rafId = 0;
  let rafQueue = new Map<number, FrameRequestCallback>();
  window.requestAnimationFrame = (cb) => {
    rafQueue.set(++rafId, cb);
    return rafId;
  };
  window.cancelAnimationFrame = (id) => {
    rafQueue.delete(id);
  };

  // ---- timers ----
  interface Timer {
    due: number;
    seq: number;
    fn: (...args: unknown[]) => void;
    args: unknown[];
    every?: number;
  }
  let timerId = 0;
  const timers = new Map<number, Timer>();
  const add = (fn: unknown, ms: unknown, args: unknown[], every: boolean) => {
    const id = ++timerId;
    if (typeof fn !== "function") return id;
    const delay = Math.max(0, Number(ms) || 0);
    timers.set(id, {
      due: now + delay,
      seq: id,
      fn: fn as Timer["fn"],
      args,
      ...(every && { every: Math.max(1, delay) }),
    });
    return id;
  };
  const clear = (id: unknown) => {
    timers.delete(Number(id));
  };
  (window as { setTimeout: unknown }).setTimeout = (
    fn: unknown,
    ms?: unknown,
    ...args: unknown[]
  ) => add(fn, ms, args, false);
  (window as { setInterval: unknown }).setInterval = (
    fn: unknown,
    ms?: unknown,
    ...args: unknown[]
  ) => add(fn, ms, args, true);
  window.clearTimeout = clear;
  window.clearInterval = clear;

  performance.now = () => now;

  // ---- WAAPI ----
  interface Owned {
    a: Animation;
    /** Virtual currentTime, ms. */
    t: number;
    playing: boolean;
  }
  const owned = new Set<Owned>();
  const proto = Animation.prototype;
  const ct = Object.getOwnPropertyDescriptor(proto, "currentTime")!;
  const ps = Object.getOwnPropertyDescriptor(proto, "playState")!;
  const realPause = proto.pause;
  const realFinish = proto.finish;
  const realCancel = proto.cancel;

  const endOf = (a: Animation) =>
    Number(a.effect?.getComputedTiming().endTime ?? Infinity);

  function finishNow(o: Owned) {
    o.playing = false;
    owned.delete(o);
    const a = o.a;
    const handler = a.onfinish;
    a.onfinish = null;
    realFinish.call(a);
    handler?.call(
      a,
      new AnimationPlaybackEvent("finish", {
        currentTime: Number(ct.get!.call(a)),
        timelineTime: null,
      }),
    );
  }

  function own(a: Animation) {
    const o: Owned = { a, t: 0, playing: true };
    const position = () => {
      realPause.call(a);
      ct.set!.call(a, Math.max(0, o.t));
    };
    position();
    owned.add(o);
    Object.defineProperties(a, {
      currentTime: {
        configurable: true,
        get: () => ct.get!.call(a),
        set: (v: unknown) => {
          o.t = Number(v) || 0;
          if (!owned.has(o)) owned.add(o);
          position();
        },
      },
      // Motion syncs animations started in one frame by setting startTime
      // (the creation time, read from performance.now). On a real paused
      // animation that would unpause it; here it just sets the position.
      startTime: {
        configurable: true,
        get: () => now - o.t,
        set: (v: unknown) => {
          if (v === null || v === undefined) return;
          o.t = now - Number(v);
          position();
        },
      },
      playState: {
        configurable: true,
        get: () => {
          const s = ps.get!.call(a) as AnimationPlayState;
          return s === "paused" && o.playing ? "running" : s;
        },
      },
    });
    a.play = () => {
      if (o.t >= endOf(a)) o.t = 0;
      o.playing = true;
      owned.add(o);
      position();
    };
    a.pause = () => {
      o.playing = false;
      realPause.call(a);
    };
    a.finish = () => finishNow(o);
    a.cancel = () => {
      o.playing = false;
      owned.delete(o);
      realCancel.call(a);
    };
  }

  Element.prototype.animate = function (
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ) {
    const a = realAnimate.call(this, keyframes, options);
    // Detached elements are feature-detection probes, never the specimen.
    if (this.isConnected) own(a);
    return a;
  };

  // ---- ResizeObserver ----
  interface Observed {
    observer: ResizeObserver;
    callback: ResizeObserverCallback;
    targets: Map<Element, string>;
  }
  const observers = new Set<Observed>();
  const sizeOf = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display === "none" ? "0x0" : `${cs.width}x${cs.height}`;
  };
  class VirtualResizeObserver {
    private o: Observed;
    constructor(callback: ResizeObserverCallback) {
      this.o = {
        observer: this as unknown as ResizeObserver,
        callback,
        targets: new Map(),
      };
    }
    observe(el: Element) {
      // Like a real one: the first delivery reports the initial size.
      if (!this.o.targets.has(el)) this.o.targets.set(el, "");
      observers.add(this.o);
    }
    unobserve(el: Element) {
      this.o.targets.delete(el);
    }
    disconnect() {
      this.o.targets.clear();
      observers.delete(this.o);
    }
  }
  window.ResizeObserver =
    VirtualResizeObserver as unknown as typeof ResizeObserver;

  function deliverResizes() {
    for (const o of [...observers]) {
      const entries: ResizeObserverEntry[] = [];
      for (const [el, last] of o.targets) {
        const size = sizeOf(el);
        if (size === last) continue;
        o.targets.set(el, size);
        const [w, h] = size.split("x").map((v) => parseFloat(v) || 0);
        const box = [{ inlineSize: w, blockSize: h }];
        entries.push({
          target: el,
          contentRect: new DOMRectReadOnly(0, 0, w, h),
          borderBoxSize: box,
          contentBoxSize: box,
          devicePixelContentBoxSize: box,
        });
      }
      if (entries.length) o.callback(entries, o.observer);
    }
  }

  // ---- the tick ----
  const channel = new MessageChannel();
  const waiting: Array<() => void> = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  const macrotask = () =>
    new Promise<void>((r) => {
      waiting.push(r);
      channel.port2.postMessage(0);
    });

  async function tick(ms: number) {
    now += ms;
    // Animations that existed before this tick advance; any born below
    // starts at currentTime 0 at this `now`.
    for (const o of [...owned]) {
      if (!o.playing) continue;
      o.t += ms * o.a.playbackRate;
      if (o.a.playbackRate > 0 && o.t >= endOf(o.a)) finishNow(o);
      else ct.set!.call(o.a, Math.max(0, o.t));
    }
    for (let guard = 0; guard < 1000; guard++) {
      let next: [number, Timer] | null = null;
      for (const entry of timers) {
        if (entry[1].due > now) continue;
        if (
          !next ||
          entry[1].due < next[1].due ||
          (entry[1].due === next[1].due && entry[1].seq < next[1].seq)
        )
          next = entry;
      }
      if (!next) break;
      const [id, timer] = next;
      if (timer.every) {
        timer.due += timer.every;
        timer.seq = ++timerId;
      } else timers.delete(id);
      timer.fn(...timer.args);
    }
    const frame = rafQueue;
    rafQueue = new Map();
    for (const cb of frame.values()) cb(now);
    deliverResizes();
    // React's scheduler runs on MessageChannel: let commits (and the
    // effects and promise chains they start) land on this tick.
    for (let i = 0; i < 3; i++) await macrotask();
  }

  return {
    now: () => now,
    tick,
    realFrame: () => new Promise((r) => realRaf(r)),
    realNow,
  };
}
