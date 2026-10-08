# vista-sheet a11y + web-standards plan (draft for adversarial review)

Audited `canvas` @ 8090664, worktree agent-a047d6627e27030d5. Line refs are to that tree. "Verified" = read in code this session; "inferred" = reasoned, not run.

**Answer:** 6 blockers, 9 majors, 13 minors. **P0 = 8 work items** (they clear all blockers, plus three majors that share their files), **P1 = 9, P2 = 11**. The single biggest structural fix: replace the "aria-hide siblings + own every Tab press" model with **`inert` on the background + focus-guard sentinels**. That one change removes four findings, B1, M1, M2 and M8.

## Blockers (must fix before publish)

- **B1. The background is not actually modal.** It is aria-hidden but not inert. With `dismissOnBackdrop={false}` no click-catcher renders (`Sheet.tsx:305`), so the page under an `aria-modal` sheet stays clickable and focusable by pointer. Focus also escapes through any `<iframe>` in the sheet (keydown inside an iframe never reaches the document listener at `useDialogBehavior.ts:274`). WCAG 2.4.3, plus the APG modal contract.
- **B2. Drag-to-reposition has no keyboard path and no single-pointer path.** The trigger handles only Space keydown (`Trigger.tsx:479-494`). `setAnchor` lives in internal context but `useVistaSheet()` drops it (`context.ts:161-180`), so consumers can't build an alternative either. Fails 2.1.1 Keyboard (A) and 2.5.7 Dragging Movements (AA). W3C: a keyboard alternative alone does not satisfy 2.5.7.
- **B3. Looping autoplay video can't be paused.** `Media.tsx:176-192` uses `autoPlay loop` and no controls. The trigger-side copy loops on the host page indefinitely. Fails 2.2.2 Pause, Stop, Hide (A). The reduced-motion pause does not count, because 2.2.2 applies to every user.
- **B4. Label in Name.** `aria-label` is required on Trigger (`types.ts:179-180`) and Close (`types.ts:233`), even when the button already shows text (a rectangle trigger reading "Contact", a Close reading "Done"). The required label replaces the visible text as the accessible name, so speech-input users who say what they see miss. Fails 2.5.3 (A).
- **B5. One Escape closes everything.** Every open surface registers its own document `keydown` (`useDialogBehavior.ts:237-276`), with no layer stack and no `e.defaultPrevented` or `e.isComposing` check. Results:
  - A link-preview card inside a sheet closes both the card and the sheet.
  - A combobox or menu in the sheet that consumes Escape still closes the sheet.
  - A CJK IME user who cancels a composition with Escape loses the sheet.
- **B6. `asChild` in a modal Root becomes a hover-to-open modal.** `Trigger.tsx:64-70` branches on `props.asChild` alone, not on `ctx.preview`. `<Root><Trigger asChild><a/></Trigger>` therefore renders LinkTrigger: hover-intent opens a focus-stealing modal, and the trigger loses `aria-haspopup`/`aria-expanded`. The `TriggerComponentProps` union does not prevent this (verified by reading the types, not compiled).

## Phase counts

| Phase | Items | Clears |
| --- | --- | --- |
| P0 (pre-publish) | 8 | B1-B6, M1, M2, M8, m1, axe gate, docs (M7/M9 doc halves) |
| P1 | 9 | M3-M7, M9, m2, m3, m13 |
| P2 | 11 | m4-m12, preview top-layer spike, SR re-run |

## Decisions for Sean (strawman applied unless he overrides)

1. **Single-pointer alternative for reposition (B2).** Strawman: the package ships arrow keys plus a public `setAnchor`, and README ships a "Move" menu recipe. 2.5.7 then depends on the consumer rendering that menu. Fork: make `draggable` default to `false` so the default install conforms, or build a pointer affordance into the package (for example a long-press that shows the 7 anchor targets). Recommended: **default `draggable` to `false`** (breaking, but free before publish). It's the only option where the default install conforms with no consumer work.
2. **Video 2.2.2 (B3).** Strawman: the trigger-side video plays once, capped at 5s, then rests on `poster`. Hover or focus replays it. The sheet-side video gets a new `<VistaSheet.MediaToggle>` pause/play part, placed by the consumer, and the package dev-warns if a looping sheet video renders without one. Fork: what the toggle looks like and where it sits, and whether the trigger plays only on hover.

---

## Findings

Severity: B = blocker, M = major, m = minor. Each row lists the reference systems' approach and how to verify.

### Modal dialog (APG Dialog Modal)

| # | Sev | Finding (code) | Reference approach | Verify |
| --- | --- | --- | --- | --- |
| B1 | B | Background is aria-hidden, not inert (`useDialogBehavior.ts:59-81, 164-181`). The click-catcher only renders when `dismissOnBackdrop` (`Sheet.tsx:305-312`). README admits the gap (`README.md:724-726`). The code comment "inert support is uneven" (`useDialogBehavior.ts:53-54`) is stale: `inert` is Baseline 2023 (Chrome 102, Safari 15.5, Firefox 112), and the React 19 peer already implies those browsers. | Native `showModal()` makes outside inert. Base UI and React Aria block outside interaction. Radix uses aria-hidden plus `react-remove-scroll` plus `pointer-events:none` on body. | Playwright: open with `dismissOnBackdrop={false}`, `page.mouse.click` on a page button; assert no click handler fired and `document.activeElement` is still in the panel. Iframe fixture: Tab past the iframe's last control, assert focus is in the panel. |
| M1 | M | The trap owns every Tab press and walks a light-DOM TreeWalker list (`useDialogBehavior.ts:37-47, 246-272`). This breaks native order: every radio in a group becomes a stop (native Tab visits only the checked radio); controls inside a shadow root are invisible to the walker, and `activeElement` retargets to the host, so `indexOf` returns -1 and focus jumps to the first item; positive `tabindex` is ignored. | Radix FocusScope and Floating UI/Base UI let the browser order Tab natively and wrap at the edges (Base UI and Floating UI use focus-guard sentinels; Radix intercepts Tab at the edge tabbables). | Spec: a radio group (3 radios, middle checked) plus a `<details>` and a web component with a shadow-root input. Tab sequence must equal Chromium's native order inside the panel and wrap at both ends. |
| M2 | M | Consumer widgets that portal to `body` (a Radix Select or Popover inside the sheet) aren't in the walker list, so Tab inside them snaps back to the panel's first item (`:262-265`). | Radix nests via DismissableLayer and FocusScope stacks. Base UI uses FloatingTree. | Spec: a fixture portals a listbox to body. Tab moves within it. Escape closes only the listbox. |
| M3 | M | No Title/Description parts, and `Labelled` (`types.ts:194-196`) forbids `aria-describedby` on Sheet: `SheetProps` has no index signature, so it's a type error (inferred from the types, not compiled). | Radix and Base UI ship `Dialog.Title` (h2) and `Dialog.Description` (p), auto-wired; Radix dev-warns when Title is missing. | Aria snapshot: `dialog "Contact" description "..."` via `toMatchAriaSnapshot`. |
| M4 | M | Focus always returns to the FAB (`Sheet.tsx:319`). A sheet opened programmatically from another control (a header "Contact" link, controlled `open`) drops the user at the bottom of the viewport. There is no override. APG: return focus to the invoking element. | Base UI `finalFocus` (ref, boolean, or function). Radix `onCloseAutoFocus` plus preventDefault. | Spec: open via an external button with controlled `open`, Escape, assert focus is on the external button. |
| M5 | M | `onOpenChange(open)` carries no reason, and an uncontrolled consumer can't veto (`Root.tsx:90-96`). There's no way to confirm unsaved changes before Escape closes, or to allow Escape but block swipe. | Base UI `onOpenChange(open, eventDetails)` with `reason` ∈ trigger-press, outside-press, escape-key, close-press… and `cancel()`. Radix uses per-cause callbacks (`onEscapeKeyDown`, `onPointerDownOutside`). | Unit test (vitest + RTL): each dismiss path reports its reason; `cancel()` keeps the sheet open. |
| M6 | M | Scroll lock is `body.style.overflow` only (`useDialogBehavior.ts:137-159`). Gaps: (a) fails when `html` is the scroller with its own `overflow`; (b) double-pads under consumer `scrollbar-gutter: stable`; (c) no ref-count, so two locks restore in the wrong order; (d) iOS Safari is unverified on device. | Base UI `useScrollLock` (locks html, accounts for scrollbar-gutter, iOS-specific path). Radix and vaul use `react-remove-scroll` (wheel/touchmove blocking plus gap compensation). | Specs with `html{overflow-y:scroll}` and `html{scrollbar-gutter:stable}` fixtures: assert `scrollY` unchanged after a wheel event and `document.body.getBoundingClientRect().width` unchanged ±0.5px. iOS: manual check on device (Sean's phone). |
| M7 | M | The fixed trigger can fully cover a focused page control (2.4.11 Focus Not Obscured, AA). A 96-144px disc pinned bottom-center sits over in-flow links. Nothing documents a mitigation. | Same class of failure as sticky headers and footers; the standard mitigation is `scroll-padding`. vaul and Radix have no FAB equivalent. | Playwright: tab through a long fixture page; for each focused element assert `!rectContains(triggerRect, el.rect)`, with `scroll-padding-bottom` applied per the README recipe. |
| m1 | m | The trigger stays exposed to AT while open (`useDialogBehavior.ts:168-179` deliberately keeps it). It's an invisible button under the sheet, still named "Open contact", that a VO/TalkBack swipe lands on. | Radix and Base UI hide everything outside the portal, the trigger included. | Aria snapshot while open: the only interactive nodes are inside `dialog`. |
| m2 | m | `<VistaSheet.Content>` decides whether it needs a tab stop only at mount and on window resize (`Content.tsx:34-42`), so an image that loads later leaves an unreachable overflow. The tab stop also has no role or name. Chrome 130+ makes scrollers focusable natively; Safari doesn't (inferred). | axe rule `scrollable-region-focusable`. | axe in a fixture where content grows after an image `load` event. |

### Link-preview card (APG Tooltip vs non-modal dialog; Radix HoverCard)

The current choice is right: the card is aria-hidden (`Sheet.tsx:335-337`), the link stays the accessible element, and focus opens the card with the hover delay. That matches Radix HoverCard ("intended for sighted users only… ignored by screen readers"). It is **not** a tooltip (no `role=tooltip`/`aria-describedby`, because it duplicates the destination rather than describing the link) and **not** a non-modal dialog (no interactive content). 1.4.13 is met: Escape dismisses it, it stays open while hovered thanks to the grace period (`LinkTrigger.tsx:191-216`), and it persists. The gaps:

| # | Sev | Finding | Verify |
| --- | --- | --- | --- |
| B5 | B | Escape inside a sheet closes both the card and the sheet (two document listeners, `useDialogBehavior.ts:237-245`). | Spec: a preview link inside a sheet; Escape once closes the card and the sheet stays open; Escape again closes the sheet. |
| m13 | m | Nothing enforces "no focusables inside" (README states it only, `README.md:718-722`). A link in the card becomes aria-hidden-but-focusable, which fails axe `aria-hidden-focus`. | Dev warning if `getTabbables(card).length > 0` at open; axe run with the card open. |
| m3 | m | A pointer-opened card stays open while the user Tabs elsewhere, and can cover the next focused link (2.4.11). Keyboard-opened cards already close on blur (`LinkTrigger.tsx:284-287`). | Spec: hover a link, then press Tab; assert the card closes on a `focusin` outside the link. |

### Trigger, gestures, media

| # | Sev | Finding | Reference approach | Verify |
| --- | --- | --- | --- | --- |
| B2 | B | No keyboard or single-pointer reposition (`Trigger.tsx:479-494`, `context.ts:161-180`). | vaul's drag-to-dismiss has a button alternative (Close/Escape); vista-sheet's swipe-dismiss already meets 2.5.7 the same way (Close is required, dev-warned at `Sheet.tsx:136-149`). The reposition gesture has no equivalent. | Keyboard spec: focus the trigger, ArrowRight moves bottom-center to bottom-right; assert the anchor changed, `onAnchorChange` fired, and the live region text. |
| B3 | B | Unpausable looping video (`Media.tsx:176-192`). BACKLOG 13 flagged it; still open (verified). | WCAG 2.2.2: a pause mechanism, or stop within 5s. | Spec: the trigger-side `video.paused === true` 5.5s after mount; the sheet-side MediaToggle flips `paused` and `aria-pressed`. |
| B4 | B | Required `aria-label` overrides visible text (`types.ts:179-180, 233`). | Radix and Base UI never require aria-label; they derive the name from content. | axe `label-content-name-mismatch` (experimental rule, enable explicitly) on rectangle triggers. |
| B6 | B | `asChild` is ignored against Root mode (`Trigger.tsx:64-70`). | Radix `asChild` = Slot prop-merge, mode-independent. | Unit: modal Root plus `asChild` logs a dev error and renders the button trigger. |
| M8 | M | No live announcement of a reposition (only drag exists today). The keyboard move needs one, or the result is silent for low-vision and SR users. | Not covered by the dialog libraries; dnd-kit and React Aria DnD announce moves via a live region (inferred from their docs, not fetched). | Covered by the B2 spec. |
| M9 | M | The README dark recipe omits `--vista-sheet-accent` (`README.md:490-497`). The default `#1d1d1f` ring on a dark page is about 1.1:1 against the page, so it fails 1.4.11 and the focus ring disappears. The example pages set it (`example/example.css:82,120`). | shadcn uses a `ring` token per theme. | Contrast check script: computed outline color vs page background ≥3:1 in each example palette. |

### Styles, platform, standards

| # | Sev | Finding | Verify |
| --- | --- | --- | --- |
| m4 | m | No `@media (forced-colors: active)` block. Shadows vanish, so the sheet and trigger edges rely on a 1px border, and a consumer setting `--vista-sheet-surface-border-width: 0` leaves no boundary. | `page.emulateMedia({ forcedColors: 'active' })` screenshots of trigger, sheet, focus ring. |
| m5 | m | No `prefers-contrast: more` handling; the default border `rgba(229,229,229,.6)` on `#fafafa` is about 1.1:1. That's decorative, but the only edge cue for an image-filled disc. | `emulateMedia({ contrast: 'more' })` (assuming Playwright 1.62 supports it). |
| m6 | m | `<button>` contains `<div>`s: TriggerSurface `as="div"` (`Trigger.tsx:690-697`), Shared `motion.div` (`Shared.tsx:30`), Media wrapper div (`Media.tsx:169`). The HTML content model allows only phrasing content. It renders fine but fails validation. | `html-validate` on the rendered DOM snapshot. |
| m7 | m | `<style>` renders in body (`Root.tsx:406`), which is non-conforming. React 19 hoists it to `<head>` when given `href` plus `precedence`, but ignores later prop changes, so `href` must encode the CSS (the React docs' example does this). | DOM assert: no `style` element under `[data-vista-sheet-root]`. |
| m8 | m | Conditional hook: `id ?? useId()` (`Root.tsx:78`). Toggling `id` between defined and undefined changes hook order and crashes. | Unit: rerender with `id` then without, expect no throw. |
| m9 | m | 1.4.12 Text Spacing: a rectangle trigger with `buttonWidth` clips its label (`styles.module.css:534-538`). | Inject the WCAG text-spacing stylesheet; assert `label.scrollWidth <= clientWidth`. |
| m10 | m | `reduceMotion={false}` overrides the OS preference silently (`Root.tsx:136-137`). | README note plus a dev warning when the prop is `false` and the media query matches. |
| m11 | m | iOS soft keyboard covers a bottom-anchored sheet when `initialFocus` targets an input (the sheet is fixed to the layout viewport). | Manual check on iOS. vaul repositions inputs via `visualViewport`. |
| m12 | m | SSR with `defaultOpen` computes placement for 1440×900 (`Sheet.tsx:230-231`), so the sheet jumps on hydrate and React logs a mismatch warning. BACKLOG 14 B2 already records this. | Existing `default-open.spec.ts` plus a hydration-warning console assert. |

### Checked and passing (verified by reading code)

- Trigger semantics: real `<button type="button">` with `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` only while open (`Trigger.tsx:669-688`). The dialog has `role`, `aria-modal`, `tabIndex=-1` (`Sheet.tsx:335-336`).
- Target size 2.5.8 passes: the trigger's hit area extends to ≥48px (`styles.module.css:62-68`) and Close is ≥44px (`:356-369`).
- Reduced motion is honoured: the morph becomes a crossfade, drag and swipe are off, the video holds its poster, and hover lift is off (`Sheet.tsx:339-346, 363`; `Media.tsx:161-165`; CSS `:not([data-vista-sheet-reduce-motion])`).
- Reflow at 320px passes: the sheet is `min(480px, 100vw-32px)` wide, its max height derives from `dvh`, and Content scrolls (`anchors.ts:263-285`).
- RTL needs no change: anchors are physical by design, a user-dragged spot shouldn't mirror, the hit area already uses logical `inset-inline`, and arrow keys must map physically to match.
- Swipe-to-dismiss meets 2.5.7 because Close and Escape exist.
- Focus restore after drag-activation is fixed (`Trigger.tsx:113-122`).

### BACKLOG staleness (verified against code)

- **BACKLOG:172-174 is stale.** The trap now owns every Tab and no longer leaks. Background aria-hiding exists, and so does scrollbar compensation. Close all three, but note B1/M1/M6 supersede them.
- **BACKLOG 13 is partly stale.** "Drag eats next activation" is fixed (`Trigger.tsx:113-122, 564-574`). "No non-drag reposition / setAnchor not public" is still open (= B2), and so is "looping trigger video unpausable" (= B3).

---

## Fix plan

### P0: before publish (8 items)

1. **Inert background plus focus guards** (B1, M1, M2). This is a rewrite of `useDialogBehavior.ts`.
   - Replace `hideOutsideSiblings` with `inertOutside(panel)`. It sets `inert` on every sibling of each ancestor from the **panel** up to `body`, which covers the trigger's wrapper and the backdrop too (fixes m1). It restores prior values the same way the current function does.
   - Skip nodes that already carry `inert` and `[aria-live]` regions, so toasts keep announcing (assumption A3).
   - Delete per-press Tab ownership (`:246-272`) and `getTabbables`/`isTabbable`.
   - Render two `<span tabIndex={0} data-vista-sheet-focus-guard aria-hidden>` sentinels in `Sheet.tsx`, as the panel's first and last children. On focus, the start guard moves to the last tabbable and the end guard to the first (Base UI/Floating UI pattern). A light-DOM tabbable query is still needed here, at the guards only, so it can never misroute mid-panel.
   - The click-catcher always renders when modal. `dismissOnBackdrop` now gates only its `onClick`.
   - **Ordering trap:** in `onExitComplete` (`Sheet.tsx:318-326`) the background must be un-inerted **before** `finalFocus.focus()`, because focusing an inert trigger fails silently. Release synchronously inside the handler (call the restore function directly, don't wait for the `setIsPresent(false)` re-render).
2. **Dismiss-layer stack** (B5). Add `src/dismissLayers.ts`: a module-level array that both modal and preview surfaces push and pop on present, plus one document `keydown` listener.
   - Escape goes only to the top layer, and is ignored when `e.defaultPrevented || e.isComposing || e.keyCode === 229`.
   - It replaces the Escape branch at `useDialogBehavior.ts:239-245`. Modal Roots push too, so nested sheets work by construction.
3. **Keyboard reposition, public `setAnchor`, announcement** (B2, M8).
   - In `Trigger.tsx` `handleKeyDown`, Arrow keys move to the adjacent anchor through a pure `adjacentAnchor(anchor, key)` function in `anchors.ts`. Left/Right move within the row. Up/Down step bottom-center → center → top-center; corners move top↔bottom.
   - Arrows only act when `draggable && !open`, and they `preventDefault`. They reuse the existing snap animation.
   - Add `setAnchor` to `VistaSheetState` and `useVistaSheet()` (`context.ts:161-180`; additive).
   - Root renders a visually-hidden `<span role="status" aria-live="polite">` inside its wrapper and writes "Moved to bottom right." on keyboard and programmatic moves, not during pointer drags (too chatty). The text comes from the new Root prop `anchorAnnouncement?: (a: AnchorId) => string | false` (additive; English default).
   - Apply Sean's decision 1 on the `draggable` default.
4. **Video 2.2.2** (B3). In `Media.tsx`, when `slot === "trigger"`: drop `loop`, add an `ended`/`timeupdate` stop at ≤5s, return to the poster, and replay on hover or focus of the trigger.
   - Add a `<VistaSheet.MediaToggle aria-label?>` part (additive) that toggles the sheet-side video and reflects `aria-pressed`.
   - Dev-warn when a sheet-side `src` video mounts with no toggle registered (same pattern as `registerClose`).
5. **Label in Name** (B4). Make `aria-label` optional on `TriggerProps` and `CloseProps` (additive: loosening).
   - Dev check at mount: if the button's computed name is empty (`!el.textContent.trim() && !aria-label && !aria-labelledby`), log an error.
   - Keep the README examples on icon-only buttons with `aria-label`.
6. **`asChild` guard** (B6). `Trigger` branches on `ctx.preview`, not on `props.asChild`. On a mismatch it logs a dev error and renders the mode-correct trigger.
7. **axe gate.** Add `@axe-core/playwright` as a devDependency (free, MIT). Add `example/axe.spec.ts`, which runs axe (tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`, plus rule `label-content-name-mismatch`) on every example page in three states: closed, open-settled, preview-open. Wire it into `prepublishOnly` via `test:geometry`, which already runs all `*.spec.ts`.
8. **Docs.** Replace README "Known gap" (`README.md:724-726`) with the new model. Add `--vista-sheet-accent` to the dark recipe (M9). Add a 2.4.11 `scroll-padding` recipe (M7: package-side, docs only, by decision). Document the arrow keys and the "Move" menu recipe.

### P1 (9 items)

1. **`<VistaSheet.Title>` / `<VistaSheet.Description>`** (M3). They render `h2`/`p`, take a `className`, get their ids from `idBase`, and register in context. Sheet sets `aria-labelledby`/`aria-describedby` automatically.
   - `Labelled` becomes `{aria-label} | {aria-labelledby} | {}` (additive: loosening). A runtime dev error fires if the sheet opens with no name source.
   - `aria-describedby` is accepted on Sheet.
2. **`finalFocus` on Sheet** (M4): `RefObject<HTMLElement|null> | false`, additive.
   - The default changes to "the element focused at open, if it's still connected and not body/inert, else the trigger". This matches APG and Base UI. It's a **behaviour change**, free before publish.
   - Safari doesn't focus buttons on click, so the fallback keeps FAB behaviour identical there.
3. **`onOpenChange(open, details)`** (M5), with `details = { reason: 'trigger-press' | 'close-press' | 'escape-key' | 'outside-press' | 'swipe' | 'imperative', event?: Event, cancel(): void }`. Additive (second argument). `cancel()` short-circuits `setOpen` in `Root.tsx:90-96`.
4. **Scroll lock rewrite** (M6). Add `src/scrollLock.ts`: a ref-counted module singleton.
   - It locks `document.documentElement` (`overflow:hidden`) and pads only when `getComputedStyle(html).scrollbarGutter` is not `stable`.
   - Keep the body padding fallback.
   - iOS: verify on device first; add the `position:fixed; top:-scrollY` body path only if the device check fails (assumption A5).
5. **Content tab stop** (m2). Swap the window `resize` for a `ResizeObserver` on the content element and its first child. Give the scroller `role="region"` plus `aria-labelledby` pointing at the Title when one exists.
6. **Pointer-opened preview closes on outside `focusin`** (m3) in `LinkTrigger.tsx`.
7. **Preview dev warning for tabbables in the card** (m13).
8. **Contrast check for the focus ring** (M9) per palette in `example/`: a script over the computed outline color versus `body` background.
9. **2.4.11 spec** (M7) as described in the findings table.

### P2 (11 items)

- **Forced-colors block** (m4): `.triggerSurface, .sheet { border: 1px solid CanvasText }` and focus outlines in `Highlight`, under `@media (forced-colors: active)`.
- **Prefers-contrast block** (m5): raise `--vista-sheet-surface-border` to an opaque `#8e8e93`-class value. That value is a design token, so Sean dials it.
- **Spans not divs inside the button** (m6): TriggerSurface `as="span"`; Shared renders `motion.span` when `slot === "trigger"`; Media wrapper becomes a span on the trigger side. All keep `display:block` from the CSS module.
- **Hoist the size `<style>`** (m7) with `href={"vista-sheet-size-" + idBase + "-" + hash(triggerSizeCss)}` and `precedence="vista-sheet"`. Inferred safe; verify SSR plus the geometry suite, because the D3 first-paint fix depends on this rule being present at first paint.
- **Unconditional `useId()`** (m8): `const generated = useId(); const idBase = id ?? generated`.
- **Let the label wrap or ellipsize** (m9) when `buttonWidth` is set. Design call: strawman is ellipsis plus the full text as the accessible name.
- **Dev warning on `reduceMotion={false}`** (m10) while the OS asks for reduce.
- **`visualViewport` reposition** (m11) for bottom-anchored sheets while an input is focused (vaul pattern).
- **SSR placement** (m12): render the open sheet hidden until the layout effect measures, or ship a CSS-only placement fallback. Shared with BACKLOG 14.
- **Spike: `popover="manual"` (top layer) for the preview card only.** The card's morph partner is the transparent link surface, so cross-layer z-order doesn't matter there. Ship only if it removes the z-index/stacking-context class of bug.
- **Re-run the full manual screen-reader matrix** after P1.

### Native `<dialog>` / `showModal()` / top layer: decided **no for v1**

- The close morph needs the trigger to paint **above** the sheet (`styles.module.css:31-33`, z+103). Nothing outside the top layer can paint above it.
- `<VistaSheet.Shadow>` must paint between page and sheet. In the top layer it would have to move inside the dialog, which rewrites the one-painter model (DESIGN.md §4.1).
- `inert` plus guards gives the same AT and keyboard outcome (`showModal` mainly provides inert background and a focus scope) without moving the morph's paint order.
- Revisit if Motion projection plus the top layer is ever proven safe for both paint partners.

### Portal

The modal stays in-tree (`Layer.tsx:9`). A consumer ancestor with `transform`, `filter` or `contain` traps the fixed sheet's z-index under the page's own headers, which can obscure focused controls (2.4.11). Plan: P2 docs warning now. An additive `portal` prop only if a real consumer hits it, because portaling breaks theme-var inheritance from Root's `className` (preview mode already moves `className` onto the layer for this reason, `Root.tsx:384-394`).

---

## API changes

| Change | Phase | Breaking? |
| --- | --- | --- |
| `useVistaSheet().setAnchor` | P0 | Additive |
| Root `anchorAnnouncement?: (a) => string \| false` | P0 | Additive |
| Root `draggable` default `true` → `false` (if Sean picks it) | P0 | **Breaking** (pre-publish, free) |
| `<VistaSheet.MediaToggle>` | P0 | Additive |
| Trigger/Close `aria-label` required → optional | P0 | Additive (loosening) |
| Trigger mode follows Root, not `asChild` | P0 | Behaviour fix |
| Background `inert` replaces `aria-hidden`; Tab no longer owned per press | P0 | Behaviour change (DOM: `inert` attrs, guard spans as first/last panel children; consumer `:first-child` selectors inside Sheet shift) |
| `<VistaSheet.Title>`, `<VistaSheet.Description>`; `Labelled` loosened; Sheet accepts `aria-describedby` | P1 | Additive |
| Sheet `finalFocus`; default return-to-invoker | P1 | Additive prop, **default behaviour change** |
| `onOpenChange(open, details)` with `reason`, `cancel()` | P1 | Additive |
| Trigger-side `<span>` instead of `<div>` | P2 | Non-breaking unless consumer CSS targets `div` |

`initialFocus` already exists (`types.ts:218`) and stays a ref. Base UI's function form `(openType) => …` is skipped until someone asks for it.

## Test strategy

Everything runs headless in the existing Playwright config (Chromium project; add a WebKit project for the a11y specs only, since that's where Safari quirks live). Run against the scratchpad temp config on :5180, per ORCHESTRATOR "Fragile".

- **axe-core** (`example/axe.spec.ts`): every page × {closed, open-settled, preview-open} × {default, `reducedMotion: 'reduce'`, `forcedColors: 'active'`}. It fails on any violation, with no baseline file, because the package is pre-publish.
- **Keyboard scripts** (extend `example/focus.spec.ts`):
  - Tab order equals the native order (radio, details, shadow-root, iframe fixtures).
  - Wraps at both ends; Shift+Tab from the first item goes to the last.
  - Escape layering with a nested preview card and a Select-like listbox.
  - Arrow-key reposition for all 7 anchors plus the live-region text.
  - Focus return to the trigger and to an external invoker.
  - IME: Escape with `isComposing` must not close (via `page.dispatchEvent` on a `KeyboardEvent` with `isComposing: true`).
- **Pointer modal check:** with `dismissOnBackdrop={false}`, clicks on background controls do nothing.
- **Aria snapshots** (`toMatchAriaSnapshot`, Playwright ≥1.49; installed is 1.62) for closed, open and preview: name, role, `expanded`, description, no interactive nodes outside `dialog` while open.
- **Emulation:** `emulateMedia({ reducedMotion: 'reduce' })` (already used in `a11y.spec.ts:237`), `forcedColors: 'active'` screenshots, `contrast: 'more'`.
- **Zoom/reflow:** 320×256 viewport (1280×1024 at 400%). Assert no horizontal scroll, the sheet fits, and the Content scroller is reachable by keyboard.
- **Text spacing:** inject the WCAG 1.4.12 stylesheet; no clipped labels.
- **Unit (vitest + RTL, jsdom):** `adjacentAnchor` table, `dismissLayers` ordering, `scrollLock` ref-count, `onOpenChange` reasons, conditional-`useId` regression.
- **Manual screen-reader checks** before tagging 1.0, about 30 minutes each:
  - VoiceOver plus Safari on macOS.
  - VoiceOver plus Safari on iOS: swipe can't leave the dialog, Close is reachable, the scrub gesture behaves, the keyboard doesn't cover an `initialFocus` input.
  - NVDA plus Firefox, if a Windows machine or VM is available (A6).

## Assumptions

- **A1.** Browser floor is "evergreen with `inert`" (Safari ≥15.5), as the React 19 peer implies. Not stated in README; it should be.
- **A2.** One modal sheet open at a time is the normal case, but the layer stack makes nesting correct regardless.
- **A3.** Skipping `[aria-live]` nodes when inerting is correct for toasts. Inferred from how libraries handle it; not checked against Radix's `aria-hidden` package source.
- **A4.** Repositioning the FAB counts as "functionality" under 2.5.7 and 2.1.1. A lenient reading (it's a preference, not a function) would downgrade B2 to major. The plan takes the conservative reading.
- **A5.** iOS Safari ≥16 honours `overflow:hidden` on html/body for touch scroll. Not verified on device; P1 item 4 is gated on that check.
- **A6.** Sean has no Windows machine for NVDA. If true, the manual matrix is macOS and iOS only, with axe plus aria snapshots as the cross-platform proxy.
- **A7.** `emulateMedia({ contrast })` is supported in Playwright 1.62. Not checked against its changelog.
- **A8.** The `dismissOnBackdrop={false}` click-through has not been run in a browser. It follows from `Sheet.tsx:305` rendering no catcher and no other pointer blocking in the CSS.

## Sources

- APG Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- APG Tooltip: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- WCAG 2.5.7 Dragging Movements (keyboard alone insufficient): https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- WCAG 2.2.2 Pause, Stop, Hide: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- WCAG 2.4.11 Focus Not Obscured: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- WCAG 2.5.3 Label in Name: https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html
- Base UI Dialog (`initialFocus`, `finalFocus`, `modal: 'trap-focus'`, `onOpenChange` `eventDetails.reason`, Title/Description, nested): https://base-ui.com/react/components/dialog
- Radix Dialog (`onOpenAutoFocus`/`onCloseAutoFocus`/`onEscapeKeyDown`, Title/Description): https://www.radix-ui.com/primitives/docs/components/dialog
- Radix HoverCard ("sighted users only… ignored by screen readers"): https://www.radix-ui.com/primitives/docs/components/hover-card
- React Aria useModalOverlay (blocks outside interaction, `isKeyboardDismissDisabled`): https://react-aria.adobe.com/Modal/useModalOverlay
- vaul: https://vaul.emilkowal.ski/
- MDN `inert`: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert
- React 19 `<style href precedence>` hoisting: https://react.dev/reference/react-dom/components/style
- Playwright accessibility testing (axe): https://playwright.dev/docs/accessibility-testing
