# vista-sheet BACKLOG

Open items only, cleaned 2026-10-07 against the tree at `8090664`. Done, obsolete and merged items live in `BACKLOG-archive.md` (append-only, with reason and evidence). Numbers are the original item numbers; unnumbered items carry `L<n>`, their line in the pre-cleanup file (`git show 8090664:BACKLOG.md`).

Standing bar (Sean, 2026-08-31): "It all needs to be buttery smooth."

## Release blockers

- [ ] **34.** Remove the four unused API leftovers before the final publish: `--vista-sheet-trigger-x/-y`, `--vista-sheet-shadow-x/-y/-w/-h`, the `SheetRect` alias, and `surfaceCloseLeadDelayMs` becoming preset-only. "Remove the four unused API leftovers (BACKLOG 34) before the final publish" — Sean 2026-10-07. **IN PROGRESS (other agent).** Still present: `src/Trigger.tsx:266`, `src/types.ts:273`.
- [ ] **35.** npm publish 0.1.1 (Sean: "tbd, maybe 0.1.1"). npm has only 0.1.0 (verified 2026-10-07); package.json is 0.1.1. Gate: PR #2 merged and 34 landed (removals ship in the same release). Needs Sean's go.
- [x] **36.** DONE: PR #2 merged `1bf11ff`, 2026-10-08. Merge PR #2 https://github.com/seansmithworks/vista-sheet/pull/2 (state OPEN, verified 2026-10-07). Sean's nod only.
- [x] **58.** DONE: canvas PR #3 merged `e88c938`, 2026-10-08. DECIDE: `canvas` branch to PR against main, or fold into PR #2. Carries canvas page, motion lab, html-review wiring, recipe changes, defaultOpen fix (`src/Root.tsx`, `Sheet.tsx`, `Close.tsx`) and the defaults merge. Merge is Sean's nod only.
- [ ] **14.** Code audit remainder (B1/M2/M3 landed: `eb73f1e`, `af272b6`, `ad24c04`): B2 SSR trigger renders top-left until hydrate and open-on-load is sized for 1440x900 (verified in the audit); M1 per-frame whole-tree re-render on drag (inferred); N3 Shadow should read live position; N6 `@property` token defaults. Accepted forks (Sean 2026-09-14): hover 1.02 lift, no drag lift, video poster at rest and plays while open.

## Accessibility & web standards

Plan approved by Sean 2026-10-08 (strawmen accepted: keyboard + setAnchor move with README recipe; no built-in video pause, Close/Escape = hide; increased-contrast opaque border). Plan: docs/plans/a11y-web-standards.md. P0 (7 items) in progress on branch a11y/p0.

- [ ] **NEW.** A11y & web-standards plan vs shadcn / Radix / Base UI / React Aria / vaul. **IN PROGRESS (other agent).**
- [ ] **13.** A11y audit remainder (blockers and the drag-eats-activation major are fixed: `ad24c04`, `af272b6`): no non-drag way to reposition (`setAnchor` is in `src/context.ts:21` but not a public prop); looping trigger video has no pause control (fork: poster at rest vs pause control, poster-at-rest accepted in 14); 11 minors from the 2026-09-14 audit (scratchpad, likely gone).

## Packaging & compatibility

- [x] **NEW.** DONE (`391e836`); Firefox run pending (Sean started it 2026-10-08). Multi-browser testing: firefox / webkit / mobile emulation; iOS Simulator spot checks. **IN PROGRESS (other agent).**
- [ ] **32.** Test against motion 14. Peer range is `>=12 <14` (green on 12.43.0 and 13.1.1, `4fa3929`). Run `test:geometry` and `perf` with motion@14 as devDep; widen `peerDependencies` only if green.
- [ ] **L145.** `npx tsc --noEmit` fails (re-verified 2026-10-07): `example/flagship/main.tsx:5` has no `*.jpg` module declaration, `src/naming.test.ts:34-40` assigns null to `number[]`, `tuner/page.tsx:17-18` cannot resolve `@seansmithworks/vista-sheet`. No suite runs bare tsc.
- [ ] **L148.** dialkit's stylesheet `@import`s Geist Mono from Google Fonts (still true on dialkit 2.0.2, `node_modules/dialkit/dist/styles.css:1`); external request on every tuner/demo page.
- [ ] **L415.** Local rename remainder (Sean, 2026-09-12: "we should also plan to rename local files too"): `CLAUDE.md` heading still `# disc-sheet`; qmd re-index of the projects collection not verified. (Directory and memory moves are done.)

## Distribution (site, README links, launch video)

- [ ] **NEW.** Known-issues doc. **IN PROGRESS (other agent).**
- [ ] **33.** Demo/download site: map visualization-STRUCTURE options from real captures (state matrix, configurator, in-context use cases, morph walkthrough) and Sean picks before any visual treatment. Shotfun A-D rejected 2026-10-05 (drew a generic sheet, not the real component). Also folds in: visual configurator on the site (playground `play.html` exists, site embed does not), the one site page (example gallery first, dials on one specimen), and the seansmithdesign.com cutover. Real captures partial in `.shotfun/states/`. Caveat: the configurator answers "both, site first" / "both in parallel" arrived alongside a harness-flagged unverifiable background notification and were never confirmed as Sean's (a later 8090664 line, L192, ticks them CONFIRMED 2026-09-01; unreconciled).
- [ ] **21.** Decide or kill: one demo or two. GitHub homepage is now https://vista-sheet.onrender.com (verified), Render is current (`ebff8dc`), Vercel is stale (`2dfe523`, orange). README still links to neither. Strawman: pause the Vercel project (reversible). Sean, 2026-09-15: "or maybe both" (unanswered).
- [ ] **42.** Canvas sharing: live iframes (`play.html?stage`) reject non-same-origin parents, so the canvas needs a hosted build of `example/dist` (Vercel or Render preview). Sean's deploy.
- [ ] **37.** Demo gaps from capture: no shape control in the settings sheet (only `?shape=` and the playground); dark/warm only on index and playground; no presets switcher; tuner Close renders mid-sheet; mobile link-preview card covers the heading.
- [ ] **38.** Launch video (/brag-slim): the demo was made for someone else; parked at `~/Code/_experiments/vista-sheet/brag-2026-10-06/`. Revisit after the npm release (outro install line needs a release with link preview).
- [ ] **11.** Full design system in Magic Patterns (new VistaSheet project). Originally "awaiting Sean's go"; a Magic Patterns design system `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38` was created (old L511, a self-report; no repo or git evidence), unpublished. State is carried by 11b.
- [ ] **11b.** Magic Patterns rebuild stopped 2026-09-14. Design system `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38`, unpublished, active artifact `6a5cb9b1-efba-4641-8b2d-41d662174d43`; orange sweep incomplete (staged `index.css` still has 2 `#b4512e`); only basic + chat compared to the real stage. Staged files in `~/.claude/projects/-Users-seansmith-Code-vista-sheet/memory/plans/v02-quality-wave/mp-stopped/`. Sean publishes after a look. Not re-checked against Magic Patterns today.

## Design calls (Sean's)

- [ ] **L474 (follows 43-45).** Apply-or-redline the strawmen live in code: squircle sheet corners = squircle (`9da07db`), circle shadow mid-morph = surface curve (`c298df5`), flagship 36 to 48 inside the radius change, dials rounded square 25% and squircle fallback 27.16% (`src/shape.ts`).
- [ ] **60.** DECIDE: "The corner radius here is probably too much, maybe we need to set some ratio depending on the width or height. Or a class depending on the content. or both." (surface tuner, open sheet)
- [ ] **46.** DECIDE: text-only button height consistency. Sean expects one min-height per size with padding on four sides. Measure s/m/l text vs icon+text heights first.
- [ ] **47.** DECIDE: "What set up for custom do we have? Design System / DESIGN.md / token-key friendly? How do we share the token naming?" Strawman to draft: a token map (`--vista-sheet-*` to DESIGN.md keys) exported as JSON. None exists yet.
- [ ] **48.** DECIDE: "should these be part of the top section, Buttons & Shapes?" (link preview placement; kept as its own canvas section).
- [ ] **55.** Confirm: link preview canvas tile on a larger-type host page (`a1c9ad6`, `321e8d9`), shipped as a strawman. Pairs with 48.
- [ ] **53.** DECIDE OR KILL: exploded view trigger layers are empty outlines while open (`src/Trigger.tsx:689-697`, the `{!open && <TriggerSurface/>}` unmount). Dim is built (`b80e22e`); the Open/Closed toggle on the exploded view is still the strawman, not built.
- [ ] **40.** Canvas design pass: phone-viewport tiles are mostly empty space; Anatomy callout numbers overlap on small triggers; Shadow on/off tiles look near-identical at tile scale; at 390 the States & API "Where" column needs horizontal scroll.
- [ ] **L291.** snappy/gentle are still un-dialled strawmen (`src/motion.ts:354-372`) and the tuner only exposes 3 of their 5 values (`tuner/page.tsx:78`, no open-direction spring). Options: (1) dial close-only and document the open springs honestly, (2) add an open-direction panel and dial all four springs, (3) cut snappy/gentle and ship `presets.default` alone (earlier recommendation: 3, then 2 later).
- [ ] **L82.** No visual scrim / backdrop opacity ramp; the modal opens with zero depth cue (`src/Sheet.tsx:301` is an invisible click-catcher, "not a scrim").
- [ ] **L83.** `RADIUS_HOLD_FRACTION = 0.74` (`src/motion.ts:74`, used `src/shape.ts:151`) releases the radius as a hard corner; ease the release instead of stepping it.
- [ ] **L84.** Critically-damped close. Close spring is still 375/32/1 (zeta about 0.83), overshoot about 3.3px, visible on a 128px disc; the avatar spills about 1.25px past the disc edge for about 2 frames. Asymmetric damping is the root fix.
- [ ] **L344.** Variant A vs B for the list/contact icon ground. A (14% accent wash) is applied (`f4a4a72`); B is solid accent with a white glyph, two lines in `example/list/list.css` and `example/contact/contact.css`. A stands; not blocking.
- [ ] **L475.** Sean's real portrait video replaces the ffmpeg placeholder (`example/public/media/vista-sheet-portrait.mp4`).
- [ ] **L476.** DESIGN.md section 4.1 one-line exception for the DOM-read radius (Shadow, Media). Sean's doc; DESIGN.md has no such line today.
- [ ] **57.** Naming round 3 runs in its own thread: pickup `ccp naming` (`~/.claude/pickup/-Users-seansmith-Code-vista-sheet-naming.md`). `@seansmithworks/vista-sheet@0.1.0` is already on npm, so a rename means a new package plus a deprecation.
- [ ] **22.** Confirm the note-9 reversal read Sean's intent: "corner setting" was taken to mean dialkit's floating panel, so the `/` Design panel stays a VistaSheet (`3cdbafc`) and glow length (10) is re-cut into that sheet.
- [ ] **30.** Dia corner mismatch (shadow tighter than sheet); not reproducible in Chrome 154. Needs Sean's console check in Dia.
- [ ] **L402.** Dia toolbar picks up the glow colour when the sheet is anchored top (inferred: browser samples the top edge when no `theme-color`). Strawman: keep in the demo and add one README line about `<meta name="theme-color">`; README has no such line.
- [ ] **L339.** Sean eyeball pass on the video close crossfade and the close-button contrast over footage.
- [ ] **L403.** Eyeball CloseMask's top-down fade when closing from `center` (inferred to read the same).

## Parked / ideas

- [ ] **8.** `/play` controls to dialkit 2.0 (`example/play/Controls.tsx` is still hand-rolled, no dialkit import).
- [ ] **10.** Glow length, 5 steps beside Strength (approved 2026-09-13): Tight 0.4x/0.5x, Short 0.7/0.75, Default 1/1, Long 1.4/1.6, Feather 1.9/2.4 (length/blur multipliers). Not built (no glow-length control in `example/main.tsx`); perf gate on Feather.
- [ ] **19 (+L482).** Playground stale state: `example/play/shell-entry.tsx:94-115` "ready" handler has empty deps and replies with the initial-mount `state` whenever the stage iframe remounts (e.g. crossing the 900px breakpoint, which also reloads the iframe fully).
- [ ] **L420 (+L443).** Settings button draggable — Sean 2026-09-13: "should be draggable since it is a vistasheet". Settings Root is `draggable={false}` (`example/main.tsx`, derived anchor). Needs a symmetric yield rule when both sheets target one anchor, its own persistKey, and geometry tests for drag-into-occupied at 390x844 and 1440x900.
- [ ] **31 (+L7).** media.spec flake: `media.spec.ts:606` (1.72px vs 1px, passes on rerun; also :289) plus the rescued sampler fix in `.rescued-2026-09-24/example/media.spec.ts` (queue the sampler before the click) that was never ported. Other known flakes: `geometry.spec.ts:316`, `:2347`.
- [ ] **L8.** `.gitignore` also ignore `recordings/` (rescued copy had it; `scripts/record-demo.mjs` is untracked in the main checkout).
- [ ] **59.** Main checkout `~/Code/vista-sheet` has uncommitted work not from the canvas thread (untracked `AGENTS.md`, `.rescued-2026-09-24/`, modified `BACKLOG.md`). Sean to check whose it is; delete `.rescued-2026-09-24/` once L7/L8 are settled (never commit it).
- [ ] **L336.** Playback-time handoff between trigger and sheet Media instances (both start at 0; visible as a content cut mid-close).
- [ ] **L337.** Cover focal point for a real portrait (centred crop may cut a face in the disc; `src/Media.tsx` has none).
- [ ] **L338.** Safari/iOS untested for aspect sheets (px size from innerHeight vs the dvh max-height cap).
- [ ] **L446.** Dial pass: rectangle S/M/L (strawman heights 36/44/52, padding 14/18/22, gap 6/8/10) and pill corners vs a fixed radius.
- [ ] **L447.** Dial pass: trigger label reveal window (strawman collapseProgress 0.85 to 1, `DESIGN.md:70`, `triggerLabelRevealStart: 0.85`).
- [ ] **L448 (+L449).** Shared / Media inside a rectangle trigger is unsupported; the playground disables Rectangle for Shared/media recipes until it is.
- [ ] **L125.** Dither / other visual treatments: a new surface, not a dial. Separate and larger.
- [ ] **L348.** Ripple on open (Sean, 2026-09-11: "if this doesn't work we can explore a pivot"): turn the shadow flare into a deliberate ripple via `<VistaSheet.Shadow asChild>` + `useVistaSheet().collapseProgress`; surface-fx has `sheetBloom` + `useRippleEngine`. Includes the edge-aware variant (ripple reflects off the viewport edge the sheet sits against; mirrored virtual sources, inferred). Judge against DESIGN.md section 4.
- [ ] **L311 (+L318).** Corner-spark (emanata) micro-detail, research done 2026-09-02, `src/` untouched. Artifact https://claude.ai/code/artifact/75282297-73f7-4030-9d3c-cbce78ddb2ab. Five candidate marks, none picked; the mark must sit outside the sheet (a sibling, since `.sheet` is `overflow: hidden`) and never draw the same twice; no Rough.js. Four calls: which mark, every open vs first per session, reduced-motion, opt-in vs default (rec: opt-in).
- [ ] **L329 (+L330).** Star trigger shape (configurable points and corner radius) and developer/agent-defined custom shapes. Deferred by Sean 2026-09-13 to a future release.
- [ ] **L297.** Mock the icon-treatment variations as editable Figma frames. Sean: "mock up the variations there and I will tweak some bits." (six: before / A / B for list and contact). Blocked on Figma MCP OAuth, which only completes from the Mac, not a phone. Sketchpad, not spec.
- [ ] **In-flow origins.** Generalize the morph beyond the floating disc: thumbnail-to-lightbox, popout-from-body-content (from the 2026-08-31 v0.2 candidates; had no checkbox in the old file).
- [ ] **L442.** Stagger length scales with Item count (Design menu 9 rows, last row about 0.92s; `ITEM_STAGGER_INTERVAL_SEC = 0.09`). If long sheets feel slow, cap total stagger rather than shrink the interval.
- [ ] **29.** "Simplify later" list from the link-preview plan (Shadow radius machinery, audit-history comment blocks, modal reveal/backdrop).
- [ ] **41.** Canvas follow-ups (the hover/pressed part was resolved by `57bd049`): reduced-motion posters are byte-identical to the basic disc at rest; link-preview tiles do not demonstrate hover intent/grace live.
- [ ] **54.** Exploded cosmetic nits: at 1440 / gap 56 legend order for rows 9-11 reads 10, 9, 11 and the elbows nearly touch; at 390 the "z 99 · fixed · opacity" meta for rows 10-11 wraps to column 0.
- [ ] **56.** html-review friction found wiring it into the canvas (belongs in `~/Code/_experiments/html-review-workflow`, not edited): anchors only to the clicked element; hard-coded apiBase and Origin guard; `read --json` omits anchors; C/Esc dead inside iframes; `--hw-topbar-height` scoped to `#hw-root`; comments cannot be deleted; comments in an inactive view count as orphaned. Offer to copy to that repo's backlog.
- [ ] **61.** Docs: `docs/PACKAGE-DESIGN.md:356` still lists the old sheet shadow (`0 8px 48px rgba(0,0,0,.24), ...`); the actual default is `src/styles.module.css:405-408`. The trigger shadow row above it is stale too.
- [ ] **62.** The sheet's own border is a fixed 1px (`src/styles.module.css:308`) and not coupled to `--vista-sheet-surface-border-width` (only the trigger ring follows the token).
- [ ] **63.** Flagship's `:active` `scale(0.94)` (`example/flagship/flagship.css:70-71`) stacks with the package's 0.97 pressed scale.
- [ ] **L404.** Duplicate geometry test label "(k)" in `example/geometry.spec.ts` (lines 926 and 1585). Cosmetic.
- [ ] **L483.** Demo settings sheet uses the whole-JSX key remount pattern (`example/main.tsx`, `key={appliedSettingsAnchor}` near line 754).
- [ ] **L484.** `example/play/render.tsx` type+ordinal keys still shift same-type siblings (Item lists) on middle removal; unreachable by current controls.
- [ ] **L485.** Copy-output identity after `58b0097` holds by construction only; `example/play-copy.spec.ts` checks substrings, not full output.
- [ ] **17.** Minor: `example/play/codegen.test.ts:177-183` var parser does not handle `var(--a, var(--b))` fallbacks; would false-flag if nesting is introduced.
- [ ] **20.** Minor: the Chat bubble contrast test in `example/play/codegen.test.ts` reads palette data, not emitted CSS, so it cannot fail if the CSS stops using surface/accent.
- [ ] **23.** Delete `origin/wip/t3-red-test` (`2b5701e`, superseded by `af272b6`) on Sean's nod. The local branch is already gone.

## Unsure (could not classify from code or git)

- [ ] **L31.** Review flagship captures + parked taste calls (added by Phase 4). No git or code evidence it was ever done or formally closed; the flagship was later changed (`f5a3a8f`, 48px radius) but that is not a review.
- [ ] **L194.** "Still unparsed from dictation: 'puppy tier agent' (guess: agent-pasteable registry output, shadcn-style) and 'out of the LinkedIn app around'." No code or doc to check; meaning was never confirmed. Kill unless Sean recognises it.
- [ ] **L355.** Audit doc review: `docs/plans/motion-craft-audit.html` was open in html-review session `sess_1e7f46c0` on 2026-09-11; whether Sean ever commented is not checkable from the repo.
