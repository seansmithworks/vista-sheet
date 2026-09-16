# disc-sheet BACKLOG

## Overnight release-prep run — dispatched 2026-08-31 (Sean asleep; stage only, NO publish)

Plan gate CLOSED: /adversarial-plan ran (Opus refuter, 14 findings, verdict revise); revised plan + unedited refutation in the session scratchpad, ledger to be copied into MORNING.md. Plan B secured: unscoped `disc-sheet` available on npm (404, checked tonight).

- [x] Phase 0a — push feat/customization-parity to origin (done 2026-08-31, upstream set)
- [x] Phase 0b — fresh baseline: vitest 15/15, Playwright 54/54 (43 geometry + 11 a11y)
- [x] Phase 1 — build system + metadata + THE GATE: vite lib build (ESM + d.ts, vite-plugin-lib-inject-css per F1, NODE_ENV define-passthrough per F2), exports dist-only (F3/F12), publishConfig access public (F6), prepublishOnly + dist gitignored (F7), audit >=10-token guard (F11), README rewrite; gate = pack tarball → fresh Next app → next build + prod Playwright + dev-warning check (DONE 80385d7: all green, dist 24.3kB+2.95kB css, 15/54/PASS)
- [x] Phase 2 — npx copy-in: zero-dep bin/disc-sheet.mjs `add`, tested in the same Next consumer, tsc green there, css-modules.d.ts collision handled (F8) (DONE 129a4a1: 18 files land, conflict guard works, consumer tsc+build green)
- [x] Phase 3 — flagship example (wave 5, unheld by Sean 2026-08-31): example/flagship.html second entry; tokens from README table not stale §2 (F4); floor per F9 = palette + portrait + copy/actions + CloseMask + reduced-motion, cuts stated; example/main.tsx untouched (geometry-gate substrate) (DONE ea34cd9: captures eyeballed by orchestrator, 15/54/PASS held)
- [x] Phase 4 — experience audit: 13 mechanical found+fixed (M2 escalated to Opus, deltas now 0.1-0.4px), taste strawmen applied, #6 focus-restore parked for Sean ("no shitty experiences"): ONE combined design-review + emil-design-eng pass (trimmed per F13), captures (morph, six anchors, reduced-motion, 390x844); mechanical fixes applied, taste calls parked below
- [x] Phase 5 — ce-code-review: 5 reviewers + validator, 6/6 findings confirmed AND fixed (headline: dist lacked "use client"), README RSC note added, MORNING.md written. Final: vitest 20/20, Playwright 69/69 x3, audit PASS

## Publish hold LIFTED 2026-08-31 (fix 1be78ac, gates 75/75 x3)

- [x] Resting-disc squircle after interrupted close (reopen-mid-close -> Escape -> rest leaves the disc surface with a sheet-ish radius; content stays round). Found by Sean on the demo videos, confirmed on end-frame pixels (scratchpad demo/end-*-disc.png). Fix + geometry gate (review finding #8 resurrected) dispatched to the T1 motion agent. Fixed: close radius-delay gate removed (never opened — 1.5s delay vs ~1.15s close), stale inline border-radius now cleared when the binding drops; geometry test (o) covers 4 close variants x 2 motion modes.

## Waiting on Sean (morning)

- [ ] `npm login` then `npm publish --access public` (token expired 2026-08-31, verified 401)
- [ ] Merge feat/customization-parity → main
- [ ] Review flagship captures + parked taste calls (added by Phase 4)
- [ ] `/model` default is now Fable 5 for ALL new sessions (saved by tonight's `/model fable`) — re-pick daily default per your own escalation-only rule

## Taste strawmen applied overnight (auditor-recommended, all one-line reversible — veto any)

- T1 whisper line at rest ("Sean Smith — tap the disc. Drag it anywhere.")
- T2 Resume handle "PDF" → "seansmithdesign.com/resume" (label was factually wrong; href is a page)
- T3 mobile sheet title 16px → 20px
- T4 X-row icon deduped from the close ✕
- T5 cursor:grab kept (auditor rec)

## Parked (off-objective, noticed tonight)

- example/ `evidence/` dir + untracked test-results/ hygiene beyond gitignore
- Site-side cutover (seansmithdesign.com consuming the package) — wave 5's other half, separate run

## v0.2 candidates (Sean, 2026-08-31 morning review)

- **Shape presets** — circle / squircle / square as first-class out-of-the-box options. The dial exists (`--disc-sheet-disc-radius`), but the SHARED CONTENT must mask to the same shape or it reads broken (the accidental squircle looked wrong only because the portrait stayed circular). Needs: child radius inheritance that tracks the ANIMATED radius mid-morph, not just the static token, plus docs + an example variant per shape. NOTE for the iOS look: a true iOS squircle is a superellipse, not a border-radius — border-radius approximates it; exact needs clip-path/mask, which does NOT interpolate through the FLIP the way the radius MotionValue does. Approximation first.
- **App-icon → preview example ("icon to advertisement")** — Sean's demo/promo concept 2026-08-31: iOS-squircle disc as an app icon that morphs into an App Store-style preview card with MEDIA content (short video/screenshot loop, not text rows). Doubles as the launch-post demo — the "why would somebody want this" artifact. Builds on shape presets; second showcase beside the flagship.
- **In-flow origins** — generalize the morph beyond the floating disc: thumbnail-to-lightbox, popout-from-body-content. (Also in tease-capture.)
- **Morph smoothness pass** [CARRIED to next thread, 2026-08-31] — dispatched, agent STOPPED mid-Phase-C by wrap-continue. WIP commit 016c53b holds UNVERIFIED edits (Content.tsx reveal timing +15/-1, Disc.tsx +56/-24): no post-edit suite run, no re-measurement. Phase A/B frame data in session scratchpad m4/ (dies with old session). Next thread: verify-or-revert 016c53b first (suite 20/75 + eyeball), then finish: measure -> Emil lens (~/.claude/skills/emil-design-eng/SKILL.md) + PACKAGE-DESIGN §3 -> surgical refinement only, never loosen a geometry threshold.


## Noted during smoothness verification (2026-08-31, T1 motion agent A/B)

- **Resting disc radius is now a permanent inline value** — 016c53b's `discRestRadius` MotionValue writes `border-radius: 64px` inline at rest, where the previous fix removed the inline so the CSS module's `var(--disc-sheet-disc-radius, 9999px)` governed. Effect deps are `[discSize, discRestRadius, sheetRect, open]`, so a consumer changing `--disc-sheet-disc-radius` at runtime (theme swap) with no resize and no open/close gets a stale radius. Not a regression against any current behaviour or test — new coupling, folds naturally into v0.2 shape presets (which need animated child-radius inheritance anyway). Measured, not fixed.

## Greenfield install / first-run experience (Sean, 2026-08-31 — resurfaced from a phone ask that was NEVER captured)

- [ ] **Greenfield consumer app Sean can actually open.** Phase 1's gate built one (`.../d4c0a3bb-.../consumer-next`, node_modules + 0.1.0 tarball, routes `/`, `/nowarning`, `/server`) but ran it headless and only ever reported an exit code. It survives in a DEAD session scratchpad and can be reaped. Rebuild durably at `~/Code/_experiments/disc-sheet-consumer` from a tarball packed AFTER the smoothness pass lands, then hand over `npm run dev` + localhost.
- [ ] **README quickstart is not runnable.** Three defects found 2026-08-31 by reading it as a fresh installer: (1) the Usage snippet mounts `<Avatar />` twice, never defined or imported — copy-paste yields a compile error, not a disc; (2) the prose says add `"use client"` "(as above)" but the snippet never shows it, so the single most likely App Router trap is described as already-demonstrated; (3) nothing sets an expectation of what you should SEE (disc at an anchor, drag, tap, morph). Fix = one self-contained copy-paste-runnable snippet.
- [ ] **The greenfield page must be the README snippet verbatim**, not a hand-tuned demo — the point is to test the documented path, which is what an installer actually follows.

## REOPENED: morph smoothness — Sean's verdict 2026-08-31, after using the prod consumer app

**Standing quality bar for this package: "It all needs to be buttery smooth."** Sean used the greenfield consumer app and stopped within a moment — the quality was not there. This overrides any measurement-based claim that the smoothness pass is complete.

**The orchestration error to not repeat:** the pass was declared done because two specific measured discontinuities (the circle→square radius pop, the shared-element occlusion) were fixed and the numbers moved. "Two defects removed" is not "the morph is smooth." Frame-level deltas are necessary evidence and are not sufficient evidence; the acceptance test for felt quality is Sean's hands on a production build, and it belongs BEFORE the pass is called done, not after.

**Second error, same session:** he was handed `npm run dev` and told to judge motion quality on it. A Next dev server double-renders under StrictMode, is unminified, and runs HMR in the frame loop. Never hand him a dev build to evaluate feel — build prod and serve that.

- [ ] Phase 3 dispatched (diagnosis only, no edits): rAF frame-timing to separate JANK from CHOREOGRAPHY, a frame-by-frame breakdown, and an Emil-format review table. Hypotheses under test: H1 Motion's layout projection is main-thread rAF and FM shorthand transforms are not hardware-accelerated; H2 durations exceed the skill's 200-500ms window for modals/drawers (open reveal 492-530ms, close ~1.15s); H3 asymmetry is backwards — the skill wants exit FASTER than enter, ours has close slower than open; H4 spring mass 1.75 on both directions reads floaty; H5 reveal overlap paints text at ~92% box scale.
- [ ] Taste calls arising from Phase 3 are Sean's — do not pre-empt spring/duration changes as "perf fixes".

## Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- [x] **DONE bf48b0a — Phase 4 coupling landed.** `transition.shared` is now direction-aware; the close default (`DEFAULT_SHARED_CLOSE_SPRING`) is DERIVED from `DEFAULT_CLOSE_SPRING` by the same k-scaling `DEFAULT_OPEN_SPRING` uses, so the two stay coupled if the close is retuned again. Measured arrival gap on the prod consumer app at 1280x800: **-175.0ms -> -33.2ms** (median of 5). The open direction is byte-for-byte unchanged and was re-measured to prove it. `9a4eec1`'s close-spring retune VERIFIED by the same gate run (vitest 20/20, Playwright 75/75, audit PASS) — not reverted. Superseded text:  Sean's pick (Option A): the avatar should track the shrinking box down and reach the 2px border relationship (`.shared[data-disc-sheet-slot="disc"]`, `inset: 2px`) AS the disc finishes, not ~430ms early. WIP `9a4eec1` carries ONLY the close-spring retune (240/34/1.75 -> 375/32/1.0, damping ratio preserved, UNVERIFIED — no suite, no re-measure). The coupling itself is NOT started. Decider metric: avatar-vs-box arrival gap, currently **425-458ms measured on avatar POSITION** (the ~740ms quoted earlier was the opacity crossfade — different measurement, do not chase it).
- [ ] **STRAWMAN BUILT 77f6d9b, awaiting Sean — `SURFACE_CLOSE_LEAD_DELAY_MS` is now 35 (was 100).** Two constants to revert (it and the derived `DEFAULT_SHARED_CLOSE_SPRING`). What the re-home read costs, measured on a prod build: at **100** the box sits frozen 143ms (8.6 frames) after the Close click, the avatar gets a 100ms (6.0 frame) head start and is **53% of the way home** before the sheet moves a pixel — unmistakably a re-home, and why the close felt long (573ms total). At **35** the box is frozen 76ms (4.6 frames), head start 36ms (2.1 frames), avatar **17% home**; the detachment is still legible but reads as the avatar LEADING the collapse rather than leaving and being followed (507ms total, four frames shorter). At **0** there is no detachment to read at all (476ms). Sean picks. Superseded text:  111ms of frozen box after the Close click; highest-leverage number on close duration. PACKAGE-DESIGN §3 says it exists to keep the close reading as a re-home rather than a scale. Reduce, don't delete, and report what the re-home read costs at the chosen value.
- [ ] **PARKED — add a `prepack` script.** `npm pack` does not run `prepublishOnly`, so a pack without a prior `npm run build:lib` ships stale compiled `dist/`. This cost Sean an evening judging a tarball built from `1be78ac`, and would ship stale output on a real publish. Not changed mid-flight; `package.json` was off-limits to the running agent.
- [ ] **PARKED — `motion@13.1.1` resolves in consumers; geometry suite runs v12.** Untested combination. Verify the v13 projection path or pin the peer range.
- [ ] **PARKED — no visual scrim / `<DiscSheet.Backdrop>` opacity ramp.** Modal opens with zero depth cue. Already a v0.2 item in §8; contributes to "doesn't feel finished."
- [ ] **PARKED — `RADIUS_HOLD_FRACTION = 0.74` releases as a hard corner** (roundness rate jumps 5x in one frame at t=321ms). Ease the release instead of stepping it.
- [ ] **PARKED — critically-damped close.** Close overshoot is 0.94% of travel = 3.3px either direction, but that is 0.69% of a 480px sheet and 2.58% of a 128px disc — visible only on close. Asymmetric damping is the right fix; explicitly excluded from Phase 4.

## Noticed during Phase 4 (2026-08-31) — mentioned, NOT fixed

- **Sean's hands-on acceptance is still outstanding.** The gap is measured and closed; "buttery" is not a number. :3000 serves a prod build of `77f6d9b` — the felt-quality call belongs to him, on that build, before this pass is called done.
- **The avatar spills ~1.25px past the disc's edge for ~2 frames at t≈355ms.** Measured every close, every candidate spring. It is NOT the coupling: at peak overshoot the close spring pulls the box to 124.5px wide against a 124px avatar, so the 2px border is already spent before the avatar's timing is considered (the pre-coupling code already spilled 0.45px). The parked critically-damped-close recommendation is the root fix. Coupling costs 0.8px more.
- **`npx tsc --noEmit` fails on `example/flagship/main.tsx(5,25)` — `Cannot find module './portrait.jpg'`.** Pre-existing, missing an image module declaration. No suite runs bare `tsc`, so nothing catches it.
- **The prod consumer app resolves `motion@13.1.1`; the geometry suite runs v12.** Every number in this pass was measured on v13 in the consumer and gated on v12 in the suite. Already parked above; recording that the split is now load-bearing for the motion evidence.
- **`npm pack` still does not run `build:lib`** (the parked `prepack` item). Every build/pack/install cycle in this pass had to run `build:lib` by hand first and grep the installed `dist/` to prove the change shipped.
- **`~/Code/_experiments/disc-sheet-consumer/package.json` now points at `file:../../disc-sheet/seansmithworks-disc-sheet-0.1.0.tgz`** — npm rewrote it when installed by path. It resolves to the repo's own tarball, so a `npm install` there without a prior `npm run build:lib` + `npm pack` silently reuses whatever was last built.

## Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

Sean's verdict on the coupled close: "really close." Two directional notes + one tool ask.

- [x] Expose `surfaceCloseLeadDelayMs` as a Root prop. README + PACKAGE-DESIGN §3 updated: the row moved OUT of §3's internal table and out of the "deliberately NOT exposed" table into the props table, with the reason (it is a duration with a taste answer, not a suppressed artifact).
- [x] Tuner on a NEW `/tune` route in the prod consumer, built on **dialkit 1.4.3** (`DialRoot mode="inline" productionEnabled`, `useDialKitController`, two `SpringControl`s + one `Slider`, its own PresetManager + Copy). `/` untouched.
- [x] Close path only, structurally: `transition.open` is never passed, so no dial can reach the open.
- [x] Live readout (hand-built — dialkit is inputs only): arrival gap ms + min avatar inset px, median of the runs since the last dial change. Rest-state sanity verified at exactly [2,2,2,2] px.
- [x] Persistence + copy are dialkit's: `persist: true`, `id: "disc-sheet-close"` → localStorage key **`dialkit:disc-sheet-close`**. Preset dropdown holds "Version 1" (= shipped defaults) and a seeded **"Phase 4 (77f6d9b)"** for the A/B.
- [x] Strawman applied to the shipped defaults: `DEFAULT_CLOSE_SPRING` 375/32/1 → **317.4/29.44/1** (k=0.92), `DEFAULT_SHARED_CLOSE_SPRING` 305/28.9/1 → **220.3625/24.565/1** (k=0.85). Damping ratios preserved (0.826 / 0.827).

### Measured on the prod consumer at 1280x800, median of 7 closes each, one instrument

| | arrival gap | min inset | total close | box arrives | avatar arrives |
| --- | --- | --- | --- | --- | --- |
| Phase 4 (77f6d9b) | **+8.4ms** | **−1.24px** | 497ms | 489ms | 497ms |
| Strawman (0.92 / 0.85) | **+58.3ms** | **−1.16px** | 586ms | 530ms | 586ms |

- The strawman does **not** spill worse: −1.16px vs −1.24px, i.e. 0.08px BETTER. The spill is set by the shell's overshoot pulling the box narrower than the avatar's resting 124px, not by the avatar's timing — both figures were stable to ±0.01px across 7 runs. The parked critically-damped-close item remains the root fix.
- It does cost **+50ms of avatar trail and +89ms of total close** (586ms), which is LONGER than the 573ms that motivated dropping the lead delay 100 → 35. The close is now paced by the avatar, not the shell.
- Found while verifying the dials: **lead delay 90 takes the strawman's gap to 0.0ms at no cost in total close** (581ms either way), because it delays the shell into the slowed avatar rather than slowing anything further. That is the cheapest way to re-couple the pair if Sean keeps the slower avatar.
- Sign convention: this instrument reads Phase 4 at **+8.4ms** (avatar trailing). PACKAGE-DESIGN §3 recorded "+25ms" and this BACKLOG recorded "−33.2ms" for the same commit — the two prior records disagree in sign and the scratchpad that would settle it is gone. All numbers above come from ONE instrument, so the deltas are sound even though the absolute Phase-4 figure does not match the −33.2ms line.

- [ ] **Sean's call — the tuner is live at http://localhost:3000/tune** (prod build, detached server). Dial it, then hand back either the panel's Copy JSON or just say "read the key" and the dialed values come out of `dialkit:disc-sheet-close`.

## Tuner productization (Sean, 2026-08-31 — from the /tune session)

- [ ] **Ship the tuner via `npx disc-sheet add tuner`, NOT as a package dependency.** Scaffolds a `/tune` route + dialkit as a devDependency into the consumer's app, reusing Phase 2's tested copy-in machinery. Rationale for not depending on it: the package has zero runtime deps today (motion is a peer); dialkit's stylesheet @imports Geist Mono from Google Fonts, which would put an external request in every consumer app forever; and a tuning panel reachable from a production bundle is a footgun.
- [ ] **Shadow dials — do these first.** `DiscSheet.Shadow` is already a component with tokens; offset/blur/opacity dials are cheap and carry no correctness risk.
- [ ] **Shape dials (circle/squircle/square) — GATED behind child-radius masking.** Adding the dial before the masking ships a control whose every non-circle setting looks broken: the shared CONTENT must mask to the same shape, tracking the ANIMATED radius, or it reproduces the accidental-squircle bug (disc surface squircle, portrait still circular). A true iOS squircle is a superellipse; border-radius approximates it, exact needs clip-path, which does NOT interpolate through the FLIP the way the radius MotionValue does. See the v0.2 "Shape presets" item above — same constraint.
- [ ] **Dither / other visual treatments** — new surface, not a dial on something existing. Separate and larger.

## Tuning snapshots (2026-08-31)

`docs/tuning/dialkit-disc-sheet-close.json` (34dc0ab) is a byte-exact snapshot of Sean's `dialkit:disc-sheet-close` localStorage. Holds V1/base, Phase 4 (77f6d9b), V3, V4. Restore by writing it back to that key. The consumer app at ~/Code/_experiments/disc-sheet-consumer has NO git, so this repo is the only durable home for dialled values.

- [ ] **V4 is Sean's pick and it reverses the strawman's direction.** V4: shell 375/32/1, avatar 340/30/1, lead 35, fill 0.45. The avatar is FASTER than both Phase 4 (305/28.9) and the shipped strawman (220.36/24.565) — wn 18.4 vs 17.5 vs 14.9. The shipped default is currently the slowest avatar, i.e. the one he likes least. Decide whether to bake V4 into motion.ts as the new default.

## Checkpoint — 2026-09-01 (wrap-continue)

**Closed this session:** Phase 4 coupling (bf48b0a) · lead-delay strawman 100→35 (77f6d9b) · /tune dialkit tuner (987e2ff) · V4 baked as shipped defaults (23c3c49) · preset snapshot to disk (34dc0ab). Gates 20/75 verified by the orchestrator, not just claimed, at every step.

**Carried (on-objective):**
- [x] **Sean's hands-on verdict on the production build at :3000.** CLOSED 2026-09-01 — "It's looking good." V4 stands as the shipped motion default; the motion objective is done and is not to be reopened.
- [ ] ~~`npm login` && `npm publish --access public`~~ **ON HOLD — do NOT publish.** Sean decided 2026-09-01 to hold 0.1.0 and ship one bigger first release including the variations/settings work below. Publishing now would burn the version number and force the API expansion into a 0.2 it no longer needs to be. Merge to main also waits.

**Parked (off-objective, do not carry into the next thread):**
- [ ] Consumer app has no version control — `git init` at ~/Code/_experiments/disc-sheet-consumer offered, not done. /tune exists only on disk.
- [ ] 4 orphaned next-server processes on ports 3921-3924 (dead session scratchpad `.../d4c0a3bb-.../consumer-next`). Offered to reap, Sean did not answer.
- [ ] Arrival-gap SIGN CONVENTION is unresolved: 77f6d9b reads −33.2ms (BACKLOG), +25ms (PACKAGE-DESIGN §3) and +8.4ms (the /tune rig) for the same commit. Deltas from any one instrument are sound; the absolute figure is not citable. Settle it or delete two of the three records.
- [ ] `tsc --noEmit` fails pre-existing on `example/flagship/main.tsx:5` (missing `./portrait.jpg` module). No suite runs bare tsc.
- [ ] Consumer resolves motion@13.1.1 while the geometry suite gates on v12. Untested combination.
- [ ] `npm pack` still does not run `build:lib` (the prepack item). Every ship cycle this session needed a manual build + dist grep to prove the change shipped.
- [ ] dialkit's stylesheet @imports Geist Mono from Google Fonts — external request on /tune.

## 0.1.0 scope expansion — variations + settings (decided 2026-09-01)

**Decision:** Sean is HOLDING the 0.1.0 release to widen the public API first, against the orchestrator's recommendation to ship now and add additively as 0.2. Recorded so the tradeoff is not re-litigated: holding keeps the API reshapeable including breaking changes, and costs a shipped package in the meantime. His call, made with that tradeoff stated.

**Scope Sean selected (all four, plus a research question):**
- [ ] Motion presets — named springs so consumers pick a feel instead of hand-tuning stiffness/damping; /tune becomes a preset picker that exports values.
- [ ] Shape + size variations — circle/squircle/square, size ramps, sheet dimensions. **GATED** on animated child-radius masking (see the v0.2 shape-presets item above — same constraint, unchanged).
- [ ] Layout + behavior settings — anchors, placement, backdrop, dismiss, controlled/uncontrolled.
- [ ] One unified config surface — CSS custom properties + config object, design-system drop-in shape.
- [ ] Answer: what do standard UI toolkits commonly ship that disc-sheet does not? Gap analysis against the real source, not a listicle.

**Status:** scoping dispatched to /adversarial-plan 2026-09-01. Plan to be delivered as an Artifact (Sean is on phone; localhost review is unreachable). No implementation dispatched until Sean picks a cut.

## Plan gate CLOSED — /adversarial-plan verdict RETHINK (2026-09-01)

Evidence on disk: `scratchpad/plan/{draft-plan.md,refuter-prompt.txt,refutation.md}`. Opus refuter, 20 findings, read the tree not just the prose.

**The draft's headline recommendation was killed.** Proposed adding `<DiscSheet.Portal>`; it is unsafe here and fails existing tests. `--disc-sheet-disc-size` is written ONLY by Root's scoped style block (`Root.tsx:403-405`) and read to size the shared element (`styles.module.css:98-105`); custom properties inherit down the DOM tree, so portalling severs it and the sheet-side Shared falls to the 92px fallback against the disc-side's real size. That equality is what the zero-scale FLIP requires. Also: portalling the sheet ALONE unpairs it from the disc (both are position:fixed and shift identically under a transformed ancestor, so the morph currently stays coherent); portalling both re-opens the measured 0.000-visibility crossfade bug (`Disc.tsx:283-315`); and an SSR-safe portal deletes the first-paint window the D3 disc-size fix depends on (`Root.tsx:86-107`). Correct fix is a README section, not a Portal part. DO NOT re-propose a portal without solving token forwarding first.

**Real defects the gate surfaced — fix regardless of any naming or configurator decision:**
- [ ] `src/types.ts:80-84` JSDoc on the PUBLIC `surfaceCloseLeadDelayMs` prop says `transition.shared.close` "is derived from this value". FALSE since V4. It compiles into `dist/index.d.ts` and every consumer's IntelliSense. A consumer who raises the lead delay trusting the doc gets the avatar spilling past the disc's 2px border.
- [ ] `src/motion.ts:57` and `:81-83` assert the same dead derivation, contradicted by `:102-110` in the same file. Four stale sites total, not two.
- [ ] Focus trap does not trap (`useDialogBehavior.ts:54-70`): Tab is only intercepted when activeElement is already the first or last focusable INSIDE the panel. Focus anywhere else and Tab walks out. Plus a 50ms setTimeout before initial focus where the trap is inert.
- [ ] No background `aria-hidden`/`inert`. `aria-modal="true"` (`Sheet.tsx:284`) is a hint browsers do not act on. Screen readers read the whole page behind the sheet.
- [ ] Scroll lock sets `body.overflow=hidden` with no scrollbar compensation — visible ~15px sideways page shift on open, on a library whose whole pitch is motion quality.
- [ ] Geometry gate has never run against motion@13, which the verification consumer resolves. The only instrument that can prove the V4 feel survived a refactor does not cover the environment it is judged in.
- [ ] `index.ts:61-67` exports five runtime geometry helpers (`anchorCenter`, `nearestAnchor`, `restingLeft`, `restingTop`, `sheetPlacement`). Decide before publish whether these are public forever.

**Corrections to earlier scoping:**
- Preset shape: a `preset` OBJECT prop on Root carrying `{transition, surfaceCloseLeadDelayMs, sharedSize}` is the only shape that round-trips the tuner's export (`docs/tuning/dialkit-disc-sheet-close.json` = discShell/avatar/leadDelay/avatarFill). Passing a spring object into the existing `transition` prop reaches 2 of 4 fields.
- The tuner's `baseValues` already stores `{visualDuration, bounce}` — Motion's designer-facing spring format. Adopt it as a `Spring` union member.
- `asChild` on all 8 parts is not viable: Sheet/Disc/Shared/Content carry layoutId, drag, MotionValues and load-bearing refs. Safe on Close and Item only.
- `forwardRef` is deprecated in React 19 and the peer floor is >=19. Its absence was correct, not a gap.
- `EDGE_MARGIN` tokenization is not one line: `anchors.ts` is documented pure, tests import the constant, four public signatures would change, and there are ~6 hardcoded 16s including a separate `SHEET_MARGIN`.
- `/tune` lives in the unversioned consumer app, not this repo. BACKLOG:114 already decided the delivery: `npx disc-sheet add tuner`.
- Sheet dimensions are NOT already shipped: `max-height: 88dvh` and `bottom: 16px` are hardcoded with no token or prop.

## New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- [ ] **Visual configurator on the site.** Pick a variation, see it live, copy the code, paste it in. Two install paths: npm, or copy-paste from the tool. shadcn model. Covers disc shape AND sheet content layouts. Answers to "where does it live" and "does it replace the API work" came back as "both, site first" / "both in parallel" but arrived alongside a background-task notification the harness flagged as unverifiable. NOT treated as confirmed.
- [ ] **Showcase examples with media**, tied to the already-parked "icon to advertisement" concept: iOS-squircle app icon morphing into an App Store-style preview card. Plus a full-size-image variant.
- [ ] **Naming system across all Sean's components/tools/frameworks.** Immediate trigger: "disc-sheet" stops being accurate the moment the disc can be a squircle or a square, so shape variants and the package name are coupled. He wants a convention, not complex or fancy, but distinctive enough to be recognizable when shared. GATES PUBLISHING — the package name is in package.json, the npm scope, the README, and every import line.
- [x] CONFIRMED 2026-09-01: the configurator answers ("both, site first" / "both in parallel") ARE Sean's. Build against them.
- [x] "the ditter" = **dither** — one of Sean's other tools/effects that needs more work (cf. the surface-fx dither). Another package the naming system has to cover, and a reason the system matters more than this one name.
- [ ] Still unparsed from dictation: "puppy tier agent" (guess: agent-pasteable registry output, shadcn-style) and "out of the LinkedIn app around".

## ⛔ SCOPE — LOCKED 2026-09-01. Read this before planning anything in this repo.

**Objective:** Ship `@seansmithworks/morph-sheet` as a component a stranger can install and actually use, promoted from seansmithdesign.com. Sean's framing: "I need to start shipping the things I'm building for fun." The site is a demo platform to show teams how he works, so the page promotes the component AND him; npm and GitHub are the other two doors in.

**Order Sean set:** component + how it's used FIRST (CLI install, local visual reference), THEN the site.

**Done when:**
- [ ] A stranger can change how it feels without typing spring numbers
- [ ] A local visual reference lives in THIS repo (today /tune exists only in the unversioned consumer app)
- [ ] One example answers "why would I want this", not just "it works"
- [ ] Published to npm, public on GitHub
- [ ] One page on the site: example gallery first, dials on ONE specimen

**NOT in scope — do not widen into these:**
- A component system or platform. "The first of a system is not important." Later he wants to define components-vs-skills as a process case study; that is a SEPARATE effort.
- Content layouts as package exports. Content stays any-children; presets (list, image, video, app promo) ship as `npx morph-sheet add` copy-in so visual tweaks are never breaking changes.
- A React portal. Investigated and killed; see the plan-gate section above.
- Shape variants, unless animated child-radius masking lands first.

**Fixed engineering decisions (do not re-litigate):**
- Motion presets = a `preset` OBJECT prop on Root carrying `{transition, surfaceCloseLeadDelayMs, sharedSize}`. Only shape that round-trips the tuner's 4-field export. NOT a `preset="snappy"` string union — zero of five peer libraries ship named presets; react-spring's exported `config` objects are the precedent.
- Adopt Motion's `{visualDuration, bounce}` as a `Spring` union member — two designer-legible numbers. The tuner's own baseValues already store springs that way.
- The default preset ships the dialled values EXACTLY: open 375/42.5/1.75, close 375/32/1, shared.open 500/45, shared.close 340/30/1, lead delay 35, snap 700/52/1.

## Overnight delivery run — dispatched 2026-09-02 (Sean asleep; NO publish, NO deploy)

Sean's two calls at dispatch: snappy/gentle ship as **marked strawmen** tonight (re-dial on the tuner in the morning, one line each); examples = **all three** (media/app-promo card FIRST since it doubles as the site hero, then simple list, then form/contact).

Sequential dispatch, not parallel — every phase commits to `feat/customization-parity` in the same worktree, and parallel pushes there race silently. Each phase: gates re-run by the orchestrator (20 vitest / 75 Playwright / audit PASS, never bare `npx playwright test`), then a reviewer agent that did not write the code.

**Correction to the locked scope's third preset key.** The lock says the preset object carries `{transition, surfaceCloseLeadDelayMs, sharedSize}`. Verified this session: **`sharedSize` is not a prop and nothing in `src/` reads it** — the size prop is `triggerSize`, and `--morph-sheet-shared-size` is a CSS var that defaults to the trigger size. The tuner's four exported fields map to `transition.close` (discShell), `transition.shared.close` (avatar), `surfaceCloseLeadDelayMs` (leadDelay), and nothing (avatarFill, "diagnostic, not choreography" per its own comment). So **two keys round-trip the tuner completely**. Flagged to Sean before dispatch, not objected to. Building `{transition, surfaceCloseLeadDelayMs}`; size stays the separate `triggerSize` prop it already is.

- [x] Phase 1 (2544796 + fixes 5345f0b) — motion presets — DONE. Reviewed by a non-builder, all 8 findings fixed and re-gated by the orchestrator: 36 vitest / 75 Playwright / audit PASS. Freeze confirmed at runtime, both levels. The 8 fake tests were replaced with 12 real ones, red/green watched: `preset` object prop on Root (explicit `transition`/`surfaceCloseLeadDelayMs` win over it), exported `presets` with `default`/`snappy`/`gentle`, `{visualDuration, bounce}` accepted as a `Spring` union member. `default` REFERENCES the shipped constants so byte-identity is structural, not copied. snappy/gentle marked un-dialled in code.
- [x] Phase 2 (ec2ca6c) — tuner into this repo — DONE, gates re-verified by orchestrator (32 vitest / 75 Playwright / audit PASS), zero runtime deps preserved, dialkit is a devDep: ships via `npx morph-sheet add tuner` copy-in (Phase 2 machinery), NOT a package dep. Source is the working 14K page.tsx + CSS in the unversioned `~/Code/_experiments/disc-sheet-consumer/src/app/tune`. Shape dials stay GATED behind child-radius masking.
- [x] Phase 3 (e6d4c41) — examples, all three — BUILT, gates green, screenshots sent to Sean. OPEN TASTE ITEM: list + contact float a small glyph in the trigger-sized shared box and leave ~100px dead space above the heading; media-card avoids it because its icon FILLS the circle. Palettes/copy/fictional app are arbitrary strawmen: media/app-promo card first, then simple list, then form/contact. Tokens from the README table, never PACKAGE-DESIGN §2 (stale).
- [x] Phase 4 (f6072a2) — `"use client"` runtime guard — DONE. Dev-only, THROWS (fatal: nothing renders without hooks), wraps Root's first `useId()`. Repro confirmed a forgotten directive gives React's generic `Invalid hook call`, naming neither the package nor the fix: a loud, named failure for the RSC trap. Today it is one README sentence and no check in `src/`.
- [x] Phase 5 (4fa3929) — motion peer pinned to `>=12 <14` — v13.1.1 ran the FULL suite green (36 vitest / 75 Playwright), so the range is honest rather than optimistic. Tree restored to motion@12.43.0 and re-confirmed green. NOTE: a first v13 pass showed 15 phantom failures that were two `test:geometry` runs racing over the shared --strictPort server, NOT a v13 regression: peer says `>=12`, suite has never run against v13, Sean's own consumer resolves v13. Test against v13 and pin to what actually passes. **If v13 fails the suite, STOP and report — do not widen the range to make it green.**
- [ ] Phase 6 — rebuild the consumer app on :3000 (build:lib -> pack -> reinstall -> rebuild -> restart) so Sean has something to put his hands on. Broken by the rename since 40c0b8c.
- [ ] **Item 6 PUBLISH is Sean's hands, not mine** — `npm login`, `npm publish`, repo public on GitHub. Outward-facing + needs his auth.
- [ ] Item 7 site page — NOT overnight work, different repo.

### Phase 1 review findings (commit 2544796) — reviewer was NOT the builder, 2026-09-02

All eight CONFIRMED by the reviewer running code, not reading it. Verified clean first: dialled values byte-unchanged, `presets.default` deep-equal to no-preset on both directions, scaling math exact, reduced-motion and tween-fallthrough intact.

Queued behind Phase 2 — same branch, same worktree, so only one agent commits at a time.

- [x] **F1 (most severe) `DurationSpring.mass` is a silent-failure trap.** Motion DISCARDS `visualDuration`+`bounce` whenever `mass` is present (`spring.mjs` gates on `physicsKeys` first), falling back to stiffness 100 / damping 10. Measured settle on a 0→100 keyframe: `{visualDuration:0.4, bounce:0.2}` = 660ms, same plus `mass:1.75` = **2080ms**. A designer copying the README example and adding the package's own documented `mass: 1.75` type-checks and gets a 2s floppy wobble with no warning. **Fix: `mass` must not exist on `DurationSpring`.**
- [x] **F2 preset + partial directional `shared` inverts the arrival gap.** `Root.tsx:165` replaces `shared` wholesale, then the per-key fallback reaches the PACKAGE default rather than the preset's. `preset={presets.snappy} transition={{shared:{open:x}}}` resolves the close shared to 340/30/1 instead of snappy's 449.65/34.5, so the shared element TRAILS the box by 45ms where all-snappy leads by 10ms. This is precisely the spill-past-the-2px-border failure that `DEFAULT_SHARED_CLOSE_SPRING`'s comment and the README both warn about. **Fix: fall back per-direction to the preset's `shared`, not the package default.**
- [x] **F3 four of the eight new tests cannot fail.** `motion.test.ts:27-79` re-declares Root's merge expression inside the test body and asserts the result against its own operand — line 71 reduces to `expect(x).toBe(x)`. **`Root.tsx` is imported by no test in the repo.** Inverting the precedence in `Root.tsx:145` would break every explicit `transition` prop and all 28 tests would still pass. The headline feature has zero real coverage while reading as four green tests. **Fix is structural: extract `resolveMotion(...)` from Root's body into `motion.ts` and test THAT.** Tests 1, 6, 7, 8 are real; 7 (tween stays a tween) is the most valuable guard in the file.
- [x] **F6 `presets` is mutable and shares references with the internal defaults.** The byte-identity-by-reference design means `presets.default.transition.open === DEFAULT_OPEN_SPRING`. The natural clone `{...presets.default}` copies `transition` by reference, so mutating it poisons `presets.default` app-wide; one level deeper it poisons `DEFAULT_OPEN_SPRING` and the no-preset path. Reviewer reproduced both. **Fix: deep freeze.**
- [x] **F5 README advertises `bounce` without saying which spelling works.** `{duration:0.4, bounce:0.2}` is valid Motion syntax but `isSpringShorthand` rejects `duration`, so it runs as a TWEEN and `bounce` is silently dropped. Pre-existing, but the README newly invites it. **Fix: advertise `visualDuration` only.** Also `README.md:241` is now stale — still says springs accept only `{stiffness, damping, mass?}`.
- [x] **F4 README overstates "field by field".** `shared` is replaced whole, not merged; that carve-out lives only in a code comment. F2 is what a consumer hits as a result.
- [x] **F8 `Spring` became a union but its members are unexported.** A consumer holding a `Spring` and reading `.stiffness` now needs narrowing, and cannot write the narrowing helper because `StiffnessSpring`/`DurationSpring` are unnameable from outside. Breaking, but free right now — still 404 on npm. **Fix: export both.**
- [x] **F7 `visualDuration` alone is undefined behaviour.** Motion's `durationKeys` is `["duration","bounce"]` — `visualDuration` is not in it, so `{visualDuration:0.4}` with no `bounce` settles in 1050ms on Motion's defaults. `DurationSpring` requiring `bounce` is the only guard, and it reads as arbitrary strictness against Motion's own optional `bounce`. **Fix: a comment recording why, so the next person "matching Motion's types" does not open the hole.** (`bounce: 0` is safe; the guard tests `!== undefined`.)

### ⚠️ Dial history orphaned by the panel-id rename — Sean's call, 2026-09-02

Phase 6 renamed `PANEL_ID` in the consumer's tuner from `disc-sheet-close` to `morph-sheet-close`, and Phase 2 shipped the repo copy already carrying the new id. dialkit persists under `dialkit:${id}`, so the panel now reads a **different localStorage key** and opens with no history — which is why it shows "Version 1" rather than the dialled Version 4.

**Nothing is lost.** Two independent recovery paths, both verified this session:
- The old key `dialkit:disc-sheet-close` is untouched in the browser. Nothing deleted it.
- `docs/tuning/dialkit-morph-sheet-close.json` is a committed byte-exact snapshot holding all three saved presets: `Phase 4 (77f6d9b)`, `Version 3`, `Version 4`.

The shipped defaults in `src/motion.ts` are unaffected — they are source constants, not panel state. The panel correctly displays 375 / 32 / 1.0.

Three options, none started because this is Sean's dial history and the choice is his:
1. Revert `PANEL_ID` to `disc-sheet-close` in both copies — history reappears immediately, but the id keeps a name the package no longer uses.
2. Keep the new id and add a one-time migration that copies the old key across when the new one is empty. Correct long-term, but it is new code in the tool that judges taste.
3. Keep the new id and import the committed JSON snapshot through the panel.

Deliberately NOT auto-migrated overnight: silently rewriting his saved dial state is not a call an agent should make while he is asleep.

Related, same area: the panel's visible dial label still reads **"Disc Shell"**. The KEY `discShell` must stay (renaming it drops the saved values inside each preset), but the display label is cosmetic and can change independently if dialkit separates the two.

## ⛔ Acceptance test findings — 2026-09-02, clean-install walk of the five-minute table

Run in a fresh Next app against the packed tarball (74.8K), motion resolved 13.1.1. All three verified independently by the orchestrator afterwards, not taken on the agent's report. **These block the locked objective — "a stranger can install and actually use it" — so they should land before publish.**

- [ ] **A1 (BLOCKS) — the README quickstart does not build as printed.** `README.md:128` is `function ContactTrigger()` with no `export default`, and nothing in the README says where to put it. A stranger's obvious move is pasting it into `app/page.tsx`, which fails the Next build with `Property 'default' is missing in type 'typeof import(".../page")'`. The component tree itself is correct and morphs fine once `export default` is added. **The delivery plan's claim that this snippet is "verbatim-tested" is false for the path a stranger actually takes.** Fix is one word.
- [ ] **A2 (BLOCKS the feature's whole point) — the `"use client"` guard is UNREACHABLE and never fires.** Verified: `src/index.ts` exports only the `MorphSheet` namespace object — there is **no named `Root` export** — so the only public path is the property access `MorphSheet.Root`. RSC rejects that property access on the client-reference namespace *before* Root's function body runs, so the guard sitting inside Root at `src/Root.tsx:57` is dead code for the only trap it was built for. A stranger who forgets the directive gets React's stock `Element type is invalid: expected a string... but got: undefined`, naming neither the package nor the fix. **The guard's own comment describes precisely the failure it cannot catch.** Fix must live at the module/namespace boundary — a top-level dev-only check in `index.ts` — not inside `Root.tsx`.
- [ ] **A3 (CONFUSES) — the `mass` trap is reopened by the union, and the README claims otherwise.** F1's fix correctly removed `mass` from `DurationSpring`, but `transition.open` and friends are typed `Spring | Transition` (`src/types.ts:36-57`), and Motion's own `Transition` permits `mass`. So `{visualDuration: 0.4, bounce: 0.2, mass: 1.75}` structurally matches `Transition` and **typechecks with zero error** — confirmed by an `@ts-expect-error` that TS reported as unused. `README.md:382` states the type "has no `mass` field specifically to prevent that", which is true of `DurationSpring` alone and false at the prop. The 660ms → 2080ms runtime footgun is live and undetected.

**Process note, worth more than the three findings.** Phases 4 and 5 were dispatched together and were the ONLY phases that did not get an independent reviewer — I folded them into one agent and skipped the review gate. A2 is the defect that gate would have caught, and it is the exact failure class the session already learned once (see the `green-tests-from-the-builder-are-not-evidence` memory). A3 is a second-order miss: the reviewer found F1, the fixer fixed the narrow type, and nobody re-checked whether the union reopened the hole. **A fix verified only against the finding that prompted it is not verified.**

Also unverified and worth a pass later: motion 12.x (the peer range floor — only 13.1.1 was exercised), the drag-to-reanchor interaction, keyboard/focus-trap behaviour in a real consumer, and the reduced-motion path.

## Item 3 CLOSED, item 2 blocked by tuner coverage — 2026-09-02

**Dead space in list/contact: diagnosed and fixed (`f4a4a72`).** Not a spacing bug. The sheet-side `<MorphSheet.Shared>` box is `calc(var(--morph-sheet-trigger-size, 96px) - 4px)` = **92px square**, and both examples set the icon ground to `--morph-sheet-surface-elevated` (`#ffffff`) on a white sheet — so the circle was an *invisible object*, not empty space, and a thin stroke glyph floated above it. media-card never had the problem because its gradient ground makes the same 92px circle read as an app icon. Size is NOT the lever: both Shared instances must resolve to the same box or the FLIP morph breaks.

- Variant A (applied): `background: color-mix(in srgb, var(--morph-sheet-accent) 14%, var(--morph-sheet-surface-elevated))`, glyph stroke unchanged.
- Variant B (not applied): solid `--morph-sheet-accent` ground, glyph stroke `#ffffff`. Diff lives in the session scratchpad and dies with it — **re-derive from this entry if wanted later, it is two lines.**
- Both are reversible taste strawmen. Awaiting Sean's pick; A is committed as the conservative default.

- [ ] **⚠️ `snappy`/`gentle` cannot be fully dialled on the current tuner.** Each preset carries FIVE values (`transition.open`, `transition.close`, `transition.shared.open`, `transition.shared.close`, `surfaceCloseLeadDelayMs`). `tuner/page.tsx:75` `DIAL_CONFIG` exposes exactly three of them — `discShell` → `transition.close`, `avatar` → `transition.shared.close`, `leadDelay` → `surfaceCloseLeadDelayMs` — plus `avatarFill`, a see-through diagnostic that lands in no field. The panel is titled "Close choreography" and that is all it is. **There is no dial for either open-direction spring**, which is the direction a stranger sees first. The backlog's earlier "one line each after a tuner pass" is therefore wrong: a tuner pass closes 3 of 5, and both presets stay half k-scaled strawman.
- [ ] Second gap: the tuner seeds from `SHIPPED` (the dialled default) and has no notion of which preset it is editing. Dialling `snappy` means dialling by eye, reading the numbers off, and hand-copying them into `SNAPPY_PRESET`.
- [ ] **Three options put to Sean, his call:** (1) dial close-only and re-document the open springs honestly as un-dialled; (2) extend the tuner with an open-direction panel first, then dial all four springs in one sitting; (3) **cut `snappy`/`gentle` from 0.1.0** and ship `presets.default` alone — the preset *API* is the load-bearing part and media-card already dogfoods it. Recommended 3, then 2 for v0.2: npm is a verified 404, so removing an export is free right now and a breaking change later.

## Figma export — parked until Sean is at the Mac (2026-09-02)

- [ ] **Mock the icon-treatment variations as editable Figma frames.** Sean's ask: "mock up the variations there and I will tweak some bits." Blocked on OAuth, not on the work.
- **Why it is blocked:** the Figma MCP (`plugin:figma:figma`, https://mcp.figma.com) is installed but unauthenticated, and its OAuth redirects to `http://localhost:<random port>/callback`. From a phone that localhost is the phone, not the Mac running the session, so the code must be hand-copied out of a failed page and pasted back. Tried twice; the pending flow expired both times before the paste landed. **Fix is trivial and desktop-only: open the auth URL ON THE MAC and the callback completes silently with nothing to paste.** Do not attempt this from a phone again — it is the wrong tool for the transport.
- **Frames to build once authed:** six — before / variant A / variant B, for both the list and contact examples. Real layers with auto-layout, not flattened screenshots, so fills and strokes stay tweakable.
- **Values (Figma has no `color-mix`, so these are pre-resolved):** list accent `#2f6b4f`, A-wash `#E2EAE6`; contact accent `#6d4aff`, A-wash `#EBE6FF`; both sheets `#ffffff`, list page `#faf9f6`, contact page `#f7f5fb`. Circle 92px. Glyph 44% of circle at stroke 2 (list), 42% at stroke 1.6 (contact).
- ⚠️ **Drift warning, stated to Sean:** a Figma file rebuilt from shipped CSS is a second source of truth and does not flow back to code. Tweaks there must be hand-ported. Treat as sketchpad, not spec.
- [ ] **Correction to an earlier note:** `scratchpad/variant-b.diff` will NOT `git apply` any more — it was cut against the original white ground and its context lines stopped matching once variant A was committed at `f4a4a72`. Variant B is two lines: icon `background: var(--morph-sheet-accent)` and glyph `stroke: #ffffff`, in both `example/list/list.css` and `example/contact/contact.css`.

## PARKED — corner-spark micro-detail (research complete 2026-09-02, OFF the locked objective)

Sean's ask: a tiny comic-book mark firing at the tail of the open spring, in the corner opposite the disc. **Research only — `src/` untouched, nothing built.** This is a v0.2 idea against a release-ready package; it is parked deliberately, not carried.

**Live research artifact (the deliverable — this URL is the only copy):**
`https://claude.ai/code/artifact/75282297-73f7-4030-9d3c-cbce78ddb2ab`

- [ ] **Sean has not picked a mark.** Five candidates, all live and replayable in the artifact: emanata, kirakira star, dites/glint, Kirby Krackle, impact ticks.
- **Vocabulary (do not re-derive):** the mark is **emanata** — Mort Walker, *The Lexicon of Comicana*, 1980. Web motion-design vocabulary has NO term for it; the whole taxonomy is borrowed from comics. Per-fire variation is **line boil**. Manga twinkle is **kirakira**. Sean's references: Spider-Verse and KPop Demon Hunters, both Sony, both 2D accents composited over 3D.
- **Two corrections from Sean, both now reflected in the artifact.** (1) The mark must sit OUTSIDE the sheet silhouette — inside it stops being emanation and becomes texture. (2) It must never draw the same twice; a fixed SVG repeated on every open is what makes a micro-detail wear out.
- **Measured this session on the real dialled open spring (375/42.5/1.75):** settles at **638ms**, overshoot peaks at **392ms**. Damping ratio 0.83, matching the 0.826 documented in `motion.ts` — so the artifact's rig is running the real spring, not an easing approximation. **A negative delay (~-240ms, landing on the overshoot peak) is the promising setting**; the last ~250ms of that spring is invisible micro-settling, so firing at true rest reads late.
- **⚠️ Architectural blocker, verified in source.** `.sheet` carries `overflow: hidden` (`src/styles.module.css:159`), so the mark CANNOT be a child of the sheet — it would be clipped at the exact edge it must cross. It has to be a sibling. And only half the sheet's box is knowable from CSS: left comes from `--morph-sheet-sheet-left` with a `bottom: 16px` default, but `src/Sheet.tsx:211-218` overrides `top`/`bottom`/`maxHeight` inline when the trigger anchors high, and height is content-driven under `max-height: 88dvh`. **The top corners are not derivable from CSS at all**, and they are usually the corner wanted. Way through, no portal needed: one `getBoundingClientRect()` at settle, then a fixed-position sibling. The mark fires once and is gone, so a single measurement suffices.
- **Do NOT add Rough.js.** It is the obvious library (~9kB, seeded randomness) and it is the wrong call — the generator is ~30 lines, and this package ships zero runtime dependencies with a deliberately tight peer range.
- **Corner is a lookup, not a constant** — six trigger anchors. Both centre anchors have no true opposite and need an arbitrary pick (defaulted right; taste, not derivation).
- [ ] **Four open decisions, all Sean's:** which mark · every open vs first-open-per-session · reduced-motion (drop or show static) · opt-in prop vs on by default. Recommendation on the last: **opt-in** — comic emanata are a strong personality choice for a generic primitive.

## Sean's expansion asks — 2026-09-12 (playground, shapes, buttons, media)

Voice note after testing the design-settings sheet on his phone. Planning in flight (planner draft → plan Artifact). Several asks reopen the SCOPE LOCK above — Sean's call.

Plan (reviewed by a second agent): https://claude.ai/code/artifact/1ab67c7c-1efc-4fbf-a3eb-717a66f36745 — P1 playground page · P2 radius shapes · P3 rectangle/button triggers · P4 video + aspect-ratio sheets. Open calls: reopen lock for buttons + aspect ratio; Safari squircle approximation; squircle vs rounded-square corner definitions; rectangle width author-set vs from label; 09-01 release hold.
- **DECIDED 2026-09-13 (Sean) — 0.1.0 release hold stays.** "We are close." Phases get discussed before release; Sean wants a time estimate per phase before he picks the cut line (estimates added to the plan Artifact).
- **DECIDED 2026-09-13 (Sean) — Safari squircle ships as an approximation.** Where `corner-shape: squircle` is unsupported (stable Safari/Firefox), the surface falls back to a tuned radius. P2 must: (a) put a code comment at the squircle CSS rule naming the Safari gap and what to change once `corner-shape` ships in stable WebKit; (b) add one short line to README browser support. Don't over-document.

- [ ] The design-settings panel becomes the WYSIWYG "copy tool" — a playground page reached from npm to play with the component and copy what you build. (extends: line 181 "Visual configurator on the site")
- [ ] Trigger shape presets: circle, squircle, square, star with outer points (configurable point count, e.g. 8, with a corner radius on the points). (extends: line 41 "Shape presets") — reopens SCOPE LOCK → DECIDED 2026-09-13 (Sean): v0.2 ships circle, squircle, rounded-corner square, square, rectangle (buttons). Star → future release.
- [ ] Custom shapes definable by any developer or agent, beyond the presets. (new) — reopens SCOPE LOCK → DEFERRED 2026-09-13 (Sean): future release, not v0.2.
- [ ] Button-style triggers: rectangle/pill at small/medium/large with icon, icon+text, or text; by extension a search box or chat input as the trigger. (new)
- [ ] Sheet content presets: list, grid, navigation, media. (extends: line 203 "Content layouts as package exports") — reopens SCOPE LOCK
- [x] Video sheet: a circle with Sean's picture expands to full video content. (extends: line 42 "icon to advertisement") — P4 on v02/p4-media (placeholder clip; Sean swaps in his video)
- [x] Media aspect ratios — the sheet sizes to the media, whether tall/phone portrait, wide, or narrow. (extends: line 148 "Shape + size variations") — P4 on v02/p4-media (placeholder clip; Sean swaps in his video)
P4 deferred (2026-09-13):
- [ ] Playback-time handoff between the trigger and sheet Media instances (today both start at 0; visible as a content cut mid-close).
- [ ] A cover focal point for a real portrait (centred crop may cut a face in the disc).
- [ ] Safari/iOS untested for aspect sheets (px size from innerHeight vs the dvh max-height cap).
- [ ] Sean eyeball pass on the video close crossfade and the close-button contrast over footage.
- [ ] The intent is prepackaged presets that show how flexible the tool is. (extends: line 182 "Showcase examples with media")

## Carried at wrap-continue — 2026-09-02

- [ ] **Variant A vs B for the list/contact icon ground.** A (14% accent wash) is applied and committed at `f4a4a72`; B (solid accent, white glyph) was shown and not chosen. A stands as the default — this is not blocking. B is two lines: icon `background: var(--morph-sheet-accent)` and glyph `stroke: #ffffff` in both example CSS files.

## Idea (Sean, 2026-09-11, late) — lean into the "flare": a ripple on open

- [ ] **Turn the open's shadow flare into a deliberate ripple.** The flare itself was a defect (duplicate shadow, fixed `4a975d5`), but a ripple that radiates from the disc as the sheet blooms is a real idea, and the seam already exists: `<MorphSheet.Shadow asChild>` plus `useMorphSheet().collapseProgress`. surface-fx has `sheetBloom` + `useRippleEngine` (`~/Code/surface-fx/src/ripple/`), and the site's ContactSheet does this today. Demo-only first, behind the same toggle as the glow, judged with `DESIGN.md` §4 (transform/opacity only, one clock). Sean's framing: "if this doesn't work we can explore a pivot" — explore only after the current fix has been recorded and judged.

## Carried at wrap-continue — 2026-09-11 (thread DiskSheet)

- [x] **closed — shadow pop.** Sean re-recorded and judged the fix (`4a975d5`, glow OFF): "much better" on a6ebc97 clips, then "overall it is looking a lot smoother". Root fix `2aab652`/`0b1ab42`, write-up `docs/solutions/ui-bugs/shadow-pop-two-painters-velocity-inferred-mask.md`.
- [x] **closed — `npm run perf` gate.** Headless GPU gate (PipelineReporter dropped frames + longest interval + raster, load gate, per-window trace floor, injection self-checks), baseline `f6239aa`, fixes `ea585c8`. Orchestrator re-ran plain (PASS), `--inject-block` (exit 1) and `PERF_DROP_WINDOW=open` (instrument error, exit 1). Known limit: GPU cost that only appears on the real display path passes headless (README).
- [x] **carried — `npm run perf` gate** (audit item 3): `scripts/perf-morph.mjs` — own vite server on :5190, headed Chromium, 5 warm cycles, CDP RasterTask ms + `Page.screencastFrame` count, `perf/baseline.json` checked in, tolerance-based pass/fail. Judged glow OFF; 2 warm-up cycles discarded. Gate proven to fire on injected main-thread jank (`--inject-jank`); the demo's glow toggle turned out compositor-only on this GPU and does not move either metric — noted in the report, not treated as a gate defect. (`2616d49`)
- [ ] **carried — audit doc review**: `docs/plans/motion-craft-audit.html` is open in html-review (session `sess_1e7f46c0`); Sean has not commented yet.
- [ ] **parked — Close X scale-from-0 spin** is a deliberate deviation from "start at 0.9+" (DESIGN.md §4.5); revisit only if it reads as popping in a recording.

## Shadow-pop root fix — dispatched 2026-09-11 (one painter, one clock)

Root cause: two painters (`<MorphSheet.Shadow>` + `.sheet[data-morph-sheet-settled]`) plus `example/CloseMask.tsx` inferring "closing" from `getVelocity()` sign, which the open spring's overshoot rebound also satisfies — mask clips the sheet's box-shadow for one frame at settle.

- [x] Step 1 — `<MorphSheet.Shadow>` paints both looks (disc + sheet shadow), crossfaded by opacity derived from `collapseProgress`, clamped 0..1. (`2aab652`)
- [x] Step 2 — crossfade window exposed as a dial (CSS custom properties, read via `readVarPx`), example DialKit slider added. (`09c3daa`)
- [x] Step 3 — remove `.sheet[data-morph-sheet-settled]`'s own box-shadow; keep the attribute (Close reveal depends on it). (`2aab652`)
- [x] Step 4 — opacity values exposed as `--morph-sheet-*` custom properties for `asChild` consumers; documented in README. (`2aab652`)
- [x] Step 5 — `example/CloseMask.tsx` fixed at the root: derive "closing" from `open === false`, not `getVelocity()` sign (velocity is positive during an open's overshoot rebound too). (`0b1ab42`)
- [x] Step 6 — docs: README theming table + DOM contract prose, DESIGN.md §3/§4.1. (`2aab652`)

## Glow palettes for social clips — 2026-09-11

- [x] Step 1 — palette presets in the example demo (Rainbow/Mono/Midnight Purple/Neon Gold) via DialKit's native select control, wired to the existing dials (`3cbac96`)
- [x] Step 2 — recordings: 8 clips + 2 comparison grids, light and dark backgrounds (scratchpad, not committed — see report)
- [x] Step 3 — report to Sean: SHAs, final values, gate summaries, clip paths, frame notes

## Center anchor — 2026-09-11

- [x] `src/anchors.ts` — two-axis alignment model (`ANCHOR_AXES`), new `"center"` id, `AnchorEdge` → `AnchorVertical`
- [x] `src/anchors.test.ts` — hard-coded pins for the six existing anchors, center coverage, boundary/round-trip tests
- [x] `src/Sheet.tsx` — always write inline top/bottom
- [x] `src/styles.module.css` `.sheet` — margin-block/fit-content centring, max-height formula
- [x] `src/index.ts` — export renamed `AnchorVertical` type
- [x] `example/geometry.spec.ts` — center-anchor geometry gate (own centre-offset assertion, not the bottom-edge one)
- [x] Docs — README "six"→"seven", `docs/PACKAGE-DESIGN.md` §1, `example/main.tsx` copy
- [x] Visual proof clip (agent-browser, Neon Gold, center anchor) + report to Sean

**Edge-aware ripple (Sean, 2026-09-11):** when the sheet sits against a viewport edge/corner, the dither shadow's ripple reflects off that edge and flows back, blending with the continuing outward wave — like ripples off a pool wall. surface-fx's ripple is an analytic annulus band (presets.ts), so reflection is likely mirrored virtual sources across nearby edges (inferred, not verified). Consumer-side via `<MorphSheet.Shadow asChild>` + useMorphSheet() anchor/rects. Decorative clock — flag against DESIGN.md §4.1 before building.

## Honest perf gate — 2026-09-11 (headless, PipelineReporter)

- [x] Ground truth sanity-checked: plain warm cycle 70 distinct frames headed, 68 headless (old clips were broken: 8 and 1)
- [x] Gate rewritten: dropped frames + longest presented interval, screencast removed, new headless on ANGLE Metal, software renderer refused (`261653c`)
- [x] Each metric proven to fire headless: jank 108 dropped, block 150ms, gpu (48 layers) 142 dropped, +unrelated animation 111 / 150ms
- [x] Rebaseline on a quiet machine (load1 2.5–2.8): raster 55.7ms, 1 dropped, 16.7ms longest interval (`f6239aa`)
- [x] Headless raster vs headed at quiet load: 55.7ms vs 44.8ms, +24%, inside the old headed +37% tolerance; not interchangeable (`f6239aa`)
- [x] 3 plain `npm run perf` stability runs PASS (raster 43.2 / 65.5 / 44.5ms, dropped 1, longest 16.7ms) (`f6239aa`)
- [x] Firing against the new baseline: `--inject-jank` dropped 106 FAIL, `--inject-block` 150ms FAIL, `--inject-gpu` dropped 148 FAIL, each exit 1 (`f6239aa`). Combos with `--inject-animation` measured before the rebaseline only (111 dropped / 150ms)
- [x] README "Measuring smoothness": limits, sensitivity and exit codes (`f6239aa`)

## Carried at wrap-continue — 2026-09-11 (evening, thread DiskSheet)

- [x] **carried — DECIDE: rename the package.** Sean: "morph-sheet sucks as a name." Breaking changes are free until publish (not on npm). Strawman next step: run the `brand-naming` skill seeded with what the component does (a disc that blooms into a sheet and folds back; a draggable anchor; one-clock spring morph), with npm + GitHub availability checks. A rename touches package.json name, README, the `MorphSheet` namespace/`useMorphSheet` exports, `--morph-sheet-*` CSS vars, `data-morph-sheet-*` attributes, the audit script and docs, so it should be one structural pass, not a find-replace. → brand-naming ran; carried again with results under the late-evening heading below. → locked VistaSheet 2026-09-12 (web screen YELLOW: Vista/Vistaprint design brand, Emigre Vista Sans; no exact-name use); renamed in this commit.
- [ ] **parked — Dia toolbar picks up the glow colour.** With the sheet anchored top and the demo glow on, Dia's toolbar tints to the glow (purple with Midnight Purple, amber with Neon Gold). Sean's screenshots: `~/.claude/image-cache/71b27934-0eab-423c-8584-d9f5d1fceee1/1.png`, `2.png`. Mechanism inferred, not verified: the browser samples the page's top-edge colour when no `theme-color` is set. Strawman: leave it in the demo (it reads as a delight on recordings), and add one README line telling consumers that a `<meta name="theme-color">` pins the toolbar if they don't want it. Demo-only; the package paints no glow.
- [ ] **carried — eyeball CloseMask's top-down fade when closing from `center`.** The center build's agent sampled frames but missed the ~600ms close; the mask gradient is in the sheet's local box so it should read the same (inferred).
- [ ] **parked — duplicate geometry test label "(k)"** in example/geometry.spec.ts (two tests share it). Rename one; cosmetic.

## Carried at wrap-continue — 2026-09-11 (late evening, thread DiskSheet)

- [x] **carried 2× since 2026-09-11 — DECIDE OR KILL: lock the package name.** Strawman: **VistaSheet** (Sean's own pitch). npm `vistasheet` / `vista-sheet` free, 0 GitHub repos by name. Web screen NOT run (session hit its 200-WebSearch cap). Inferred risk: "Vista" reads as Windows Vista / Vista (Vistaprint's parent). Keeps "Sheet", so identifiers become `VistaSheet` / `useVistaSheet` / `--vista-sheet-*` / `data-vista-sheet-*`. Sean also floated **AvaSheet**: `ava` is the AVA Node test runner (avajs/ava ★20.8k), a dev collision. → locked VistaSheet 2026-09-12 (web screen YELLOW: Vista/Vistaprint design brand, Emigre Vista Sans; no exact-name use); renamed in this commit.
  - **Sean's criteria (2026-09-11):** npm/domain availability doesn't matter; only "no major usage in my circles of designers and maybe some devs". Then "a two word combo", then "real word".
  - **Two-word screen (web-searched for typefaces, studios, Figma plugins, libraries):** clean: Budfurl, Pebblefold, Clayleaf, Linenfold, Mainspring, Wellspring, Moonflower, Dewbloom, Bellflare, Seedswell, Petalpod. Yellow: Dropleaf (dropleaf.app), Emberleaf (reads as Ember.js), Moonsail, Groundswell, Moonrise, Pocketwatch. Red: Kingtide (King Tide, a 100–249-person product design studio). Unscreened late adds: Pinchpot, Seedleaf, Moonfold, Hushfold, Claybloom.
  - **Single-word screen:** clean: Kupla, Frond, Sepal, Messa, Brette, Parison, Piega, Crozier, Kovo, Plumo, Nacre, Tellin, Valva (also insect anatomy), Opelle, Pellum, Upwell, Puni, Tsubomi. Red: Tondo (Dalton Maag), Maru (GT Maru), Vellum (typeface + app), Vessa (vessa.design), Locket (80M-download app), Enso (7.4k★). Yellow: Miura (DSType family), Hiraku (two drawer libs), Detent (iOS sheet term), Bisque (CSS colour).
  - **Next:** web-screen VistaSheet (and AvaSheet if Sean still wants it); Sean locks one; then the one structural rename pass scoped in the item above.
- [x] Sean — rename GitHub repo seansmithworks/disc-sheet → vista-sheet before publish (package.json URLs already point there) → done 2026-09-12 via gh repo rename; origin repointed. Repo was already public.
- [ ] consumer app in ~/Code/_experiments still imports @seansmithworks/morph-sheet; repoint on next rebuild
- [ ] **Rename local files to vista-sheet (Sean, 2026-09-12: "we should also plan to rename local files too").** Must run AFTER the live Claude session in this repo ends. The session's cwd and memory dir are keyed to the path, so moving mid-session orphans both. Steps, in order: (1) `/wrap`, then close every session in ~/Code/disc-sheet; (2) `mv ~/Code/disc-sheet ~/Code/vista-sheet`; (3) `mv ~/.claude/projects/-Users-seansmith-Code-disc-sheet ~/.claude/projects/-Users-seansmith-Code-vista-sheet` so memory + ORCHESTRATOR.md follow; (4) CLAUDE.md heading `# disc-sheet` → `# vista-sheet` and ORCHESTRATOR.md title; (5) `~/Code/_experiments/disc-sheet-consumer` → `vista-sheet-consumer`, repoint its dep from `@seansmithworks/morph-sheet` (file: tgz) to a fresh `npm pack` of vista-sheet (merges with the consumer item above); (6) `qmd` re-index the projects collection; (7) relaunch with `cd ~/Code/vista-sheet && ccob`.

## Carried at wrap-continue — 2026-09-13 (thread DiskSheet)

- [ ] **carried — map phases + pick the cut line with Sean (next round's first action).** Plan Artifact v4: https://claude.ai/code/artifact/1ab67c7c-1efc-4fbf-a3eb-717a66f36745. Estimates (agent wall-clock incl. review/fix/gates): P1 playground 2.5–4h · P2 circle/squircle/rounded square/square 3–5h + dial pass · P3 rectangle buttons 6–10h · P4 video + aspect-ratio 4–6h + Sean's portrait video. Strawman cut line: release 0.1.0 after P1+P2 (~6–9h). 0.1.0 hold stays until Sean picks.
- [ ] **new — settings button draggable (Sean 2026-09-13: "should be draggable since it is a vistasheet").** Settings Root in example/main.tsx is `draggable={false}` with a derived anchor (top-right unless main occupies it → top-left, applied only while closed). Making it draggable means both sheets can target the same anchor: needs a symmetric yield rule (the sheet that didn't just move takes the opposite top corner), its own persistKey, and geometry tests for drag-into-occupied at 390×844 and 1440×900.
- [ ] **carried — open plan calls, strawmen already in the Artifact:** reopen SCOPE LOCK for P3 buttons + P4 aspect ratio (rec: yes) · squircle = superellipse vs rounded square = ~25% radius · rectangle width sized to label by default.
- [x] Settings panel fixes live on Vercel (d70a954 build; icon, collision, dark mode) — promoted 2026-09-13.
  → Cut line + plan calls RESOLVED 2026-09-13 (see next section): Sean chose an overnight run of all four phases; plan calls accepted (reopen lock for P3+P4 · squircle = superellipse, rounded square ≈25% radius · rectangle width from label).

## Carried at wrap-continue — 2026-09-13 (early morning, thread DiskSheet)

**Overnight v0.2 run — planned, NOT dispatched.** Plan passed /adversarial-plan (separate Opus refuter, 20 findings, verdict REVISE, all absorbed). Revised plan + unedited refutation + prompt + draft: `~/.claude/projects/-Users-seansmith-Code-disc-sheet/memory/plans/v02-overnight/` (kept out of the repo: the refutation quotes frozen old-name ids and would trip `src/naming.test.ts`). Mechanism: one Workflow script, fresh agent per step (spec → one implementer per task → gate → review → fix → gate → re-review), serial in the main worktree (Playwright reuses :4873), no overnight push, perf non-blocking. Smoke Workflow PASSED 2026-09-13: implementer/reviewer/planner agentTypes ran Bash and returned schema JSON with no permission denials.

- [x] **carried — verify `e59c7a2` WIP first** (review fixes stopped mid-flight at wrap): npm test, `tsc --noEmit` (6 pre-existing errors is baseline), audit:vars, build:lib + banner, test:geometry (116 + new). Fix anything red before the run's base is set.
- [x] carried — P2 shapes (circle/squircle/rounded square/square; Shadow follows shape) → branch `v02/p2-shapes` off the verified tip
- [x] carried — P1 playground + copy tool → `v02/p1-playground` off P2
- [x] carried — P4 video + aspect-ratio sheets → `v02/p4-media` off last green tip (placeholder portrait clip via ffmpeg unless Sean supplies his)
- [x] carried — P3 rectangle buttons S/M/L → `v02/p3-buttons` off last green tip
- [x] carried — morning: orchestrator re-runs all gates + perf on a quiet machine, captures, then pushes branches after Sean looks. No deploy, no publish, no merge. → gates re-run at `98cadb2` + branches pushed 2026-09-13 afternoon; captures carried below.

**Shipped this session (feat/customization-parity):**
- [x] `0c7dc11` item stagger 40→90ms + example sheets split into title / body / actions Items. Measured beats on index: 284 / 376 / 459ms (was 281 / 322, two beats).
- [x] `6a7e3a7` Design menu: Shadow speed (Very slow 24s … Fast 3s + Variable, rAF-integrated, no phase jumps) · Glow colour + Glow strength with per-palette Light/Medium/Bold · 8 palettes mildest→wildest (Mono, Midnight Purple, Aurora, Rainbow, Neon Gold, Biolume, Demon Pink, Glitch) · warm × dark as a 4-cell CSS model (Warm + Dark mode painted cream sheets before) · DialRoot `productionEnabled` (Show dials did nothing on Vercel: dialkit defaults to dev-only). Independent review: pass, no blockers.
- [x] **DECIDED 2026-09-13 (Sean): "we are taking our strawman and hardening it now."** Tonight's values are decisions, not strawmen: 90ms stagger, palettes + strengths, speed steps, warm dark hexes. Older strawmen (snappy/gentle) stay marked.
- [x] carried — `e59c7a2` WIP: F1 `<VistaSheet.Shadow asChild>` overwrote the child's ref (package defect, `src/Shadow.tsx` cloneElement) → composed + `src/Shadow.test.ts`; F2 reduced-motion subscribed live; F3 labels hardened; F4 demo uses a ref. UNVERIFIED (see first item).
- [x] carried — deploy the demo (Sean's explicit go per deploy; `vercel deploy` → `vercel promote`). → deployed 2dfe523, see VistaSheet afternoon section.
- [ ] parked — stagger length scales with Item count: Design menu 9 rows → last row ~0.92s (was ~0.52s), list example ~0.65s (arithmetic, not measured). If long sheets feel slow, cap total stagger rather than shrink the interval.
- [ ] parked — design-settings button draggable (unchanged, see above).

## P3 deferred — 2026-09-13 (overnight run)
- [ ] Dial pass: rectangle S/M/L (strawman heights 36/44/52, padding 14/18/22, gap 6/8/10) and pill corners vs a fixed radius.
- [ ] Dial pass: trigger label reveal window (strawman collapseProgress 0.85 to 1).
- [ ] Shared / Media inside a rectangle trigger (unsupported in v0.2).
- [ ] Playground: Rectangle is disabled for Shared/media recipes; revisit once Shared-in-rectangle exists.

## Overnight v0.2 run ledger — 2026-09-13

- [x] e59c7a2 WIP verified at dc3bd44 before launch: 95 vitest · tsc 6 (baseline) · audit:vars PASS · build:lib + banner PASS · geometry 117 passed.
- P2 gate r1 @ 6aceac5: vitest 122/0 · tsc new 0 · audit PASS · build PASS · geometry 148/5 · red-proof NOT proven · dial ok · perf raster 56.6ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 6.38 warning)
- P4 gate r1 @ 531a882: vitest 139/0 · tsc new 0 · audit PASS · build PASS · geometry 209/0 · red-proof proven · dial ok · perf raster 56.8ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 4.03 warning)
- P2 gate r1 @ 3bb9770: vitest 122/0 · tsc new 0 · audit PASS · build PASS · geometry 148/5 · red-proof proven · dial ok · perf raster 59.5ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 7.51 warning)
- P2 FIX round 1 @ ea86163: all 5 red geometry cases from gate r1 now green — (rt) shape=circle/squircle/square and (wk-squircle) were Shadow.tsx's DOM-read fallback racing Motion's own post-settle border-radius rewrite one rAF late (fixed: MutationObserver on the surface's style attribute, reacts same-task instead of polling) plus, for wk-squircle specifically, Trigger.tsx's one-shot mount-time rect read racing WebKit's own application of the trigger-size `<style>` block (fixed: ResizeObserver self-corrects); (sh) shape=rounded-square was geometry.spec.ts's own open-rest assertion comparing against the sheet's outer box instead of the trigger-size-derived value `<Shared>` actually uses on both slots (test fixed, not the CSS). vitest 122/0 · tsc 6 (baseline, unchanged) · audit:vars PASS · build:lib + client-banner PASS · full test:geometry 153/153 (up from 148, P2's new (rt)/(sh) assertions all counted) · wk-squircle 1/1 · asChild-ref regression guard re-proven firing (temporary local revert of Shadow.tsx's asChild ref branch → both `<Shadow asChild>` DOM tests failed as expected → restored). Perf not re-run this round (no motion-constant or paint-frequency change intended; MutationObserver/ResizeObserver additions are gated to in-flight/settle windows only).
- P2 gate r2 @ bccccf3: vitest 122/0 · tsc new 0 · audit PASS · build PASS · geometry 153/0 · red-proof skipped · dial ok · perf raster 61.1ms/1 dropped/16.7ms longest, all PASS vs baseline
- P1 gate r1 @ 7c74665: vitest 122/0 · tsc new 0 · audit PASS · build PASS · geometry 175/0 · red-proof proven · dial ok · perf raster 54.4ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 4.50 warning)
- P1 gate r2 @ 6cb3e64: vitest 122/0 · tsc new 0 · audit PASS · build PASS · geometry 175/0 · red-proof skipped · dial ok · perf raster 57.3ms/1 dropped/25.0ms longest, all PASS vs baseline (load1 4.83 warning)
- P3 gate r1 @ 7873fbb: vitest 177/0 · tsc new 0 · audit PASS · build PASS · geometry 248/0 · red-proof NOT proven · dial ok · perf raster 64.0ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 3.45)
- P3 gate r1 @ cba8c59: vitest 177/0 · tsc new 0 · audit PASS · build PASS · geometry 248/0 · red-proof proven · dial ok · perf raster 48.0ms/1 dropped/16.7ms longest, all PASS vs baseline
- P3 gate r2 @ 19dd86f: vitest 177/0 · tsc new 0 · audit PASS · build PASS · geometry 248/0 · red-proof skipped · dial ok · perf raster 64.0ms/1 dropped/16.7ms longest, all PASS vs baseline (load1 6.64 warning)
- RUN END: P2 green @d011205 · P1 green @8bc9717 · P4 green @2b67c29 · P3 green @e881b97 · last green: P3 (v02/p3-buttons)

## Carried at wrap-continue — 2026-09-13 (afternoon, thread VistaSheet)

**v0.2 built: all four phases green, branches pushed, not merged or deployed.** Tip `v02/p3-buttons` `09d8f2e`. Orchestrator re-ran gates at `98cadb2`: 177/177 vitest · tsc 6 · audit PASS · build+banner · 248 geometry · perf PASS (raster 54.5, load 23.9).

- [x] carried — independent review of the Shadow per-frame fix `d3f294b`/`09d8f2e`: PASS-WITH-FINDINGS; current spec proven red on pre-fix Shadow (framesOver1 140/141 vs budget 6, post-fix 3); dead peak gates removed, writes held ≤1/frame (`7dedb59`).
- [x] carried — 48px default sheet radius across package + examples: `f5a3a8f` (incl. Search/Chat recipes 28→48, flagship 36→48 and media-card 28→48 kept as strawman); slider ceiling 48→64 `d5a9a3e` (strawman).
- [x] new — playground live option switching: red `eb4eb25` → fix `58b0097` (example-only; specimen key was the whole generated JSX); recipe switch while open covered `9962b1e`; radio/label wrap fix `eb3d0dd`.
- [x] carried — `play.html` captures per shape (contact sheet + full-size) sent to Sean, 2026-09-13.
- [ ] carried — Sean apply-or-redline (strawmen live in code): squircle sheet corners = squircle (`9da07db`) · circle shadow mid-morph = surface curve (`c298df5`) · flagship 36→48 inside the radius change · dials: rounded square 25%, squircle fallback 27.16% (`src/shape.ts`).
- [ ] carried — Sean's real portrait video replaces the ffmpeg placeholder.
- [ ] parked — DESIGN.md §4.1 one-line exception for DOM-read radius (Shadow, Media); Sean's doc.
- [ ] parked — merge, release cut line, demo deploy, npm publish (each needs Sean's go).
- [ ] noted — stray RUN END ledger commit `9ad603e` on `v02/p4-media` (outside the P3 stack; harmless).
- [x] found — media ratio self-check flake (failed 2 of 3 full runs under load): sampler now ends on the sheet's settled signal, not wall clock (`673a9a1`).
- [x] found — orchestrator gates at `eb3d0dd`: vitest 177 · tsc 6 (baseline) · audit PASS · build+banner PASS · geometry 252/252 · perf PASS (load ~8, warning).
- [x] awaiting Sean — DialKit "Iridescent shadow" values he shared (Neon Gold, opacity 0.22, length 161, blur 69, saturation 1.40, spin 16s; crossfade 0–0.25) differ from the Neon Gold preset in `example/main.tsx:293` (0.30–0.60 / 42–60 / 32–46 / 10s); strawman: bake in as Neon Gold defaults. → baked in 2dfe523 (Bold 0.22/161/69, Medium 0.17/140/60, Light 0.11/113/48 — Light/Medium scaled by old ratios, strawman; spin 16s = Slow step; crossfade already 0–0.25).
- [ ] noticed — playground iframe fully reloads when the window crosses the 900px breakpoint (iframe moves position in the page).
- [ ] noticed — demo settings sheet uses the same whole-JSX key remount pattern (`example/main.tsx:750`).
- [ ] noticed — `example/play/render.tsx` type+ordinal keys still shift same-type siblings (Item lists) on middle removal; unreachable by current controls.
- [ ] noticed — copy-output identity after `58b0097` holds by construction only; `play-copy.spec.ts` checks substrings, not full output.
- [ ] noticed — `58b0097` commit message says "32/32 (18 baseline + 2 new)"; real count was 20/20.
- [x] v0.2 stack fast-forwarded into main (Sean's go, 2026-09-13): main 973cc2f → c10def5 → 2dfe523, pushed. Not merged on purpose: v02/p4-media's 9ad603e (stale "P3 stopped" ledger line) and v02/sheet-radius-48's 52b4070 (WIP superseded by f5a3a8f).
- [x] Old branches deleted locally and on origin (Sean's go): v02/p1-playground, v02/p2-shapes, v02/p3-buttons, v02/p4-media, v02/sheet-radius-48, feat/customization-parity.
- [x] Demo deployed to production from main @ 2dfe523 (Sean ran the CLI; the auto-mode classifier blocks vercel deploy and self-edits to permissions): https://vista-sheet.vercel.app serves index-DWTJnWuG.css (48px) + main-BQfH1qgx.js (Neon Gold 161). Deployment dpl_XXgwjYXsnggseCVfzTZgr4tnHdfS.
- [ ] noticed — to let Claude deploy without Sean pasting the CLI, Sean adds `Bash(vercel link *)` and `Bash(vercel deploy *)` via /permissions (Claude is blocked from editing its own permission files).

## Sean's v0.2 localhost test notes — 2026-09-13 (evening, thread VistaSheet)

- [ ] 1. `/play.html` drag → endless flicker. Cause verified: `AnchorSync` (stage-entry.tsx) reverts every drag across the postMessage round trip; any anchor, `/` unaffected. Fix building (command-vs-report messages) + red-proven test.
- [ ] 2. Chat bubble invisible (Warm: `--vista-sheet-accent` never declared because codegen omits package-default values, `.vs-chat-bubble-out` has no fallback; warm-dark/neutral-dark: white on off-white). Queued: codegen always emits the full var block; bubble text = surface; test every var read is declared.
- [ ] 3. Chat trigger/send icon 0×0 on all palettes/sizes: `.vs-button-icon`/`.vs-button-text` live only in SEARCH_RECIPE.css. Queued: move to BASE_CSS; test every recipe className has a rule in its own emitted CSS.
- [ ] 4. No hover state — interaction-states audit running (scratchpad audit/interaction.md).
- [ ] 5. "Design-engineered, not vibe-coded": a11y / interaction / code+perf audits running → one triage page.
- [ ] 6. Search/Chat: focus the text input on open — batch with a11y initial-focus findings (package-level).
- [ ] 7. Recipe review board (every recipe × palette × state × viewport) — capture fix in progress; open tiles were all identical on first run.
- [ ] 8. `/play` controls → dialkit 2.0 (hand-rolled Controls.tsx was never a decision). After drag fix.
- [ ] 9. `/` Design panel → dialkit 2.0. Fork for Sean: Design stays a VistaSheet with dialkit inline (recommended) vs dialkit floating panel only.
- [ ] 10. Glow length, 5 steps beside Strength. Strawman: Tight 0.4×/0.5× · Short 0.7/0.75 · Default 1/1 (= dialled) · Long 1.4/1.6 · Feather 1.9/2.4 (length/blur multipliers on the strength's values). Queued after 2–3; perf gate on Feather.
- [ ] 11. Full design system in Magic Patterns (new VistaSheet project) — awaiting Sean's go (outward: uploads unpublished source; MP re-creates components unless it can run `motion`, unchecked).
- [x] 1 → fixed `44aa28d` (command vs report; geometry 253/253, red-proven); independent review running.
- Decisions (Sean, 2026-09-13 late): 9 → dialkit floating panel only on `/` (drop the recreated Design sheet); 8 → `/play` on dialkit 2.0 too; 10 glow-length strawman approved; 11 Magic Patterns go (build to validated artifact, Sean publishes).
- REVERSED (Sean, 2026-09-14 ~01:00 PT): 9 → the `/` Design panel stays a VistaSheet ("keep vista sheet for now"); the dialkit floating panel does not replace it. T6 needs a re-cut after Thursday: glow length (10, still approved) goes into the existing settings sheet. 8 (`/play` on dialkit) untouched by this call.
- [x] 12. Render deploy (Sean interviews with Render 2026-09-14): static site `vista-sheet` https://vista-sheet.onrender.com, service `srv-dajphh9594qs73d4i740`, build `npm ci && npx vite build example` → `example/dist`, NODE_VERSION 22, autoDeploy OFF. Deploy `dep-dajphhp594qs73d4i8ng` live from `e73cf59` (same `main-BQfH1qgx.js` as Vercel).
- [ ] 12b. Redeploy Render + Vercel after tonight's fixes: push main, `trigger_deploy` Render, Sean pastes Vercel line — needs Sean's go.
- [ ] 13. A11y audit (scratchpad audit/a11y.md): 2 blockers (focus trap skips inputs `useDialogBehavior.ts:4`; missing vars = note 2), 10 majors (drag eats next activation `Trigger.tsx:436`; no non-drag reposition / `setAnchor` not public; looping trigger video unpausable — fork: poster at rest vs pause control), 11 minors.
- [x] 11 → Magic Patterns design system "VistaSheet" `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38` (artifact `58ad360e…`), 10 components / 46 static previews, both chat bugs rendered as intended. NOT published — Sean publishes after a look. https://www.magicpatterns.com/design-system/ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38
- [ ] 14. Code audit (scratchpad audit/code.md): B1 defaultOpen → invisible Close + stray shadow (inferred); B2 SSR trigger top-left until hydrate, open-on-load sized for 1440×900 (verified); M1 per-frame whole-tree re-render on drag (inferred); M2 touch tap after drag swallowed; M3 focus trap misses inputs (= a11y blocker). Interaction audit (audit/interaction.md): 55 state gaps; trigger + Close have no hover/press; disc-trigger icons browser-default black. Forks for Sean: hover 1.02 lift vs tint · no drag lift · video poster-at-rest vs pause control. Wave plan in progress (scratchpad plan/wave.md).
- [ ] 15. Sean: "NO CLAUDE BURNT ORANGE ALLOWED. Lets default to neutral color palette." Package default palette warm → neutral (src/styles.module.css:58,250 focus-ring fallbacks · README.md:142,154,345 theming table + audit-css-vars · docs/PACKAGE-DESIGN.md:313 · DESIGN.md:11,55,69 · CLAUDE.md:16 · example/example.css:90-103 · example/play/state.ts:35-82 default palette · codegen PACKAGE_DEFAULTS · tuner/tune.module.css:200). Strawman: Warm keeps cream surfaces, accent #b4512e → #1a1610 (no orange ships). Magic Patterns update dispatched (neutral first, orange swept). Package lane planned into TONIGHT, serial after the chat/codegen fix.
- Queue status (scope check 2026-09-14): 6 autofocus, 10 glow length, 8/9 dialkit are queued, not dropped — serial behind the in-flight codegen writer (one branch, one geometry port); order comes from scratchpad plan/wave.md.
- [x] 2 + 3 → fixed `b601927` (always-emit palette block, shared button rules in BASE_CSS, bubble text = surface; 116 class-of-bug codegen tests red-proven; vitest 293 · geometry 253/253). Independent review PASS-WITH-FINDINGS.
- [ ] 16. `.vs-grid-label` (recipes.ts:205-209) is a genuinely unstyled element, allowlisted in `codegen.test.ts:143-149` — give it a rule and drop the allowlist entry. (Review of b601927.)
- [ ] 17. minor: `codegen.test.ts:177-183` var parser doesn't handle `var(--a, var(--b))` fallbacks — would false-flag if nesting is ever introduced.
- [ ] 18. Comment at `example/play/stage-entry.tsx:42-45` noting `applyingRef` relies on synchronous `onAnchorChange` + no StrictMode (review of 44aa28d).
- [ ] 19. Playground stale-state bug (found by the board capture): `example/play/shell-entry.tsx` "ready" postMessage handler closes over the initial-mount `state` (empty-deps effect), so any stage iframe remount (e.g. window crossing the 900px breakpoint) replies with `DEFAULT_STATE` while the controls still show the user's choices. Pairs with the noted iframe-reload-at-900px item.
- [x] 7 → review board: 152/152 tiles on b601927 (32 unique open hashes per viewport), `scratchpad/board/index.html`; re-run `board/capture.mjs` after the neutral default lands.
- Wave plan (scratchpad plan/wave.md), orchestrator order for TONIGHT, serial on main: T1 codegen fix ✅ b601927 → T2 neutral default (building) → T3 drag no longer swallows next tap/Enter → N2 promoted: focus model (trap covers inputs, initial focus on open = note 6) → T4 Trigger/Close text colour, cursor, hover, press → T5 recipe + playground-chrome states & AA (+ note 19 stale state) → T6 `/` dialkit floating panel + glow length. NEXT: N1 trigger hover lift + shadow scale (dial pass) · N3 Shadow reads live position (code M1) · N4 open-on-mount settle (code B1) · N5 `/play` on dialkit 2.0 · N6 `@property` token defaults. Deployable cut: T1–T3 + focus.
- [ ] 20. minor: Chat bubble contrast test in codegen.test.ts reads palette data, not emitted CSS — can't fail if the CSS stops using surface/accent (planner).
- Overnight approvals (Sean, 2026-09-14 ~00:40 PT): run the TONIGHT lanes as a Workflow script · push main + redeploy Render at each green cut (T1–T3+N2, then T4–T6) after the orchestrator's own gate re-run, verify the live asset; Render stays on last good build on any failure · design picks accepted (hover 1.02 lift, no drag lift, video poster at rest / plays while open) · Magic Patterns stays unpublished.
- REVISED (Sean, ~00:50 PT): token budget ~10% of week left until Thu 9am → overnight = "Lean + focus": T2 neutral (finishing) → one Workflow: T2 review, T3 tap-after-drag, N2 focus model → gates, push, Render redeploy → stop. Magic Patterns rebuild stopped mid-run (design system left unpublished, partial state unverified). T4 hover/press, T5 recipe states/AA, T6 `/` dialkit + glow length, N1 hover lift, MP rebuild → after Thursday.
- [ ] 11b. Magic Patterns rebuild STOPPED 2026-09-14 ~00:55 PT (token budget). Where it stopped:
  - Live design system `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38`, active artifact now `6a5cb9b1-efba-4641-8b2d-41d662174d43` (was `58ad360e…`), unpublished, 10 components / 38 files.
  - Done (verified): BasicSheet previews are literal and Neutral-first (Neutral, Neutral dark, Warm, Warm dark), showing trigger + sheet. All 11 staged `*.previews.tsx` in the scratch copy have no `.map(`.
  - NOT done: orange sweep incomplete. The staged `index.css` still has 2 `#b4512e` hits; the live index.css is unchecked. Side-by-side compares exist only for basic + chat (`compare/{basic,chat}_{mp,real}.png`), unreviewed. Remaining recipes (list, grid, nav, media, video, search) and Trigger/Tokens/Sheet not compared. Unknown which components were regenerated from codegen output vs still hand-ported. Preview counts not proven from MP for the rest.
  - Staged files + compares persisted: `~/.claude/projects/-Users-seansmith-Code-disc-sheet/memory/plans/v02-quality-wave/mp-stopped/`.
  - Resume (Thursday): get_design_system → read index.css + every previews file → sweep orange → regenerate each recipe from `buildCss`/`buildSpecimenTree` → side-by-side vs the real :5180 stage per recipe → fix drift → prove counts → Sean publishes.
- [x] 15 → neutral default `d178ccd` (+ flagship `#a4441f`), riders `e0b1ad8` (`.vs-grid-label` rule, allowlist dropped = 16), `cce0fe8` (applyingRef comment = 18). Survivors kept on purpose: glow presets (main.tsx, example.css:245), tuner amber warn colour. Builder gates: vitest 293 · tsc 6 · audit PASS · geometry 252–253/253 with `media.spec.ts` timing flakes under load (different sub-case each run) — orchestrator to confirm on a quiet solo run.
- [x] T2 review (workflow run wf_7766f136-d8a): PASS, no must-fix — neutral set consistent across README/DESIGN/state.ts/PACKAGE-DESIGN, audit PASS, grid-label rule matches inherited look, no StrictMode anywhere.
- [x] Overnight run STOPPED at wrap-continue ~01:00 PT (Sean: clear context, save tokens) — relaunched and finished, see below. T3 builder was mid-lane: its unverified red test saved on branch `wip/t3-red-test` (`2b5701e`, example/trigger-activation.spec.ts), removed from main. Relaunch in the fresh thread: `Workflow({scriptPath: "~/.claude/projects/-Users-seansmith-Code-disc-sheet/memory/plans/v02-quality-wave/overnight-t3-n2.js"})` (T3 → N2, cap 1.5M) → orchestrator gates (quiet solo geometry) → push → Render `trigger_deploy` → verify asset → stop. Pre-approved by Sean.
- [x] T3 → `af272b6` a drag never swallows the next tap or Enter: sticky `draggedRef` deleted, per-gesture max travel read once in `handleClick` (`src/Trigger.tsx`). `example/trigger-activation.spec.ts` red-proven 4/5 against pre-fix (act-4 4px wobble is inferred, not proof; act-5 regression check). Review (wf_6b021250-886) PASS, no must-fix.
- [x] N2 → `ad24c04` focus model (TreeWalker tabbables incl. inputs/select/textarea, trap owns every Tab, scroll lock/aria-hidden/trap last until exit-complete, Content tabbable while overflowing) + `ebff8dc` review fix: initial focus is an opt-in `Sheet initialFocus` ref (ad24c04 had shipped a universal first-text-field heuristic — deleted), Search/Chat recipes emit it live + in codegen, `Close` reveals on keyboard focus (was focused-but-invisible before settle, red-proven). Sean note 6 closed. Reviews: ad24c04 PASS-WITH-FINDINGS (the heuristic) → ebff8dc PASS.
- [x] Orchestrator gate re-run on `ebff8dc` (2026-09-14 ~02:20 PT): vitest 296/296 · tsc 6 baseline · audit:vars PASS · build:lib + client banner PASS · geometry 266/266 (no media.spec flake). Pushed `f6677d1..ebff8dc`.
- [x] Render redeployed (12b, Render half): deploy `dep-dajrql95efls73a49h9g` from `ebff8dc`, status live 2026-09-14 09:24:53Z; https://vista-sheet.onrender.com/ serves `assets/main-ByIa7MPx.js` = local `npx vite build example` hash. Vercel still on `2dfe523` (needs Sean's paste). Overnight job done — STOP; T4–T6, N1, MP after Thu 9am.
- [ ] 21. **Decide or kill — one demo or two.** Render is current (`ebff8dc`); Vercel is stale (`2dfe523`, orange) and needs Sean's CLI paste every time. Nothing in the repo or the GitHub page links to either (checked 2026-09-15). Strawman: retire Vercel — pause the project (reversible) and set https://vista-sheet.onrender.com as the GitHub repo homepage; Render is also the platform Sean is interviewing with. Alternative: keep both, Vercel redeployed by paste at each Render deploy. Sean asked "or maybe both" 10:17 — unanswered.
- [ ] 22. Confirm the note-9 reversal read Sean's intent: "corner setting" was taken to mean dialkit's floating panel, so the `/` Design panel stays a VistaSheet (`3cdbafc`) and glow length (10) is re-cut into that sheet. If he meant a different control, T6 needs re-planning again.
- [ ] 23. Local branch `wip/t3-red-test` (`2b5701e`) is superseded by `af272b6` — delete on Sean's nod.
