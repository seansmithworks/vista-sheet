/**
 * Spring maths for the Dissection's timeline and presets table. Inputs are
 * the live constants from src/motion.ts; outputs are simulated, not
 * measured (the captured strips are the measured record).
 */
import type { Spring } from "../../src/types";

export interface SpringRun {
  /** Position per ms, from `from` toward `to`. */
  samples: number[];
  /** First ms at which Motion would call it at rest. */
  settleMs: number;
}

// Motion's rest thresholds for a granular (< 5 unit) range.
const REST_DELTA = 0.005;
const REST_SPEED = 0.01;

/** Semi-implicit Euler at 0.1ms, sampled per ms. */
export function simulate(
  spring: Spring,
  from = 1,
  to = 0,
  maxMs = 4000,
): SpringRun {
  if (!("stiffness" in spring) || spring.stiffness === undefined) {
    throw new Error("simulate: needs a stiffness/damping spring");
  }
  const k = spring.stiffness;
  const c = spring.damping ?? 10;
  const m = ("mass" in spring && spring.mass) || 1;
  const dt = 0.0001;
  let x = from;
  let v = 0;
  const samples = [x];
  let settleMs = maxMs;
  for (let ms = 1; ms <= maxMs; ms++) {
    for (let i = 0; i < 10; i++) {
      v += ((-k * (x - to) - c * v) / m) * dt;
      x += v * dt;
    }
    samples.push(x);
    if (
      settleMs === maxMs &&
      Math.abs(x - to) <= REST_DELTA &&
      Math.abs(v) <= REST_SPEED
    ) {
      settleMs = ms;
    }
  }
  return { samples, settleMs };
}

/** Damping ratio ζ: 1 is critical, below 1 overshoots. */
export function dampingRatio(spring: Spring): number {
  if (!("stiffness" in spring) || spring.stiffness === undefined) return NaN;
  const m = ("mass" in spring && spring.mass) || 1;
  return (spring.damping ?? 10) / (2 * Math.sqrt(spring.stiffness * m));
}

/** First ms the run crosses `value` (moving from `from` toward `to`). */
export function crossing(run: SpringRun, value: number, from = 1): number {
  const dir = Math.sign(from - value);
  const i = run.samples.findIndex((x) => Math.sign(x - value) !== dir);
  return i < 0 ? run.samples.length - 1 : i;
}
