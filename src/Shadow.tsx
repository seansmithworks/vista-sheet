"use client";

import { cloneElement, isValidElement, useEffect, useRef } from "react";
import type { CSSProperties, ReactElement, Ref } from "react";
import { useVistaSheetInternal } from "./context";
import { Layer } from "./Layer";
import { mergeRefs } from "./mergeRefs";
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
 * One fixed, aria-hidden div at z-1, sized to the silhouette interpolated
 * between the trigger and the sheet. It is the only painter of both shadows
 * (DESIGN.md §4.1): the disc shadow and the sheet's resting shadow, two
 * layers crossfaded on collapseProgress. The crossfade window is the
 * --vista-sheet-sheet-shadow-fade-start / -fade-end CSS vars.
 *
 * asChild clones the single child (e.g. a surface-fx dither layer), merges
 * the positioning, attributes and --vista-sheet-shadow-* vars onto it, and
 * composes the child's own ref (React 19 `props.ref`) with Shadow's.
 */

/**
 * An element's rendered top-left corner radius in px, corrected for
 * Motion's projection scale — the same measurement geometry.spec.ts's (rt)
 * gate makes. An elliptical value ("Xpx Ypx") uses the horizontal part.
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
      // Mid-morph, read the surface's RENDERED radius instead of computing
      // it. Motion's shared-layout crossfade mixes the radius from the
      // exiting element's snapshot on its own layout progress, not
      // collapseProgress, so no p-based formula matches it on open. Reading
      // the DOM makes shadow and surface one clock by construction. The read
      // stays live for SURFACE_READ_GRACE_MS after the last tick because
      // Motion keeps rewriting the surface radius (including a literal "0px")
      // for a few frames past settle. At rest, use the analytic curve.
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

    // collapseProgress's "change" fires before Motion writes the surface's
    // radius for the frame, so apply() is deferred to a microtask: after
    // that write, still before paint. Coalesced to one call per task.
    let applyScheduled = false;
    const scheduleApply = () => {
      if (applyScheduled) return;
      applyScheduled = true;
      queueMicrotask(() => {
        applyScheduled = false;
        apply();
      });
    };

    // The MutationObserver covers only the post-settle tail; while
    // collapseProgress ticks, scheduleApply covers every frame. Arming is
    // debounced on quiet, not gated on p: a spring's last decay frames sit
    // inside any epsilon band. Each tick disarms and schedules a one-frame
    // quiet check; only a frame with no tick connects the observer, so one
    // path covers any frame, never both.
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

    // Re-arms (and extends) the grace window whenever the observer catches
    // Motion still rewriting the surface after the ticks stop. A
    // MutationObserver, not a rAF poll: its callback runs in the same task
    // as Motion's write, before paint, so the shadow copies exactly what the
    // surface paints; a rAF loop races those writes.
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

  let shadow: ReactElement;
  if (asChild && isValidElement(children)) {
    const childEl = children as ReactElement<Record<string, unknown>>;
    const childStyle = (childEl.props.style as CSSProperties | undefined) ?? {};
    const childRef = (childEl.props as { ref?: Ref<HTMLElement> }).ref;
    shadow = cloneElement(childEl, {
      ...sharedProps,
      ref: mergeRefs(childRef, (node) => {
        elRef.current = node;
      }),
      style: {
        position: "fixed",
        zIndex: zIndex - 1,
        pointerEvents: "none",
        ...childStyle,
      },
    });
  } else {
    shadow = (
      <div
        ref={(node) => {
          elRef.current = node;
        }}
        className={`${styles.shadow} ${className ?? ""}`}
        style={{ position: "fixed", zIndex: zIndex - 1, pointerEvents: "none" }}
        {...sharedProps}
      />
    );
  }
  return <Layer>{shadow}</Layer>;
}
