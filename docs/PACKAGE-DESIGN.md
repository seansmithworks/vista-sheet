# Wicket Iris package design

Draggable trigger that morphs into a sheet. Generic React primitive, compound-component API.

Shipped as `@wicket/iris`. `Iris` is the exported namespace object throughout, and `--wicket-iris-*` is the CSS custom property namespace.

Source of the extraction: `src/components/chrome/FloatingIdentity.tsx`, `ContactSheet.tsx`, `anchorPositions.ts` and their CSS modules on `seansmithdesign.com`. Everything cited below was verified against those files, not inferred.

---

## 0. Framing

Three things ship, in this order of priority:

1. **The primitive.** A trigger that lives at one of seven viewport anchors (six corners/edges plus center), can be dragged and snapped between them, and morphs into a modal sheet. Consumer supplies all content.
2. **The flagship example.** Sean's identity/contact surface, rebuilt on top of the primitive. It is an example app in the repo, not a second entry point in the package.
3. **The shadow seam.** A slot where a `@seansmith/surface-fx` dither layer drops in. The package never imports surface-fx.

Precedent check. Two of Sean's own packages already set conventions:

- `@seansmith/surface-fx` (`~/Code/surface-fx`): source-only, no build step, installed from GitHub, consumed via Next `transpilePackages`, `react`/`motion` as peers. Ships **no JSX and no CSS**. Subpath export map is `"./*": "./src/*.ts"`.
- `@seansmith/device-frame` (`~/Code/device-frame`): source-only, same install model, **ships JSX and CSS Modules**, root-only export (`{".": "./src/index.ts"}`), a `src/css-modules.d.ts` shim, all CSS custom properties namespaced `--device-*` with hardcoded fallbacks, and a Vite `demo/` folder.

`device-frame` is the closer precedent and this package should follow it. Section 5 flags every place surface-fx's conventions do not carry over.

---

## 1. Public API

### The tree

```tsx
import { Iris } from "@wicket/iris";

<Iris.Root>
  <Iris.Shadow />

  <Iris.Trigger aria-label="Open contact">
    <Iris.Shared>
      <Avatar />
    </Iris.Shared>
  </Iris.Trigger>

  <Iris.Sheet aria-labelledby="sheet-title">
    <Iris.Shared>
      <Avatar />
    </Iris.Shared>

    <Iris.Close aria-label="Close" />

    <Iris.Content>
      <Iris.Item>
        <h2 id="sheet-title">Sean Smith</h2>
      </Iris.Item>
      <Iris.Item>…</Iris.Item>
    </Iris.Content>
  </Iris.Sheet>
</Iris.Root>
```

Nine exports total: eight components plus one hook. That is the whole surface area.

### `<Iris.Root>`

Owns open state, anchor state, the `LayoutGroup`, the shared context, and the reduced-motion decision.

```ts
type AnchorId =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "center";

type Spring = { stiffness: number; damping: number; mass?: number };

interface SharedTransitionByDirection {
  open?: Spring | Transition;
  close?: Spring | Transition;
}

interface MorphTransition {
  /** Trigger to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to trigger. Default: { stiffness: 375, damping: 32, mass: 1 } */
  close?: Spring | Transition;
  /**
   * The <Iris.Shared> element's own morph. Direction-aware: a single
   * value applies to both directions, { open, close } sets them apart.
   * Defaults: open { stiffness: 500, damping: 45 },
   *           close { stiffness: 305, damping: 28.9, mass: 1 }
   */
  shared?: Spring | Transition | SharedTransitionByDirection;
}

interface RootProps {
  children: React.ReactNode;

  // ── Open state ────────────────────────────────────────────────
  /** Uncontrolled initial state. Default false. */
  defaultOpen?: boolean;
  /** Controlled. When provided, the package never sets open itself. */
  open?: boolean;
  /** Fires on every requested state change, controlled or not. */
  onOpenChange?: (open: boolean) => void;

  // ── Position ──────────────────────────────────────────────────
  /** Uncontrolled initial anchor. Default "bottom-center". */
  defaultAnchor?: AnchorId;
  /** Fires once per move to a new anchor: a drag release, an arrow key on
   * the focused trigger, or useIris().setAnchor. */
  onAnchorChange?: (anchor: AnchorId) => void;
  /** Default true. False renders a fixed trigger with no drag affordance. */
  draggable?: boolean;
  /**
   * localStorage key for the chosen anchor.
   * Default "wicket-iris-anchor". Pass false to disable persistence entirely.
   */
  persistKey?: string | false;
  /**
   * The polite status text written when the trigger moves by keyboard or by
   * useIris().setAnchor (never by a drag). Default
   * `Moved to bottom right.` style text. Return false to announce nothing.
   */
  anchorAnnouncement?: (anchor: AnchorId) => string | false;

  // ── Geometry ──────────────────────────────────────────────────
  /**
   * Trigger diameter in px. Object form is a breakpoint ramp.
   * Default { base: 96, md: 128, xl: 144 } at 0 / 768 / 1600.
   */
  triggerSize?: number | { base: number; md?: number; xl?: number };
  /** Sheet max width in px. Default 480. */
  sheetMaxWidth?: number;

  // ── Motion ────────────────────────────────────────────────────
  transition?: MorphTransition;
  /** Force reduced-motion behavior. Default: the media query. */
  reduceMotion?: boolean;

  // ── Plumbing ──────────────────────────────────────────────────
  /** Base for generated aria ids and layoutIds. Default useId(). */
  id?: string;
  /** Base z-index. Default 100. See §2 for the derived stack. */
  zIndex?: number;
  className?: string;
}
```

**Uncontrolled path.** `<Iris.Root>` with no `open`. The trigger tap toggles internal state, `onOpenChange` fires for telemetry. The anchor is read from `localStorage` at mount, validated against the seven legal values, and written back on every settled drag. This is the default and it is what the flagship example uses.

**Controlled path.** Pass `open` and `onOpenChange`. The package calls `onOpenChange(next)` and does nothing else; the surface only changes when `open` changes. All internal triggers route through the same call: trigger tap, Escape, backdrop click, swipe-down past threshold, `<Iris.Close>`. There is no second escape valve, so a consumer holding `open={false}` gets a sheet that genuinely cannot open.

Anchor is deliberately **uncontrolled only** in v0.1. See §8.

#### Preview mode: `<Iris.Root preview>`

```ts
interface RootProps {
  /** Default false: a draggable button opening a modal sheet. */
  preview?: false;
  // ...everything above
}

type PreviewKept =
  | "children" | "onOpenChange" | "sheetMaxWidth" | "preset" | "transition"
  | "reduceMotion" | "id" | "zIndex" | "className";

type PreviewRootProps = Pick<RootProps, PreviewKept> & {
  /** Fixed for the Root's lifetime. Sheet max width defaults to 360. */
  preview: true;
} & Partial<Record<Exclude<keyof RootProps, PreviewKept | "preview">, never>>;

/** What <Iris.Root> accepts. */
type RootComponentProps = RootProps | PreviewRootProps;
```

`preview` turns a consumer's `<a>` into the trigger of a non-modal hover card. The Trigger is `<Iris.Trigger asChild>` over the link (`PreviewTriggerProps`: `asChild: true`, one element child, no `aria-label`, no `className`; the modal `TriggerProps` keeps `aria-label` required, so the modal compile-time check survives). `<Iris.Sheet>` still needs `aria-label` or `aria-labelledby`, but a preview card is `aria-hidden`, so nothing inside it may be focusable; the link is the accessible element.

Every modal-only prop (`open`, `defaultOpen`, `defaultAnchor`, `draggable`, `persistKey`, `triggerSize`, `shape`, `buttonSize`, `buttonWidth`, ...) is `never` on `PreviewRootProps`, so passing one is a type error, not a silent no-op. `RootComponentProps` is additive for existing modal consumers.

**Why a Root mode and not a new component.** The morph's clock coupling (`startMorphClock` plus its fallback rAF), shared context, `LayoutGroup` and reduced-motion decision all live in Root, and that is the most fragile code in the package. A separate `<Iris.Preview>` would have to duplicate it. So there is one Root, and `preview` branches in exactly three places:

1. **The Trigger switch.** `asChild` selects `LinkTrigger` (hover intent, focus intent, touch long-press, one pinned line box) over the button trigger.
2. **The placement function.** `previewSheetPlacement` (built on the pure `previewPlacement` in `anchors.ts`) replaces `sheetPlacement`: above the hovered line if the whole card fits there, otherwise the side with more room (above wins a tie), shrunk to fit; 8px gap, 16px viewport clamp, a 240px minimum height (currently; `PREVIEW_MIN_HEIGHT_PX`). Computed once at open.
3. **`useDialogBehavior({ modal })`.** `modal: false` skips scroll lock, the inert page, focus move and the focus guards, and adds light dismiss (outside press, scroll, resize). Escape closes in both modes.

Root also owns one `display: contents` layer on `<body>` that Sheet and Shadow both portal into, so `Shadow` still finds its sheet through `[data-wicket-iris-root]`. The layer exists only while a card is armed, open or closing, and carries the theme vars and the consumer's `className`. Content and Shadow carry no preview branches.

**Settled (Sean, 2026-10-04).** Placement is above when the whole card fits there, otherwise the side with more room, because the lines below stay hoverable. The 240px minimum height stays. The card is hoverable (WCAG 1.4.13), with a hover intent (currently 150ms, `PREVIEW_HOVER_INTENT_MS`) and a grace to cross the gap (currently 250ms, `PREVIEW_CLOSE_GRACE_MS`). Timings and the link-end radius (currently 4px, `PREVIEW_TRIGGER_RADIUS_PX`) are strawmen that live only in `src/motion.ts`.

### `<Iris.Trigger>`

The fixed drag wrapper plus the trigger button plus the morph seed surface.

```ts
interface TriggerProps {
  children?: React.ReactNode;
  className?: string;
  /** Required. This is the button's accessible name. */
  "aria-label": string;
}
```

Renders three nested nodes the consumer does not control:

1. `motion.div[data-wicket-iris-part="trigger-root"]`, `position: fixed` at the viewport origin, positioned entirely by Motion `x`/`y` MotionValues holding the trigger's top-left in viewport px. This single-origin model is load-bearing: nothing ever changes CSS `left`/`top` after mount, so a snap is a plain `x`/`y` animation with no FLIP and no one-frame transform desync.
2. `button[data-wicket-iris-part="trigger"]`, transparent, fills the wrapper, carries `aria-haspopup="dialog"` / `aria-expanded` / `aria-controls`.
3. `motion.div[data-wicket-iris-part="trigger-surface"]`, the `layoutId` seed. Circular, painted from `--wicket-iris-surface` and `--wicket-iris-surface-border`. This is the element that FLIPs into the sheet, which is why it is package-owned rather than a slot.

`children` render above the seed surface, inside the button.

### `<Iris.Sheet>`

The modal surface. Same `layoutId` as the trigger seed, so Motion FLIPs the box between the two.

```ts
type Labelled =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

type SheetProps = Labelled & {
  children: React.ReactNode;
  className?: string;
  /** Drag the sheet down past threshold to close. Default true. */
  dismissOnSwipe?: boolean;
  /** Click outside the sheet to close. Default true. */
  dismissOnBackdrop?: boolean;
};
```

The `Labelled` union makes it a type error to render a dialog with no accessible name. That is worth the small ugliness in the type.

Escape is **not** configurable. A modal surface that traps focus and cannot be dismissed by keyboard is a defect, not a variant.

### `<Iris.Shared>`

The shared-element slot. Rendered **twice**: once inside `<Iris.Trigger>`, once inside `<Iris.Sheet>`, with the same children. It carries its own `layoutId` and its own spring, independent of the surface morph.

```ts
interface SharedProps {
  children: React.ReactNode;
  className?: string;
}
```

Critical structural rule inherited from the source, and the package enforces it by construction: `<Iris.Shared>` renders as a **sibling** of the trigger seed surface, never a child. Nesting it would make its projection inherit the surface's close-morph FLIP, freezing it at the surface's transient mid-collapse box and then teleporting it home. The comment at `FloatingIdentity.tsx:1935-1944` documents that exact bug.

Optional: omit it entirely. The morph still works; there is just no element that persists visually across it.

### `<Iris.Content>` and `<Iris.Item>`

`Content` holds sheet content at opacity 0 through the bloom and reveals it after, then fades it out first on close. `Item` is a staggered child.

```ts
interface ContentProps { children: React.ReactNode; className?: string }
interface ItemProps    { children: React.ReactNode; className?: string }
```

No props beyond that. The reveal delay, stagger interval, and exit duration are internal (§3).

`Content` also owns the scroll region: it applies `overflow-y: auto` to itself and reports `scrollTop` to the swipe-to-close handler, which must not fire while the content is scrolled. That coupling exists today at `ContactSheet.tsx:929-930` and it is easy to lose in an extraction.

### `<Iris.Close>`

```ts
interface CloseProps {
  children?: React.ReactNode;  // default: a hairline X glyph
  className?: string;
  "aria-label": string;        // required
}
```

Registers itself in context on mount. If the sheet opens and no `Close` is registered, Root logs a dev-only warning. Escape and backdrop click are not a substitute for a visible close control.

### `<Iris.Backdrop>`

Opt-in **visual** scrim only. Dismiss-on-outside-click is Root behavior and works whether or not `Backdrop` is rendered.

```ts
interface BackdropProps {
  className?: string;
  /** backdrop-filter blur in px. Default 0. */
  blurPx?: number;
}
```

This split matters. The site currently ships `backdropDimEnabled: false` (verified in `surface-fx/src/schema/bloomDefaults.ts`), so the default look is a clear page behind the bloom. Making the scrim a component rather than a boolean means the default costs nothing and the dim variant costs one line.

### `<Iris.Shadow>`

See §4.

### `useIris()`

```ts
interface IrisState {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: AnchorId;
  /** Move the trigger to `anchor` with the same spring as a drag release
   * (seated directly under reduced motion). Fires onAnchorChange and the
   * status announcement when the anchor actually changes. */
  setAnchor: (anchor: AnchorId) => void;
  isDragging: boolean;
  triggerSize: number;
  /** 0 = fully open (sheet), 1 = fully closed (trigger). Live MotionValue. */
  collapseProgress: MotionValue<number>;
  /** Live viewport rects, null before first measure. */
  triggerRect: { cx: number; cy: number; radius: number } | null;
  sheetRect: { cx: number; cy: number; halfWidth: number; halfHeight: number } | null;
}

function useIris(): IrisState;
```

Throws outside `<Iris.Root>`. This hook is the escape hatch for §3 and the data source for §4.

### Props deliberately NOT exposed

| Not exposed | Why |
| --- | --- |
| `dragElastic`, `dragMomentum`, `dragConstraints`, drag threshold (5px) | Drag feel is one dialed system. Exposing pieces of it lets a consumer produce an off-screen excursion or a tap that registers as a drag. |
| Snap spring (`stiffness 700, damping 52, mass 1`) | Deliberately overdamped so the trigger never overshoots past a viewport edge. A softer value is a bug, not a preference. |
| `radiusHoldFraction`, `openContentRevealDelaySec`, `contentFadeOutMs` | The close choreography. Every one of these exists to suppress a specific artifact. See §3. (`surfaceCloseLeadDelayMs` was promoted OUT of this row and into §3's preset table — it is a duration, not a suppressed artifact.) |
| The trailing-paper mask envelope constants (`FADE_START/PEAK/END`, `MAX_FADE`, `BAND`) | Internal to one artifact fix. See §8, where this is a cut. |
| The anchor region map thresholds (thirds each axis) | Changing them makes "nearest anchor" not mean nearest. |
| Swipe-to-close thresholds (96px offset, 400px/s velocity) | Platform convention values. |
| Individual layer z-indices | One `zIndex` base, derived offsets. §2. |
| Focus-guard routing | Guards send focus to the first or last live tab stop; consumers cannot widen what counts as tabbable, because that is how focus lands on a hidden element. |
| `topPx` / `bottomPx` sheet placement | Derived from the anchor and the viewport, never passed. The consumer choosing these independently is how the sheet ends up off-screen. |
| A `tuning` object mirroring `BloomTuning` | The shortest path and the wrong one. See §7C. |

---

## 2. Theming API

### Delivery: CSS Modules, one file, no consumer import step

**Decision: CSS Modules, exactly as `@seansmith/device-frame` does it.**

Rejected alternatives:

- **A single `styles.css` the consumer imports.** Global class names in a package are a collision waiting to happen, and "you must also import the stylesheet" is a step people forget and then file a bug about.
- **Inline styles.** Kills media queries, `:focus-visible`, `:hover`, `@media (prefers-reduced-motion)`, and `[data-palette]`-style consumer overrides. This component needs all of them.
- **Tailwind, with a `@source` config step (div-phone's model).** Requires the consumer to have Tailwind at all, and requires a config edit. Sean's site has Tailwind v4 and it would still be friction. Hard no.

CSS Modules give hashed class names (no collisions), zero consumer setup, and native support in both Next and Vite for a `transpilePackages`-consumed source package. The cost is real but narrow: a consumer on a bundler with no CSS-module support cannot use the package. Both target bundlers support it.

Required companion file: `src/css-modules.d.ts`, copied verbatim from device-frame.

### Namespace and mapping

Every variable is `--wicket-iris-*` and every one has a hardcoded fallback in the CSS, so the package renders correctly with a consumer who sets nothing. The mapping below is what the flagship example writes to re-skin the primitive back into Sean's site.

| Package variable | Default (fallback baked in the CSS) | Current site variable |
| --- | --- | --- |
| `--wicket-iris-surface` | `#fafafa` | `--color-paper` |
| `--wicket-iris-surface-elevated` | `#ffffff` | `--color-paper-soft` (midnight sheet fill) |
| `--wicket-iris-surface-border` | `#e5e5e5` | `--color-paper-edge` |
| `--wicket-iris-text` | `#1d1d1f` | `--color-ink` |
| `--wicket-iris-accent` | `#1d1d1f` | `--color-accent` (focus ring only) |
| `--wicket-iris-sheet-max-width` | `480px` | `--contact-sheet-max-width` |
| `--wicket-iris-shared-size` | matches `--wicket-iris-trigger-size` | `--contact-portrait-size` |
| `--wicket-iris-sheet-radius` | `48px` | `tuning.sheetRadius` |
| `--wicket-iris-trigger-radius` | `9999px` | `tuning.discRadius` |
| `--wicket-iris-edge-margin` | `16px` | `EDGE_MARGIN` in `anchorPositions.ts` |
| `--wicket-iris-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` | `.triggerSurface` box-shadow |
| `--wicket-iris-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` | `.sheet` box-shadow |
| `--wicket-iris-z` | `100` | the z-index literals |

Derived z-stack, from `--wicket-iris-z` (call it `z`):

| Layer | z |
| --- | --- |
| Shadow | `z - 1` |
| Trigger | `z` |
| Backdrop | `z + 101` |
| Sheet | `z + 102` |

Those offsets reproduce the shipped stack exactly (99 / 100 / 201 / 202) at the default `z = 100`.

**Written by the package, readable by the consumer.** These are set as inline custom properties, not read:

| Variable | On | Meaning |
| --- | --- | --- |
| `--wicket-iris-trigger-size` | trigger root | resolved diameter in px |
| `--wicket-iris-sheet-left`, `--wicket-iris-sheet-top` | sheet | resolved placement in px |
| `--wicket-iris-collapse` | shadow layer | `0..1`, the live morph progress |
| `--wicket-iris-shadow-radius` | shadow layer | the interpolated corner radius |

### One fix taken during extraction

The site duplicates the trigger breakpoints in two places: the `@media` blocks in `FloatingIdentity.module.css:94-106` and the `resolveDiscSize()` function at `FloatingIdentity.tsx:311-317`, with a comment on each telling you to keep them in sync. That is a latent bug, and the sync failure mode (trigger shifts off its anchor) is exactly the kind of thing that gets debugged twice.

In the package, `resolveTriggerSize()` remains the single source of the size ramp, but it is not JS writing the var at runtime. `Root` renders a scoped `<style>` block with real `@media` rules — one per breakpoint in the ramp — that set `--wicket-iris-trigger-size` in CSS, server-rendered and deterministic from props alone. Neither `Root`'s wrapper nor `Trigger`'s drag wrapper writes `--wicket-iris-trigger-size` inline; an inline write on either would always beat the `@media` rules, at every viewport, and defeat the point of resolving the size in CSS. The live JS value from the size hook feeds only position math (`anchors.ts`) and drag-constraint numbers — never a FLIP-tracked element's painted box.

This split exists because Motion snapshots a shared-`layoutId` element's box at first paint. A JS-resolved size is not available correctly at first paint without either a hydration mismatch (server and client disagreeing before the effect that would set it runs) or a stale post-mount promotion (the size hook returning a base value on first render for hydration safety, then correcting itself after Motion has already snapshotted the shared-element origin). Resolving the size in CSS via `@media`, instead of in JS via an effect, means the browser has the correct value at first paint with no client-side correction step for Motion to snapshot ahead of.

---

## 3. Motion API

The morph is hand-dialed. The design rule is: **springs are props, shape tokens are CSS variables, choreography is internal, and one MotionValue is the escape hatch.**

### Public: three springs

`transition.open`, `transition.close`, `transition.shared`. Defaults, all verified against `surface-fx/src/schema/bloomDefaults.ts:332-368` and the `OPEN_SPRING_SPEEDUP` derivation at `ContactSheet.tsx:776-782`:

| Key | Default | Provenance |
| --- | --- | --- |
| `open` | `{ stiffness: 375, damping: 42.5, mass: 1.75 }` | `surfaceCloseSpring` scaled by k=1.25 (stiffness by k², damping by k), which preserves the damping ratio and shortens settle ~20% |
| `close` | `{ stiffness: 375, damping: 32, mass: 1 }` | Dialled by Sean on /tune, saved as "Version 4" (`docs/tuning/dialkit-morph-sheet-close.json`). Retuned 2026-08-31 from 240/34/1.75; a k=0.92 "slow the shell down" strawman (317.4/29.44/1) was tried and rejected — he dialled the shell back to exactly this. Damping ratio 0.826 |
| `shared.open` | `{ stiffness: 500, damping: 45 }` | stiff and near-critically damped so the shared element clears the growing sheet without overshoot |
| `shared.close` | `{ stiffness: 340, damping: 30, mass: 1 }` | Dialled by Sean on /tune ("Version 4"), NOT derived. He asked for a slower avatar, was given a k=0.85 strawman (220.3625/24.565/1), and dialled back past the k=Ts/(Ts+D)=0.902 arrive-together value to something FASTER than either: wn 18.44 rad/s vs 17.46 derived vs 14.85 strawman. The derivation no longer holds for this pair — deriving from `close` would give damping 30.47, and 30 is where the panel's step-1 slider left it, so the damping ratio drifts to 0.814 against the shell's 0.826. Re-dial on /tune if `close` changes; do not recompute |
| `surfaceCloseLeadDelayMs` | `35` | ms the surface box waits before starting its close FLIP, so the shared element leads the shrink instead of scaling in lockstep. At 100 the shared element was 53% of the way home before the sheet started collapsing and the close ran 573ms; at 35 it is 17% home and the close runs 507ms, four frames shorter, with the detachment still legible. `shared.close` was formerly derived from this value; as of "Version 4" it is a dialled value and is no longer coupled by formula — re-dial both on /tune together |

`shared` is **direction-aware** because the two directions have different
jobs. On the open the shared element only has to clear the growing sheet; on
the close it has to arrive home together with the collapsing trigger — and it
cannot do that on the open's spring, because the surface's close FLIP is
deliberately started `surfaceCloseLeadDelayMs` after the shared element's.
Left on one fixed spring, the shared element parked at its resting box 175ms
before the trigger stopped moving, and the 2px border relationship
(`.shared[data-wicket-iris-slot="trigger"]`, `inset: 2px`) arrived a sixth of a
second early. The close default was originally derived from `close` by
formula; as of "Version 4" it is independently dialled instead (see the table
above), so if `close` is ever retuned again, `shared.close` must be re-dialled
on /tune to match — it will not stay coupled automatically.

`surfaceCloseLeadDelayMs` is the one internal choreography constant that has
been promoted to a preset field (not a Root prop), and the reason is the rule below rather than an
exception to it. The rule says a constant stays internal when exposing it
turns "we solved this" into "you can un-solve this". This one is different in
kind: it is not a suppressed artifact, it is a *duration*, and it is the
single biggest lever on how long a close feels — the one number that has to
move when the close reads too long or too short. Everything else in the
internal table has a right answer; this one has a taste answer, and taste
answers belong to whoever is looking at it. It is coupled to `shared.close`
by feel, not by the derivation above — that derivation is history, not a
live relation. If either value is retuned, the other has to be re-dialled on
/tune to match; this is documented on both constants, in the README, and
here.

Each accepts a full Motion `Transition` as well as the `Spring` shorthand, so "I need a tween, not a spring" is never a reason to fork. When the package needs to compose its own `delay` onto the close transition, it applies it **only if the consumer did not specify one**.

### CSS variables: shape tokens

`--wicket-iris-sheet-radius` (48px) and `--wicket-iris-trigger-radius` (9999px). These are read once when the sheet opens, via a small `readVarPx` helper modelled on the existing `useCssVarPx.ts`, and fed to the border-radius transform.

Rationale: radius is a design token. A designer will want it sitting next to the rest of the surface styling in CSS, not buried in a JS prop object. Every other visual token in this package is a CSS variable, and radius should not be the exception just because JS happens to interpolate it.

### Internal: everything else

Not props, not variables, not documented as tunable:

| Constant | Value | What it prevents |
| --- | --- | --- |
| `radiusHoldFraction` | 0.74 | The trigger shape appearing before the box has contracted (an over-rounded rectangle). Progress-based, so it holds correctly however long a close runs. A second, wall-clock hold (`radiusCloseDelaySec: 1.5`) used to sit on top of it and was removed: 1.5s is longer than a close takes, so it suppressed this hold entirely on the close direction and left the trigger resting on the SHEET's radius — a squircle — after every close. |
| `openContentRevealDelaySec` | 0.2 | Text visibly stretching during the bloom |
| `contentFadeOutMs` / `DelayMs` | 80 / 0 | Content still painted while the box collapses under it |
| stagger interval | 0.09 (Sean, 2026-09-13) | |
| Snap spring | 700 / 52 / 1 | Overshoot past a viewport edge |
| Swipe thresholds | 96px, 400px/s | |
| Tab threshold | 5px | Tap misread as drag |

Each of these is a fix for a specific artifact. Exposing them turns "we solved this" into "you can un-solve this, and it is our compatibility promise now."

### The escape hatch

**`useIris().collapseProgress`**: the raw `MotionValue<number>`, 0 at fully open, 1 at fully closed. It is the same value the package's own radius, mask, and opacity transforms read.

Anything the package will not animate for you, you animate off that value, and it is frame-locked to the morph by construction rather than by a parallel timer. Combined with `triggerRect` and `sheetRect`, that is enough to rebuild any of the internal choreography externally. Section 8 uses exactly this to validate the hatch: the trailing-paper close mask is cut from the package and rebuilt in the example app. If it cannot be rebuilt from outside, the hatch is inadequate and we find out in week one instead of after v1.

---

## 4. The shadow seam

**Shape: a slot component with Radix-style `asChild`, fed by context.**

### Default, zero dependencies

```tsx
<Iris.Root>
  <Iris.Shadow />
  …
</Iris.Root>
```

Renders one `div`: `position: fixed`, `aria-hidden="true"`, `pointer-events: none`, at `z - 1`, sized and positioned to the interpolated silhouette between the trigger circle and the sheet box. It paints a plain `box-shadow` from `--wicket-iris-shadow`. It carries, updated every frame without a React re-render:

```
data-wicket-iris-part="shadow"
data-state="closed" | "open" | "dragging"
style:
  --wicket-iris-collapse: 0..1
  --wicket-iris-shadow-radius      px
```

A consumer with only CSS can already do a lot with that: swap the shadow, tie its opacity to `--wicket-iris-collapse`, change the falloff.

### Swapped for a surface-fx dither layer

```tsx
import { Iris, useIris } from "@wicket/iris";
import { useRippleEngine, velocityToRipple } from "@seansmith/surface-fx";

function DitherShadow() {
  const { collapseProgress, triggerRect, sheetRect, isDragging } = useIris();
  // build the mask / shader uniforms off collapseProgress + the two rects
  return <canvas … />;
}

<Iris.Shadow asChild>
  <DitherShadow />
</Iris.Shadow>
```

`asChild` clones the single child and merges onto it: the fixed positioning, the z-index, `aria-hidden`, `pointer-events: none`, the `data-*` attributes, and all the `--wicket-iris-shadow-*` custom properties. The child gets a correctly placed, correctly stacked, non-interactive layer for free and only has to paint.

The richer signal (the raw MotionValue and the two rects) comes through `useIris()`, not through the slot. Keeping data flow in the hook and layout in the slot means the slot has one job and the hook has one job.

**The package never imports surface-fx.** `@seansmith/surface-fx` appears only in the example app's dependencies. The default `<Iris.Shadow />` has no dependency beyond React.

### Why this shape

- **Render prop** (`<Iris.Shadow>{(state) => …}</Iris.Shadow>`): equal power, but every consumer re-declares the fixed positioning and the z-index, and gets one of them wrong. The slot owns the container so the consumer owns only the paint.
- **Data-attributes only, styled by consumer CSS**: cannot paint a WebGL canvas or a JS-computed radial mask. Insufficient for the actual target.
- **A `shadow` prop on Root taking a component**: makes composition order implicit and reads badly in a compound API.

### The tradeoff you are buying

Today the box-shadow is painted directly on `.triggerSurface` and `.sheet`. In this design it moves to the separate shadow layer, which means **if you do not render `<Iris.Shadow />` you get a flat trigger with no shadow.**

That is deliberate. The alternative (keep a built-in shadow on the surfaces *and* offer a shadow layer) means swapping in the dither requires two edits: add the layer, and null out the built-in. That is the friction that makes people not bother. Radix makes the same call with `Dialog.Overlay`. `<Iris.Shadow />` appears in every documentation example including the one-line copy-paste sample.

---

## 5. File layout

### Package

```
wicket-iris/
├── package.json              ~35    name, root-only exports, react+motion peers
├── tsconfig.json             ~20    device-frame's, verbatim
├── README.md                ~260    pitch → install → one copy-paste sample → prop tables
└── src/
    ├── index.ts              ~25    the Iris namespace object, useIris, exported types
    ├── Root.tsx             ~180    context, open+anchor state, LayoutGroup, persistence, reduced-motion, id generation
    ├── Trigger.tsx             ~200    fixed drag wrapper, x/y MotionValues, drag + nearest-anchor snap, tap-vs-drag, trigger button, seed surface
    ├── Sheet.tsx            ~260    dialog surface, layoutId FLIP, borderRadius transform, swipe-to-close, placement from anchor
    ├── Shared.tsx            ~45    shared-element slot, own layoutId + spring
    ├── Content.tsx           ~70    post-bloom reveal container, scroll region, Item
    ├── Close.tsx             ~35    close button, registers itself for the dev warning
    ├── Backdrop.tsx          ~45    visual scrim only
    ├── Shadow.tsx            ~95    shadow slot + asChild merge, writes geometry vars per frame
    ├── context.ts            ~70    context type, useIris, the throw-outside-Root guard
    ├── anchors.ts           ~180    seven-anchor model: nearestAnchor, restingLeft/Top, anchorCenter, sheetPlacement
    ├── motion.ts             ~75    default springs, internal choreography constants, transition merge
    ├── useTriggerSize.ts     ~45    resolve the ramp to a number, write --wicket-iris-trigger-size, resize handling
    ├── usePersistedAnchor.ts ~50    localStorage read + validate + write
    ├── useDialogBehavior.ts  ~95    scroll lock, inert page, focus guards, Escape via dismissLayers, focus restore on exit-complete
    ├── readVarPx.ts          ~35    read a px custom property (radius tokens)
    ├── types.ts              ~60    AnchorId, Spring, MorphTransition, prop interfaces
    ├── styles.module.css    ~380    all package CSS, --wicket-iris-* vars with fallbacks
    └── css-modules.d.ts       ~4    device-frame's file, verbatim
```

Roughly 1,900 lines. That is higher than the raw extraction estimate (~800 TS + ~500 CSS) and the gap is honest: splitting a monolith into eight components adds context plumbing, prop interfaces, and the `asChild` merge that did not exist before.

### Example app

```
wicket-iris/example/
├── index.html            ~20
├── vite.config.ts         ~8
├── main.tsx              ~40    mount, palette toggle for light/midnight proof
├── IdentityTrigger.tsx  ~220    Sean's contact surface, built on the primitive
├── DitherShadow.tsx     ~120    surface-fx dither layer through <Iris.Shadow asChild>
├── CloseMask.tsx         ~60    the trailing-paper mask, rebuilt off collapseProgress (see §8)
└── example.module.css   ~200    the site's tokens mapped onto --wicket-iris-*
```

### Where surface-fx's conventions carry over, and where they do not

Carry over:
- Source-only, no build step. `"exports"` points straight at `src`.
- Installed from GitHub, consumed via Next `transpilePackages` or Vite's native TS.
- `react` and `motion` as peers, never dependencies. `motion` is genuinely required here; see §7A.
- vitest, for `anchors.ts` only. The region map and the sheet-placement clamping are pure functions with real edge cases (an anchor near a viewport edge, a sheet wider than the viewport). The morph is not unit-testable and should not be faked into looking tested.

Do not carry over:

1. **The subpath export map.** surface-fx uses `"./*": "./src/*.ts"`, which only resolves `.ts`. This package ships `.tsx` and `.module.css`, so that glob silently fails on exactly the files that matter. Use device-frame's root-only export. Consequence: no deep imports, the barrel is the whole API. Correct for a component package, wrong for a hook library, which is why the two differ.
2. **`css-modules.d.ts` is required.** surface-fx ships no CSS so it has no such shim. Copy device-frame's.
3. **JSX in the tsconfig.** surface-fx's tsconfig already sets `"jsx": "react-jsx"`, so this is inherited cleanly, but it is now load-bearing rather than incidental.
4. **No `scripts/` agent CLI, no MCP server, no param registry.** surface-fx has all three because it is a tuning library. This package's tuning is deliberately closed (§3). Copying that scaffolding would be copying the exact thing Sean decided to strip.
5. **A `example/` (Vite), not a `scripts/` playground.** device-frame's `demo/` is the model. Rename to `example/` to match the "flagship example" framing.

---

## 6. Accessibility contract

### What the package guarantees

**Trigger.** A real `<button type="button">`. `aria-haspopup="dialog"`. `aria-expanded` reflects state. `aria-controls` points at the sheet id while open. `aria-label` is a required prop, so a nameless trigger is a type error.

**Dialog semantics.** The sheet is `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}`, with a package-generated `id` that matches the trigger's `aria-controls`. Its accessible name is required at the type level via the `Labelled` union: exactly one of `aria-label` or `aria-labelledby`.

**Focus management.**
- On open, focus moves to the dialog panel itself, not to the first control. This is deliberate and it is the shipped behavior (`ContactSheet.tsx:880-889`): focusing the first link pre-highlights it and reads as a selection the user did not make. Tab from the panel goes to the first control.
- On close, focus returns to the trigger at **exit-complete**, not at state change (`ContactSheet.tsx:1094-1096`). Restoring focus while the surface is still animating out causes a visible scroll jump.
- Tab is never intercepted. Two focus guards (`<span tabIndex={0} aria-hidden data-wicket-iris-focus-guard>`), rendered as siblings just outside the panel while a modal sheet is present, catch focus leaving either edge and route on `relatedTarget`: from inside the panel means Tab ran off that edge, so wrap to the opposite end; from anywhere else means focus is entering, so land on the near end. Tab order inside is the browser's own. Focus coming back out of an iframe is handled with a blur fallback.

**Inert page.** While the sheet is open, every sibling off the path from the panel, guards and backdrop to `<body>` gets `inert` (keep-path walking, React Aria's model). Live regions present at open (`[aria-live]` other than `aria-live="off"`, `role=status|alert|log`) stay live; one that wraps the sheet is not kept, since that would keep the whole page. Elements the page already made inert are left alone, and elements inerted by stacked sheets are owner-counted. The inert window is `open`, not `isPresent`: it is released at the close request, in the commit the backdrop unmounts in, so the trigger is tappable from the first close frame and reopen-mid-close works. Guards and scroll lock key on `isPresent` and last until exit-complete, so Tab mid-close stays in the panel. There is no `aria-hidden` on the page; `inert` does that job.

**Dismiss layers.** Open modal sheets and preview cards register in `src/dismissLayers.ts` in the order they open. One document keydown listener in the bubble phase sends Escape to the top layer only. It is ignored when `defaultPrevented` (a listbox or combobox claimed it), `isComposing` or `keyCode === 229` (IME). So a preview card in a sheet takes one Escape and the sheet a second.

**Focus restore** happens at exit-complete, only if focus is on the body or inside the leaving panel, so a page control clicked mid-close keeps focus.

**Keyboard repositioning.** With the trigger focused, `draggable` on and the sheet closed, arrow keys move it one anchor via `adjacentAnchor` and the same `snapTo` a drag release uses. Plain arrows are always consumed; Alt, Ctrl and Meta arrows pass through. `useIris().setAnchor` routes through the same `snapTo`. Moves write `Moved to bottom right.` into a visually hidden `role="status"` span in Root (`anchorAnnouncement` overrides it); drags never do.

**Escape** closes, unconditionally, not configurable, subject to the dismiss-layer rules above.

**Body scroll lock** while open, restoring the previous `overflow` value rather than clearing it.

**Reduced motion.** With `prefers-reduced-motion: reduce` or `reduceMotion`:
- No FLIP. `layoutId` is dropped on both the surface and the shared element, so the sheet cross-fades at 200ms instead of morphing.
- No swipe-to-close on the sheet (drag would fight the reduced-motion contract).
- Trigger drag elastic goes to 0 and the anchor snap is instant.
- The default shadow layer paints statically at the resting silhouette.

**Hit target.** The drag wrapper is at least 96px on every breakpoint, comfortably over WCAG 2.5.5's 44px.

**Touch.** `touch-action: none` on the trigger wrapper so Motion owns the pointer stream; `touch-action: pan-y` on the sheet so content still scrolls.

### What the consumer owns

- Every semantic inside `<Iris.Sheet>`: heading levels, landmarks, link text, reading order.
- Supplying both accessible names. Both are typed-required, so this is enforced, not merely asked for.
- Rendering a visible `<Iris.Close>`. The package does not place it, because placement is a design decision, but Root logs a dev-only warning if the sheet opens with none registered. Escape plus backdrop click is not sufficient for a touch user with a screen reader.
- Color contrast of the content and of any `--wicket-iris-*` overrides.
- Any live-region announcements their content needs beyond the dialog role.

### Known gaps, stated rather than hidden

1. **Strict WCAG 2.5.7 needs a consumer control.** Dragging stays on by default and arrow keys cover keyboard users, but a mouse or touch user who cannot drag needs a control that calls `setAnchor`. The README ships a "Move" menu recipe; the package renders none.
2. **Android's back gesture leaves the page** rather than closing the sheet. The package does not touch history; the README says so.

---

## 7. The three hardest decisions

### A. `motion` is a required peer, with no CSS-only fallback

**Rejected:** a fallback morph path built on the Web Animations API and manual FLIP measurement, so the package works with zero animation-library dependency.

**Why rejected.** The morph is the product. A hand-rolled FLIP that must also interpolate border-radius through a hold-gate, run an independently-projected child element that does not inherit the parent's transform, and stay velocity-continuous with an in-flight drag gesture is the single hardest thing in the existing 4,000 lines. Rebuilding that without Motion's projection system means owning a second, worse animation engine forever, and the failure modes are exactly the ones already documented as landmines in this codebase (nested `layoutId` inheriting the parent FLIP, inline transform clobbering CSS positioning).

**Cost.** Anyone on GSAP-only, or wanting zero animation dependency, cannot use this. `bloom-menu` made the identical call with framer-motion, which is at least evidence the market tolerates it.

**Uncertainty: low.** I would make this call again without hesitating.

### B. `<Iris.Shared>` is duplicated in both Trigger and Sheet, not hoisted to a Root prop

**Rejected:** `<Iris.Root shared={<Avatar />}>`, with the package rendering it into both states automatically.

**Why rejected.** The shared element needs genuinely different layout in each state. In the trigger it is `inset: 2px` and clipped to a circle so the surface ring shows around it. In the sheet it is `position: absolute; top: 24px; left: 24px` at a fixed size, sitting over a spacer row (`ContactSheet.module.css:168-178`). A single hoisted node can only be styled by the package, which means the package would have to own sheet header layout. That is a content decision and it does not belong in a generic primitive. Duplicating the slot keeps layout with the consumer in both states.

**Cost.** A real footgun. If the two slots get different children, the morph looks broken and the cause is not obvious. Mitigations are weak: a dev-time child-count comparison catches the crude version and misses the subtle one.

**Uncertainty: medium-high.** This is the decision I would most want tested against a second, non-avatar use case before locking it. If the second use case also wants different layout per state, this is right. If it wants identical layout, the hoisted prop wins and I would want to know that before v1.

### C. The choreography constants stay internal, with one MotionValue as the only hatch

**Rejected:** a `tuning` prop mirroring the site's existing `BloomTuning` object.

**Why rejected.** It is the shortest path, because the code already reads from exactly such an object, and it is the classic options-menu failure. Every parameter becomes a compatibility promise. Worse, most of them are individually harmful: a consumer who sets `radiusHoldFraction` to 0.1 gets precisely the over-rounding artifact that the 0.74 default exists to suppress, then reports it as a package bug.

**Cost.** Someone who wants a materially different close choreography has to fork. Accepted. That is a fork worth forcing, because the alternative is a package that ships twenty ways to look wrong.

**Uncertainty: medium.** This section used to flag `radiusCloseDelaySec: 1.5` as tuned to a 480px-wide, roughly 600px-tall sheet and wrong for a 900px one. It was worse than that — being wall-clock rather than progress-based, it was longer than a close takes at ANY sheet size, so it never let the radius round at all on the close direction and left the trigger resting as a squircle. It is gone; `radiusHoldFraction` alone carries the hold, and the rounding phase targets half the trigger's own box so it lands on the resting shape continuously. The remaining soft spot is that `sheetMaxWidth` is a prop while `--wicket-iris-sheet-max-width` is also a CSS variable; those two must not disagree, and the package should let the prop win and write the variable.

---

## 8. What I would cut from v0.1

Ship this: `Root`, `Trigger`, `Sheet`, `Shared`, `Content`, `Item`, `Close`, `Shadow`, `useIris`. Roughly 1,400 lines. That is the smallest thing that is still the actual product.

| Cut | Cost |
| --- | --- |
| **The entrance choreography** (WAAPI arrival stroke, impact ripple, velocity coupling) | Already out of scope per the extraction map; reconfirming it. Near-zero cost to the package. Real cost to the site: the trigger simply appears. The site keeps its own arrival animation on a wrapper, driven off `useIris().triggerRect`. Say this out loud in the migration plan so nobody discovers it during cutover. |
| **`<Iris.Backdrop>`** | Site default is already no scrim. Dismissal behavior still ships. A consumer who wants a dim scrim writes six lines of their own fixed div. Low. |
| **Controlled `anchor` + `onAnchorChange` as a controlled pair** | Ship uncontrolled and persisted only; keep `onAnchorChange` as a read-only notification. Cost: the anchor itself is not a controlled prop. Programmatic moves shipped in P0-3 as public `useIris().setAnchor`; only the controlled `anchor` prop remains cut. Low. |
| **The `anchors` subset prop and `edgeMargin`** | All six anchors at 16px. Cost: low, and it is additive later. |
| **Arrow-key repositioning between anchors** | Roughly 20 lines and a genuine accessibility and delight win, but it did not exist in the shipped component and extraction was the wrong time to add behavior. Shipped in P0-3 (a11y/p0): arrow keys move the focused trigger, sharing `snapTo` with the drag release. |
| **The trailing-paper close mask** (`surfaceCloseMask` and its triangular envelope) | **The expensive one, and it doubles as the design's own test.** See below. |

### On cutting the close mask

That mask is roughly 50 lines of the least explicable code in `ContactSheet.tsx` (lines 721-755). It exists to fix one artifact specific to a tall sheet whose shared element leads the close: mid-collapse, the vacated paper above the avatar sits as a solid opaque block for a few frames. A generic sheet with no leading shared element does not have that artifact at all, so it does not belong in a generic primitive.

But Sean's flagship example *does* have it, and cutting the mask outright would make the example visibly worse than the live site it replaces. That is not acceptable.

So: **cut it from the package, rebuild it in the example app** off `useIris().collapseProgress`, in `example/CloseMask.tsx`. Roughly 60 lines applying a `maskImage` to `<Iris.Sheet>` from outside.

This is the design's own validation test. If that mask can be rebuilt from outside the package with no additional API, the escape hatch in §3 is proven sufficient and the internal-constants decision in §7C is safe. If it cannot, the hatch is inadequate and we learn it in week one, on a case we already understand, instead of after v1 on a case we do not.

Build the example's `CloseMask.tsx` **first**, before finalizing `useIris()`'s shape. It is the cheapest possible check on the most consequential decision in this document.
