import { useEffect } from "react";
// Relative import: the example lives inside the package repo itself (no
// publish step yet), so it reaches the package the same way main.tsx does.
// A real consumer would import from "@orrery-ui/iris".
import { useIris } from "../src/index";

/**
 * CloseMask — the trailing-paper close mask, rebuilt from OUTSIDE the
 * package (docs/PACKAGE-DESIGN.md §8). Ported from the source site's
 * ContactSheet.tsx:721-755 (`surfaceCloseMask`), which exists to fix one
 * artifact specific to a tall sheet whose shared element leads the close:
 * mid-collapse, the vacated paper above the avatar sits as a solid opaque
 * block for a few frames. This is the package's own escape-hatch validation
 * test — it is cut from `orrery-iris` because it does not belong in a generic
 * primitive (a sheet with no leading shared element has no such artifact),
 * but re-derived here for the flagship-style example so the demo isn't
 * visibly worse without it.
 *
 * THE FINDING: this component is buildable using ONLY the documented v0.1
 * API — useIris().collapseProgress and .open — and one documented DOM
 * contract: the sheet element carries `data-orrery-iris-part="sheet"`. No
 * widening of useIris() was needed.
 *
 * Why `open`, not getVelocity(): a prior version inferred "closing" from the
 * sign of collapseProgress.getVelocity() (positive while progress increases
 * toward 1). That inference is wrong by construction — the open spring
 * (375/42.5/1.75) overshoots and rebounds, and during that rebound velocity
 * is briefly positive too, mid-OPEN. The mask then painted (and, at the
 * settle boundary, momentarily cleared to an identity gradient) during an
 * open, clipping whatever the sheet's own box-shadow was doing that frame —
 * a one-frame shadow pop. `open` is the real flag: it is false for exactly
 * the duration of a close (button, Escape, backdrop, or a released
 * swipe-to-dismiss all funnel through the same `setOpen(false)`), and true
 * for the entire open including its overshoot. The fade envelope below runs
 * only while `open === false`, never during an open, regardless of velocity.
 *
 * Renders no DOM of its own: it writes `maskImage` directly onto the live
 * sheet element on every collapseProgress tick.
 */
export function CloseMask() {
  const { collapseProgress, open } = useIris();

  useEffect(() => {
    const apply = () => {
      // Scoped to the main Root's wrapper (`data-orrery-iris-root="main"`,
      // set in main.tsx): a second, unrelated Iris.Root (the "Design"
      // settings sheet) also renders `[data-orrery-iris-part="sheet"]` when
      // open, and an unscoped query would grab whichever one is open at the
      // time — usually not this one.
      const sheetEl = document.querySelector<HTMLElement>(
        '[data-orrery-iris-root="main"] [data-orrery-iris-part="sheet"]',
      );
      if (!sheetEl) return;

      if (open) {
        // No fade during an open (including its overshoot) or once settled:
        // clear the property rather than paint a "0% -> 100% solid"
        // gradient. An identity mask is still a mask — it forces compositing
        // and creates a new containing block on an element that also runs a
        // FLIP, for zero visual benefit (E3).
        sheetEl.style.removeProperty("mask-image");
        sheetEl.style.removeProperty("-webkit-mask-image");
        return;
      }

      const p = collapseProgress.get();

      // Envelope window over collapseProgress (0 open -> 1 closed) — the
      // exact constants from ContactSheet.tsx:731-735.
      const FADE_START = 0.06;
      const FADE_PEAK = 0.5;
      const FADE_END = 0.82;
      const MAX_FADE = 0.62;
      const BAND = 18;

      let e = 0;
      if (p > FADE_START && p < FADE_END) {
        e =
          p <= FADE_PEAK
            ? (p - FADE_START) / (FADE_PEAK - FADE_START)
            : (FADE_END - p) / (FADE_END - FADE_PEAK);
      }
      e = e < 0 ? 0 : e > 1 ? 1 : e;

      const solidPct = 100 - MAX_FADE * 100 * e;
      const fadeEndPct = Math.min(100, solidPct + BAND);
      const mask = `linear-gradient(to top, #000 0%, #000 ${solidPct}%, transparent ${fadeEndPct}%)`;

      sheetEl.style.maskImage = mask;
      sheetEl.style.setProperty("-webkit-mask-image", mask);
    };

    // Seeded here (not gated on collapseProgress alone) so `apply` re-runs
    // the instant `open` flips — mirrors the pattern in Sheet.tsx:79-92.
    apply();
    const unsubscribe = collapseProgress.on("change", apply);
    return unsubscribe;
  }, [collapseProgress, open]);

  return null;
}
