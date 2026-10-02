"use client";

import { cloneElement, isValidElement, useEffect, useRef } from "react";
import type { CSSProperties, ReactElement, Ref } from "react";
import { useVistaSheetInternal } from "./context";
import { Layer } from "./Layer";
import { readVarPx } from "./readVarPx";
import {
  collapseRadiusAt,
  resolveTriggerCornerRadius,
  supportsCornerShape,
} from "./shape";
import type { ShadowProps } from "./types";
import styles from "./styles.module.css";

/**
 * <VistaSheet.Shadow> — the shadow seam (docs/PACKAGE-DESIGN.md §4).
 *
 * Default: renders one fixed, aria-hidden, pointer-events:none div at
 * z-1, sized/positioned to the interpolated silhouette between the trigger
 * circle and the sheet box. It paints BOTH looks on that one silhouette —
 * the thin disc shadow (--vista-sheet-shadow) and the sheet's heavier
 * resting shadow (--vista-sheet-sheet-shadow), as two layers (.shadow::before
 * / ::after in styles.module.css) crossfaded by opacity as a function of
 * collapseProgress. This is the only place either shadow is painted (DESIGN.md
 * §4.1 "one surface, one clock") — the sheet used to paint its own resting
 * shadow via `.sheet[data-vista-sheet-settled]`, which was a second clock and
 * produced a one-frame pop when a demo mask clipped it at the phase boundary.
 * Zero dependencies beyond React.
 *
 * The crossfade window (where in collapseProgress the handoff happens) is a
 * taste value, exposed as two consumer-overridable CSS custom properties —
 * --vista-sheet-sheet-shadow-fade-start / -fade-end — read the same way
 * --vista-sheet-sheet-radius already is, via readVarPx.
 *
 * asChild: clones the single child and merges the fixed positioning,
 * z-index, aria-hidden, pointer-events, data-* attributes, and all
 * --vista-sheet-shadow-* custom properties (including the two crossfade
 * opacities) onto it — the shape a consumer swaps in a
 * `@seansmithworks/surface-fx` dither layer through. This package never
 * imports surface-fx (docs/PACKAGE-DESIGN.md §4).
 *
 * A ref already on the child (object or callback — read from `child.props.ref`,
 * the React 19 shape; the peer range is `react >=19`, so the React 18 side
 * channel on the element itself is never consulted) is composed with Shadow's
 * own internal ref rather than overwritten, via mergeShadowRef below.
 */

/**
 * Composes a consumer-supplied ref (object or callback, or none) with
 * Shadow's own internal ref callback so an asChild clone forwards the DOM
 * node to both instead of only the last one assigned.
 */
/**
 * Reads an element's ACTUALLY-RENDERED top-left corner radius in px,
 * correcting for any transform-scale Motion's shared-layout projection has
 * applied — the same technique example/geometry.spec.ts's (rt) gate uses to
 * measure it, so Shadow's radius matches what that gate checks BY
 * CONSTRUCTION. `borderTopLeftRadius` can report an elliptical value
 * ("Xpx Ypx" or "X% Y%") when Motion corrects a non-uniform scale — the
 * horizontal component is enough for a corner-radius comparison, matching
 * the gate's own choice.
 */
function readRenderedCornerRadius(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const token =
    (getComputedStyle(el).borderTopLeftRadius || "").trim().split(/\s+/)[0] ||
    "0";
  if (token.endsWith("%")) {
    return (parseFloat(token) / 100) * rect.width;
  }
  return parseFloat(token) * (rect.width / (el.offsetWidth || rect.width || 1));
}

export function mergeShadowRef<T>(
  childRef: Ref<T> | null | undefined,
  internalRef: (node: T | null) => void,
): (node: T | null) => void {
  return (node) => {
    internalRef(node);
    if (typeof childRef === "function") {
      childRef(node);
    } else if (childRef) {
      (childRef as { current: T | null }).current = node;
    }
  };
}
export function Shadow({ className, asChild, children }: ShadowProps) {
  const ctx = useVistaSheetInternal("Shadow");
  const {
    collapseProgress,
    triggerRect,
    sheetRect,
    sheetDragY,
    zIndex,
    isDragging,
    shape,
    layerEl,
  } = ctx;
  const elRef = useRef<HTMLElement | null>(null);
  // Strawman (v0.2): how long, after the last collapseProgress/sheetDragY
  // "change", the DOM-read branch below keeps sampling the surface instead
  // of falling back to the analytic curve. See the note at its read site.
  const SURFACE_READ_GRACE_MS = 300;
  const lastActiveAtRef = useRef(0);
  const NEAR_REST_EPS = 0.02;
  const isInFlight = (p: number) => p > NEAR_REST_EPS && p < 1 - NEAR_REST_EPS;

  useEffect(() => {
    const apply = () => {
      const el = elRef.current;
      if (!el) return;
      const p = collapseProgress.get();
      const m = sheetRect
        ? Math.min(sheetRect.halfWidth, sheetRect.halfHeight)
        : 0;
      const trigger = triggerRect ?? {
        cx: sheetRect?.cx ?? 0,
        cy: sheetRect?.cy ?? 0,
        halfWidth: m,
        halfHeight: m,
      };
      // sheetRect is measured from offsetLeft/Top (Sheet.tsx), which by
      // definition excludes transforms — so a live drag on the sheet never
      // shows up there. sheetDragY is the sheet's own drag `y` MotionValue
      // (bound directly, not re-measured per frame — see the D1 fix note
      // in context.ts), folded in here as a translation on top of the
      // measured rect.
      const dragY = sheetDragY.get();
      const sheet = sheetRect
        ? { ...sheetRect, cy: sheetRect.cy + dragY }
        : {
            cx: trigger.cx,
            cy: trigger.cy,
            halfWidth: trigger.halfWidth,
            halfHeight: trigger.halfHeight,
          };

      const cx = sheet.cx + (trigger.cx - sheet.cx) * p;
      const cy = sheet.cy + (trigger.cy - sheet.cy) * p;
      const halfW = sheet.halfWidth + (trigger.halfWidth - sheet.halfWidth) * p;
      const halfH =
        sheet.halfHeight + (trigger.halfHeight - sheet.halfHeight) * p;
      // The silhouette's corner radius is meant to share the surface's own
      // hold-then-round curve (collapseRadiusAt, src/shape.ts) — DESIGN.md
      // §4.1, "one surface, one clock". Measured directly (see Strawman
      // below), an ANALYTIC re-computation of that curve here does not equal
      // what Motion actually PAINTS on the shared-layoutId surface: for a
      // shared-layoutId crossfade, Motion's own border-radius mix
      // (motion-dom's mixValues, projection/animation/mix-values.mjs) blends
      // the ENTERING element's radius from the EXITING element's SNAPSHOT
      // value using Motion's OWN internal layout progress, not
      // collapseProgress — regardless of what curve we feed the bound
      // MotionValue. That snapshot happens to equal the target's hold value
      // on CLOSE (the sheet's own resting radius is already `sheetRadius`),
      // so collapseRadiusAt recomputed here tracked the rendered CLOSE
      // within measured worst 3.4px — but on OPEN the snapshot is the
      // trigger's own resting (shape) radius, which differs from
      // `sheetRadius` from the first frame, so Motion's mix produces a
      // smooth blend across the WHOLE open that no analytic p-based formula
      // (this hold curve, or the previous linear one) reproduces — measured
      // worst 24.4px, matching the "pre-fix defect" this gate guards
      // against. Strawman (v0.2): rather than re-deriving Motion's internal
      // mix, read the surface's ACTUALLY-RENDERED corner radius directly off
      // the DOM (same technique geometry.spec.ts's own (rt) gate uses) —
      // this is "one clock" by construction: whatever the surface paints,
      // the shadow paints, with no independent formula to drift out of sync
      // with Motion's own crossfade math. Falls back to the analytic
      // collapseRadiusAt/resolveTriggerCornerRadius pair (still shared with
      // Trigger.tsx's rest radius and useCollapseRadius.ts's morph curve)
      // only when no surface element is mounted to measure, or while
      // collapseProgress itself is meaningfully in flight: at the moment a
      // layout animation finishes, Motion briefly writes a literal "0px"
      // inline (measured: ~85ms, a multi-frame window, not a single-frame
      // measurement race) before the next commit re-applies the bound
      // MotionValue — reading through that window would paint a 0-radius
      // shadow on a still-resting sheet. `collapseProgress.isAnimating()`
      // alone doesn't exclude it: the spring's own rest-detection threshold
      // can keep reporting `true` for a few extra ms after p is visually 0
      // or 1 (measured p as low as -0.0004 while still "animating"), which
      // is exactly the window the glitch falls in — so gate on p itself
      // being away from either rest endpoint. Near either endpoint the
      // analytic curve already IS the resting value, so there's nothing to
      // gain from the DOM read there anyway.
      // Strawman (v0.2): this window also has to cover a few frames AFTER
      // p itself reaches an endpoint — measured directly, Motion's own
      // shared-layoutId settle can still be rewriting the SURFACE's inline
      // border-radius (including the literal "0px" glitch above) for a few
      // frames past the point collapseProgress calls the morph done. The
      // grace-period loop below (GRACE_MS) keeps this DOM read live through
      // that tail instead of switching back to the analytic curve the
      // instant p lands on 0/1, which is what let Motion's post-settle
      // rewrite paint a value this shadow had already stopped tracking.
      const inFlight = isInFlight(p);
      const withinSettleGrace =
        performance.now() - lastActiveAtRef.current < SURFACE_READ_GRACE_MS;
      const sheetRadius = readVarPx(el, "--vista-sheet-sheet-radius", 48);
      const surfaceEl = el
        .closest("[data-vista-sheet-root]")
        ?.querySelector<HTMLElement>(
          '[data-vista-sheet-part="sheet"], [data-vista-sheet-part="trigger-surface"]',
        );
      let radius: number;
      if (surfaceEl && (inFlight || withinSettleGrace)) {
        radius = readRenderedCornerRadius(surfaceEl);
      } else {
        const token = readVarPx(el, "--vista-sheet-trigger-radius", 9999);
        const triggerCorner = resolveTriggerCornerRadius({
          shape,
          triggerSize: 2 * Math.min(trigger.halfWidth, trigger.halfHeight),
          token,
          cornerShapeSupported: supportsCornerShape(),
        });
        radius = collapseRadiusAt(p, sheetRadius, triggerCorner);
      }

      // Crossfade window: the heavy sheet shadow is fully in at p=0 (open,
      // at rest) and fades out to the thin disc shadow by p=fadeEnd — a
      // taste value, dialled via these two CSS vars rather than hand-typed
      // (DESIGN.md §4.4, "springs and taste values are dialled, never
      // typed" — this isn't a spring, but the same rule applies to any
      // number a stranger would otherwise have to guess). collapseProgress
      // overshoots slightly past its [0,1] range on spring rebound (measured
      // ~-0.0094) — clamp before using it for opacity, since opacity is the
      // only property this crossfade may animate (§4.3: transform/opacity
      // only while the clock runs).
      const pClamped = p < 0 ? 0 : p > 1 ? 1 : p;
      const fadeStart = readVarPx(
        el,
        "--vista-sheet-sheet-shadow-fade-start",
        0,
      );
      const fadeEnd = readVarPx(
        el,
        "--vista-sheet-sheet-shadow-fade-end",
        0.25,
      );
      const span = fadeEnd - fadeStart;
      const sheetShadowOpacity =
        span <= 0
          ? pClamped <= fadeStart
            ? 1
            : 0
          : Math.min(1, Math.max(0, (fadeEnd - pClamped) / span));
      const discShadowOpacity = 1 - sheetShadowOpacity;

      el.style.setProperty("--vista-sheet-collapse", String(p));
      el.style.setProperty(
        "--vista-sheet-shadow-opacity",
        String(discShadowOpacity),
      );
      el.style.setProperty(
        "--vista-sheet-sheet-shadow-opacity",
        String(sheetShadowOpacity),
      );
      el.style.setProperty("--vista-sheet-shadow-x", `${cx}px`);
      el.style.setProperty("--vista-sheet-shadow-y", `${cy}px`);
      el.style.setProperty("--vista-sheet-shadow-w", `${halfW}px`);
      el.style.setProperty("--vista-sheet-shadow-h", `${halfH}px`);
      el.style.setProperty("--vista-sheet-shadow-radius", `${radius}px`);
      el.style.width = `${halfW * 2}px`;
      el.style.height = `${halfH * 2}px`;
      el.style.left = `${cx - halfW}px`;
      el.style.top = `${cy - halfH}px`;
    };

    apply();

    // collapseProgress's "change" fires synchronously the instant its spring
    // value updates — BEFORE Motion's own layout-projection system (a
    // SEPARATE clock, see Root.tsx's clock-coupling note) writes the
    // surface's actual border-radius for that same frame. Reading
    // synchronously from that handler therefore reads last frame's surface
    // radius, one step stale; deferring the read to a microtask lets
    // Motion's write for the CURRENT task land first while still running
    // well before the browser's next paint — the same "read after the
    // write, still pre-paint" guarantee the settle-tail MutationObserver
    // below relies on, applied to the in-flight path too. `scheduleApply`
    // coalesces repeat triggers within one task into a single deferred
    // apply() call.
    let applyScheduled = false;
    const scheduleApply = () => {
      if (applyScheduled) return;
      applyScheduled = true;
      queueMicrotask(() => {
        applyScheduled = false;
        apply();
      });
    };

    // The MutationObserver below exists only to cover the POST-settle tail
    // (see its comment) — while collapseProgress is actually ticking,
    // scheduleApply() above already covers every frame, timed to read AFTER
    // Motion's write lands. Connecting the observer for that same window as
    // well used to double both the write below AND the forced layout read
    // inside apply() (readRenderedCornerRadius), every frame of the morph.
    //
    // Gating the observer on `p` being away from the rest endpoints (the
    // same NEAR_REST_EPS apply() itself reads) does NOT work here: a
    // spring's final decay frames sit inside that epsilon band — p keeps
    // producing real per-frame "change" events for a stretch after it reads
    // as "near rest" — so an epsilon-based arm/disarm re-connects the
    // observer while collapseProgress is still actively ticking, right back
    // into the double-apply bug. What actually distinguishes "the tail this
    // observer exists for" is collapseProgress having stopped EMITTING
    // changes at all, regardless of how close to rest its value sits — so
    // arming is debounced on quiet, not gated on value: every progress tick
    // disarms and reschedules a one-frame quiet-check via requestAnimationFrame
    // (registered AFTER Motion's own next-frame request, so a still-ticking
    // spring's next tick always cancels ours before it can fire). Only once
    // a tick fails to arrive for one whole frame (the spring's own ticker
    // has genuinely stopped) does the observer connect, for the
    // SURFACE_READ_GRACE_MS tail. One scheduling path covers any one frame,
    // never both.
    const rootEl = elRef.current?.closest("[data-vista-sheet-root]") ?? null;
    let mutationObserver: MutationObserver | null = null;
    let observing = false;
    let graceTimeout: ReturnType<typeof setTimeout> | null = null;
    let armRafId: number | null = null;

    const disarmObserver = () => {
      if (graceTimeout !== null) {
        clearTimeout(graceTimeout);
        graceTimeout = null;
      }
      if (observing) {
        mutationObserver?.disconnect();
        observing = false;
      }
    };

    // Strawman (v0.2): re-arms (and extends) the settle-grace window every
    // time either a progress tick lands at rest or the observer itself
    // catches Motion still rewriting the surface — the post-settle
    // border-radius rewrite (the "0px" glitch) keeps happening for ~85ms
    // after collapseProgress's own "change" events have already stopped
    // firing (confirmed by direct measurement, task 3's investigation).
    // Reacting to the surface's ACTUAL mutation, rather than polling it on
    // an independent requestAnimationFrame, is what makes this "one clock"
    // by construction (DESIGN.md §4.1): a separate rAF loop races Motion's
    // own writes frame-to-frame (measured: still landing a full
    // glitch-width late); a MutationObserver's microtask callback runs in
    // the SAME task Motion's write lands in, before the browser's next
    // paint, so whatever the surface shows at paint time is always what
    // this last observed and copied.
    const armObserverForGrace = () => {
      if (graceTimeout !== null) clearTimeout(graceTimeout);
      if (rootEl && mutationObserver && !observing) {
        mutationObserver.observe(rootEl, {
          subtree: true,
          attributes: true,
          attributeFilter: ["style"],
        });
        observing = true;
      }
      graceTimeout = setTimeout(disarmObserver, SURFACE_READ_GRACE_MS);
    };

    if (rootEl && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver((mutations) => {
        // Exclude this shadow element's own style writes (apply() sets
        // several inline properties every call) — otherwise observing the
        // shadow's own mutations would re-trigger apply() on itself forever.
        const relevant = mutations.some((m) => m.target !== elRef.current);
        if (!relevant) return;
        lastActiveAtRef.current = performance.now();
        armObserverForGrace();
        apply();
      });
    }

    const unsubscribeProgress = collapseProgress.on("change", () => {
      lastActiveAtRef.current = performance.now();
      // A live tick is covering this frame's apply() itself — the observer
      // would just re-run it a second time for the same Motion write, so it
      // stays off. Reschedule the one-frame quiet-check: only once a tick
      // fails to arrive for a whole frame does the tail actually need the
      // observer.
      disarmObserver();
      if (armRafId !== null) cancelAnimationFrame(armRafId);
      armRafId = requestAnimationFrame(() => {
        armRafId = null;
        armObserverForGrace();
      });
      scheduleApply();
    });
    // Drag frames must re-run apply() too, or the shadow only picks up the
    // drag offset on the NEXT collapseProgress tick (i.e. never, while the
    // sheet sits fully open at p=0 with no progress change in flight) — this
    // is the D1 fix.
    const unsubscribeDrag = sheetDragY.on("change", () => {
      lastActiveAtRef.current = performance.now();
      scheduleApply();
    });

    return () => {
      unsubscribeProgress();
      unsubscribeDrag();
      if (armRafId !== null) cancelAnimationFrame(armRafId);
      disarmObserver();
    };
  }, [collapseProgress, triggerRect, sheetRect, sheetDragY, shape, layerEl]);

  const dataState = isDragging ? "dragging" : ctx.open ? "open" : "closed";

  const sharedProps = {
    "aria-hidden": true as const,
    "data-vista-sheet-part": "shadow",
    "data-state": dataState,
    "data-vista-sheet-shape": shape,
  };

  if (asChild && isValidElement(children)) {
    const childEl = children as ReactElement<Record<string, unknown>>;
    const childStyle = (childEl.props.style as CSSProperties | undefined) ?? {};
    const childRef = (childEl.props as { ref?: Ref<HTMLElement> }).ref;
    return (
      <Layer>
        {cloneElement(childEl, {
          ...sharedProps,
          ref: mergeShadowRef(childRef, (node) => {
            elRef.current = node;
          }),
          style: {
            position: "fixed",
            zIndex: zIndex - 1,
            pointerEvents: "none",
            ...childStyle,
          },
        })}
      </Layer>
    );
  }

  return (
    <Layer>
      <div
        ref={(node) => {
          elRef.current = node;
        }}
        className={`${styles.shadow} ${className ?? ""}`}
        style={{ position: "fixed", zIndex: zIndex - 1, pointerEvents: "none" }}
        {...sharedProps}
      />
    </Layer>
  );
}
