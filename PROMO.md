# vista-sheet — Brand layer

`PROMO.md` is the brand layer this product owns (schema: `~/Code/annotie/docs/promo-schema.md`).
It locks **identity** and leaves **angle and camera** free — it is not a shot list.

## Rule: reference, never duplicate

Every value with a `DESIGN.md` equivalent is a **reference to a token name**, not a copied
hex/px value. See `DESIGN.md` for the actual numbers.

## Fields

```yaml
---
product: vista-sheet
design_tokens: ../DESIGN.md
mood_board:
  - design/reference/apple-dynamic-island.png
  - design/reference/family-wallet.png
  - design/reference/vaul-drawer-open.png
  - design/reference/seansmithdesign-contactsheet-closed.png
look:
  accent: colors.accent
  background: colors.exampleBackground
  surface: colors.surface
  surfaceElevated: colors.surfaceElevated
  border: colors.border
  text: colors.textPrimary
  sheet_radius: rounded.sheet
  trigger_radius: rounded.trigger
  shadow: shadows.sheetAtRest
motion_rules:
  - "One surface, one clock: box, shadow, radius and close mask derive from collapseProgress; nothing has its own spring (motion.open / motion.close)"
  - "Nothing appears from nothing: the sheet never paints at a size the disc did not grow into"
  - "Content reveals only after the surface settles, staggered (motion.itemStaggerSec)"
  - "Exit is faster than enter: close is stiffer than open, content fades out fast (motion.contentFadeOutMs)"
  - "No decorative color or gradient; the morph itself is the only event on screen"
sound_motif:
  key: "none — vista-sheet ships silent; any score is source music laid under a cut, not a product sound"
  register: "quiet, minimal, never masking the morph as the visual lead"
  loudness_target_lufs: -14
standard_intro:
  template: kit/bumpers/bumper.html
  duration_s: 1.2
standard_outro:
  template: kit/endcard/endcard.html
  wordmark: vista-sheet
  tagline: "A persistent trigger that morphs into a modal sheet."
  footer: "npm install @seansmithworks/vista-sheet · MIT"
approved_claims:
  - "A draggable trigger that morphs into a modal sheet via a layoutId FLIP transition"
  - "Compound-component API: nine components plus useVistaSheet()"
  - "Ships compiled ESM + .d.ts; no build-step config needed on install"
  - "Copy-in option via npx @seansmithworks/vista-sheet add, no package dependency"
  - "React >=19, react-dom >=19, motion >=12 <14 as peer dependencies"
  - "Seven anchor points; drag to re-anchor"
  - "Shapes: circle, squircle, rounded-square, square, rectangle"
  - "Reduced motion falls back to a 200ms opacity crossfade, no transforms"
  - "MIT licensed"
banned:
  - "streamline your workflow"
  - "blazing fast" / any unverified performance adjective
  - any invented number, testimonial, or stat not in README.md or DESIGN.md
  - "production-tested" / "battle-tested" — README's own status says the opposite ("nothing consumes this package yet, including Sean's own site")
  - claiming visual-regression or perf numbers not printed in DESIGN.md §"Measuring smoothness"
---
```

## Notes

- `look` and `sound_motif` lock identity so every cut reads as the same product; they do not
  lock story, pacing, or shot choice — that's the Director's job per run (P1).
- `standard_intro` / `standard_outro` point at the kit's slot templates, filled with this
  product's values above.
- `banned` mirrors brag-slim's "no generic SaaS language" rule, extended with vista-sheet's
  own known-status caveats from README.md's "Known issues / status" section.

## Demo mode

`example/` already gives fixed, seeded, deterministic states loadable by URL — no query
params or additions needed. A capture script should hit these directly against the Vite dev
server (`node_modules/.bin/vite example --port <free-port> --strictPort --host 127.0.0.1`):

- `/flagship.html` — the flagship recipe (warm serif treatment, ContactSheet-style)
- `/list.html` — simple list recipe
- `/media-card.html` — media / app-promo card recipe
- `/video.html` — portrait video recipe (aspect-ratio sheet, autoplay muted media)
- `/buttons.html` — rectangle trigger sizes (s/m/l)
- `/contact.html` — contact form recipe
- `/play.html` — the playground shell: driven via `#play-recipe` (select), the
  `input[name="play-shape"]` radio group, and `#play-palette` (select) to cover the full
  recipe × shape × palette gamut from one page, as `scripts/record-demo.mjs` already does
  (reference pattern only, not modified by this task)
