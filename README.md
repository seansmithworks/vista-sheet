# trigger→sheet

A draggable trigger that morphs into a modal sheet.

## What it is

A persistent circular control that sits at one of seven viewport anchors (the
corners, top-center and bottom-center, plus dead center), can be dragged and re-anchored,
and morphs into a modal sheet via a `layoutId` FLIP transition. It is a
generic React primitive with a compound-component API: you supply all
content, the package owns the morph.

There is no canonical design-system name for this pattern. Material has
SpeedDial, a FAB that expands into a radial menu of actions. Apple and Radix
both have sheets, but theirs enter from a screen edge rather than growing out
of a persistent trigger. Nobody has standardized "trigger morphs into
surface," so `vista-sheet` / `VistaSheet` names the shape directly rather than
reaching for an existing term.

## Install

```bash
npm install @seansmithworks/vista-sheet
```

`dist/` ships compiled ESM + `.d.ts` declarations, so the default import
needs no build-step config on the consumer's side — no `transpilePackages`,
no extra `tsc` target. CSS is bundled and auto-imported by the package's own
entry point; you don't need a separate stylesheet `<link>` or `import` for
the component to render styled. A manual stylesheet path,
`@seansmithworks/vista-sheet/styles.css`, also exists if you need to import
the CSS on its own (e.g. to inline it above the fold, or reference it from a
non-JS build step) — most consumers never need it.

### Installing from source

For a git-dependency install (e.g. testing an unreleased branch), the
package still ships raw TypeScript source in `src/`, but a source install
needs a build step on your side. Point Next.js at it via
`transpilePackages` in `next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@seansmithworks/vista-sheet"],
};
```

```bash
npm install @seansmithworks/vista-sheet@github:seansmithworks/vista-sheet
```

This mirrors how `@seansmithworks/device-frame` is consumed. Vite consumers
work with no config, but because a source install's `src/` isn't
precompiled, your own `tsc -b` typechecks it directly as part of `npm run
build` — so an unusually strict or `types`-restricted consumer
`tsconfig.json` typechecks our source too, not just yours. None of this
applies to the default npm install above, which ships compiled output.

### npx copy-in

If you'd rather own the files outright — no package dependency, no
`node_modules` indirection — copy the component source directly into your
project:

```bash
npx @seansmithworks/vista-sheet add
```

This drops all of `src/`'s components, hooks, and `styles.module.css` into
`./src/vista-sheet` (pass a different path as the first argument to change
the target). It skips the test file and, if your project already has a
`next-env.d.ts`, skips the `*.module.css` ambient type shim too (Next
already declares it — a duplicate `declare module` block is a TS error). It
refuses to overwrite existing files unless you pass `--force`.

The tradeoff: you own the copy from that point on. There's no update
channel — to pick up changes, re-run with `--force` (which overwrites
everything) or diff your copy against a fresh `add` in a scratch directory.
Peer dependencies aren't copied and still need installing:

```bash
npm install react react-dom motion
```

### Live-tuning panel

```bash
npx @seansmithworks/vista-sheet add tuner
```

Copies a small dialkit-driven page (`./tuner` by default) for dialling the
close choreography by eye instead of by hand-typed spring numbers — the same
panel Sean's own "Version 4" defaults were dialled on. It needs
[`dialkit`](https://www.npmjs.com/package/dialkit) as a **devDependency**,
which the copy-in tells you to install:

```bash
npm install -D dialkit
```

`dialkit` is never a dependency of this package itself and shouldn't become
one of your consuming app either: its stylesheet pulls Geist Mono from
Google Fonts, an external request you don't want on every page load, and a
tuning panel is a development tool that has no business being reachable
from a production bundle. Mount `tuner/page.tsx` behind a route your prod
build never ships (or a dev-only guard), dial the close, then use the
panel's **Copy as MotionPreset** button — it emits a `MotionPreset`-shaped
object you paste straight into `preset={...}` on `<VistaSheet.Root>`, no
hand-translation. This repo runs the same file live at
`npm run dev` → `/tune.html`.

## Peer dependencies

- `react` >=19
- `react-dom` >=19
- `motion` >=12 <14 (full suite run green against both 12.43.0 and 13.1.1)

None are bundled. Install them yourself if your app doesn't already have
them.

## Usage

Paste this into `app/page.tsx` (or wherever you mount it) in a Next.js App
Router app:

```tsx
"use client";

import { VistaSheet } from "@seansmithworks/vista-sheet";

export default function ContactTrigger() {
  return (
    <VistaSheet.Root>
      <VistaSheet.Shadow />

      <VistaSheet.Trigger aria-label="Open contact">
        <VistaSheet.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1d1d1f",
            }}
          />
        </VistaSheet.Shared>
      </VistaSheet.Trigger>

      <VistaSheet.Sheet aria-labelledby="sheet-title">
        <VistaSheet.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1d1d1f",
            }}
          />
        </VistaSheet.Shared>

        <VistaSheet.Close aria-label="Close" />

        <VistaSheet.Content>
          <VistaSheet.Item>
            <h2 id="sheet-title">Sean Smith</h2>
          </VistaSheet.Item>
          <VistaSheet.Item>
            <p>Links, etc.</p>
          </VistaSheet.Item>
        </VistaSheet.Content>
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}
```

Pasted as-is, this renders a solid-colored trigger at the bottom-center
viewport anchor: drag it to re-anchor at any of the seven anchors, tap it to
morph it into the sheet shown above.

Ten exports total: nine components (`Root`, `Trigger`, `Sheet`, `Shared`,
`Media`, `Content`, `Item`, `Close`, `Shadow`) plus the `useVistaSheet()`
hook. That is the whole surface area.

### `<Shared>` and `<Media>` must be direct children

`<VistaSheet.Shared>` and `<VistaSheet.Media>` must render as **direct**
children of `<VistaSheet.Trigger>` and `<VistaSheet.Sheet>`, never nested
inside `<VistaSheet.Item>` or any other motion-animated wrapper. Per
`Shared.tsx`'s own header comment, `<Shared>` "renders as a SIBLING of the
trigger seed surface in Trigger.tsx, never nested inside it": nesting it
makes its projection inherit the parent's close-morph FLIP and freezes it
at the surface's transient mid-collapse box. The break is silent, no error,
no warning, just a frozen shared element mid-morph.

Size `<Shared>`'s own children with `width: 100%; height: 100%`, not a fixed
pixel value. The slot's box tracks `--vista-sheet-shared-size`, which
changes across breakpoints and shapes; a fixed-px child desyncs from it and
leaves a blank oval visible mid-morph.

**In a Next.js App Router app, `"use client"` has to be the first line of
the file where you mount `VistaSheet`**, as it is in the snippet above.
Server Components can't resolve a property access like `VistaSheet.Root` on
a client-reference namespace — this is the same constraint as Radix, MUI,
and `motion/react` itself.

Forgetting it does **not** produce an error naming this package or
`"use client"` — the failure happens inside React/Next before any of this
package's own code runs, so there is nothing here to catch it and warn you.
What you'll see instead is React's generic, misleading message:

```
Element type is invalid: expected a string (for built-in components) or a
class/function (for composite components) but got: undefined. You likely
forgot to export your component from the file it's defined in, or you
might have mixed up default and named imports.
```

Nothing is missing an export. If you see this message after adding
`<VistaSheet.Root>` to a file, the fix is to add `"use client"` as the very
first line of that file.

### Anchor persistence

The dragged-to anchor persists across reloads via `localStorage`, on by
default under the key `"vista-sheet-anchor"`:

```tsx
<VistaSheet.Root persistKey="my-app-sheet-anchor">
```

Pass a different string to namespace multiple `<VistaSheet.Root>` instances
on the same page (each would otherwise read and write the same default key).
Pass `persistKey={false}` to disable persistence entirely and always start
from `defaultAnchor`. Reads and writes are wrapped in `try`/`catch`, so a
disabled or full `localStorage` falls back to the in-memory default rather
than throwing.

### Trigger shape

`<VistaSheet.Root shape>` takes `"circle"` (default), `"squircle"`,
`"rounded-square"`, `"square"` or `"rectangle"`. The trigger surface, `<VistaSheet.Shadow>`,
both `<VistaSheet.Shared>` slots and the focus ring all follow it.
`--vista-sheet-trigger-radius` still caps the corner radius for every shape.
With `"squircle"` the sheet's own corners use the squircle curve too, so the
surface never switches corner geometry mid-morph. `<VistaSheet.Shared>`
children should fill their box without applying their own `border-radius` —
the slot clips them to the current shape.

Browser support: `"squircle"` is a true superellipse where CSS `corner-shape`
is supported (Chromium); Safari and Firefox get a close `border-radius`
approximation.

### Rectangle buttons

```tsx
"use client";

import { VistaSheet } from "@seansmithworks/vista-sheet";

export default function SearchTrigger() {
  return (
    <VistaSheet.Root shape="rectangle" buttonSize="m">
      <VistaSheet.Shadow />

      <VistaSheet.Trigger aria-label="Search">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" />
          <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" />
        </svg>
        Search
      </VistaSheet.Trigger>

      <VistaSheet.Sheet aria-labelledby="search-title">
        <VistaSheet.Close aria-label="Close" />

        <VistaSheet.Content>
          <VistaSheet.Item>
            <h2 id="search-title">Search</h2>
          </VistaSheet.Item>
        </VistaSheet.Content>
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}
```

- `shape="rectangle"` plus `buttonSize` (`"s" | "m" | "l"`, default `"m"`)
  sets height and inline padding: 36px/14px, 44px/18px, 52px/22px.
- Width sizes to the trigger's label (children) by default. Pass `buttonWidth`
  (px) for a fixed width; a value narrower than the label clips it, no
  ellipsis.
- Corners are a pill — `min(--vista-sheet-trigger-radius, height / 2)` — a
  strawman awaiting Sean's dial pass. Set `--vista-sheet-trigger-radius` lower
  for a rounded rectangle instead.
- A rectangle trigger holds plain children only: an icon, icon + text, or
  text. `<VistaSheet.Shared>` and `<VistaSheet.Media>` are not supported
  inside it in v0.2.
- The label fades in only as a close nears rest, over the last 15% of the
  close (`collapseProgress` 0.85 to 1), so it never paints over the
  still-large sheet.

### Media and aspect-ratio sheets

```tsx
const ratio = 9 / 16;

<VistaSheet.Root>
  <VistaSheet.Shadow />

  <VistaSheet.Trigger aria-label="Play intro">
    <VistaSheet.Media
      src="/intro.mp4"
      poster="/intro.jpg"
      aspectRatio={ratio}
    />
  </VistaSheet.Trigger>

  <VistaSheet.Sheet aria-label="Intro video" aspectRatio={ratio}>
    <VistaSheet.Media
      src="/intro.mp4"
      poster="/intro.jpg"
      aspectRatio={ratio}
    />
    <VistaSheet.Close aria-label="Close" />
  </VistaSheet.Sheet>
</VistaSheet.Root>
```

- `Sheet`'s `aspectRatio` (width / height) contain-fits the sheet inside
  `sheetMaxWidth` and the current anchor's max height — tall (`9 / 16`), wide
  (`16 / 9`) and narrow (`1 / 2`) all work.
- `Media` is rendered twice like `Shared` and fills and covers its box. It
  scales uniformly through the morph and never squashes.
- `aspectRatio` is required on `Media` because it sizes the media before the
  file loads.
- The video autoplays muted, loops and plays inline. Reduced-motion users get
  the poster, paused.
- Use `Media` in place of `Shared`, as a direct child of `Trigger` or `Sheet`.
- The two instances don't share playback time; make `poster` the clip's first
  frame.
- `alt` makes it non-decorative.
- Like `<Shared>`, both `<Media>` and the element it wraps remount on every
  open and every close (they're two separate `<video>`/`<img>` elements,
  trigger-side and sheet-side, not one element that travels). Playback
  position isn't carried between them: a consumer that needs continuity has
  to read the outgoing element's `currentTime` and seed the incoming one
  itself, outside the package.

### The escape hatch

`useVistaSheet().collapseProgress` is the raw `MotionValue<number>` the
package's own radius, mask, and opacity transforms read: `0` at fully open
(sheet), `1` at fully closed (trigger). `triggerRect` is
`{ cx, cy, halfWidth, halfHeight }`, so it describes a rectangle trigger as
well as a round one. Combined with `triggerRect` and
`sheetRect`, it is enough to rebuild any choreography the package doesn't
expose as a prop. See `example/CloseMask.tsx` for a worked example: it
rebuilds a trailing-paper close mask from *outside* the package using only
this hatch.

```tsx
function usePKG() {
  return useVistaSheet();
  // { open, setOpen, anchor, isDragging, triggerSize, collapseProgress, triggerRect, sheetRect }
}
```

## Theming

Two public styling surfaces: CSS custom properties and a DOM data-attribute
contract.

### `--vista-sheet-*` custom properties

Every visual token is a CSS custom property with a hardcoded fallback, so the
package renders correctly out of the box:

| Variable | Default |
| --- | --- |
| `--vista-sheet-surface` | `#fafafa` |
| `--vista-sheet-surface-elevated` | `#ffffff` |
| `--vista-sheet-surface-border` | `#e5e5e5` |
| `--vista-sheet-text` | `#1d1d1f` |
| `--vista-sheet-accent` | `#1d1d1f` |
| `--vista-sheet-sheet-max-width` | `480px` |
| `--vista-sheet-shared-size` | matches `--vista-sheet-trigger-size` |
| `--vista-sheet-sheet-radius` | `48px` |
| `--vista-sheet-trigger-radius` | `9999px` |
| `--vista-sheet-sheet-padding` | `24px` |
| `--vista-sheet-shadow` | `0 1px 4px rgba(26,22,16,.14), 0 6px 24px rgba(0,0,0,.15)` |
| `--vista-sheet-sheet-shadow` | `0 8px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12)` |
| `--vista-sheet-sheet-shadow-fade-start` | `0` |
| `--vista-sheet-sheet-shadow-fade-end` | `0.25` |
| `--vista-sheet-z` | `100` |

`--vista-sheet-sheet-shadow-fade-start`/`-fade-end` are unitless
`collapseProgress` fractions (0 = open at rest, 1 = closed at rest) marking
where `<VistaSheet.Shadow>` crossfades from the heavy `--vista-sheet-sheet-shadow`
look to the thin `--vista-sheet-shadow` look — see "Two shadows, one painter"
below.

The package writes `--vista-sheet-trigger-size`, `--vista-sheet-button-width`,
`--vista-sheet-trigger-x/-y`,
`--vista-sheet-sheet-left`, `--vista-sheet-collapse`,
`--vista-sheet-shadow-x/-y/-w/-h/-radius`, and
`--vista-sheet-shadow-opacity`/`--vista-sheet-sheet-shadow-opacity` (the live
crossfade values, in [0, 1]); read these, don't set them.

### Two shadows, one painter

`<VistaSheet.Shadow>` paints both shadow looks on its one silhouette,
crossfaded by opacity as `collapseProgress` moves — nothing else in the
package paints a shadow. If you don't render `<VistaSheet.Shadow>`, there is
no shadow at all. An `asChild` swap receives
`--vista-sheet-shadow-opacity`/`--vista-sheet-sheet-shadow-opacity` as custom
properties on the cloned element so a replacement layer (e.g. a
`@seansmithworks/surface-fx` dither) can reproduce the same crossfade. A ref
already on the child is preserved (composed with Shadow's own), never dropped.

`npm run audit:vars` checks this table against `src/styles.module.css` and
`src/`: any `--vista-sheet-*` variable the CSS reads must be either written by
the package or documented here, or the audit fails.

### `data-vista-sheet-part` DOM contract

Every element the package renders carries `data-vista-sheet-part`, and this is
public, stable surface, not an accident of implementation you happen to be
able to reach. Use it for CSS overrides or, as `example/CloseMask.tsx` does,
to find the live element from outside the package via `useVistaSheet()` + a
`document.querySelector`.

| Value | Element |
| --- | --- |
| `trigger-root` | The trigger's fixed drag wrapper |
| `trigger` | The trigger `<button>` |
| `trigger-surface` | The trigger's seed surface (the FLIP source) |
| `shared` | `<VistaSheet.Shared>`, on both its trigger- and sheet-side instances |
| `media` | `<VistaSheet.Media>`'s wrapper, on both its trigger- and sheet-side instances (the trigger-side one renders inside `trigger-surface`) |
| `sheet` | `<VistaSheet.Sheet>`'s panel |
| `backdrop` | The invisible outside-click catcher (only when `dismissOnBackdrop`) |
| `content` | `<VistaSheet.Content>`'s scroll region |
| `item` | `<VistaSheet.Item>` |
| `close` | `<VistaSheet.Close>`'s button |
| `shadow` | `<VistaSheet.Shadow>`'s default div (also merged onto an `asChild` child) |
| `trigger-label` | Wrapper around the trigger's plain children (everything except Shared and Media); fades in as a close lands |

`<VistaSheet.Shared>` additionally carries `data-vista-sheet-slot="trigger"` or
`"sheet"`, so consumer CSS (or the package's own
`.shared[data-vista-sheet-slot=…]` rules) can target either instance without
relying on className precedence. `<VistaSheet.Media>` carries it too.

`trigger-root` additionally carries `data-vista-sheet-closing` (empty string),
present only while a close is in flight (removed once the sheet has fully
closed).

`trigger`, `trigger-surface`, `sheet`, `shared` and `shadow` additionally
carry `data-vista-sheet-shape` (the Root's `shape`).

`trigger-root` also carries `data-vista-sheet-shape`. `trigger-root` and
`trigger` additionally carry `data-vista-sheet-button-size` (the Root's
`buttonSize`) when `shape="rectangle"`.

`sheet` additionally carries `data-vista-sheet-settled` (empty string), present
only once the open has finished and removed as soon as a close starts. This
gates `<VistaSheet.Close>`'s reveal, not any shadow — the sheet element paints
no box-shadow of its own; see "Two shadows, one painter" above.

### Theming with your own tokens

Every `--vista-sheet-*` custom property falls back to a hardcoded light-mode
value (see the table above), so nothing in the package itself responds to a
host app's dark mode. To support both, map each token to your own CSS
variables and flip those variables per theme:

```css
.myVistaSheetScope {
  --vista-sheet-surface: var(--surface);
  --vista-sheet-surface-elevated: var(--surface-elevated);
  --vista-sheet-surface-border: var(--border);
  --vista-sheet-text: var(--ink);
  --vista-sheet-accent: var(--accent);
  --vista-sheet-shadow: var(--shadow-thin);
  --vista-sheet-sheet-shadow: var(--shadow-heavy);
}
```

Set that class (or the equivalent inline styles) on an ancestor of
`<VistaSheet.Root>`, and let your own `--surface`/`--ink`/etc. tokens flip
with `[data-theme="dark"]` or `prefers-color-scheme` the way the rest of
your app already does. Without this mapping the sheet renders in its
light-only defaults regardless of the host's theme.

## Motion

Three springs are props (`transition.open` / `.close` / `.shared`), each
accepting either `{ stiffness, damping, mass? }` or `{ visualDuration, bounce }`
(see below for both spring shorthands), or a full Motion `Transition`, plus
one number: `surfaceCloseLeadDelayMs`. Everything else,
hold fractions, stagger intervals, swipe thresholds, drag feel, is internal.
These are fixes for specific artifacts, not knobs; see
`docs/PACKAGE-DESIGN.md` §3 and §7C in the source repo for why.

`transition.shared` is additionally **direction-aware**. The shared element
has a different job in each direction — on the open it only has to clear the
growing sheet, on the close it has to arrive home together with the
collapsing trigger, whose own FLIP starts deliberately later than its own. A
single value still applies to both directions; `{ open, close }` sets them
independently:

```tsx
<VistaSheet.Root
  transition={{
    close: { stiffness: 375, damping: 32, mass: 1 },
    shared: {
      open: { stiffness: 500, damping: 45 },
      close: { stiffness: 340, damping: 30, mass: 1 },
    },
  }}
>
```

| Key | Default |
| --- | --- |
| `open` | `{ stiffness: 375, damping: 42.5, mass: 1.75 }` |
| `close` | `{ stiffness: 375, damping: 32, mass: 1 }` |
| `shared.open` | `{ stiffness: 500, damping: 45 }` |
| `shared.close` | `{ stiffness: 340, damping: 30, mass: 1 }` |

### `surfaceCloseLeadDelayMs`

```tsx
<VistaSheet.Root surfaceCloseLeadDelayMs={35}>
```

Milliseconds the surface box waits before starting its close FLIP, so the
shared element visibly leads the shrink instead of scaling in lockstep — the
close reads as a re-home rather than a scale. Default `35`. Ignored under
reduced motion. It is the single biggest lever on how long a close feels: at
`100` the box sits frozen for 143ms after the click and the shared element is
53% of the way home before the sheet moves; at `0` there is no detachment to
read at all.

The three close values are coupled, but not by formula. `shared.close` was
originally derived from `close` by frequency-scaling (stiffness by `k²`,
damping by `k`, with `k = Ts / (Ts + D)`); Sean's later hand-dial pass moved
`shared.close` past that derived value, so it no longer holds. Change `close`
or `surfaceCloseLeadDelayMs` and re-dial `shared.close` to match on the
`/tune` panel — do not recompute it — or the shared element stops arriving
with the box: too fast and it parks early, too slow and it trails, and a
trailing shared element spills past the round trigger's 2px border.

### Presets

```tsx
import { VistaSheet, presets } from "@seansmithworks/vista-sheet";

<VistaSheet.Root preset={presets.snappy}>
```

`presets` carries three named feels, each a `{ transition?, surfaceCloseLeadDelayMs? }`
object — the same two fields above, bundled so a stranger can change how the
component feels without typing spring numbers. `default` is exactly what
ships when you pass no preset at all, so `preset={presets.default}` changes
nothing. `snappy` and `gentle` are un-dialled strawmen (frequency-scaled off
`default`, not judged by eye) — expect Sean to re-dial their actual values on
the `/tune` panel; that's a one-line change per preset, not an API change.

An explicit `transition` or `surfaceCloseLeadDelayMs` prop on `Root` always
wins over the same field on `preset`, field by field — **except `shared`**,
which is replaced whole rather than merged (it can be a Spring, a
Transition, or a directional `{ open, close }` object, and those three
shapes don't shallow-merge sensibly). If your explicit `shared` only sets
one direction, the other direction falls back to the preset's `shared` for
that direction, not the package default:

```tsx
<VistaSheet.Root preset={presets.snappy} transition={{ open: mySpring }}>
```

keeps `snappy`'s `close` and `shared`, taking only `mySpring` for `open`.

```tsx
<VistaSheet.Root
  preset={presets.snappy}
  transition={{ shared: { open: mySharedOpenSpring } }}
>
```

keeps `snappy`'s `shared.close`, taking only `mySharedOpenSpring` for
`shared.open`.

### `{ visualDuration, bounce }`

Every spring prop also accepts Motion's designer-legible shorthand — two
numbers instead of `stiffness`/`damping`. Use exactly these two keys,
**`visualDuration` and `bounce`, both required**:

```tsx
<VistaSheet.Root transition={{ open: { visualDuration: 0.4, bounce: 0.2 } }}>
```

Do not use Motion's other duration shorthand, `{ duration, bounce }` — this
package's shorthand detection treats anything with a `duration` key as a
plain tween and silently drops `bounce`. And do not add `mass` to this
shorthand: Motion resolves `stiffness`/`damping`/`mass` before it ever looks
at `visualDuration`/`bounce`, so a `mass` key here discards both and the
spring falls back to Motion's own defaults — measured, a 660ms settle
becomes 2080ms with no error and no warning from Motion itself.

This package's own `DurationSpring` type has no `mass` field, but the prop
type is `DurationSpring | Transition`, and Motion's own `Transition` type
structurally permits `mass` — so TypeScript will **not** catch
`{ visualDuration: 0.4, bounce: 0.2, mass: 1.75 }` at the prop. There is a
dev-only runtime warning for it instead (logged wherever the transition is
resolved); it does not run in production builds. Read this paragraph, not
the type checker, as the guard.

## Accessibility

- Real `<button type="button">` trigger, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- `role="dialog"` `aria-modal="true"` sheet; the `Labelled` union makes a
  missing accessible name a type error.
- Focus lands on the panel on open and stays there by default. Pass a ref
  to `Sheet`'s `initialFocus` prop to move focus to that control (a search
  field, a chat composer) once the open settles instead — opt-in, so opening
  a sheet never pre-highlights a control on its own. Escape closes
  unconditionally, but only while open; focus restores to the trigger on
  exit-complete, not at state-change.
- `<VistaSheet.Close>` reveals on keyboard focus, not only once the open
  spring settles — a Tab that reaches it before the sheet has visibly
  finished arriving still finds a visible control, not an invisible one.
- Body scroll lock, background `aria-hiding` and the Tab trap all last for
  the whole close animation, not just while `open` is true — they release
  on exit-complete, same as focus restore.
- Tab/Shift+Tab cycle every tabbable control in live DOM order — inputs,
  selects, textareas and contenteditable hosts included, disabled or
  hidden ones excluded — and never leave the panel; a scrollable
  `<VistaSheet.Content>` gets its own tab stop while it overflows.
- `<VistaSheet.Close>` is required in practice; Root logs a dev-only warning
  if the sheet opens with none registered.

**Known gap:** no `inert` on background content. `aria-modal="true"` covers
modern assistive tech; screen readers that ignore it can still navigate out
of the dialog.

## React StrictMode

Supported as of 0.1.1. Earlier versions could leave the trigger stuck
mid-close after a StrictMode double-mount in development, because a
cleanup-time `requestAnimationFrame` ref wasn't reset across the remount.
0.1.1 fixes it by resetting that ref on cleanup; no consumer-side workaround
needed.

## Known issues / status

- **Nothing consumes this package yet, including Sean's own site.** It is a
  clean-room extraction that has been gate-tested (see Development below) but
  not battle-tested in production.
- **Resize-mid-close transient.** Resizing the viewport while the sheet is
  closing produces a roughly 300-370px position-only desync between the
  shadow and the surface (`|Δheight|` stays around 2.5px). It is bounded and
  gated in the test suite at 450px. Two mechanisms are responsible:
  `sheetRect` is React state one render tick behind the surface's synchronous
  native reflow, and closing that gap fully would reintroduce a previously
  fixed teardown bug.
- **The dither shadow is deliberately not included.** `<Shadow asChild>` is
  the layering point; the visual treatment is the consumer's.

## What v0.1 cuts

Entrance choreography, `<VistaSheet.Backdrop>` as its own component (dismissal
still works via `Sheet`'s `dismissOnBackdrop`, which renders an invisible
click-catcher, no visual dim layer by default), controlled anchor, the
anchors-subset prop, and arrow-key repositioning between anchors. See
`docs/PACKAGE-DESIGN.md` §8 in the source repo for the reasoning behind each
cut.

## Development

```bash
npm install
npm run test           # vitest, unit tests for anchors.ts
npm run test:geometry  # Playwright, the geometry/motion gate
npm run audit:vars     # cross-check CSS vars against writers and docs
```

`npm run dev` also serves `/play.html`, a playground: pick a shape, recipe
(list, grid, nav, media), props and colour tokens, then copy the JSX and CSS
that reproduce the specimen. Motion stays on the dialled defaults; tune it on
`/tune.html`.

The geometry gate is `npm run test:geometry`, which points Playwright at
`example/playwright.config.ts`. A bare `npx playwright test` loads the
default config instead, silently runs zero tests, and still exits 0. Always
use the npm script, and check the reported test count, not just the exit
code.

### Measuring smoothness

```bash
npm run perf                          # measure vs perf/baseline.json
npm run perf -- --update-baseline     # rebaseline (needs a quiet machine)
npm run perf -- --update-baseline --wait-for-quiet   # poll for quiet, then rebaseline
```

"Does the morph feel smooth?" checked against a number instead of memory.
`scripts/perf-morph.mjs` opens its own vite server on `:5190` (never
`:5180`), drives 5 warm open+close cycles of the example in Chromium's
**new headless mode**, traces each cycle, and gates three numbers. Frame
numbers come from `PipelineReporter`, Chromium's own per-frame presentation
record, inside a 900ms window after each click:

- **raster ms** — total `RasterTask` time over the cycle.
- **dropped frames** — frames that ended dropped or partially presented,
  i.e. the page's pending update missed its frame.
- **longest interval ms** — the largest gap between two consecutive fully
  presented frames. Catches one long stall that a low dropped count hides.

`presented` is printed for information only. Any unrelated animation raises
it, which is why it isn't gated (the old screencast frame count went from 90
to 207 that way). An unrelated animation can't hide the gated numbers: a
frame that misses the morph's update still counts as partial, and a partial
frame never closes an interval.

Limits come from `perf/baseline.json`: raster at most the baseline median
plus a tolerance derived from its spread (20–90%), dropped frames at most
the median plus a derived slack of at least 2, longest interval at most the
worst baseline cycle plus one frame. Exit 1 on any failure.

**It runs on the GPU, and refuses otherwise.** Playwright's default headless
shell renders on SwiftShader (software); new headless mode
(`channel: "chromium"`) uses ANGLE Metal. Every launch reads the WebGL
renderer and the GPU feature status, prints the renderer, stores it in the
baseline, and exits 1 on a software renderer. No window opens.

**It refuses to score a trace it can't trust.** Each window must report at
least 50 frames in any state (healthy: ~106 open, ~74 close); fewer means its
trace events went missing, and the run throws instead of scoring a perfect 0.
`--inject-jank` and `--inject-block` read back page-side records and throw
unless the injection ran inside the scored windows. `PERF_DROP_WINDOW=open`
or `=close` discards one window's events to prove the floor fires.

**Baseline and sensitivity** (headless, M1 Pro, 2026-09-11, 20 pooled cycles
at load1 2.5–2.8): raster 55.7ms, 1 dropped frame, 16.7ms longest interval.
Judged on the median of 5 cycles, the gate fails when raster passes 93.3ms
(+67%), dropped frames reach 4, or the longest interval reaches 41.7ms (the
first frame-quantized step past the 33.3ms limit, at headless's 120Hz).
Headless raster runs about 24% above the old headed baseline (44.8ms), so
don't compare numbers across modes; rebaseline instead.

**Proof each gate fires** (against that baseline):

| Injection | What it does | Dropped (≤ 3) | Longest interval (≤ 33.3ms) | Exit |
| --- | --- | --- | --- | --- |
| `--inject-jank` | 20ms busy block every rAF | 106 FAIL | 25ms | 1 |
| `--inject-block` | one 150ms block, 200ms into each open | 17 FAIL | 150ms FAIL | 1 |
| `--inject-gpu` | 48 static full-viewport `backdrop-filter` layers | 148 FAIL | 41.7ms FAIL | 1 |

With an unrelated CSS animation added (`--inject-animation`), jank still read
111 dropped and the block 150ms (measured the same day, before this
rebaseline).

**Rebaselining requires a quiet machine, checked before every launch.** Raster
ms and frame presentation are absolute measurements: another test browser, a
heavy background app, or just system load contaminate them exactly like a
real regression would. `--update-baseline` checks `os.loadavg()[0]` against
`0.5 * cpu count` **before each of the 5 baseline launches**, not once
before the whole run — a launch takes minutes, so a load spike between
launches would otherwise silently contaminate a later one under a check
that already passed. Any launch that isn't quiet **refuses to write** a
baseline (no partial baseline is ever written) — pass `--wait-for-quiet` to
poll instead (default timeout 20 minutes) — and each launch's load1 at the
moment it started is recorded in `perf/baseline.json` under
`load1PerLaunch`. A plain `npm run perf` (the gate, not the rebaseline)
prints a warning instead of refusing, since it's meant to run ad hoc during
a dev loop; treat a FAIL under that warning as suspect until re-run quiet.

**Baseline model — warm steady state, not one cold sample.** The first open
after browser launch renders roughly half the distinct frames of a later
one, so a single launch is not steady state. `--update-baseline` runs 5
separate browser launches of 5 cycles each, discards the *entire first
launch* (not just its in-page warm-up — a whole cold launch), and pools the
per-cycle samples from the remaining launches. The baseline's median/min/max,
and the limits above, come from that pool.

Needs this machine's GPU — **not part of `prepublishOnly` or CI**, where a
software renderer is refused rather than measured.

**What the gate can't see (verified 2026-09-11).** Ground truth is a 60fps
`agent-browser record` clip of one warm open+close, counted with
`ffmpeg -vf mpdecimate`: 68–73 distinct frames, headed or headless. The old
"blind spot" rested on broken clips (8 and 1 distinct frames across whole
recordings), not on the app. GPU load does reach the gate: 48 static
full-viewport `backdrop-filter` layers cut the headless clip to 39 distinct
frames, and the gate fails on it. The gap is the real display. 12 such
layers cost nothing headless (68 distinct frames, no extra dropped frames)
but cut a headed clip to 42, and a headed trace shows it (25 dropped, a
150ms interval). A GPU regression that only hurts on a real display passes
this gate; check one with a headed recording. Two limits of the recording
itself: distinct-frame counts miss a main-thread stall while compositor
animations keep changing pixels (a 150ms block still reads 71), and
visibly blurred content undercounts.



MIT. See `LICENSE` for the full text.
