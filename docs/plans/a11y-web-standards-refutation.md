## 1. WRONG

**F1. The core P0 fix, as specified, breaks the interruptible close.** This is the kill. P0 item 1 inerts every sibling from the **panel** up to `body`, which "covers the trigger's wrapper" (plan :110). It keeps that inert state until `onExitComplete` (plan :115), which matches today's `isPresent` keying (`useDialogBehavior.ts:92-97, 164-181`).
- In modal mode, the Layer renders in place (`Layer.tsx:9`). The trigger's drag wrapper is therefore a sibling of the panel inside the Root wrapper (`Root.tsx:407-422`), so it goes inert for the whole ~640ms exit.
- The HTML spec says inert hit-testing acts as `pointer-events:none`. A tap on the trigger mid-close can't land, so reopen-during-close dies.
- That path is a documented product contract: "the trigger stays tappable (and the close interruptible) from the first frame" (`Sheet.tsx:301-304`, `Root.tsx:251`). It is gated in tests: `geometry.spec.ts:473-482`, `:734` (n), `:1139` (n-shape), `:1909` (p3), `buttons.spec.ts:537`, `media.spec.ts:335`. Each one calls `trigger.click()` about 300ms after Escape. Playwright's hit-target check will time out on all of them.
- Test (l) (`geometry.spec.ts:366-400`) will still pass, but only because it asserts `not.toBe("backdrop")`. That makes it a false green.
- The plan's own "ordering trap" note (:115) proves the author knew the trigger would be inert at exit-complete and didn't follow it through to mid-exit.
- Consequence: the geometry gate fails in `prepublishOnly`. Or, if someone "fixes" the specs, the product's signature double-tap behaviour quietly regresses.
- Correct model: the trigger wrapper goes inert only while `open`, and is released at the close **request**. The rest of the page stays inert through `isPresent`.

**F2. Inerting the backdrop kills backdrop dismissal.** Plan :110 says inertOutside "covers ... the backdrop too". Plan :114 says "the click-catcher always renders when modal. `dismissOnBackdrop` now gates only its `onClick`".
- The backdrop is a sibling of the panel (`Sheet.tsx:305-312`, same parent).
- An inert backdrop receives no clicks, because hit-testing behaves as `pointer-events:none`. The `onClick` never fires.
- Consequence: `dismissOnBackdrop` (default `true`) stops working for every consumer. The two P0 sub-steps contradict each other.

**F3. The focus-guard placement breaks the first Tab after open.** The guards are "the panel's first and last children", and "the start guard moves to the last tabbable" (plan :113). On open, focus sits on the panel itself (`tabIndex=-1`, `useDialogBehavior.ts:188-201`).
- The first Tab goes to the next focusable in tree order. That is the start guard, which is a child of the panel. Focus then jumps to the **last** control.
- `focus.spec.ts:142-144` asserts that "a single Tab reaches Close (first in DOM order)". It fails, and so does the Close-reveal race test built on it.
- Shift+Tab from the focused panel goes to the previous focusable before the panel. Everything there is inert, so focus escapes to the browser chrome.
- Floating UI puts its guards **outside** the floating element and routes on `relatedTarget`. Plan :113 claims to follow "the Base UI/Floating UI pattern" but doesn't.
- Fix: route the start guard on `relatedTarget` (coming from the panel or from outside → first tabbable). Keep one keydown branch for `activeElement === panel`.

**F4. M3's premise is false.** The plan says `aria-describedby` on Sheet "is a type error" (:45, "inferred from the types, not compiled").
- TypeScript does not check hyphenated JSX attribute names that the props type doesn't declare. This applies to component props too, not only intrinsics.
- `aria-describedby` is undeclared in `SheetProps` (`types.ts:194-220`), so it type-checks. At runtime it already spreads onto the dialog through `...labelled` (`Sheet.tsx:50, 338`).
- The half of M3 that loosens `Labelled` to accept `aria-describedby` buys nothing. Title/Description is the only real part.

**F5. B4 overstates 2.5.3.** Label in Name fails only when the name doesn't *contain* the visible text.
- `aria-label="Contact"` on a trigger that shows "Contact" passes.
- The default Close is a glyph with no visible text (`Close.tsx:107`), so 2.5.3 doesn't apply to it at all.
- The required prop invites mismatch; it does not cause failure. That is a major, not a blocker.
- Separately: with `aria-label` optional, the default glyph-only Close loses its name. The plan ships no default `"Close"`; it relies on a dev check.

**F6. The B4 mount check is wrong.** `!el.textContent.trim()` ignores image `alt`, `aria-label` on a child video (`Media.tsx:186`) and `aria-labelledby` content. An image-only disc whose name comes from its media is valid but gets flagged. Use the computed name, or drop the check.

**F7. B6's fallback produces invalid nesting.** The plan says to "render the mode-correct trigger" on mismatch (:131). For `<Root><Trigger asChild><a/></Trigger>`, the mode-correct trigger is ButtonTrigger, which puts the consumer's `<a>` inside a `<button>`. That is interactive content inside interactive content, worse than today. It should be a dev error that renders the child unwrapped. Severity is also inflated: this is a misuse path, not a failure of a correct install.

**F8. Decision 2 reopens a fork Sean already closed.** BACKLOG.md:18 (BACKLOG 13): "fork: poster at rest vs pause control, poster-at-rest accepted in 14". BACKLOG.md:14 (14): "Accepted forks (Sean 2026-09-14): … video poster at rest and plays while open."
- The plan's strawman (plays once, capped at 5s, replays on hover/focus) contradicts that decision and never cites it.
- Poster at rest already satisfies 2.2.2 on the trigger, with no motion at all. B3's trigger half is "implement the accepted decision", not a design fork.

**F9. B1 is inflated as a blocker.**
- The AT half is already handled by sibling aria-hiding (`useDialogBehavior.ts:164-181`). The README "Known gap" (`README.md:724-726`) overstates it too.
- What remains: pointer click-through only under the opt-out `dismissOnBackdrop={false}`, and Tab escaping through an iframe.
- Pointer click-through is not a 2.4.3 failure; that SC covers sequential focus order. It's an APG-contract major.
- `inert` is still the right direction. The severity label is what's inflated.

**F10. The native `<dialog>` reasoning is right, but it misses the decisive reason.**
- "Nothing outside the top layer can paint above it" (:170) is incomplete. Top-layer elements stack in insertion order, so a later `popover` can paint above a modal dialog.
- The real blocker is F1's: `showModal()` inerts the trigger for as long as the dialog is open. Calling `close()` at the close request drops the sheet out of the top layer mid-morph, unless `overlay`/`allow-discrete` is used, and that is Chromium-only.
- "No for v1" is correct, but for a reason the plan never states.

**F11. The `[aria-live]` skip (A3) can't work with an upward walk.** Plan :111 skips `[aria-live]` nodes, but inert inherits and can't be undone below.
- A toaster rendered inside the app tree (Sonner's `<section aria-live>`) sits inside an inerted ancestor-sibling. Skipping it at the sibling level never reaches it.
- It goes silent, and its "Undo" button goes dead while the sheet is open.
- Keeping it requires treating each kept node as a second path to walk up from (React Aria's keep-list approach), not a sibling filter.

## 2. MISSING

**F12. No geometry coverage for keyboard or programmatic moves.** The plan says arrows "reuse the existing snap animation" (:121), but no snap function exists. The snap is inline in `handleDragEnd` (`Trigger.tsx:549-551`).
- A bare `setAnchor` goes through the anchor layout effect, which **jumps** x/y (`Trigger.tsx:167-178`).
- The comment there warns that the shared-layoutId surface FLIPs on such a change (the "~700ms drift").
- Expected result, inferred: the hit area and focus ring teleport while the painted surface and Shadow glide. That is a two-painter desync.
- The B2 spec checks only anchor value, callback and live text. It needs a geometry assertion (surface vs wrapper vs Shadow) and an extracted `snapTo(anchor)` helper.

**F13. `draggable=false` by default removes the user's only way to clear an obscured spot.** The FAB covers page content (M7, 2.4.11), and dragging it away is how a pointer user uncovers it. Defaulting `draggable` to `false` trades 2.5.7 for a worse 2.4.11 situation. It also contradicts the package's headline, "A draggable trigger that morphs into a modal sheet" (`README.md:3`). That's a product-identity call, and the plan presents it as an engineering recommendation.

**F14. M4's new focus-return default fails in Safari.** It captures "the element focused at open". Safari doesn't focus links or buttons on click, so an external header link that opens a controlled sheet leaves `activeElement === body`. The fallback goes to the FAB, which is exactly the bug M4 claims to fix.
- Capture order also matters: if inert lands before the capture, the focused trigger has already blurred to `body`.
- Base UI-style explicit `finalFocus` is the real fix. The default change buys little, and only in Chromium and Firefox.

**F15. The axe gate as written never runs the B4 rule.** In `@axe-core/playwright`, `withTags` and `withRules` both assign `option.runOnly`, and the last call wins (verified in source). "Tags … plus rule `label-content-name-mismatch`" (:132) therefore runs one or the other.
- The tag list also omits `wcag21a`, which is where `label-content-name-mismatch` is tagged.
- The rule is experimental; it needs `.options({ rules: { 'label-content-name-mismatch': { enabled: true } } })`.

**F16. The P0 gate isn't reconciled with the current release plan.** BACKLOG release blockers 34/35/36 (`BACKLOG.md:9-11`) gate npm 0.1.1 on PR #2 plus the API cleanup. The plan says "P0 (pre-publish)" without saying which publish. If it's 0.1.1, P0 adds 8 items to a gate Sean hasn't agreed to widen.

**F17. Overlap with in-flight work.** "Add a WebKit project" (:201) duplicates BACKLOG.md:22, "Multi-browser testing … IN PROGRESS (other agent)". The current branch is `test/cross-browser`. Both would edit `example/playwright.config.ts`.

**F18. There is no type gate for the type-level changes.** The `Labelled` and `aria-label` loosening, plus B6, rest on "verified by reading the types". But `npx tsc --noEmit` already fails (BACKLOG.md:24, L145). No suite catches a regression in the public types.

**F19. Smaller gaps.**
- (a) Escape layering with Radix works only because Radix's DismissableLayer calls `event.preventDefault()` before dismissing (verified), on what is inferred to be a capture-phase document listener. The plan must pin vista-sheet's listener to bubble phase, or the `defaultPrevented` gate misses.
- (b) Nothing tells keyboard users that arrows move the trigger (no `aria-keyshortcuts` or description).
- (c) `scroll-padding-bottom` can't uncover controls at the end of the page; the page also needs bottom padding.
- (d) Android back gesture: the native dialog's CloseWatcher closes it, but this one navigates away. Worth one line in the docs.
- (e) The plan proposes two restore paths (a direct restore call and the effect cleanup) but never makes restore idempotent.

## 3. OVERVALUED / GOLD-PLATED

**F20. "Click-catcher always renders when modal" (:114).** Fails the deletion test. With inert on the background, the catcher blocks nothing that isn't already blocked; it only exists to dismiss. Keep today's `dismissOnBackdrop` gating, and keep it un-inerted (F2).

**F21. `<VistaSheet.MediaToggle>` plus the dev-warn registry (P0 4).** The trigger half is just poster at rest (F8).
- On the sheet side, Close and Escape already provide a "hide" mechanism for content the user deliberately opened (2.2.2 is "Pause, Stop, *or Hide*"). Whether that suffices is arguable. A new public part plus a registry is not P0.
- Cut the registry and warning. Make the toggle P1 at most, as a recipe.

**F22. `src/scrollLock.ts` as a ref-counted module singleton (P1 4).** It has one caller.
- The ref count only matters when two modal locks overlap and the first closes first, a case A2 calls abnormal.
- Locking `html` and checking `scrollbar-gutter` are real fixes. Do them inline in the existing effect. Drop the module and the ref count.

**F23. The test matrix is gold-plated.**
- The axe matrix crosses every page × 3 states × {default, reduced, forced-colors} (:203). axe color rules mean nothing under forced colors, and the "every page" set includes the canvas dissection page. Its static state captures are design artifacts, so a no-baseline gate will fail on them for reasons unrelated to the package.
- Scope axe to the shipping-behaviour pages, in default plus reduced-motion only.

**F24. Two P2 items fail the cost/benefit test.**
- m7 `<style>` hoisting risks the D3 first-paint fix for validator purity. React 19's precedence styles also never unmount, so every `triggerSize` change leaks a rule (inferred). Backlog it.
- The P2 `popover="manual"` spike names no bug it would fix. Cut it.

**F25. `dismissLayers.ts` passes the two-adapters rule** (modal plus preview both push), so keep it. No finding there.

## 4. EVIDENCE

**F26. BACKLOG line refs are stale.** "BACKLOG:172-174 is stale … close all three" (:100) cites lines that don't exist at HEAD. BACKLOG.md is 104 lines after `6535575` and `cdb35d7` regrouped and archived it.
- The plan audited `8090664` and never re-read the current file. That's how it missed F8's accepted decision on the current BACKLOG.md:14 and :18.
- `src/` has no diff between `8090664` and HEAD, so the code line refs hold (verified).

**F27. The headline claims could not be seen by the method used.**
- "Inert plus guards gives the same AT and keyboard outcome … without moving the morph's paint order" (:172) was reasoned from paint order only. Nothing was run, and no suite was grepped for trigger interaction during exit. F1 is visible from `grep reopen example/*.spec.ts`.
- "React 19 peer already implies those browsers" (:42, A1) is a non sequitur. React 19 publishes no Safari 15.5 floor; the browser floor must be stated, not inferred.

**F28. Infrastructure claims are unverified.**
- "vitest + RTL" (:47, :216): `@testing-library/react` is not a devDependency (`package.json:62-78`). Existing units use `createRoot` plus `act` (`LinkTrigger.test.tsx:1-6`). Either add the dependency explicitly or match the existing pattern.
- "Playwright 1.62": the installed version is 1.62.0 (verified). `emulateMedia({ contrast })` support (A7) is still unchecked.

**F29. Reference-system claims taken from memory.** "Base UI/Floating UI pattern" for the guards, and A3's "how libraries handle" live regions, are both asserted without fetched source. The guard claim is wrong in a way that matters (F3).

## 5. WEAKEST ASSUMPTION

The assumption: inert can cover everything outside the panel, the trigger included, for the whole `isPresent` window without touching the morph, because "inert does not affect painting."

Painting is fine, but interaction isn't. The trigger is an interactive morph partner during the exit, and reopen-mid-close is a gated contract (`Sheet.tsx:301-304`; six specs). Taken as written, the plan's single biggest structural fix breaks reopen-during-close (F1), backdrop dismiss (F2) and the first Tab (F3). The "removes four findings" headline (:5) is then built on a change that can't ship in its current shape.

Revised model:
- The trigger wrapper is inert only while `open`.
- The backdrop and the guards are never inerted.
- The rest of the page is inert through `isPresent`.
- Start-guard routing uses `relatedTarget`.

VERDICT: revise. The single most important change: rewrite P0 item 1 so the trigger wrapper is released from inert at the close request, not at exit-complete, and so the backdrop and the focus guards are never inerted. Then gate it on the existing reopen-mid-close geometry specs.