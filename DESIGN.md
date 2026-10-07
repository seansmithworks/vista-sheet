---
version: alpha
name: "vista-sheet — Design System"
preset: refined-minimal
colors:
  # Package defaults (README theming table; consumers override via --vista-sheet-* vars)
  surface: "#fafafa"
  surfaceElevated: "#ffffff"
  border: "#e5e5e5"
  textPrimary: "#1d1d1f"
  accent: "#1d1d1f"
  # Example pages (match the package defaults, example/example.css)
  exampleBackground: "#f5f5f7"
  exampleSurface: "#fafafa"
  exampleSurfaceElevated: "#ffffff"
  exampleBorder: "#e5e5e5"
  exampleTextPrimary: "#1d1d1f"
  exampleTextSecondary: "#6e6e73"
  exampleAccent: "#1d1d1f"
  # Warm palette (alternate, no longer the package default)
  warmSurface: "#faf7f2"
  warmSurfaceElevated: "#f4f0e8"
  warmBorder: "#e6dfd2"
  warmTextPrimary: "#1a1610"
  warmAccent: "#1a1610"
rounded:
  sheet: "48px"
  trigger: "9999px"
  close: "9999px"
  triggerRoundedSquare: "25% of trigger size (strawman, awaiting dial)"
  triggerSquircleFallback: "27.16% of trigger size (strawman, awaiting dial)"
  triggerRectangle: "min(trigger radius token, height / 2): a pill (strawman, awaiting dial)"
shadows:
  silhouette: "0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.08)"
  silhouetteDark: "0 1px 2px rgba(0,0,0,.3), 0 4px 12px rgba(0,0,0,.3)"
  sheetAtRest: "0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)"
triggerFeedback:
  # strawman, awaiting dial
  hoverLift: "1px"
  pressScale: 0.97
  durationMs: 150
  easing: "cubic-bezier(0.23, 1, 0.32, 1)"
  minHitArea: "48px"
  highlightColor: "7% of text colour (dark example palettes: rgba(255,255,255,.1))"
  highlightSize: "96px"
  highlightPressScale: 0.6
  highlightStrength: 1
  pressTint: "rgba(0,0,0,.05) (dark example palettes: rgba(0,0,0,.2))"
buttonSizes:
  # strawman, awaiting dial
  s: { height: 36px, paddingInline: 14px, gap: 6px }
  m: { height: 44px, paddingInline: 18px, gap: 8px }
  l: { height: 52px, paddingInline: 22px, gap: 10px }
motion:
  open: { stiffness: 375, damping: 42.5, mass: 1.75 }
  close: { stiffness: 375, damping: 32, mass: 1 }
  sharedOpen: { stiffness: 500, damping: 45 }
  sharedClose: { stiffness: 340, damping: 30, mass: 1 }
  snap: { stiffness: 700, damping: 52, mass: 1 }
  surfaceCloseLeadDelayMs: 35
  openContentRevealDelaySec: 0.2
  itemStaggerSec: 0.09
  contentFadeOutMs: 80
  closeRevealProgress: 0.01
  triggerLabelRevealStart: 0.85
---

# Design System: vista-sheet

Preset `refined-minimal`, with motion governed by §4 below instead of the preset's Motion section. Package tokens live in `README.md`'s theming table and are machine-checked by `npm run audit:vars`; this file explains the choices and holds the rules that table cannot.

## 1. Visual Theme

A bare disc that becomes a sheet. Everything else on screen is quiet so the morph is the only event. Neutral by default, so the motion, not the palette, is what a viewer reads; Warm paper (the seansmithdesign.com origin) is an alternate palette a consumer opts into.

- Near-monochrome. One accent, used only for focus rings.
- Whitespace and a hairline border carry structure; the sheet's one shadow is the only substantial shadow on the page.
- No gradients or decorative color inside the package. The demo's iridescent glow is a recording aid behind a toggle, never a default.

## 2. Color

| Role | Package default | Example pages | Warm palette |
| --- | --- | --- | --- |
| Surface (trigger) | `#fafafa` | `#fafafa` | `#faf7f2` |
| Surface, elevated (sheet) | `#ffffff` | `#ffffff` | `#f4f0e8` |
| Border | `#e5e5e5` | `#e5e5e5` | `#e6dfd2` |
| Text | `#1d1d1f` | `#1d1d1f` | `#1a1610` |
| Accent (focus ring only) | `#1d1d1f` | `#1d1d1f` | `#1a1610` |
| Page background | consumer's | `#f5f5f7` | consumer's |

Consumers override with `--vista-sheet-*` custom properties. Never add a hex to `src/styles.module.css` that is not a `var()` fallback.

## 3. Shape and Depth

- **Trigger:** `shape` on Root, default circle (`--vista-sheet-trigger-radius: 9999px`). Squircle is a true superellipse via `corner-shape` (Chromium; 27.16% radius elsewhere) and gives the sheet squircle corners too; rounded square is 25% of trigger size; square is 0. Surface, silhouette shadow, Shared clip and focus ring all follow the shape, and the shadow's corner uses the surface's own radius curve. It rests at its shape after every close path (geometry tests (o) and (o-shape)).
- **Sheet:** `--vista-sheet-sheet-radius: 48px`. During the morph the radius is a pure function of `collapseProgress`, never its own spring.
- **Two shadow looks, one painter.** `<VistaSheet.Shadow>` paints both the thin disc shadow and the sheet's heavier resting shadow on its own silhouette, crossfaded by opacity as `collapseProgress` moves (2026-09-11). Nothing else paints a shadow.
- **Trigger shadow:** soft and low-contrast (2026-10-07): `0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.08)` on light, `0 1px 2px rgba(0,0,0,.3), 0 4px 12px rgba(0,0,0,.3)` on dark. The 2px `--vista-sheet-surface-border` ring carries the edge; the shadow only lifts it off the page.
- **Trigger hover and press:** at rest only, the trigger rises 1px on mouse hover and scales to 0.97 while pressed, 150ms strong ease-out, with `<VistaSheet.Shadow>` moving identically so the two never disagree (Strawman, awaiting dial). Never while the sheet is mounted, never under reduced motion, and any open drops it instantly before the morph measures its start.
- **Trigger highlight:** a soft radial spot inside the trigger surface follows the mouse on hover; on press it tightens to 0.6 and the surface takes a slight dark tint (Strawman, awaiting dial). It is 7% of the text colour by default, so it reads as a tint on light and a glow on dark. Touch, keyboard and reduced motion get it centred and static, fade only. It lives inside the surface, so it never changes a measured box, never paints on the sheet, and is gone before any open. `--vista-sheet-trigger-highlight-strength: 0` turns it off.
- **Tap target:** every trigger has an invisible hit area of at least 48px on each axis (rectangle s/m, small discs). The visual and every measured box keep their size.
- **Close button:** 44px hit area, transparent, circular focus ring.
- **Media sheet:** `<VistaSheet.Sheet aspectRatio>` contain-fits the media ratio; `<VistaSheet.Media>` covers the surface, centred, clipped by the surface shape (Strawman (v0.2): centred crop, no focal point).
- **Rectangle trigger:** `shape="rectangle"` with `buttonSize` s/m/l → height 36/44/52px, inline padding 14/18/22px, gap 6/8/10px. Width sizes to the label by default, or a fixed `buttonWidth`. Corners are a pill, `min(--vista-sheet-trigger-radius, height / 2)` (Strawman (v0.2), awaiting dial). Shared and Media are not supported inside it in v0.2.

## 4. Motion Principles

The morph is the product, so it gets the budget a modal normally does not. Everything else obeys Emil Kowalski's standards (`~/.claude/skills/review-animations/STANDARDS.md`).

1. **One surface, one clock.** Surface box, silhouette shadow, corner radius and close mask all derive from `collapseProgress`. Nothing has its own spring. A frame where the shadow and the surface disagree is a bug, not a tuning question. The shadow is painted by `<VistaSheet.Shadow>` and nowhere else: a second copy on any surface makes the shadow change intensity the frame that surface mounts or unmounts. *(Fixed 2026-09-11: `.triggerSurface` carried a duplicate, so the resting disc painted two shadows and the open's first frame halved them. Also fixed 2026-09-11: the sheet's own resting shadow, painted separately via `data-vista-sheet-settled`, was a second painter/second clock — `<VistaSheet.Shadow>` now paints that look too, crossfaded on `collapseProgress`.)* `<VistaSheet.Media>` has no clock either: it reads the surface's rendered scale on each of Motion's own style writes and counter-scales to a uniform cover, so the video can never squash (P4, 2026-09-13).
2. **Nothing appears from nothing.** The sheet must never paint at a size the disc did not grow into. A stall that skips the first 30% of the morph is a defect even if every frame after it is perfect. *(Known, bounded: the first open after page load stalls ~50ms on Sean's GPU — one dropped frame of morph; every later open runs with no frame over 20ms. Measured 2026-09-11. Open only if a cold first open ever needs to be the recorded one.)*
3. **Transform and opacity only while the clock runs.** No filter, blur, box-shadow, width or height animates during a morph. The silhouette shadow resizes per frame today; moving it to a transform is the durable fix.
4. **Springs, dialled, never typed.** Open 375/42.5/1.75 · close 375/32/1 · shared.open 500/45 · shared.close 340/30/1 · lead delay 35 · snap 700/52/1. A change to any of these goes through the tuner (`/tune`) with a measured before/after, never a hand edit.
5. **Reveal after settle.** Content and the close control reveal once the surface is within 1% of rest. Items stagger at 90ms (Sean, 2026-09-13), deliberately past the old 30–80ms band so title, body and actions land as separate beats. The close control's scale-from-0 spin is a deliberate exception to "start at 0.9+", chosen 2026-09-10 for the glyph's symmetry; if it ever reads as popping, that is the first thing to revisit. A trigger's plain children (its label) fade in from `collapseProgress` 0.85 to 1 on close (Strawman (v0.2), awaiting dial), derived from progress like every other reveal here — never from spring velocity.
6. **Exit faster than enter.** Content fades out in 80ms; the close control reverses in 200ms; the close spring is stiffer than the open.
7. **Reduced motion is a crossfade, not nothing.** No `layoutId`, no transforms, opacity only, 200ms. The close control stays visible and reachable.
8. **Judge with the instrument, not memory.** Every motion change ships with before/after frame measurement; acceptance is the pixel. Smoothness is a number (distinct rendered frames per open+close, warm browser). Recording aids (the glow toggle) are off when judging.

## 5. Agent Prompt Guide

- Read this file and `src/motion.ts` before any change to the morph.
- Run `npm run test:geometry` (expect 36 vitest / 76 Playwright) and never loosen a threshold to fit a feel change.
- Reviewer is never the builder; green tests written by the builder are not evidence.
- Two `test:geometry` runs race over the shared dev server. Never run it concurrently with anything.

## Reference Ceiling

- **Apple Dynamic Island** — `design/reference/apple-dynamic-island.png` — one shape becoming another, shadow and content on one clock.
- **Family wallet drawer** — `design/reference/family-wallet.png` — continuity and settle feel for sheets.
- **Vaul drawer (Emil Kowalski)** — `design/reference/vaul-drawer-open.png` — web-native open/close smoothness and gesture dismiss.
- **seansmithdesign.com ContactSheet** — `design/reference/seansmithdesign-contactsheet-closed.png` — the source this package was extracted from; the feel it must not lose.

Screenshots are first-pass captures of each site's landing state; replace with a mid-morph frame of each when one is available.
