# vista-sheet a11y + web standards: revised plan

Revises `a11y-web-standards-draft.md` against `a11y-web-standards-refutation.md` (F1-F29).
- Code refs are to `canvas` HEAD `cdb35d7`; `src/` is unchanged since `8090664` (`git diff --stat 8090664 HEAD -- src` is empty).
- BACKLOG refs are to the regrouped 104-line file.
- "Verified" means read or run this session. "Inferred" means reasoned, not run.

**Answer.** The refutation was right on every substantive point: 29 of 29 findings accepted. Two fixes are my own: F3 and F19's sub-point (b), where I reject adding an AT hint. One deliberate deviation: the page leaves inert at the close request, not at exit-complete (see P0-1).

**Release gate** (the 0.2 / final publish; 0.1.1 stays as BACKLOG 35 defines it):
- **Blocks the final publish (P0):** 7 items. They clear both remaining Level-A failures (keyboard-only move, autoplaying video) and the modal-contract majors.
- **Ship after the final publish:** P1 has 8 items, P2 has 6.

## Decisions for Sean (strawman applied in the plan)

1. **How a mouse or touch user moves the trigger without dragging (WCAG 2.5.7).** The page tagline sells "a draggable trigger" (`README.md:3`), and dragging is also how a pointer user clears a disc that covers content. So drag stays on by default either way.
   - **A (applied): the package adds keyboard moves and a public `setAnchor`.** The README ships a copy-paste "Move" menu recipe. Strict 2.5.7 conformance then depends on the site rendering that menu, and the README says so.
   - **B: the package ships its own tap-to-move affordance.** For example, long-press the trigger and the 7 anchor spots appear as tap targets. Conformant out of the box, but it's new UI for you to design.
   - **Recommendation:** A for the final publish, and B goes to BACKLOG as a design brief. A unblocks the release without inventing UI under time pressure.
2. **Pause control for the sheet's video.** Your accepted fork (BACKLOG.md:14) puts the poster at rest and plays the video while the sheet is open. The open sheet then loops a video next to text. Strawman applied: no pause button, because Close and Escape count as the "hide" in WCAG 2.2.2 ("Pause, Stop, or Hide") for content the user chose to open. A pause/play recipe goes in the README (P2). Fork: a built-in pause control part instead. That's new UI, so it's your call.
3. **High-contrast border colour.** Under the OS "increase contrast" setting the sheet and trigger edge is about 1.1:1. Strawman: an opaque mid-grey border token (`#8e8e93`-class) applies only under `prefers-contrast: more`. Fork: the exact value, which is yours to dial on the canvas (P2).

## Browser floor (state it in README)

- **Supported:** Safari / iOS Safari 16.2+, Chrome / Edge 111+, Firefox 113+.
- **What sets the floor:** the shipped CSS already uses `color-mix()` (`styles.module.css:168`), so the floor exists today. `inert` (Safari 15.5, Chrome 102, Firefox 112) fits under it.
- **Correction:** the draft's "React 19 implies the floor" was wrong (F27).
- `corner-shape` stays progressive.

---

## Findings ledger (F1-F29)

| F | Verdict | Change |
| --- | --- | --- |
| F1 | **Accepted.** Verified: six reopen-mid-close specs click the trigger mid-exit (`geometry.spec.ts:473-482, 734, 1139, 1909`, `buttons.spec.ts:537`, `media.spec.ts:335`). | P0-1: inert keys on `open`, not `isPresent`. The trigger wrapper and the page are both released at the close request. Gate: all six specs plus (l). |
| F2 | **Accepted.** | The backdrop is never inerted (it's on the panel's keep path). |
| F3 | **Accepted, with a different fix.** Verified: `focus.spec.ts:142-144` needs a single Tab to reach Close. | Guards become **siblings outside the panel**, not children. Tab from the focused panel then reaches its first child natively. Routing uses `relatedTarget`: the start guard sends focus to the last tabbable if focus came from inside the panel, otherwise to the first; the end guard is the mirror. No keydown branch is needed. |
| F4 | **Accepted.** | M3 narrows to Title/Description parts only. Loosening `Labelled` for `aria-describedby` is dropped. Confirmed by the new type gate (P0-6). |
| F5 | **Accepted.** | B4 becomes a major (P1). Close gets a default name "Close", so its `aria-label` becomes optional. Trigger keeps `aria-label` required (most discs are icon or image only), and README adds the rule "the label must contain any visible text". |
| F6 | **Accepted.** | The `textContent` mount check is dropped. The axe rule (P0-5) covers mismatches in the examples. |
| F7 | **Accepted.** | Severity drops to minor (P1). On a mode mismatch: dev error, and the child renders unwrapped. Never a `<a>` inside `<button>`. |
| F8 | **Accepted.** Verified at BACKLOG.md:14 and :18. | P0-4 implements the accepted fork: poster at rest, plays while open. The draft's 5s-cap strawman is gone. |
| F9 | **Accepted.** | B1 becomes a major. It stays in the release gate: it makes the README's modal claim true, and `README.md:724-726` "Known gap" gets rewritten. |
| F10 | **Accepted.** | The native `<dialog>` rationale now leads with the decisive reason (below). |
| F11 | **Accepted.** | P0-1 uses keep-path walking (React Aria's model; the refuter's citation, not fetched by me). |
| F12 | **Accepted.** Verified: the snap is inline at `Trigger.tsx:549-551`, and the anchor layout effect jumps x/y at `:167-178`. | P0-3 extracts `snapTo(anchor)`. Public `setAnchor` routes through it, and a geometry assertion is added. |
| F13 | **Accepted.** | `draggable=false` is no longer recommended. It's Decision 1, as a product call. |
| F14 | **Accepted.** | The default focus-return change is dropped. P1 adds an explicit `finalFocus` ref prop (Base UI naming); the default stays "the trigger". |
| F15 | **Accepted.** | The axe config is fixed (P0-5): two passes plus a red-proof fixture. |
| F16 | **Accepted.** | "Release gate" means the final publish, not 0.1.1. |
| F17 | **Accepted.** | The WebKit project is dropped; the cross-browser branch owns it (BACKLOG.md:22). |
| F18 | **Accepted.** | P0-6 adds a scoped type gate. Bare `tsc` stays broken per L145 and is out of scope. |
| F19 | **(a), (c), (d), (e) accepted. (b) rejected.** | (a) The Escape listener is pinned to document **bubble** phase. (c) The README recipe pairs `scroll-padding-bottom` with page bottom padding equal to the trigger box. (d) README gets one line on the Android back gesture. (e) Restore functions are idempotent through a `released` flag. **(b) rejected:** `aria-keyshortcuts` is for keys that activate or focus an element, not ones that move it, and SR users in browse mode don't receive arrow keys. The arrow keys are documented in README instead. |
| F20 | **Accepted.** | Today's `dismissOnBackdrop` gating stays. |
| F21 | **Accepted.** | `MediaToggle` and its registry are cut. A recipe goes in P2 (Decision 2). |
| F22 | **Accepted.** | Scroll-lock fixes go inline in the existing effect. No module, no ref count. |
| F23 | **Accepted.** | axe scope: shipping pages only, default plus reduced motion. Forced colors gets screenshots only. |
| F24 | **Accepted.** | `<style>` hoisting goes to BACKLOG. The popover spike is cut. |
| F25 | **Agreed.** | `dismissLayers.ts` stays. |
| F26 | **Accepted.** | BACKLOG refs are re-cited against the current file. Old items 172-174 are already archived. |
| F27 | **Accepted.** | The browser floor is stated explicitly. Paint-order-only reasoning is replaced by spec gates. |
| F28 | **Accepted.** | No RTL dependency. Units match `LinkTrigger.test.tsx:1-6` (jsdom + `createRoot` + `act`); pure functions use plain vitest. |
| F29 | **Accepted.** | Guard placement is now justified by our own spec (`focus.spec.ts:142`), not by a library citation. My Floating UI docs fetch was ambiguous on whether guards sit inside or outside the floating element. A3 is replaced by keep-path walking. |

**Revised severities:**
- **Blockers:** B2 (keyboard move, 2.1.1 A) and B3 (autoplay video, 2.2.2 A).
- **Majors:** B1, B4, B5, M1-M9.
- **Minors:** B6 and m1-m13; m7 moves to BACKLOG.

---

## P0: blocks the final publish (7)

1. **The sheet behaves like a real modal: the page behind it can't be clicked or tabbed into, and reopen-mid-close keeps working** (B1, M1, M2, m1). This rewrites `useDialogBehavior.ts`.
   - **Inert window = `open`.** On open, walk up from each **keep node** to `body` and set `inert` on every sibling that isn't on a keep path. Keep nodes are the panel, the two guards, the backdrop, and every `[aria-live]` / `[role=status|alert|log]` present at open. The trigger wrapper and the rest of the page go inert.
   - **Release at the close request.** The inert effect's cleanup runs when `open` flips false. That's the same render the backdrop unmounts in (`Sheet.tsx:305`), so the trigger is tappable from the first close frame (F1) and the page stays as pointer-live mid-close as it is today.
   - **Deviation from the refuter, on purpose.** The refuter keeps the page inert through `isPresent`. That would swallow page clicks for about 640ms, which is a regression against today, because the backdrop is already gone at the request.
   - **Guards and scroll lock still run until exit-complete (`isPresent`),** so Tab mid-close stays in the panel (`focus.spec.ts:184`).
   - **Focus guards.** Two `<span tabIndex={0} aria-hidden data-vista-sheet-focus-guard>` render as siblings immediately before and after `AnimatePresence` in `Sheet.tsx`, only when `modal && isPresent`. They route on `relatedTarget` (F3 row).
   - **Delete per-press Tab ownership** (`useDialogBehavior.ts:246-272`). Keep `getTabbables` only for guard routing (first and last item).
   - **Focus restore at exit-complete** (`Sheet.tsx:319`): only if `document.activeElement` is the body or inside the panel, so a page control the user clicked mid-close keeps its focus. With inert released at the request, the draft's ordering trap disappears.
   - **Restore functions are idempotent** (F19e).
   - **Gate:** existing `geometry` (l), (n), (n-shape), (p3), `buttons:537`, `media:335`, and the whole `focus.spec.ts`. New tests: with `dismissOnBackdrop={false}`, a click on a page button does nothing while open; an iframe fixture can't take focus out; radio-group, `<details>` and shadow-root Tab order matches native; a portaled listbox inside the sheet stays Tab-navigable; a toast `[aria-live]` stays live and clickable.
2. **Escape closes only the top-most layer, and never interrupts typing** (B5). New `src/dismissLayers.ts`: a module array that modal and preview Roots push to while present, plus one document keydown listener in **bubble** phase.
   - Escape goes to the top layer only. It's ignored when `defaultPrevented`, `isComposing` or `keyCode === 229`.
   - It replaces `useDialogBehavior.ts:239-245`.
   - **Gate:** a preview link inside a sheet takes two Escapes to close both; a composition Escape doesn't close; a listbox that calls preventDefault on Escape keeps the sheet open.
3. **Keyboard users can move the trigger, and the move animates like a drag** (B2, M8, F12).
   - Extract `snapTo(anchor)` from `handleDragEnd` (`Trigger.tsx:543-551`). It sets the anchor, then runs the spring, or seats the trigger directly under reduced motion.
   - Pure `adjacentAnchor(anchor, key)` in `anchors.ts`. Left/Right move within the row. Up/Down step bottom-center ↔ center ↔ top-center, and corners move top ↔ bottom. Arrows are physical, so RTL is the same.
   - Arrow keys work on the trigger when `draggable && !open`, with `preventDefault`.
   - `useVistaSheet().setAnchor` becomes public (additive) and routes through `snapTo` via a ref Trigger registers in context. It never goes through the jumping layout effect.
   - Root renders a visually hidden `role="status"` span and writes "Moved to bottom right." on keyboard and programmatic moves, never during drags.
   - New Root prop `anchorAnnouncement?: (a) => string | false` (additive) for translation.
   - **Gate:** Playwright, for all 7 anchors via arrows. Asserts the anchor, `onAnchorChange`, the live text, and a geometry check that wrapper, surface and Shadow centres agree within the existing (n) tolerance through the move.
4. **The trigger's video shows its poster until the sheet opens, then plays** (B3; Sean's accepted fork, BACKLOG.md:14).
   - In `Media.tsx` the trigger-side `<video>` keeps its element (spec selectors at `media.spec.ts:299, 425` stay valid) but drops `autoPlay`/`loop`, uses `preload="none"`, and stays paused on `poster`.
   - The sheet side keeps autoplay and loop. Reduced motion is unchanged.
   - Rewrite `media.spec.ts:419-440` ("trigger video autoplays") to assert the trigger is paused and the sheet is playing. Check `canvas-autoplay.spec.ts` for the same assumption.
   - **Known visual seam:** on close the sheet's frame N morphs into the trigger's poster (frame 0). This is the existing "no playback handoff" strawman (`Media.tsx:30-32`).
5. **An accessibility scanner runs before every publish** (F15, F23).
   - Add `@axe-core/playwright` (free, MIT) and `example/axe.spec.ts`.
   - **Pages:** index, contact, buttons, list, media-card, video, link-preview, flagship. Not canvas, play, tune or surface.
   - **States:** closed, open-settled, preview-open, each in default and `reducedMotion: 'reduce'`.
   - **Pass 1:** `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`.
   - **Pass 2:** a separate builder, `.withRules(['label-content-name-mismatch'])`, because the last `runOnly` wins.
   - **Red-proof fixture:** a trigger whose `aria-label` doesn't contain its visible text **must fail** pass 2. If it doesn't, switch pass 2 to `.options({ rules: { 'label-content-name-mismatch': { enabled: true } } })` and re-prove.
   - Runs inside `test:geometry`, which is already in `prepublishOnly`. Fails on any violation.
6. **Type gate for the public types** (F18).
   - Add `tsconfig.types.json`, extending `tsconfig.json`, including `src/**/*.ts(x)` and `src/types.test-d.tsx`, excluding `*.test.ts(x)` (keeps L145 out of scope).
   - Add `"typecheck": "tsc -p tsconfig.types.json"`, run first in `prepublishOnly`.
   - Add `@ts-expect-error` cases for: Trigger `aria-label` still required; `asChild` without a preview Root (if it's typeable; otherwise runtime only); `aria-describedby` accepted on Sheet (F4 proof).
7. **Docs match behaviour.**
   - README "Accessibility": rewrite `README.md:724-726`, add the browser floor, arrow keys, and the "Move" menu recipe (Decision 1).
   - Add `--vista-sheet-accent` to the dark recipe (M9).
   - Add the 2.4.11 recipe: `scroll-padding-bottom` plus bottom padding.
   - Add the Label-in-Name rule and the Android back-gesture line.
   - BACKLOG: tick 13's reposition/video items when they land.

## P1: after the final publish (8)

1. **Screen readers hear a title and description automatically** (M3). New `<VistaSheet.Title>` (h2) and `<VistaSheet.Description>` (p). They register ids, Sheet sets `aria-labelledby`/`aria-describedby`, and there's a dev error if the sheet opens with no name. `Labelled` gains a third arm, `{}` (additive).
2. **Focus can return to whatever opened the sheet** (M4). Sheet `finalFocus?: RefObject<HTMLElement|null>`, additive. The default stays the trigger.
3. **Sites can tell why the sheet is closing and veto it** (M5): `onOpenChange(open, { reason, event?, cancel() })`, additive. Reasons: `trigger-press | close-press | escape-key | outside-press | swipe | imperative`.
4. **The page doesn't scroll or shift under the sheet on more sites** (M6). This is inline in the existing effect. Lock `html` as well as `body`, and skip padding when `scrollbar-gutter: stable`. iOS: verify on device first, and add the `position:fixed` body path only if that check fails.
5. **Close is named "Close" by default and labels match visible text** (B4 revised). `CloseProps['aria-label']` becomes optional with default "Close" (additive).
6. **`asChild` misuse fails loudly instead of silently** (B6). Dev error, and the child renders unwrapped.
7. **Long sheets are always keyboard-scrollable** (m2). `<VistaSheet.Content>` uses a ResizeObserver instead of window resize, and gets `role="region"` plus `aria-labelledby` the Title.
8. **The preview card closes when you Tab away, and warns if it contains links** (m3, m13).

## P2: after the final publish (6)

- **Windows High Contrast keeps every edge visible** (m4): a forced-colors block that sets `border: 1px solid CanvasText` on the surface and sheet, plus `Highlight` focus rings.
- **"Increase contrast" gets a stronger border** (m5, Decision 3).
- **Valid HTML inside the trigger button** (m6): spans instead of divs on the trigger side.
- **Small correctness fixes** (m8, m10). Unconditional `useId()` (`Root.tsx:78`). Dev warning when `reduceMotion={false}` overrides the OS setting.
- **Rectangle labels with `buttonWidth` don't clip under text-spacing overrides** (m9). Strawman: ellipsis.
- **The iOS keyboard doesn't cover an input in a bottom sheet** (m11): a `visualViewport` reposition. Also the pause/play recipe for sheet video (Decision 2).

BACKLOG, not planned: m7 `<style>` hoisting (risks the D3 first-paint fix, and React may leak rules on `triggerSize` change; inferred). m12 SSR placement is already BACKLOG 14 B2. A `portal` prop waits until a consumer needs it.

## Native `<dialog>` / top layer: no for v1

- **The decisive reason (F10):** `showModal()` inerts the trigger for as long as the dialog is open. Calling `close()` at the close request would drop the sheet out of the top layer mid-morph, unless `overlay` plus `transition-behavior: allow-discrete` is used, and that is Chromium-only. Either way reopen-mid-close breaks.
- **Secondary reason:** `<VistaSheet.Shadow>` would have to move inside the dialog, which breaks the one-painter model (DESIGN.md §4.1).

## Tests (all headless; Chromium only, since the cross-browser branch owns WebKit and Firefox)

- **Playwright:** P0-1/2/3/4 gates above, plus the axe spec (P0-5). Run via the scratchpad temp config on :5180 (ORCHESTRATOR "Fragile").
- **Emulation:** reduced motion inside axe. Forced colors and `contrast: 'more'` are screenshot specs (P2); `contrast` support in Playwright 1.62 is unchecked, so confirm before writing that spec.
- **Unit (vitest):** plain tests for the `adjacentAnchor` table. Tests for `dismissLayers` ordering and `onOpenChange` reasons follow `LinkTrigger.test.tsx` (`// @vitest-environment jsdom`, `createRoot`, `act`).
- **Manual, before the final publish:** VoiceOver + Safari on macOS and on iOS. Check you can't swipe out of the dialog, Close is reachable, and the move announcement is heard. NVDA only if a Windows VM exists.

## Assumptions

- **A1.** The browser floor above is acceptable to Sean. It's already de facto, because of `color-mix`.
- **A2.** Releasing the page from inert at the close request is preferable to holding it through the close, since it matches today's pointer behaviour.
- **A3.** iOS 16.2+ honours `overflow:hidden` for touch scroll. Unverified on device; P1-4 is gated on that check.
- **A4.** Repositioning counts as "functionality" under 2.1.1 and 2.5.7 (the conservative reading).
