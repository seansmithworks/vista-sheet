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
surface," so Wicket Iris (`Iris`) names the shape directly rather than
reaching for an existing term.

Browser and platform limits: [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md).

## Install

```bash
npm install @wicket/iris
npm install react react-dom motion@14
```

The second line installs the [peer dependencies](#peer-dependencies); skip
any your app already has.

`dist/` ships compiled ESM + `.d.ts` declarations, so the default import
needs no build-step config on the consumer's side — no `transpilePackages`,
no extra `tsc` target. CSS is bundled and auto-imported by the package's own
entry point; you don't need a separate stylesheet `<link>` or `import` for
the component to render styled. A manual stylesheet path,
`@wicket/iris/styles.css`, also exists if you need to import
the CSS on its own (e.g. to inline it above the fold, or reference it from a
non-JS build step) — most consumers never need it.

### Installing from source

To test an unreleased branch, install straight from GitHub. Add `#<branch>`
(or a tag or commit) to pick the ref; without it you get the default branch:

```bash
npm install github:seansmithworks/vista-sheet
npm install github:seansmithworks/vista-sheet#explore/link-preview
npm install react react-dom motion@14
```

It builds itself on install: npm installs the package's dev dependencies
and runs its `prepare` script, which compiles the same `dist/` the npm
release ships. After that it behaves exactly like the default install
above, with no `transpilePackages` or other config on your side. The
install takes longer than a registry install because of that build. npm 11
may warn that the package's `prepare` script isn't covered by
`allowScripts`; the build has already run by then, and the install works.

### npx copy-in

If you'd rather own the files outright — no package dependency, no
`node_modules` indirection — copy the component source directly into your
project:

```bash
npx @wicket/iris add
```

This drops all of `src/`'s components, hooks, and `styles.module.css` into
`./src/wicket-iris` (pass a different path as the first argument to change
the target). It skips the test file and, if your project already has a
`next-env.d.ts`, skips the `*.module.css` ambient type shim too (Next
already declares it — a duplicate `declare module` block is a TS error). It
refuses to overwrite existing files unless you pass `--force`.

After copy-in, the Usage and Link preview snippets below import from the
copied folder, not the package: use the import path the CLI prints after
copying (by default `"./src/wicket-iris"`, relative to where you ran it)
instead of `"@wicket/iris"`.

The tradeoff: you own the copy from that point on. There's no update
channel — to pick up changes, re-run with `--force` (which overwrites
everything) or diff your copy against a fresh `add` in a scratch directory.
Peer dependencies aren't copied and still need installing:

```bash
npm install react react-dom motion@14
```

### Live-tuning panel

```bash
npx @wicket/iris add tuner
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
object you paste straight into `preset={...}` on `<Iris.Root>`, no
hand-translation. This repo runs the same file live at
`npm run dev` → `/tune.html`.

## Peer dependencies

- `react` >=19
- `react-dom` >=19
- `motion` ^12 || ^13 || ^14 (geometry suite run green against 12.43.0, 13.5.1 and 14.0.0; see [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) for the perf-gate detail)

None are bundled. Install them yourself if your app doesn't already have
them.

## Usage

Paste this into `app/page.tsx` (or wherever you mount it) in a Next.js App
Router app, or into `App.tsx` in Vite (the `"use client"` line is harmless
there):

```tsx
"use client";

import { Iris } from "@wicket/iris";

export default function ContactTrigger() {
  return (
    <Iris.Root>
      <Iris.Shadow />

      <Iris.Trigger aria-label="Open contact">
        <Iris.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1d1d1f",
            }}
          />
        </Iris.Shared>
      </Iris.Trigger>

      <Iris.Sheet aria-labelledby="sheet-title">
        <Iris.Shared>
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1d1d1f",
            }}
          />
        </Iris.Shared>

        <Iris.Close aria-label="Close" />

        <Iris.Content>
          <Iris.Item>
            <h2 id="sheet-title">Sean Smith</h2>
          </Iris.Item>
          <Iris.Item>
            <p>Links, etc.</p>
          </Iris.Item>
        </Iris.Content>
      </Iris.Sheet>
    </Iris.Root>
  );
}
```

Pasted as-is, this renders a solid-colored trigger at the bottom-center
viewport anchor: drag it to re-anchor at any of the seven anchors, tap it to
morph it into the sheet shown above.

Ten exports total: nine components (`Root`, `Trigger`, `Sheet`, `Shared`,
`Media`, `Content`, `Item`, `Close`, `Shadow`) plus the `useIris()`
hook. That is the whole surface area.

A Root that mounts open (`defaultOpen`, or `open` already `true`) renders the sheet at rest, with no morph and no entrance on its content or close button; every later close and open animates.

**In a Next.js App Router app, `"use client"` has to be the first line of
the file where you mount `Iris`**, as it is in the snippet above.
Server Components can't resolve a property access like `Iris.Root` on
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
`<Iris.Root>` to a file, the fix is to add `"use client"` as the very
first line of that file.

### Trigger shape

`<Iris.Root shape>` takes `"circle"` (default), `"squircle"`,
`"rounded-square"`, `"square"` or `"rectangle"`. The trigger surface, `<Iris.Shadow>`,
both `<Iris.Shared>` slots and the focus ring all follow it.
`--wicket-iris-trigger-radius` still caps the corner radius for every shape.
With `"squircle"` the sheet's own corners use the squircle curve too, so the
surface never switches corner geometry mid-morph. `<Iris.Shared>`
children should fill their box without applying their own `border-radius` —
the slot clips them to the current shape.

Browser support: `"squircle"` is a true superellipse where CSS `corner-shape`
is supported (Chromium); Safari and Firefox get a close `border-radius`
approximation.

### Rectangle buttons

```tsx
"use client";

import { Iris } from "@wicket/iris";

export default function SearchTrigger() {
  return (
    <Iris.Root shape="rectangle" buttonSize="m">
      <Iris.Shadow />

      <Iris.Trigger aria-label="Search">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" />
          <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" />
        </svg>
        Search
      </Iris.Trigger>

      <Iris.Sheet aria-labelledby="search-title">
        <Iris.Close aria-label="Close" />

        <Iris.Content>
          <Iris.Item>
            <h2 id="search-title">Search</h2>
          </Iris.Item>
        </Iris.Content>
      </Iris.Sheet>
    </Iris.Root>
  );
}
```

- `shape="rectangle"` plus `buttonSize` (`"s" | "m" | "l"`, default `"m"`)
  sets height and inline padding: 36px/14px, 44px/18px, 52px/22px.
- Width sizes to the trigger's label (children) by default. Pass `buttonWidth`
  (px) for a fixed width; a value narrower than the label clips it, no
  ellipsis.
- Corners are a pill — `min(--wicket-iris-trigger-radius, height / 2)` — a
  strawman awaiting Sean's dial pass. Set `--wicket-iris-trigger-radius` lower
  for a rounded rectangle instead.
- A rectangle trigger holds plain children only: an icon, icon + text, or
  text. `<Iris.Shared>` and `<Iris.Media>` are not supported
  inside it in v0.2.
- The label fades in only as a close nears rest, over the last 15% of the
  close (`collapseProgress` 0.85 to 1), so it never paints over the
  still-large sheet.

### Media and aspect-ratio sheets

```tsx
const ratio = 9 / 16;

<Iris.Root>
  <Iris.Shadow />

  <Iris.Trigger aria-label="Play intro">
    <Iris.Media
      src="/intro.mp4"
      poster="/intro.jpg"
      aspectRatio={ratio}
    />
  </Iris.Trigger>

  <Iris.Sheet aria-label="Intro video" aspectRatio={ratio}>
    <Iris.Media
      src="/intro.mp4"
      poster="/intro.jpg"
      aspectRatio={ratio}
    />
    <Iris.Close aria-label="Close" />
  </Iris.Sheet>
</Iris.Root>
```

- `Sheet`'s `aspectRatio` (width / height) contain-fits the sheet inside
  `sheetMaxWidth` and the current anchor's max height — tall (`9 / 16`), wide
  (`16 / 9`) and narrow (`1 / 2`) all work.
- `Media` is rendered twice like `Shared` and fills and covers its box. It
  scales uniformly through the morph and never squashes.
- `aspectRatio` is required on `Media` because it sizes the media before the
  file loads.
- The trigger rests on the `poster` and never loads the video (`preload="none"`,
  paused). The sheet's video plays muted, looped and inline while the sheet is
  open. Reduced-motion users get the poster, paused, in both places. There is
  no pause button: Close and Escape are how a user hides it.
- Use `Media` in place of `Shared`, as a direct child of `Trigger` or `Sheet`.
- The two instances don't share playback time; make `poster` the clip's first
  frame.
- `alt` makes it non-decorative.

### The escape hatch

`useIris().collapseProgress` is the raw `MotionValue<number>` the
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
  return useIris();
  // { open, setOpen, anchor, setAnchor, isDragging, triggerSize, collapseProgress, triggerRect, sheetRect }
}
```

### Link preview

`<Iris.Root preview>` turns a text link into a hover card: the link
morphs into a floating card holding a live iframe of the page it points at.
It is for previewing pages on sites you own. Only one iframe is ever alive:
mount it while the card is open and drop it the instant a close starts.

```tsx
// LinkPreview.tsx
"use client";

import { Iris, useIris } from "@wicket/iris";

export function LinkPreview({ href, children }: { href: string; children: string }) {
  return (
    <Iris.Root preview>
      <Iris.Shadow />
      <Iris.Trigger asChild>
        <a href={href}>{children}</a>
      </Iris.Trigger>
      <Iris.Sheet aria-label={`Preview of ${children}`} aspectRatio={360 / 520}>
        <Iris.Content>
          <PreviewFrame href={href} />
        </Iris.Content>
      </Iris.Sheet>
    </Iris.Root>
  );
}

function PreviewFrame({ href }: { href: string }) {
  const { open } = useIris();
  if (!open) return null;
  return <iframe src={href} title={`Preview of ${href}`} tabIndex={-1} />;
}
```

Use it anywhere a link goes. In Next.js, render it from any page; the
component file carries `"use client"`. The preview iframes the target, so
`href` should be a page on a site you own that allows framing.

```tsx
<p>Read the <LinkPreview href="/">home page</LinkPreview> first.</p>
```

Keep the `"use client"` line at the top of the file that defines
`LinkPreview`. A Next.js Server Component can then import and render
`<LinkPreview>` directly; without the directive, that import fails.

The `<a>` stays an ordinary link. `<Iris.Trigger asChild>` takes it as
the trigger and adds the preview behavior; your `onPointerEnter`, `onClick`
and the rest still run first. `example/link-preview/main.tsx` is the working
version, with a loading skeleton and an "Open" link inside the card.

- **Hover intent and a hoverable card.** The pointer must rest on the link
  for 150ms (currently; `PREVIEW_HOVER_INTENT_MS`) before a card opens, so sweeping across a paragraph opens
  nothing. Keyboard focus (`:focus-visible` only) uses the same delay. Once
  open, the card stays while the pointer is on the link or on the card, and
  closes 250ms (currently; `PREVIEW_CLOSE_GRACE_MS`) after it leaves both, so you can cross the gap to the card.
  Escape, a press outside, scrolling and a window resize also close it.
- **Placement.** The card opens above the hovered line if the whole card
  fits there. If not, it opens on whichever side has more room (above wins a
  tie) and shrinks to fit. The unread lines below stay hoverable. It sits
  8px from the line, is centred on the pointer, and is clamped 16px inside
  the viewport. A link that wraps is several line boxes: the card pins to the
  one under the pointer, and a close lands on that line.
- **240px minimum.** The card shrinks to the room on its side of the link,
  down to 240px tall (currently; `PREVIEW_MIN_HEIGHT_PX`). Below that it overlaps the link rather than shrinking
  further.
- **Touch.** Press and hold for 400ms (currently; `PREVIEW_LONG_PRESS_MS`) opens the card; lifting the finger
  keeps it open and does not follow the link. A short tap follows the link as
  normal, and moving more than 10px (currently; `PREVIEW_LONG_PRESS_SLOP_PX`) cancels the press.
- **Defaults.** The card is 360px wide at `aspectRatio={360 / 520}` unless
  you pass `sheetMaxWidth` or an `aspectRatio` of your own.
- **One card at a time**, across every preview Root on the page.
- **Props.** A preview Root accepts only `children`, `onOpenChange`,
  `sheetMaxWidth`, `preset`, `transition`,
  `reduceMotion`, `id`, `zIndex` and `className`. Modal-only props (`open`,
  `defaultOpen`, `shape`, `triggerSize`, `defaultAnchor`, `draggable` and the
  rest) are type errors. `preview` is fixed for the Root's lifetime.
- **Theming.** The card renders in a layer on `<body>`, outside your link's
  DOM. Theme it through the Root's `className`, not an ancestor of the link.
  The preview timings live in `src/motion.ts` (`PREVIEW_*`).
- **`useIris().triggerRect`** is the hovered line box, measured at
  open; it is not live.

## Theming

Two public styling surfaces: CSS custom properties and a DOM data-attribute
contract.

### `--wicket-iris-*` custom properties

Every visual token is a CSS custom property with a hardcoded fallback, so the
package renders correctly out of the box:

| Variable | Default |
| --- | --- |
| `--wicket-iris-surface` | `#fafafa` |
| `--wicket-iris-surface-elevated` | `#ffffff` |
| `--wicket-iris-surface-border` | `rgba(229,229,229,.6)` |
| `--wicket-iris-surface-border-width` | `1px` |
| `--wicket-iris-text` | `#1d1d1f` |
| `--wicket-iris-accent` | `#1d1d1f` |
| `--wicket-iris-sheet-max-width` | `480px` |
| `--wicket-iris-shared-size` | matches `--wicket-iris-trigger-size` |
| `--wicket-iris-sheet-radius` | `48px` |
| `--wicket-iris-trigger-radius` | `9999px` |
| `--wicket-iris-sheet-padding` | `24px` |
| `--wicket-iris-shadow` | `0 2px 16px -4px rgba(0,0,0,.03), 0 6px 20px -4px rgba(0,0,0,.08)` |
| `--wicket-iris-sheet-shadow` | `0 12px 16px -12px rgba(0,0,0,.12), 0 8px 22px -4px rgba(0,0,0,.12)` |
| `--wicket-iris-sheet-shadow-fade-start` | `0` |
| `--wicket-iris-sheet-shadow-fade-end` | `0.25` |
| `--wicket-iris-z` | `100` |
| `--wicket-iris-trigger-hover-lift` | `1px` |
| `--wicket-iris-trigger-press-scale` | `0.97` |
| `--wicket-iris-trigger-highlight-color` | 7% of `--wicket-iris-text` |
| `--wicket-iris-trigger-highlight-size` | `96px` |
| `--wicket-iris-trigger-highlight-strength` | `0.75` |
| `--wicket-iris-trigger-press-tint` | `rgba(0,0,0,.06)` |

`--wicket-iris-sheet-shadow-fade-start`/`-fade-end` are unitless
`collapseProgress` fractions (0 = open at rest, 1 = closed at rest) marking
where `<Iris.Shadow>` crossfades from the heavy `--wicket-iris-sheet-shadow`
look to the thin `--wicket-iris-shadow` look — see "Two shadows, one painter"
below.

`--wicket-iris-surface-border-width` is the width of the trigger surface's
`--wicket-iris-surface-border` ring. `<Iris.Shared>` sits inset by the
same width, so its clip stays concentric with the ring at any width. The
sheet's own border stays 1px.

`--wicket-iris-trigger-hover-lift` (how far the resting trigger rises on
mouse hover) and `--wicket-iris-trigger-press-scale` (its scale while
pressed, by pointer or Space) drive the disc and button triggers' hover and
pressed states. The trigger and its `<Iris.Shadow>` move together, over
150ms. Set `0px` / `1` to turn either off. Neither applies under reduced
motion, while the sheet is open or closing, or to a link preview; any open
drops them instantly so the morph starts from the trigger at rest. Every
trigger also has an invisible hit area of at least 48px on each axis (a
rectangle `s`/`m` button, or a disc under 48px) without changing its visual
size or layout.

The trigger surface also shows a soft radial highlight that follows the mouse
on hover (`--wicket-iris-trigger-highlight-color`, `-size`). On press the
highlight tightens and the surface darkens by `--wicket-iris-trigger-press-tint`.
For touch, keyboard and reduced motion the highlight is centred and only fades.
The default colour is 7% of `--wicket-iris-text`, so a light palette gets a
faint tint and a dark palette a faint glow. Set
`--wicket-iris-trigger-highlight-strength: 0` to turn the highlight and the
press tint off. Both layers sit inside the trigger surface: they never paint
on the sheet and are gone before any open.

A dark shadow barely reads on a dark ground, so the example pages' dark
palette uses a faint white glow instead:

```css
--wicket-iris-shadow: 0 2px 4px -2px rgba(255,255,255,.14), 0 8px 12px rgba(255,255,255,.15);
--wicket-iris-sheet-shadow: 0 4px 20px rgba(255,255,255,.1), 0 16px 28px -8px rgba(255,255,255,.15);
--wicket-iris-surface-border: rgba(255,255,255,.1);
--wicket-iris-accent: #f5f5f7; /* focus ring; matches the canvas page's dark accent (--cv-accent). The default #1d1d1f is invisible on dark */
--wicket-iris-trigger-highlight-color: rgba(255,255,255,.1);
--wicket-iris-trigger-highlight-strength: 1;
--wicket-iris-trigger-press-tint: rgba(255,255,255,.15);
```

Hover lift (`1px`), press scale (`0.97`), highlight size (`96px`) and ring
width (`1px`) are the same as the light defaults.

The package writes `--wicket-iris-trigger-size`, `--wicket-iris-button-width`,
`--wicket-iris-trigger-highlight-x/-y`,
`--wicket-iris-sheet-left`, `--wicket-iris-collapse`,
`--wicket-iris-shadow-radius`, and
`--wicket-iris-shadow-opacity`/`--wicket-iris-sheet-shadow-opacity` (the live
crossfade values, in [0, 1]); read these, don't set them.

### Two shadows, one painter

`<Iris.Shadow>` paints both shadow looks on its one silhouette,
crossfaded by opacity as `collapseProgress` moves — nothing else in the
package paints a shadow. If you don't render `<Iris.Shadow>`, there is
no shadow at all. An `asChild` swap receives
`--wicket-iris-shadow-opacity`/`--wicket-iris-sheet-shadow-opacity` as custom
properties on the cloned element so a replacement layer (e.g. a
`@seansmithworks/surface-fx` dither) can reproduce the same crossfade. A ref
already on the child is preserved (composed with Shadow's own), never dropped.

`npm run audit:vars` checks this table against `src/styles.module.css` and
`src/`: any `--wicket-iris-*` variable the CSS reads must be either written by
the package or documented here, or the audit fails.

### `data-wicket-iris-part` DOM contract

Every element the package renders carries `data-wicket-iris-part`, and this is
public, stable surface, not an accident of implementation you happen to be
able to reach. Use it for CSS overrides or, as `example/CloseMask.tsx` does,
to find the live element from outside the package via `useIris()` + a
`document.querySelector`.

| Value | Element |
| --- | --- |
| `trigger-root` | The trigger's fixed drag wrapper |
| `trigger` | The trigger `<button>` |
| `trigger-surface` | The trigger's seed surface (the FLIP source) |
| `shared` | `<Iris.Shared>`, on both its trigger- and sheet-side instances |
| `media` | `<Iris.Media>`'s wrapper, on both its trigger- and sheet-side instances (the trigger-side one renders inside `trigger-surface`) |
| `sheet` | `<Iris.Sheet>`'s panel |
| `backdrop` | The invisible outside-click catcher (only when `dismissOnBackdrop`) |
| `content` | `<Iris.Content>`'s scroll region |
| `item` | `<Iris.Item>` |
| `close` | `<Iris.Close>`'s button |
| `shadow` | `<Iris.Shadow>`'s default div (also merged onto an `asChild` child) |
| `trigger-label` | Wrapper around the trigger's plain children (everything except Shared and Media); fades in as a close lands |

`<Iris.Shared>` additionally carries `data-wicket-iris-slot="trigger"` or
`"sheet"`, so consumer CSS (or the package's own
`.shared[data-wicket-iris-slot=…]` rules) can target either instance without
relying on className precedence. `<Iris.Media>` carries it too.

`trigger-root` additionally carries `data-wicket-iris-closing` (empty string),
present only while a close is in flight (removed once the sheet has fully
closed).

`trigger`, `trigger-surface`, `sheet`, `shared` and `shadow` additionally
carry `data-wicket-iris-shape` (the Root's `shape`).

`trigger-root` also carries `data-wicket-iris-shape`. `trigger-root` and
`trigger` additionally carry `data-wicket-iris-button-size` (the Root's
`buttonSize`) when `shape="rectangle"`.

`sheet` additionally carries `data-wicket-iris-settled` (empty string), present
only once the open has finished and removed as soon as a close starts. This
gates `<Iris.Close>`'s reveal, not any shadow — the sheet element paints
no box-shadow of its own; see "Two shadows, one painter" above.

## Motion

Three springs are props (`transition.open` / `.close` / `.shared`), each
accepting either `{ stiffness, damping, mass? }` or `{ visualDuration, bounce }`
(see below for both spring shorthands), or a full Motion `Transition`, plus
one number, `surfaceCloseLeadDelayMs`, which lives on a preset. Everything else,
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
<Iris.Root
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
<Iris.Root preset={{ surfaceCloseLeadDelayMs: 35 }}>
```

A field of a [preset](#presets), not a Root prop. Milliseconds the surface box waits before starting its close FLIP, so the
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
or the preset's `surfaceCloseLeadDelayMs` and re-dial `shared.close` to match on the
`/tune` panel — do not recompute it — or the shared element stops arriving
with the box: too fast and it parks early, too slow and it trails, and a
trailing shared element spills past the round trigger's border ring.

### Presets

```tsx
import { Iris, presets } from "@wicket/iris";

<Iris.Root preset={presets.snappy}>
```

`presets` carries three named feels, each a `{ transition?, surfaceCloseLeadDelayMs? }`
object — the same two fields above, bundled so a stranger can change how the
component feels without typing spring numbers. `default` is exactly what
ships when you pass no preset at all, so `preset={presets.default}` changes
nothing. `snappy` and `gentle` are un-dialled strawmen (frequency-scaled off
`default`, not judged by eye) — expect Sean to re-dial their actual values on
the `/tune` panel; that's a one-line change per preset, not an API change.

An explicit `transition` prop on `Root` always
wins over the same field on `preset`, field by field — **except `shared`**,
which is replaced whole rather than merged (it can be a Spring, a
Transition, or a directional `{ open, close }` object, and those three
shapes don't shallow-merge sensibly). If your explicit `shared` only sets
one direction, the other direction falls back to the preset's `shared` for
that direction, not the package default:

```tsx
<Iris.Root preset={presets.snappy} transition={{ open: mySpring }}>
```

keeps `snappy`'s `close` and `shared`, taking only `mySpring` for `open`.

```tsx
<Iris.Root
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
<Iris.Root transition={{ open: { visualDuration: 0.4, bounce: 0.2 } }}>
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

### Browser floor

Safari and iOS Safari 16.2+, Chrome and Edge 111+, Firefox 113+. The shipped
CSS uses `color-mix()`, which sets that floor; `inert` (Safari 15.5, Chrome
102, Firefox 112) sits under it. `corner-shape` stays progressive: browsers
without it get the tuned `border-radius` fallback.

### Semantics

- Real `<button type="button">` trigger, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- `role="dialog"` `aria-modal="true"` sheet; the `Labelled` union makes a
  missing accessible name a type error.
- `<Iris.Close>` is required in practice; Root logs a dev-only warning
  if the sheet opens with none registered. It reveals on keyboard focus, not
  only once the open spring settles, so a Tab that reaches it early still
  finds a visible control.
- Link preview cards are non-modal and `aria-hidden`: nothing moves focus,
  locks scroll or traps Tab. The card is a visual duplicate for pointer and
  touch users, so never put focusable content inside it; the link remains the
  accessible element. Keyboard focus on the link opens it after the intent
  delay, and blur closes it.

### Modal behaviour

An open sheet is a real modal, not just a labelled dialog.

- **The page is inert.** While the sheet is open, everything outside it gets
  `inert`: no pointer, no focus, no assistive-technology access. The panel,
  its backdrop and any `[aria-live]` (other than `aria-live="off"`) or
  `role="status|alert|log"` region already on the page when the sheet opens
  are kept live, so a toast still announces and stays clickable. A live
  region that wraps the sheet is not kept, since that would keep the whole
  page. The page, trigger included, is released the moment a close is
  requested, not when the animation ends, so the trigger is tappable from the
  first close frame and a reopen can interrupt the close.
- **Focus guards.** Tab is never intercepted. Two `tabindex="0"` guard
  elements (`data-wicket-iris-focus-guard`) sit just outside the panel and
  catch focus leaving either edge: Tab off the last control wraps to the
  first, Shift+Tab off the first wraps to the last. They route by where focus
  came from, so focus entering from outside lands on the near end. Tab order
  inside the panel is the browser's own, so radio groups, `<details>`, shadow
  roots and portaled listboxes behave natively. The guards and the body
  scroll lock last for the whole close animation, so Tab mid-close stays in
  the panel.
- **Focus on open.** Focus lands on the panel and stays there by default.
  Pass a ref to `Sheet`'s `initialFocus` prop to move focus to that control (a
  search field, a chat composer) once the open settles instead; opt-in, so
  opening a sheet never pre-highlights a control on its own.
- **Escape closes the top layer only.** Open sheets and preview cards form a
  stack; Escape closes the most recent, so a preview card inside a sheet
  takes one press and the sheet a second. Escape is ignored when something
  inside already handled it (a listbox or combobox that calls
  `preventDefault`) and while an IME composition is ending, so it never
  interrupts typing. It is not configurable.
- **Focus restore.** When the close animation finishes, focus returns to the
  trigger, but only if focus is on the body or still inside the leaving
  panel. A page control the user clicked mid-close keeps its focus.
- **Android back.** The package doesn't touch browser history, so the
  Android back gesture navigates away from the page; it doesn't close the
  sheet. To make back close it, push a history entry in `onOpenChange` and
  close on `popstate`.

### Moving the trigger

Dragging stays on by default, but a drag is not the only way to move the
trigger.

- **Arrow keys.** With the trigger focused, `draggable` on and the sheet
  closed, the arrow keys move it one step, with the same spring as a drag
  release (placed directly under reduced motion). The keys are physical, so
  right-to-left layouts behave the same:

  | From | Left / Right | Up / Down |
  | --- | --- | --- |
  | `top-left` / `top-right` | along the top row | Down: `bottom-left` / `bottom-right` |
  | `top-center` | `top-left` / `top-right` | Down: `center` |
  | `center` | none | Up: `top-center`, Down: `bottom-center` |
  | `bottom-left` / `bottom-right` | along the bottom row | Up: `top-left` / `top-right` |
  | `bottom-center` | `bottom-left` / `bottom-right` | Up: `center` |

  A step off the grid does nothing. While active, a plain arrow is always
  consumed, so the page doesn't scroll under the trigger; arrows with Alt,
  Ctrl or Meta pass through to the browser. With `draggable={false}` or the
  sheet open, arrows are left alone.
- **`setAnchor(anchor)`** on `useIris()` moves the trigger exactly like
  a drag release and fires `onAnchorChange`. Called while the sheet is open,
  it records the new anchor without moving the open sheet; the trigger takes
  its new place on close.
- **Announcement.** Keyboard and `setAnchor` moves write a polite
  `role="status"` message ("Moved to bottom right.") into a visually hidden
  span inside Root. Drags never do. Pass `anchorAnnouncement` to Root to
  translate or replace it; return `false` to announce nothing:

  ```tsx
  <Iris.Root anchorAnnouncement={(a) => `Verschoben nach ${LABELS_DE[a]}.`}>
  ```

**Dragging alone does not meet WCAG 2.5.7 (Dragging Movements).** The arrow
keys cover keyboard users; for mouse, touch and switch users, render a
control that calls `setAnchor`. A native `<select>` is the smallest accessible
one. It must live inside `Root` and outside the sheet, since the page is
inert while the sheet is open:

```tsx
import { Iris, useIris, type AnchorId } from "@wicket/iris";

const ANCHORS: AnchorId[] = [
  "top-left", "top-center", "top-right",
  "center",
  "bottom-left", "bottom-center", "bottom-right",
];

function MoveMenu() {
  const { anchor, setAnchor } = useIris();
  return (
    <label>
      Move button to
      <select value={anchor} onChange={(e) => setAnchor(e.target.value as AnchorId)}>
        {ANCHORS.map((a) => (
          <option key={a} value={a}>{a.replace("-", " ")}</option>
        ))}
      </select>
    </label>
  );
}
```

Strict conformance depends on your site rendering a control like this; the
package ships none.

### Rules for your side

- **Label in Name (WCAG 2.5.3).** If the trigger shows text, its `aria-label`
  must contain that text: a button reading "Search messages" can be labelled
  "Open search messages", not "Open inbox". The example pages' axe spec
  enforces this on every shipping page.
- **A trigger parked at the bottom covers content (WCAG 2.4.11, Focus Not
  Obscured).** Without room for it, a focused link near the page end can sit
  under the trigger. Reserve the trigger's box at the bottom of the page and
  tell the browser to scroll focus clear of it. `--wicket-iris-trigger-size`
  is scoped to Root, so use the fixed size: `160px` is the largest default
  trigger (144px) plus the 16px edge margin.

  ```css
  html { scroll-padding-bottom: 160px; }
  body { padding-bottom: 160px; }
  ```

- **Dark palettes need `--wicket-iris-accent`.** It is the focus-ring colour
  and defaults to `#1d1d1f`, which is invisible on a dark ground. See the dark
  recipe under Theming.
- **Reduced motion.** `prefers-reduced-motion: reduce` (or the `reduceMotion`
  prop) swaps the morph for a short cross-fade, drops swipe-to-close and
  keeps video paused on its poster.

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
- **Link preview long-press is untested on a real iPhone.** Only a synthetic
  CDP touch is covered; iOS's own long-press callout and text selection have
  not been verified.

## What v0.1 cuts

Entrance choreography, `<Iris.Backdrop>` as its own component (dismissal
still works via `Sheet`'s `dismissOnBackdrop`, which renders an invisible
click-catcher, no visual dim layer by default), controlled anchor and the
anchors-subset prop. See
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
