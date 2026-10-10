"use client";

/**
 * /tune — live close-choreography tuner.
 *
 * Route `/` stays the verbatim README snippet (it is the test of the
 * documented install path). This route is the instrument: the same
 * Iris markup, driven by a dialkit panel, with the two numbers you
 * cannot dial this pair blind without.
 *
 * CLOSE PATH ONLY, by construction. `transition.open` is never passed, so the
 * open direction always falls through to the package default — there is no
 * dial that can reach it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Iris } from "@orrery-ui/iris";
import type { MotionPreset } from "@orrery-ui/iris";
import { DialRoot, DialStore, useDialKitController } from "dialkit";
import type { TransitionConfig } from "dialkit";
import "dialkit/styles.css";
import styles from "./tune.module.css";

/** Stable panel id. dialkit persists under `dialkit:${id}` in localStorage.
 * This key predates the package renames — changing it orphans Sean's saved
 * dial history, so it stays "morph-sheet-close" on purpose. */
const PANEL_ID = "morph-sheet-close";
const PHASE_4_PRESET = "Phase 4 (77f6d9b)";

type MotionSpring = {
  type: "spring";
  stiffness?: number;
  damping?: number;
  mass?: number;
  visualDuration?: number;
  bounce?: number;
};

/**
 * Shipped defaults — what motion.ts now carries: Sean's dialled "Version 4"
 * (shell 375/32/1, avatar 340/30/1, lead 35), which replaced the k-scaled
 * slow-it-down strawman he tried and rejected. dialkit's "Version 1" in the
 * preset dropdown is exactly this, because it is the config default.
 */
const SHIPPED = {
  discShell: {
    type: "spring",
    stiffness: 375,
    damping: 32,
    mass: 1,
  } satisfies MotionSpring,
  avatar: {
    type: "spring",
    stiffness: 340,
    damping: 30,
    mass: 1,
  } satisfies MotionSpring,
  leadDelay: 35,
};

/** What Sean already saw and called "really close" — seeded as a preset. */
const PHASE_4 = {
  discShell: {
    type: "spring",
    stiffness: 375,
    damping: 32,
    mass: 1,
  } satisfies MotionSpring,
  avatar: {
    type: "spring",
    stiffness: 305,
    damping: 28.9,
    mass: 1,
  } satisfies MotionSpring,
  leadDelay: 35,
};

const DIAL_CONFIG = {
  discShell: SHIPPED.discShell,
  avatar: SHIPPED.avatar,
  leadDelay: [SHIPPED.leadDelay, 0, 150, 1] as [number, number, number, number],
  /* Diagnostic, not choreography: 0 = outline only, 1 = solid. Lets the
     shell's box be seen THROUGH the avatar while dialling the two against
     each other. Does not touch layout, so the readouts are unaffected. Never
     appears in the emitted MotionPreset below — it has no field to land in. */
  avatarFill: [0.2, 0, 1, 0.05] as [number, number, number, number],
};

function toSpring(value: TransitionConfig): MotionSpring {
  return value.type === "spring" ? value : { type: "spring" };
}

/** Strips dialkit's `type: "spring"` discriminator, which has no place on
 * MotionPreset's Spring union (StiffnessSpring is just stiffness/damping/mass). */
function toPresetSpring(spring: MotionSpring): {
  stiffness: number;
  damping: number;
  mass?: number;
} {
  const stiffness = spring.stiffness ?? 0;
  const damping = spring.damping ?? 0;
  return spring.mass !== undefined
    ? { stiffness, damping, mass: spring.mass }
    : { stiffness, damping };
}

// ── Measurement ────────────────────────────────────────────────────────────
// Two elements, sampled per frame from the Close click until both are quiet:
//   box    = [data-orrery-iris-part="trigger-surface"]      the collapsing shell
//   avatar = the trigger-side <Iris.Shared>           inset: 2px inside it
//
// ARRIVAL GAP  = avatarArrival - boxArrival, ms. Negative = the avatar gets
//                home first (leads). Positive = it is still moving after the
//                shell has stopped (trails).
// MIN INSET    = the smallest of the four edge gaps between them, px. 2.0 at
//                rest. Negative = the avatar is outside the shell's edge.
//
// Arrival = the last frame that was still more than ARRIVAL_TOL_PX off the
// resting box, plus one. The inset minimum is taken over the closing TAIL
// only — from the first frame where the shell is within 1.5x its resting
// width — because that is the whole region in which a 2px border
// relationship exists to violate, and it excludes any single-frame skew
// between the two projections starting.
const ARRIVAL_TOL_PX = 0.2;
const QUIET_FRAMES = 10;
const QUIET_TOL_PX = 0.02;
const SAMPLE_TIMEOUT_MS = 4000;
const TAIL_WIDTH_FACTOR = 1.5;

type Edges = [number, number, number, number];
type Frame = { t: number; box: Edges; av: Edges };

export type CloseRun = {
  gapMs: number;
  minInsetPx: number;
  totalMs: number;
  boxMs: number;
  avatarMs: number;
  frames: number;
};

function edgesOf(el: Element): Edges {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom];
}

function maxDev(a: Edges, b: Edges): number {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2]),
    Math.abs(a[3] - b[3]),
  );
}

function arrivalOf(frames: Frame[], pick: (f: Frame) => Edges): number {
  const rest = pick(frames[frames.length - 1]);
  for (let i = frames.length - 1; i >= 0; i--) {
    if (maxDev(pick(frames[i]), rest) > ARRIVAL_TOL_PX) {
      return frames[Math.min(i + 1, frames.length - 1)].t;
    }
  }
  return 0;
}

function analyse(frames: Frame[]): CloseRun | null {
  if (frames.length < 4) return null;

  const boxMs = arrivalOf(frames, (f) => f.box);
  const avatarMs = arrivalOf(frames, (f) => f.av);

  const restWidth =
    frames[frames.length - 1].box[2] - frames[frames.length - 1].box[0];
  const tailStart = frames.findIndex(
    (f) => f.box[2] - f.box[0] <= restWidth * TAIL_WIDTH_FACTOR,
  );

  let minInset = Infinity;
  for (let i = Math.max(tailStart, 0); i < frames.length; i++) {
    const { box, av } = frames[i];
    minInset = Math.min(
      minInset,
      av[0] - box[0],
      av[1] - box[1],
      box[2] - av[2],
      box[3] - av[3],
    );
  }

  return {
    gapMs: avatarMs - boxMs,
    minInsetPx: minInset,
    totalMs: Math.max(boxMs, avatarMs),
    boxMs,
    avatarMs,
    frames: frames.length,
  };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Readout ────────────────────────────────────────────────────────────────

function gapTone(ms: number): string {
  if (ms <= 0) return styles.ok;
  if (ms <= 15) return styles.warn;
  return styles.bad;
}

function insetTone(px: number): string {
  if (px < 0) return styles.bad;
  if (px < 1) return styles.warn;
  return styles.ok;
}

function signed(n: number, digits = 0): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v.replace("-", "−");
}

export default function TunePage() {
  const dial = useDialKitController("Close choreography", DIAL_CONFIG, {
    id: PANEL_ID,
    persist: true,
  });

  const shellSpring = toSpring(dial.values.discShell);
  const avatarSpring = toSpring(dial.values.avatar);
  const leadDelay = dial.values.leadDelay;
  const avatarFill = dial.values.avatarFill;

  // The open direction is absent on purpose — nothing here can reach it.
  const transition = useMemo(
    () => ({ close: shellSpring, shared: { close: avatarSpring } }),
    [shellSpring, avatarSpring],
  );

  // Lead delay is preset-only; Root merges it field by field with `transition`.
  const leadDelayPreset = useMemo<MotionPreset>(
    () => ({ surfaceCloseLeadDelayMs: leadDelay }),
    [leadDelay],
  );

  // Seed the A/B preset once. "Version 1" already is the shipped default
  // (it is this config's default), so only Phase 4 needs adding.
  useEffect(() => {
    if (DialStore.getPresets(PANEL_ID).some((p) => p.name === PHASE_4_PRESET)) {
      return;
    }
    dial.setValues(PHASE_4);
    DialStore.savePreset(PANEL_ID, PHASE_4_PRESET);
    dial.resetValues();
    // Run once against a freshly registered panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [runs, setRuns] = useState<CloseRun[]>([]);
  const rafRef = useRef<number | null>(null);

  // A settings change invalidates the sample set — the median must never mix
  // two configurations.
  useEffect(() => {
    setRuns([]);
  }, [shellSpring, avatarSpring, leadDelay]);

  const startSampling = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const frames: Frame[] = [];
    let quiet = 0;

    const tick = (now: number) => {
      const boxEl = document.querySelector(
        '[data-orrery-iris-part="trigger-surface"]',
      );
      const avEl = document.querySelector(
        '[data-orrery-iris-part="shared"][data-orrery-iris-slot="trigger"]',
      );
      if (!boxEl || !avEl) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const frame: Frame = {
        t: now - t0,
        box: edgesOf(boxEl),
        av: edgesOf(avEl),
      };
      const prev = frames[frames.length - 1];
      frames.push(frame);

      if (
        prev &&
        maxDev(prev.box, frame.box) < QUIET_TOL_PX &&
        maxDev(prev.av, frame.av) < QUIET_TOL_PX
      ) {
        quiet += 1;
      } else {
        quiet = 0;
      }

      if (quiet >= QUIET_FRAMES || frame.t > SAMPLE_TIMEOUT_MS) {
        rafRef.current = null;
        const run = analyse(frames);
        if (run) setRuns((prevRuns) => [...prevRuns, run].slice(-9));
        setMeasuring(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setSheetOpen(next);
      if (next) {
        // A tap that reopens mid-close invalidates that close.
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setMeasuring(false);
        return;
      }
      setMeasuring(true);
      startSampling();
    },
    [startSampling],
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const summary = useMemo(() => {
    if (runs.length === 0) return null;
    return {
      gapMs: median(runs.map((r) => r.gapMs)),
      minInsetPx: median(runs.map((r) => r.minInsetPx)),
      totalMs: median(runs.map((r) => r.totalMs)),
      n: runs.length,
    };
  }, [runs]);

  // Read-out hook for the measurement harness; the numbers on screen and the
  // numbers in the report are the same numbers.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__orreryIrisTune = {
      runs,
      summary,
      values: { discShell: shellSpring, avatar: avatarSpring, leadDelay },
    };
  }, [runs, summary, shellSpring, avatarSpring, leadDelay]);

  // The one genuine coupling out of this panel: the dial values, shaped as a
  // MotionPreset so they paste straight into `preset={...}` with no
  // hand-translation. `avatarFill` is deliberately excluded — it is a
  // dialling diagnostic (see DIAL_CONFIG above), not choreography, and has
  // no field on MotionPreset to land in.
  const [copied, setCopied] = useState(false);
  const handleCopyPreset = useCallback(() => {
    const preset: MotionPreset = {
      transition: {
        close: toPresetSpring(shellSpring),
        shared: { close: toPresetSpring(avatarSpring) },
      },
      surfaceCloseLeadDelayMs: leadDelay,
    };
    navigator.clipboard.writeText(JSON.stringify(preset, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [shellSpring, avatarSpring, leadDelay]);

  const quiet = sheetOpen || measuring;

  return (
    <main className={styles.stage}>
      <Iris.Root
        transition={transition}
        preset={leadDelayPreset}
        onOpenChange={handleOpenChange}
      >
        <Iris.Shadow />

        <Iris.Trigger aria-label="Open contact">
          <Iris.Shared>
            <div
              className={styles.avatar}
              style={{ "--avatar-fill": avatarFill } as React.CSSProperties}
            />
          </Iris.Shared>
        </Iris.Trigger>

        <Iris.Sheet aria-labelledby="sheet-title">
          <Iris.Shared>
            <div
              className={styles.avatar}
              style={{ "--avatar-fill": avatarFill } as React.CSSProperties}
            />
          </Iris.Shared>

          <Iris.Content>
            <Iris.Close aria-label="Close" />
            <Iris.Item>
              <h2 id="sheet-title">Sean Smith</h2>
            </Iris.Item>
            <Iris.Item>
              <p>Links, etc.</p>
            </Iris.Item>
          </Iris.Content>
        </Iris.Sheet>
      </Iris.Root>

      <aside
        className={styles.dock}
        data-quiet={quiet}
        aria-label="Close tuner"
      >
        <div className={styles.readout}>
          <div className={styles.readoutHead}>
            <span className={styles.readoutTitle}>Close, measured</span>
            <span className={styles.runCount}>
              {runs.length === 0
                ? "no runs"
                : `${runs.length} run${runs.length > 1 ? "s" : ""}`}
            </span>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Arrival gap</div>
              <div
                className={`${styles.metricValue} ${summary ? gapTone(summary.gapMs) : styles.idle}`}
              >
                {summary ? signed(summary.gapMs) : "—"}
                <span className={styles.metricUnit}>ms</span>
              </div>
              <div className={styles.metricNote}>
                {summary
                  ? summary.gapMs <= 0
                    ? `avatar leads the shell by ${Math.abs(summary.gapMs).toFixed(0)}ms`
                    : `avatar TRAILS the shell by ${summary.gapMs.toFixed(0)}ms`
                  : "close the sheet to measure"}
              </div>
            </div>

            <div className={styles.metric}>
              <div className={styles.metricLabel}>Min inset</div>
              <div
                className={`${styles.metricValue} ${
                  summary ? insetTone(summary.minInsetPx) : styles.idle
                }`}
              >
                {summary ? summary.minInsetPx.toFixed(2) : "—"}
                <span className={styles.metricUnit}>px</span>
              </div>
              <div className={styles.metricNote}>
                {summary
                  ? summary.minInsetPx < 0
                    ? `SPILLS ${Math.abs(summary.minInsetPx).toFixed(2)}px past the edge`
                    : `${(2 - summary.minInsetPx).toFixed(2)}px into the 2px border`
                  : "2.00 at rest"}
              </div>
            </div>
          </div>

          {summary && (
            <div className={styles.subline}>
              close {summary.totalMs.toFixed(0)}ms · median of {summary.n}
            </div>
          )}

          <button
            type="button"
            className={styles.copyButton}
            onClick={handleCopyPreset}
          >
            {copied ? "Copied" : "Copy as MotionPreset"}
          </button>
        </div>

        <div className={styles.dials}>
          <DialRoot mode="inline" theme="dark" productionEnabled />
        </div>

        <div className={styles.foot}>
          Dials drive the <strong>close only</strong>. Values persist to{" "}
          <code>dialkit:{PANEL_ID}</code>. Use the button above, not
          dialkit&apos;s own toolbar Copy, to get a <code>MotionPreset</code>{" "}
          object shaped to paste into{" "}
          <code>
            preset={"{"}...{"}"}
          </code>
          .
        </div>
      </aside>
    </main>
  );
}
