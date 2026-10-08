# vista-sheet BACKLOG archive

Append-only. Items moved out of `BACKLOG.md` on 2026-10-07 because they are done, obsolete, or merged into another open line. Grouped by the heading they sat under. `(L123)` is the line number in `BACKLOG.md` at `8090664`; the full pre-cleanup text, including prose notes that were not checkbox items, stays readable with `git show 8090664:BACKLOG.md`.

Each moved item carries `[done]`, `[obsolete]` or `[merged]` plus a one-line reason and evidence (SHA or file:line), all checked against the tree on 2026-10-07.

## Moved 2026-10-07 (checked against code and git)

### 2026-09-25 — review files rescued from the old (compromised, since wiped) Mac

- (L7) [merged] `example/media.spec.ts` — old copy has an uncommitted test fix (starts the frame sampler before the click so the 640ms open spring is captured). Likely worth porting.
  - Merged into the media.spec flake line in Parked.
- (L9) [obsolete] `package.json` — old copy is v0.1.0 (live is 0.1.1) with a different `prepublishOnly` chain. Probably stale; skim and discard.
  - Rescued package.json is the older copy (0.1.0); live is a superset (prepare, test excludes, jsdom). Only difference is a `record` script tied to untracked scripts/record-demo.mjs, which is in BACKLOG 59. Evidence: diff of .rescued-2026-09-24/package.json vs package.json.

### Waiting on Sean (morning)

- (L29) [done] `npm login` then `npm publish --access public` (token expired 2026-08-31, verified 401)
  - 0.1.0 is on npm (published 2026-09-15). Evidence: npm view @seansmithworks/vista-sheet time.
- (L30) [done] Merge feat/customization-parity → main
  - v0.2 stack fast-forwarded into main and feat/customization-parity deleted. Evidence: e73cf59.
- (L32) [obsolete] `/model` default is now Fable 5 for ALL new sessions (saved by tonight's `/model fable`) — re-pick daily default per your own escalation-only rule
  - Not repo work; the global default model is now opus. Evidence: ~/.claude/settings.json:68.

### Greenfield install / first-run experience (Sean, 2026-08-31 — resurfaced from a phone ask that was NEVER captured)

- (L61) [obsolete] Greenfield consumer app Sean can actually open. Phase 1's gate built one (`.../d4c0a3bb-.../consumer-next`, node_modules + 0.1.0 tarball, routes `/`, `/nowarning`, `/server`) but ran it headless and only ever reported an exit code. It survives in a DEAD session scratchpad and can be reaped. Rebuild durably at `~/Code/_experiments/disc-sheet-consumer` from a tarball packed AFTER the smoothness pass lands, then hand over `npm run dev` + localhost.
  - The consumer app directory no longer exists and its scratchpad is dead. The clean-install path is now covered by the tester-ready re-run. Evidence: ls ~/Code/_experiments (no disc-sheet-consumer or vista-sheet-consumer); ORCHESTRATOR-log 2026-10-05.
- (L62) [done] README quickstart is not runnable. Three defects found 2026-08-31 by reading it as a fresh installer: (1) the Usage snippet mounts `<Avatar />` twice, never defined or imported — copy-paste yields a compile error, not a disc; (2) the prose says add `"use client"` "(as above)" but the snippet never shows it, so the single most likely App Router trap is described as already-demonstrated; (3) nothing sets an expectation of what you should SEE (disc at an anchor, drag, tap, morph). Fix = one self-contained copy-paste-runnable snippet.
  - README Usage snippet is copy-paste runnable: `export default`, `"use client"` shown, and a 'Pasted as-is' paragraph says what you will see. All three defects fixed. Evidence: 52d38af, 30ba168; README.md:128-170.
- (L63) [obsolete] The greenfield page must be the README snippet verbatim, not a hand-tuned demo — the point is to test the documented path, which is what an installer actually follows.
  - Consumer app is gone; the README snippet itself was verified by the 2026-10-05 clean-install re-run (git/tarball/copy-in x Next16/Vite8). Evidence: ORCHESTRATOR-log 2026-10-05.

### REOPENED: morph smoothness — Sean's verdict 2026-08-31, after using the prod consumer app

- (L73) [obsolete] Phase 3 dispatched (diagnosis only, no edits): rAF frame-timing to separate JANK from CHOREOGRAPHY, a frame-by-frame breakdown, and an Emil-format review table. Hypotheses under test: H1 Motion's layout projection is main-thread rAF and FM shorthand transforms are not hardware-accelerated; H2 durations exceed the skill's 200-500ms window for modals/drawers (open reveal 492-530ms, close ~1.15s); H3 asymmetry is backwards — the skill wants exit FASTER than enter, ours has close slower than open; H4 spring mass 1.75 on both directions reads floaty; H5 reveal overlap paints text at ~92% box scale.
  - Phase 3 diagnosis was overtaken by Sean's verdict 'It's looking good' (2026-09-01) and V4 as the shipped motion default. Evidence: 23c3c49.
- (L74) [obsolete] Taste calls arising from Phase 3 are Sean's — do not pre-empt spring/duration changes as "perf fixes".
  - Same as Phase 3: motion taste calls closed by V4. Evidence: 23c3c49.

### Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- (L79) [done] STRAWMAN BUILT 77f6d9b, awaiting Sean — `SURFACE_CLOSE_LEAD_DELAY_MS` is now 35 (was 100). Two constants to revert (it and the derived `DEFAULT_SHARED_CLOSE_SPRING`). What the re-home read costs, measured on a prod build: at 100 the box sits frozen 143ms (8.6 frames) after the Close click, the avatar gets a 100ms (6.0 frame) head start and is 53% of the way home before the sheet moves a pixel — unmistakably a re-home, and why the close felt long (573ms total). At 35 the box is frozen 76ms (4.6 frames), head start 36ms (2.1 frames), avatar 17% home; the detachment is still legible but reads as the avatar LEADING the collapse rather than leaving and being followed (507ms total, four frames shorter). At 0 there is no detachment to read at all (476ms). Sean picks. Superseded text:  111ms of frozen box after the Close click; highest-leverage number on close duration. PACKAGE-DESIGN §3 says it exists to keep the close reading as a re-home rather than a scale. Reduce, don't delete, and report what the re-home read costs at the chosen value.
  - Lead delay is 35 and shipped; Sean's V4 pick kept lead 35. Evidence: src/motion.ts:82; 23c3c49.
- (L80) [done] PARKED — add a `prepack` script. `npm pack` does not run `prepublishOnly`, so a pack without a prior `npm run build:lib` ships stale compiled `dist/`. This cost Sean an evening judging a tarball built from `1be78ac`, and would ship stale output on a real publish. Not changed mid-flight; `package.json` was off-limits to the running agent.
  - `prepare` runs build:lib, and npm runs prepare on pack, so a pack can no longer ship stale dist. Evidence: ad74b2e; package.json scripts.prepare.
- (L81) [done] PARKED — `motion@13.1.1` resolves in consumers; geometry suite runs v12. Untested combination. Verify the v13 projection path or pin the peer range.
  - Peer range pinned to >=12 <14 after the full suite ran green on motion 12.43.0 and 13.1.1. Motion 14 remains open as BACKLOG 32. Evidence: 4fa3929; README.md:120.

### Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

- (L118) [obsolete] Sean's call — the tuner is live at http://localhost:3000/tune (prod build, detached server). Dial it, then hand back either the panel's Copy JSON or just say "read the key" and the dialed values come out of `dialkit:disc-sheet-close`.
  - The localhost:3000 consumer /tune is gone; Sean picked V4 from it. Evidence: 23c3c49.

### Tuner productization (Sean, 2026-08-31 — from the /tune session)

- (L122) [done] Ship the tuner via `npx disc-sheet add tuner`, NOT as a package dependency. Scaffolds a `/tune` route + dialkit as a devDependency into the consumer's app, reusing Phase 2's tested copy-in machinery. Rationale for not depending on it: the package has zero runtime deps today (motion is a peer); dialkit's stylesheet @imports Geist Mono from Google Fonts, which would put an external request in every consumer app forever; and a tuning panel reachable from a production bundle is a footgun.
  - `npx @seansmithworks/vista-sheet add tuner` copies the tuner in; dialkit stays a devDependency. Evidence: ec2ca6c; bin/vista-sheet.mjs:92.
- (L123) [done] Shadow dials — do these first. `DiscSheet.Shadow` is already a component with tokens; offset/blur/opacity dials are cheap and carry no correctness risk.
  - Shadow dials exist in the surface & shadow tuner page. Evidence: 6e7989a; example/surface/Tuner.tsx.
- (L124) [done] Shape dials (circle/squircle/square) — GATED behind child-radius masking. Adding the dial before the masking ships a control whose every non-circle setting looks broken: the shared CONTENT must mask to the same shape, tracking the ANIMATED radius, or it reproduces the accidental-squircle bug (disc surface squircle, portrait still circular). A true iOS squircle is a superellipse; border-radius approximates it, exact needs clip-path, which does NOT interpolate through the FLIP the way the radius MotionValue does. See the v0.2 "Shape presets" item above — same constraint.
  - Shape presets with child-radius masking shipped, so the gate is lifted. Evidence: 5238e4e; src/shape.ts.

### Tuning snapshots (2026-08-31)

- (L131) [done] V4 is Sean's pick and it reverses the strawman's direction. V4: shell 375/32/1, avatar 340/30/1, lead 35, fill 0.45. The avatar is FASTER than both Phase 4 (305/28.9) and the shipped strawman (220.36/24.565) — wn 18.4 vs 17.5 vs 14.9. The shipped default is currently the slowest avatar, i.e. the one he likes least. Decide whether to bake V4 into motion.ts as the new default.
  - V4 baked in as the shipped close defaults (shell 375/32/1, shared 340/30/1, lead 35). Evidence: 23c3c49; src/motion.ts.

### Checkpoint — 2026-09-01 (wrap-continue)

- (L139) [obsolete] ~~`npm login` && `npm publish --access public`~~ ON HOLD — do NOT publish. Sean decided 2026-09-01 to hold 0.1.0 and ship one bigger first release including the variations/settings work below. Publishing now would burn the version number and force the API expansion into a 0.2 it no longer needs to be. Merge to main also waits.
  - Hold lifted; 0.1.0 was published 2026-09-15. Evidence: npm view @seansmithworks/vista-sheet time.
- (L142) [obsolete] Consumer app has no version control — `git init` at ~/Code/_experiments/disc-sheet-consumer offered, not done. /tune exists only on disk.
  - Consumer app directory no longer exists. Evidence: ls ~/Code/_experiments.
- (L143) [obsolete] 4 orphaned next-server processes on ports 3921-3924 (dead session scratchpad `.../d4c0a3bb-.../consumer-next`). Offered to reap, Sean did not answer.
  - Nothing listens on ports 3921-3924; the session that spawned them is dead. Evidence: lsof -iTCP:3921-3924.
- (L144) [obsolete] Arrival-gap SIGN CONVENTION is unresolved: 77f6d9b reads −33.2ms (BACKLOG), +25ms (PACKAGE-DESIGN §3) and +8.4ms (the /tune rig) for the same commit. Deltas from any one instrument are sound; the absolute figure is not citable. Settle it or delete two of the three records.
  - docs/PACKAGE-DESIGN.md no longer carries the +25ms figure and the -33.2ms line lived only here, so the contradiction is gone. Evidence: grep of docs/PACKAGE-DESIGN.md.
- (L146) [done] Consumer resolves motion@13.1.1 while the geometry suite gates on v12. Untested combination.
  - Duplicate of L81: motion 13 suite-verified and peer pinned. Evidence: 4fa3929.
- (L147) [done] `npm pack` still does not run `build:lib` (the prepack item). Every ship cycle this session needed a manual build + dist grep to prove the change shipped.
  - Duplicate of L80: prepare builds before pack. Evidence: ad74b2e.

### 0.1.0 scope expansion — variations + settings (decided 2026-09-01)

- (L155) [done] Motion presets — named springs so consumers pick a feel instead of hand-tuning stiffness/damping; /tune becomes a preset picker that exports values.
  - `presets` export and `preset` Root prop shipped. Evidence: 2544796; src/motion.ts:404.
- (L156) [done] Shape + size variations — circle/squircle/square, size ramps, sheet dimensions. GATED on animated child-radius masking (see the v0.2 shape-presets item above — same constraint, unchanged).
  - Shape variants, trigger size ramp, sheet radius and media aspect ratios shipped. Evidence: 5238e4e; f5a3a8f; src/types.ts triggerSize.
- (L157) [done] Layout + behavior settings — anchors, placement, backdrop, dismiss, controlled/uncontrolled.
  - Anchors (seven), controlled/uncontrolled open, dismissOnBackdrop all exist. Evidence: src/types.ts:76-80,204.
- (L158) [done] One unified config surface — CSS custom properties + config object, design-system drop-in shape.
  - `preset` object plus `--vista-sheet-*` CSS variables with the README theming table. Evidence: 2544796; README theming table.
- (L159) [done] Answer: what do standard UI toolkits commonly ship that disc-sheet does not? Gap analysis against the real source, not a listicle.
  - Gap analysis against peer libraries was done in the 2026-09-01 plan gate and drove the preset/asChild/forwardRef decisions. Evidence: BACKLOG at 8090664, lines 163-185.

### Plan gate CLOSED — /adversarial-plan verdict RETHINK (2026-09-01)

- (L170) [done] `src/types.ts:80-84` JSDoc on the PUBLIC `surfaceCloseLeadDelayMs` prop says `transition.shared.close` "is derived from this value". FALSE since V4. It compiles into `dist/index.d.ts` and every consumer's IntelliSense. A consumer who raises the lead delay trusting the doc gets the avatar spilling past the disc's 2px border.
  - types.ts JSDoc now says the shared close is coupled by feel, not derived. Evidence: 8d42184; src/types.ts:131-137.
- (L171) [done] `src/motion.ts:57` and `:81-83` assert the same dead derivation, contradicted by `:102-110` in the same file. Four stale sites total, not two.
  - motion.ts comments no longer claim the derivation. Evidence: 8d42184; src/motion.ts:50-54.
- (L172) [done] Focus trap does not trap (`useDialogBehavior.ts:54-70`): Tab is only intercepted when activeElement is already the first or last focusable INSIDE the panel. Focus anywhere else and Tab walks out. Plus a 50ms setTimeout before initial focus where the trap is inert.
  - Focus trap owns every Tab and covers inputs. Evidence: 2413a6b, ad24c04; src/useDialogBehavior.ts.
- (L173) [done] No background `aria-hidden`/`inert`. `aria-modal="true"` (`Sheet.tsx:284`) is a hint browsers do not act on. Screen readers read the whole page behind the sheet.
  - Background aria-hidden via hideOutsideSiblings. Evidence: 2413a6b; src/useDialogBehavior.ts.
- (L174) [done] Scroll lock sets `body.overflow=hidden` with no scrollbar compensation — visible ~15px sideways page shift on open, on a library whose whole pitch is motion quality.
  - Scroll lock compensates the scrollbar with padding-right. Evidence: 2413a6b; src/useDialogBehavior.ts.
- (L175) [done] Geometry gate has never run against motion@13, which the verification consumer resolves. The only instrument that can prove the V4 feel survived a refactor does not cover the environment it is judged in.
  - Full geometry suite ran green on motion 13.1.1. Evidence: 4fa3929.
- (L176) [done] `index.ts:61-67` exports five runtime geometry helpers (`anchorCenter`, `nearestAnchor`, `restingLeft`, `restingTop`, `sheetPlacement`). Decide before publish whether these are public forever.
  - Geometry helpers are no longer exported from index.ts. Evidence: 9e8c5c9; src/index.ts.

### New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- (L189) [merged] Visual configurator on the site. Pick a variation, see it live, copy the code, paste it in. Two install paths: npm, or copy-paste from the tool. shadcn model. Covers disc shape AND sheet content layouts. Answers to "where does it live" and "does it replace the API work" came back as "both, site first" / "both in parallel" but arrived alongside a background-task notification the harness flagged as unverifiable. NOT treated as confirmed.
  - Playground (play.html) built; the remaining site-embed half is in BACKLOG 33. Evidence: 6f10f70.
- (L190) [done] Showcase examples with media, tied to the already-parked "icon to advertisement" concept: iOS-squircle app icon morphing into an App Store-style preview card. Plus a full-size-image variant.
  - media-card and video examples shipped. Evidence: e6d4c41; example/media-card, example/video.
- (L191) [obsolete] Naming system across all Sean's components/tools/frameworks. Immediate trigger: "disc-sheet" stops being accurate the moment the disc can be a squircle or a square, so shape variants and the package name are coupled. He wants a convention, not complex or fancy, but distinctive enough to be recognizable when shared. GATES PUBLISHING — the package name is in package.json, the npm scope, the README, and every import line.
  - Name locked as VistaSheet 2026-09-12; any further rename is BACKLOG 57. Evidence: BACKLOG at 8090664, lines 401 and 408.

### ⛔ SCOPE — LOCKED 2026-09-01. Read this before planning anything in this repo.

- (L203) [done] A stranger can change how it feels without typing spring numbers
  - Presets, `{visualDuration, bounce}` and the playground let a stranger change feel without spring numbers. Evidence: 2544796; 6f10f70.
- (L204) [done] A local visual reference lives in THIS repo (today /tune exists only in the unversioned consumer app)
  - Tuner and playground live in this repo. Evidence: ec2ca6c; example/play.html; example/tune.html.
- (L205) [done] One example answers "why would I want this", not just "it works"
  - media-card example answers 'why'. Evidence: e6d4c41.
- (L206) [done] Published to npm, public on GitHub
  - Published to npm 2026-09-15; repo is public. Evidence: npm view; gh repo view (PUBLIC).
- (L207) [merged] One page on the site: example gallery first, dials on ONE specimen
  - Site page is the Distribution line BACKLOG 33.

### Overnight delivery run — dispatched 2026-09-02 (Sean asleep; NO publish, NO deploy)

- (L233) [obsolete] Phase 6 — rebuild the consumer app on :3000 (build:lib -> pack -> reinstall -> rebuild -> restart) so Sean has something to put his hands on. Broken by the rename since 40c0b8c.
  - Consumer app is gone. Evidence: ls ~/Code/_experiments.
- (L234) [done] Item 6 PUBLISH is Sean's hands, not mine — `npm login`, `npm publish`, repo public on GitHub. Outward-facing + needs his auth.
  - 0.1.0 published. Evidence: npm view.
- (L235) [merged] Item 7 site page — NOT overnight work, different repo.
  - Site page is BACKLOG 33.

### ⛔ Acceptance test findings — 2026-09-02, clean-install walk of the five-minute table

- (L275) [done] A1 (BLOCKS) — the README quickstart does not build as printed. `README.md:128` is `function ContactTrigger()` with no `export default`, and nothing in the README says where to put it. A stranger's obvious move is pasting it into `app/page.tsx`, which fails the Next build with `Property 'default' is missing in type 'typeof import(".../page")'`. The component tree itself is correct and morphs fine once `export default` is added. The delivery plan's claim that this snippet is "verbatim-tested" is false for the path a stranger actually takes. Fix is one word.
  - A1: README snippet has `export default`. Evidence: 52d38af; README.md:136.
- (L276) [done] A2 (BLOCKS the feature's whole point) — the `"use client"` guard is UNREACHABLE and never fires. Verified: `src/index.ts` exports only the `MorphSheet` namespace object — there is no named `Root` export — so the only public path is the property access `MorphSheet.Root`. RSC rejects that property access on the client-reference namespace *before* Root's function body runs, so the guard sitting inside Root at `src/Root.tsx:57` is dead code for the only trap it was built for. A stranger who forgets the directive gets React's stock `Element type is invalid: expected a string... but got: undefined`, naming neither the package nor the fix. The guard's own comment describes precisely the failure it cannot catch. Fix must live at the module/namespace boundary — a top-level dev-only check in `index.ts` — not inside `Root.tsx`.
  - A2: the unreachable guard was removed and the README documents the real error. Evidence: 30ba168; README.md:190-211.
- (L277) [done] A3 (CONFUSES) — the `mass` trap is reopened by the union, and the README claims otherwise. F1's fix correctly removed `mass` from `DurationSpring`, but `transition.open` and friends are typed `Spring | Transition` (`src/types.ts:36-57`), and Motion's own `Transition` permits `mass`. So `{visualDuration: 0.4, bounce: 0.2, mass: 1.75}` structurally matches `Transition` and typechecks with zero error — confirmed by an `@ts-expect-error` that TS reported as unused. `README.md:382` states the type "has no `mass` field specifically to prevent that", which is true of `DurationSpring` alone and false at the prop. The 660ms → 2080ms runtime footgun is live and undetected.
  - A3: dev-only runtime warning for `mass` with `visualDuration`; README says to read the paragraph, not the type checker. Evidence: 30ba168; src/motion.ts:186; README.md:686-692.

### Item 3 CLOSED, item 2 blocked by tuner coverage — 2026-09-02

- (L292) [merged] Second gap: the tuner seeds from `SHIPPED` (the dialled default) and has no notion of which preset it is editing. Dialling `snappy` means dialling by eye, reading the numbers off, and hand-copying them into `SNAPPY_PRESET`.
  - Merged into the snappy/gentle line.
- (L293) [merged] Three options put to Sean, his call: (1) dial close-only and re-document the open springs honestly as un-dialled; (2) extend the tuner with an open-direction panel first, then dial all four springs in one sitting; (3) cut `snappy`/`gentle` from 0.1.0 and ship `presets.default` alone — the preset *API* is the load-bearing part and media-card already dogfoods it. Recommended 3, then 2 for v0.2: npm is a verified 404, so removing an export is free right now and a breaking change later.
  - Merged into the snappy/gentle line.

### Figma export — parked until Sean is at the Mac (2026-09-02)

- (L302) [obsolete] Correction to an earlier note: `scratchpad/variant-b.diff` will NOT `git apply` any more — it was cut against the original white ground and its context lines stopped matching once variant A was committed at `f4a4a72`. Variant B is two lines: icon `background: var(--morph-sheet-accent)` and glyph `stroke: #ffffff`, in both `example/list/list.css` and `example/contact/contact.css`.
  - Informational correction folded into the Variant A vs B item.

### PARKED — corner-spark micro-detail (research complete 2026-09-02, OFF the locked objective)

- (L318) [merged] Four open decisions, all Sean's: which mark · every open vs first-open-per-session · reduced-motion (drop or show static) · opt-in prop vs on by default. Recommendation on the last: opt-in — comic emanata are a strong personality choice for a generic primitive.
  - Merged into the corner-spark line.

### Sean's expansion asks — 2026-09-12 (playground, shapes, buttons, media)

- (L328) [done] The design-settings panel becomes the WYSIWYG "copy tool" — a playground page reached from npm to play with the component and copy what you build. (extends: line 181 "Visual configurator on the site")
  - Playground page shipped. Evidence: 6f10f70; example/play.html.
- (L330) [merged] Custom shapes definable by any developer or agent, beyond the presets. (new) — reopens SCOPE LOCK → DEFERRED 2026-09-13 (Sean): future release, not v0.2.
  - Merged with the star line in Parked (deferred by Sean 2026-09-13).
- (L331) [done] Button-style triggers: rectangle/pill at small/medium/large with icon, icon+text, or text; by extension a search box or chat input as the trigger. (new)
  - Rectangle button triggers S/M/L with icon/text. Evidence: db0ef0b (rectangle trigger, S/M/L sizing); example/buttons/main.tsx.
- (L332) [done] Sheet content presets: list, grid, navigation, media. (extends: line 203 "Content layouts as package exports") — reopens SCOPE LOCK
  - list, grid, nav, media, video, search and chat recipes. Evidence: 8454dd5; example/play/recipes.ts:12.
- (L340) [done] The intent is prepackaged presets that show how flexible the tool is. (extends: line 182 "Showcase examples with media")
  - Prepackaged presets are the playground recipes. Evidence: example/play/recipes.ts.

### Carried at wrap-continue — 2026-09-11 (thread DiskSheet)

- (L356) [obsolete] parked — Close X scale-from-0 spin is a deliberate deviation from "start at 0.9+" (DESIGN.md §4.5); revisit only if it reads as popping in a recording.
  - Not a task: the Close X spin exception is documented in DESIGN.md with its revisit condition. Evidence: DESIGN.md:121.

### Carried at wrap-continue — 2026-09-11 (late evening, thread DiskSheet)

- (L414) [obsolete] consumer app in ~/Code/_experiments still imports @seansmithworks/morph-sheet; repoint on next rebuild
  - Consumer app is gone. Evidence: ls ~/Code/_experiments.

### Carried at wrap-continue — 2026-09-13 (thread DiskSheet)

- (L419) [obsolete] carried — map phases + pick the cut line with Sean (next round's first action). Plan Artifact v4: https://claude.ai/code/artifact/1ab67c7c-1efc-4fbf-a3eb-717a66f36745. Estimates (agent wall-clock incl. review/fix/gates): P1 playground 2.5–4h · P2 circle/squircle/rounded square/square 3–5h + dial pass · P3 rectangle buttons 6–10h · P4 video + aspect-ratio 4–6h + Sean's portrait video. Strawman cut line: release 0.1.0 after P1+P2 (~6–9h). 0.1.0 hold stays until Sean picks.
  - Cut line resolved: all four phases built, merged and deployed. Evidence: e73cf59.
- (L421) [obsolete] carried — open plan calls, strawmen already in the Artifact: reopen SCOPE LOCK for P3 buttons + P4 aspect ratio (rec: yes) · squircle = superellipse vs rounded square = ~25% radius · rectangle width sized to label by default.
  - Plan calls resolved 2026-09-13 (accepted). Evidence: BACKLOG at 8090664, line 423.

### Carried at wrap-continue — 2026-09-13 (early morning, thread DiskSheet)

- (L443) [merged] parked — design-settings button draggable (unchanged, see above).
  - Duplicate of L420.

### P3 deferred — 2026-09-13 (overnight run)

- (L449) [merged] Playground: Rectangle is disabled for Shared/media recipes; revisit once Shared-in-rectangle exists.
  - Merged into L448 (Rectangle disabled for Shared/media is the same gap).

### Carried at wrap-continue — 2026-09-13 (afternoon, thread VistaSheet)

- (L477) [obsolete] parked — merge, release cut line, demo deploy, npm publish (each needs Sean's go).
  - Superseded by BACKLOG 35, 36 and 58; v0.2 merged and demo deployed. Evidence: e73cf59.
- (L478) [obsolete] noted — stray RUN END ledger commit `9ad603e` on `v02/p4-media` (outside the P3 stack; harmless).
  - The v02/p4-media branch was deleted. Evidence: git branch -a shows no v02/*.
- (L482) [merged] noticed — playground iframe fully reloads when the window crosses the 900px breakpoint (iframe moves position in the page).
  - Merged into BACKLOG 19, same root cause (iframe remount replies with initial state).
- (L486) [obsolete] noticed — `58b0097` commit message says "32/32 (18 baseline + 2 new)"; real count was 20/20.
  - Commit-message trivia; nothing to fix.
- (L490) [obsolete] noticed — to let Claude deploy without Sean pasting the CLI, Sean adds `Bash(vercel link *)` and `Bash(vercel deploy *)` via /permissions (Claude is blocked from editing its own permission files).
  - Vercel is no longer the live demo; the one-demo-or-two call is BACKLOG 21. Evidence: gh repo view homepageUrl = vista-sheet.onrender.com.

### Sean's v0.2 localhost test notes — 2026-09-13 (evening, thread VistaSheet)

- (L494) [done] 1. `/play.html` drag → endless flicker. Cause verified: `AnchorSync` (stage-entry.tsx) reverts every drag across the postMessage round trip; any anchor, `/` unaffected. Fix building (command-vs-report messages) + red-proven test.
  - Drag flicker fixed (command vs report), red-proven. Evidence: 44aa28d.
- (L495) [done] 2. Chat bubble invisible (Warm: `--vista-sheet-accent` never declared because codegen omits package-default values, `.vs-chat-bubble-out` has no fallback; warm-dark/neutral-dark: white on off-white). Queued: codegen always emits the full var block; bubble text = surface; test every var read is declared.
  - Chat bubble and codegen fixed. Evidence: b601927.
- (L496) [done] 3. Chat trigger/send icon 0×0 on all palettes/sizes: `.vs-button-icon`/`.vs-button-text` live only in SEARCH_RECIPE.css. Queued: move to BASE_CSS; test every recipe className has a rule in its own emitted CSS.
  - Button icon/text rules moved to BASE_CSS. Evidence: b601927.
- (L497) [done] 4. No hover state — interaction-states audit running (scratchpad audit/interaction.md).
  - Hover and pressed feedback shipped. Evidence: 57bd049, 5674e77.
- (L498) [obsolete] 5. "Design-engineered, not vibe-coded": a11y / interaction / code+perf audits running → one triage page.
  - Umbrella item; the audits produced 13 and 14, which carry what is left.
- (L499) [done] 6. Search/Chat: focus the text input on open — batch with a11y initial-focus findings (package-level).
  - Initial focus is an opt-in Sheet ref; Search/Chat emit it. Evidence: ad24c04, ebff8dc.
- (L500) [done] 7. Recipe review board (every recipe × palette × state × viewport) — capture fix in progress; open tiles were all identical on first run.
  - Review board captured 152/152 tiles. Evidence: b601927.
- (L502) [obsolete] 9. `/` Design panel → dialkit 2.0. Fork for Sean: Design stays a VistaSheet with dialkit inline (recommended) vs dialkit floating panel only.
  - Sean reversed this 2026-09-14: the Design panel stays a VistaSheet. Evidence: 3cdbafc.
- (L509) [done] 12b. Redeploy Render + Vercel after tonight's fixes: push main, `trigger_deploy` Render, Sean pastes Vercel line — needs Sean's go.
  - Render half redeployed at ebff8dc; Vercel half is BACKLOG 21. Evidence: 3bbc6a5.
- (L513) [done] 15. Sean: "NO CLAUDE BURNT ORANGE ALLOWED. Lets default to neutral color palette." Package default palette warm → neutral (src/styles.module.css:58,250 focus-ring fallbacks · README.md:142,154,345 theming table + audit-css-vars · docs/PACKAGE-DESIGN.md:313 · DESIGN.md:11,55,69 · CLAUDE.md:16 · example/example.css:90-103 · example/play/state.ts:35-82 default palette · codegen PACKAGE_DEFAULTS · tuner/tune.module.css:200). Strawman: Warm keeps cream surfaces, accent #b4512e → #1a1610 (no orange ships). Magic Patterns update dispatched (neutral first, orange swept). Package lane planned into TONIGHT, serial after the chat/codegen fix.
  - Neutral is the package default; no orange ships. Evidence: d178ccd.
- (L516) [done] 16. `.vs-grid-label` (recipes.ts:205-209) is a genuinely unstyled element, allowlisted in `codegen.test.ts:143-149` — give it a rule and drop the allowlist entry. (Review of b601927.)
  - `.vs-grid-label` rule added and allowlist entry dropped. Evidence: e0b1ad8.
- (L518) [done] 18. Comment at `example/play/stage-entry.tsx:42-45` noting `applyingRef` relies on synchronous `onAnchorChange` + no StrictMode (review of 44aa28d).
  - StrictMode comment added. Evidence: cce0fe8.

### 2026-10-07 — canvas review round 1+2 (html-review sess_0246bd1a6e4f)

- (L570) [done] 43. DECIDE — Trigger/button shadow reads heavy and generic (comments 7, 29), and "is there a stroke/border as well?" (yes: a 2px `--vista-sheet-surface-border` ring on the trigger surface). Strawman: tone down per theme, smaller blur or lower-contrast colour; library default, so README/DESIGN.md values change with it.
  - Softer shadow and Sean's dialled surface look shipped; ring width is a token. Evidence: 57bd049, 578f2ce.
- (L571) [done] 44. DECIDE — Button and disc hover/pressed are visually identical to rest (comment 28; see 41). Should the package ship hover/pressed styles?
  - Hover and pressed styles ship. Evidence: 57bd049, 5674e77.
- (L572) [done] 45. DECIDE — 48pt minimum tap target for rectangle buttons; the visual can stay smaller (comment 6). Library default.
  - 48px hit area on rectangle buttons. Evidence: 57bd049.

## Previously ticked items (carried over unchanged, 2026-10-07)

Every `- [x]` line that sat in `BACKLOG.md`; full text, also at `8090664`.

### Overnight release-prep run — dispatched 2026-08-31 (Sean asleep; stage only, NO publish)

- (L15) Phase 0a — push feat/customization-parity to origin (done 2026-08-31, upstream set)
- (L16) Phase 0b — fresh baseline: vitest 15/15, Playwright 54/54 (43 geometry + 11 a11y)
- (L17) Phase 1 — build system + metadata + THE GATE: vite lib build (ESM + d.ts, vite-plugin-lib-inject-css per F1, NODE_ENV define-passthrough per F2), exports dist-only (F3/F12), publishConfig access public (F6), prepublishOnly + dist gitignored (F7), audit >=10-token guard (F11), README rewrite; gate = pack tarball → fresh Next app → next build + prod Playwright + dev-warning check (DONE 80385d7: all green, dist 24.3kB+2.95kB css, 15/54/PASS)
- (L18) Phase 2 — npx copy-in: zero-dep bin/disc-sheet.mjs `add`, tested in the same Next consumer, tsc green there, css-modules.d.ts collision handled (F8) (DONE 129a4a1: 18 files land, conflict guard works, consumer tsc+build green)
- (L19) Phase 3 — flagship example (wave 5, unheld by Sean 2026-08-31): example/flagship.html second entry; tokens from README table not stale §2 (F4); floor per F9 = palette + portrait + copy/actions + CloseMask + reduced-motion, cuts stated; example/main.tsx untouched (geometry-gate substrate) (DONE ea34cd9: captures eyeballed by orchestrator, 15/54/PASS held)
- (L20) Phase 4 — experience audit: 13 mechanical found+fixed (M2 escalated to Opus, deltas now 0.1-0.4px), taste strawmen applied, #6 focus-restore parked for Sean ("no shitty experiences"): ONE combined design-review + emil-design-eng pass (trimmed per F13), captures (morph, six anchors, reduced-motion, 390x844); mechanical fixes applied, taste calls parked below
- (L21) Phase 5 — ce-code-review: 5 reviewers + validator, 6/6 findings confirmed AND fixed (headline: dist lacked "use client"), README RSC note added, MORNING.md written. Final: vitest 20/20, Playwright 69/69 x3, audit PASS

### Publish hold LIFTED 2026-08-31 (fix 1be78ac, gates 75/75 x3)

- (L25) Resting-disc squircle after interrupted close (reopen-mid-close -> Escape -> rest leaves the disc surface with a sheet-ish radius; content stays round). Found by Sean on the demo videos, confirmed on end-frame pixels (scratchpad demo/end-*-disc.png). Fix + geometry gate (review finding #8 resurrected) dispatched to the T1 motion agent. Fixed: close radius-delay gate removed (never opened — 1.5s delay vs ~1.15s close), stale inline border-radius now cleared when the binding drops; geometry test (o) covers 4 close variants x 2 motion modes.

### Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- (L78) **DONE bf48b0a — Phase 4 coupling landed.** `transition.shared` is now direction-aware; the close default (`DEFAULT_SHARED_CLOSE_SPRING`) is DERIVED from `DEFAULT_CLOSE_SPRING` by the same k-scaling `DEFAULT_OPEN_SPRING` uses, so the two stay coupled if the close is retuned again. Measured arrival gap on the prod consumer app at 1280x800: **-175.0ms -> -33.2ms** (median of 5). The open direction is byte-for-byte unchanged and was re-measured to prove it. `9a4eec1`'s close-spring retune VERIFIED by the same gate run (vitest 20/20, Playwright 75/75, audit PASS) — not reverted. Superseded text:  Sean's pick (Option A): the avatar should track the shrinking box down and reach the 2px border relationship (`.shared[data-disc-sheet-slot="disc"]`, `inset: 2px`) AS the disc finishes, not ~430ms early. WIP `9a4eec1` carries ONLY the close-spring retune (240/34/1.75 -> 375/32/1.0, damping ratio preserved, UNVERIFIED — no suite, no re-measure). The coupling itself is NOT started. Decider metric: avatar-vs-box arrival gap, currently **425-458ms measured on avatar POSITION** (the ~740ms quoted earlier was the opacity crossfade — different measurement, do not chase it).

### Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

- (L99) Expose `surfaceCloseLeadDelayMs` as a Root prop. README + PACKAGE-DESIGN §3 updated: the row moved OUT of §3's internal table and out of the "deliberately NOT exposed" table into the props table, with the reason (it is a duration with a taste answer, not a suppressed artifact).
- (L100) Tuner on a NEW `/tune` route in the prod consumer, built on **dialkit 1.4.3** (`DialRoot mode="inline" productionEnabled`, `useDialKitController`, two `SpringControl`s + one `Slider`, its own PresetManager + Copy). `/` untouched.
- (L101) Close path only, structurally: `transition.open` is never passed, so no dial can reach the open.
- (L102) Live readout (hand-built — dialkit is inputs only): arrival gap ms + min avatar inset px, median of the runs since the last dial change. Rest-state sanity verified at exactly [2,2,2,2] px.
- (L103) Persistence + copy are dialkit's: `persist: true`, `id: "disc-sheet-close"` → localStorage key **`dialkit:disc-sheet-close`**. Preset dropdown holds "Version 1" (= shipped defaults) and a seeded **"Phase 4 (77f6d9b)"** for the A/B.
- (L104) Strawman applied to the shipped defaults: `DEFAULT_CLOSE_SPRING` 375/32/1 → **317.4/29.44/1** (k=0.92), `DEFAULT_SHARED_CLOSE_SPRING` 305/28.9/1 → **220.3625/24.565/1** (k=0.85). Damping ratios preserved (0.826 / 0.827).

### Checkpoint — 2026-09-01 (wrap-continue)

- (L138) **Sean's hands-on verdict on the production build at :3000.** CLOSED 2026-09-01 — "It's looking good." V4 stands as the shipped motion default; the motion objective is done and is not to be reopened.

### New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- (L192) CONFIRMED 2026-09-01: the configurator answers ("both, site first" / "both in parallel") ARE Sean's. Build against them.
- (L193) "the ditter" = **dither** — one of Sean's other tools/effects that needs more work (cf. the surface-fx dither). Another package the naming system has to cover, and a reason the system matters more than this one name.

### Overnight delivery run — dispatched 2026-09-02 (Sean asleep; NO publish, NO deploy)

- (L228) Phase 1 (2544796 + fixes 5345f0b) — motion presets — DONE. Reviewed by a non-builder, all 8 findings fixed and re-gated by the orchestrator: 36 vitest / 75 Playwright / audit PASS. Freeze confirmed at runtime, both levels. The 8 fake tests were replaced with 12 real ones, red/green watched: `preset` object prop on Root (explicit `transition`/`surfaceCloseLeadDelayMs` win over it), exported `presets` with `default`/`snappy`/`gentle`, `{visualDuration, bounce}` accepted as a `Spring` union member. `default` REFERENCES the shipped constants so byte-identity is structural, not copied. snappy/gentle marked un-dialled in code.
- (L229) Phase 2 (ec2ca6c) — tuner into this repo — DONE, gates re-verified by orchestrator (32 vitest / 75 Playwright / audit PASS), zero runtime deps preserved, dialkit is a devDep: ships via `npx morph-sheet add tuner` copy-in (Phase 2 machinery), NOT a package dep. Source is the working 14K page.tsx + CSS in the unversioned `~/Code/_experiments/disc-sheet-consumer/src/app/tune`. Shape dials stay GATED behind child-radius masking.
- (L230) Phase 3 (e6d4c41) — examples, all three — BUILT, gates green, screenshots sent to Sean. OPEN TASTE ITEM: list + contact float a small glyph in the trigger-sized shared box and leave ~100px dead space above the heading; media-card avoids it because its icon FILLS the circle. Palettes/copy/fictional app are arbitrary strawmen: media/app-promo card first, then simple list, then form/contact. Tokens from the README table, never PACKAGE-DESIGN §2 (stale).
- (L231) Phase 4 (f6072a2) — `"use client"` runtime guard — DONE. Dev-only, THROWS (fatal: nothing renders without hooks), wraps Root's first `useId()`. Repro confirmed a forgotten directive gives React's generic `Invalid hook call`, naming neither the package nor the fix: a loud, named failure for the RSC trap. Today it is one README sentence and no check in `src/`.
- (L232) Phase 5 (4fa3929) — motion peer pinned to `>=12 <14` — v13.1.1 ran the FULL suite green (36 vitest / 75 Playwright), so the range is honest rather than optimistic. Tree restored to motion@12.43.0 and re-confirmed green. NOTE: a first v13 pass showed 15 phantom failures that were two `test:geometry` runs racing over the shared --strictPort server, NOT a v13 regression: peer says `>=12`, suite has never run against v13, Sean's own consumer resolves v13. Test against v13 and pin to what actually passes. **If v13 fails the suite, STOP and report — do not widen the range to make it green.**
- (L243) **F1 (most severe) `DurationSpring.mass` is a silent-failure trap.** Motion DISCARDS `visualDuration`+`bounce` whenever `mass` is present (`spring.mjs` gates on `physicsKeys` first), falling back to stiffness 100 / damping 10. Measured settle on a 0→100 keyframe: `{visualDuration:0.4, bounce:0.2}` = 660ms, same plus `mass:1.75` = **2080ms**. A designer copying the README example and adding the package's own documented `mass: 1.75` type-checks and gets a 2s floppy wobble with no warning. **Fix: `mass` must not exist on `DurationSpring`.**
- (L244) **F2 preset + partial directional `shared` inverts the arrival gap.** `Root.tsx:165` replaces `shared` wholesale, then the per-key fallback reaches the PACKAGE default rather than the preset's. `preset={presets.snappy} transition={{shared:{open:x}}}` resolves the close shared to 340/30/1 instead of snappy's 449.65/34.5, so the shared element TRAILS the box by 45ms where all-snappy leads by 10ms. This is precisely the spill-past-the-2px-border failure that `DEFAULT_SHARED_CLOSE_SPRING`'s comment and the README both warn about. **Fix: fall back per-direction to the preset's `shared`, not the package default.**
- (L245) **F3 four of the eight new tests cannot fail.** `motion.test.ts:27-79` re-declares Root's merge expression inside the test body and asserts the result against its own operand — line 71 reduces to `expect(x).toBe(x)`. **`Root.tsx` is imported by no test in the repo.** Inverting the precedence in `Root.tsx:145` would break every explicit `transition` prop and all 28 tests would still pass. The headline feature has zero real coverage while reading as four green tests. **Fix is structural: extract `resolveMotion(...)` from Root's body into `motion.ts` and test THAT.** Tests 1, 6, 7, 8 are real; 7 (tween stays a tween) is the most valuable guard in the file.
- (L246) **F6 `presets` is mutable and shares references with the internal defaults.** The byte-identity-by-reference design means `presets.default.transition.open === DEFAULT_OPEN_SPRING`. The natural clone `{...presets.default}` copies `transition` by reference, so mutating it poisons `presets.default` app-wide; one level deeper it poisons `DEFAULT_OPEN_SPRING` and the no-preset path. Reviewer reproduced both. **Fix: deep freeze.**
- (L247) **F5 README advertises `bounce` without saying which spelling works.** `{duration:0.4, bounce:0.2}` is valid Motion syntax but `isSpringShorthand` rejects `duration`, so it runs as a TWEEN and `bounce` is silently dropped. Pre-existing, but the README newly invites it. **Fix: advertise `visualDuration` only.** Also `README.md:241` is now stale — still says springs accept only `{stiffness, damping, mass?}`.
- (L248) **F4 README overstates "field by field".** `shared` is replaced whole, not merged; that carve-out lives only in a code comment. F2 is what a consumer hits as a result.
- (L249) **F8 `Spring` became a union but its members are unexported.** A consumer holding a `Spring` and reading `.stiffness` now needs narrowing, and cannot write the narrowing helper because `StiffnessSpring`/`DurationSpring` are unnameable from outside. Breaking, but free right now — still 404 on npm. **Fix: export both.**
- (L250) **F7 `visualDuration` alone is undefined behaviour.** Motion's `durationKeys` is `["duration","bounce"]` — `visualDuration` is not in it, so `{visualDuration:0.4}` with no `bounce` settles in 1050ms on Motion's defaults. `DurationSpring` requiring `bounce` is the only guard, and it reads as arbitrary strictness against Motion's own optional `bounce`. **Fix: a comment recording why, so the next person "matching Motion's types" does not open the hole.** (`bounce: 0` is safe; the guard tests `!== undefined`.)

### Sean's expansion asks — 2026-09-12 (playground, shapes, buttons, media)

- (L333) Video sheet: a circle with Sean's picture expands to full video content. (extends: line 42 "icon to advertisement") — P4 on v02/p4-media (placeholder clip; Sean swaps in his video)
- (L334) Media aspect ratios — the sheet sizes to the media, whether tall/phone portrait, wide, or narrow. (extends: line 148 "Shape + size variations") — P4 on v02/p4-media (placeholder clip; Sean swaps in his video)

### Carried at wrap-continue — 2026-09-11 (thread DiskSheet)

- (L352) **closed — shadow pop.** Sean re-recorded and judged the fix (`4a975d5`, glow OFF): "much better" on a6ebc97 clips, then "overall it is looking a lot smoother". Root fix `2aab652`/`0b1ab42`, write-up `docs/solutions/ui-bugs/shadow-pop-two-painters-velocity-inferred-mask.md`.
- (L353) **closed — `npm run perf` gate.** Headless GPU gate (PipelineReporter dropped frames + longest interval + raster, load gate, per-window trace floor, injection self-checks), baseline `f6239aa`, fixes `ea585c8`. Orchestrator re-ran plain (PASS), `--inject-block` (exit 1) and `PERF_DROP_WINDOW=open` (instrument error, exit 1). Known limit: GPU cost that only appears on the real display path passes headless (README).
- (L354) **carried — `npm run perf` gate** (audit item 3): `scripts/perf-morph.mjs` — own vite server on :5190, headed Chromium, 5 warm cycles, CDP RasterTask ms + `Page.screencastFrame` count, `perf/baseline.json` checked in, tolerance-based pass/fail. Judged glow OFF; 2 warm-up cycles discarded. Gate proven to fire on injected main-thread jank (`--inject-jank`); the demo's glow toggle turned out compositor-only on this GPU and does not move either metric — noted in the report, not treated as a gate defect. (`2616d49`)

### Shadow-pop root fix — dispatched 2026-09-11 (one painter, one clock)

- (L362) Step 1 — `<MorphSheet.Shadow>` paints both looks (disc + sheet shadow), crossfaded by opacity derived from `collapseProgress`, clamped 0..1. (`2aab652`)
- (L363) Step 2 — crossfade window exposed as a dial (CSS custom properties, read via `readVarPx`), example DialKit slider added. (`09c3daa`)
- (L364) Step 3 — remove `.sheet[data-morph-sheet-settled]`'s own box-shadow; keep the attribute (Close reveal depends on it). (`2aab652`)
- (L365) Step 4 — opacity values exposed as `--morph-sheet-*` custom properties for `asChild` consumers; documented in README. (`2aab652`)
- (L366) Step 5 — `example/CloseMask.tsx` fixed at the root: derive "closing" from `open === false`, not `getVelocity()` sign (velocity is positive during an open's overshoot rebound too). (`0b1ab42`)
- (L367) Step 6 — docs: README theming table + DOM contract prose, DESIGN.md §3/§4.1. (`2aab652`)

### Glow palettes for social clips — 2026-09-11

- (L371) Step 1 — palette presets in the example demo (Rainbow/Mono/Midnight Purple/Neon Gold) via DialKit's native select control, wired to the existing dials (`3cbac96`)
- (L372) Step 2 — recordings: 8 clips + 2 comparison grids, light and dark backgrounds (scratchpad, not committed — see report)
- (L373) Step 3 — report to Sean: SHAs, final values, gate summaries, clip paths, frame notes

### Center anchor — 2026-09-11

- (L377) `src/anchors.ts` — two-axis alignment model (`ANCHOR_AXES`), new `"center"` id, `AnchorEdge` → `AnchorVertical`
- (L378) `src/anchors.test.ts` — hard-coded pins for the six existing anchors, center coverage, boundary/round-trip tests
- (L379) `src/Sheet.tsx` — always write inline top/bottom
- (L380) `src/styles.module.css` `.sheet` — margin-block/fit-content centring, max-height formula
- (L381) `src/index.ts` — export renamed `AnchorVertical` type
- (L382) `example/geometry.spec.ts` — center-anchor geometry gate (own centre-offset assertion, not the bottom-edge one)
- (L383) Docs — README "six"→"seven", `docs/PACKAGE-DESIGN.md` §1, `example/main.tsx` copy
- (L384) Visual proof clip (agent-browser, Neon Gold, center anchor) + report to Sean

### Honest perf gate — 2026-09-11 (headless, PipelineReporter)

- (L390) Ground truth sanity-checked: plain warm cycle 70 distinct frames headed, 68 headless (old clips were broken: 8 and 1)
- (L391) Gate rewritten: dropped frames + longest presented interval, screencast removed, new headless on ANGLE Metal, software renderer refused (`261653c`)
- (L392) Each metric proven to fire headless: jank 108 dropped, block 150ms, gpu (48 layers) 142 dropped, +unrelated animation 111 / 150ms
- (L393) Rebaseline on a quiet machine (load1 2.5–2.8): raster 55.7ms, 1 dropped, 16.7ms longest interval (`f6239aa`)
- (L394) Headless raster vs headed at quiet load: 55.7ms vs 44.8ms, +24%, inside the old headed +37% tolerance; not interchangeable (`f6239aa`)
- (L395) 3 plain `npm run perf` stability runs PASS (raster 43.2 / 65.5 / 44.5ms, dropped 1, longest 16.7ms) (`f6239aa`)
- (L396) Firing against the new baseline: `--inject-jank` dropped 106 FAIL, `--inject-block` 150ms FAIL, `--inject-gpu` dropped 148 FAIL, each exit 1 (`f6239aa`). Combos with `--inject-animation` measured before the rebaseline only (111 dropped / 150ms)
- (L397) README "Measuring smoothness": limits, sensitivity and exit codes (`f6239aa`)

### Carried at wrap-continue — 2026-09-11 (evening, thread DiskSheet)

- (L401) **carried — DECIDE: rename the package.** Sean: "morph-sheet sucks as a name." Breaking changes are free until publish (not on npm). Strawman next step: run the `brand-naming` skill seeded with what the component does (a disc that blooms into a sheet and folds back; a draggable anchor; one-clock spring morph), with npm + GitHub availability checks. A rename touches package.json name, README, the `MorphSheet` namespace/`useMorphSheet` exports, `--morph-sheet-*` CSS vars, `data-morph-sheet-*` attributes, the audit script and docs, so it should be one structural pass, not a find-replace. → brand-naming ran; carried again with results under the late-evening heading below. → locked VistaSheet 2026-09-12 (web screen YELLOW: Vista/Vistaprint design brand, Emigre Vista Sans; no exact-name use); renamed in this commit.

### Carried at wrap-continue — 2026-09-11 (late evening, thread DiskSheet)

- (L408) **carried 2× since 2026-09-11 — DECIDE OR KILL: lock the package name.** Strawman: **VistaSheet** (Sean's own pitch). npm `vistasheet` / `vista-sheet` free, 0 GitHub repos by name. Web screen NOT run (session hit its 200-WebSearch cap). Inferred risk: "Vista" reads as Windows Vista / Vista (Vistaprint's parent). Keeps "Sheet", so identifiers become `VistaSheet` / `useVistaSheet` / `--vista-sheet-*` / `data-vista-sheet-*`. Sean also floated **AvaSheet**: `ava` is the AVA Node test runner (avajs/ava ★20.8k), a dev collision. → locked VistaSheet 2026-09-12 (web screen YELLOW: Vista/Vistaprint design brand, Emigre Vista Sans; no exact-name use); renamed in this commit.
- (L413) Sean — rename GitHub repo seansmithworks/disc-sheet → vista-sheet before publish (package.json URLs already point there) → done 2026-09-12 via gh repo rename; origin repointed. Repo was already public.

### Carried at wrap-continue — 2026-09-13 (thread DiskSheet)

- (L422) Settings panel fixes live on Vercel (d70a954 build; icon, collision, dark mode) — promoted 2026-09-13.

### Carried at wrap-continue — 2026-09-13 (early morning, thread DiskSheet)

- (L429) **carried — verify `e59c7a2` WIP first** (review fixes stopped mid-flight at wrap): npm test, `tsc --noEmit` (6 pre-existing errors is baseline), audit:vars, build:lib + banner, test:geometry (116 + new). Fix anything red before the run's base is set.
- (L430) carried — P2 shapes (circle/squircle/rounded square/square; Shadow follows shape) → branch `v02/p2-shapes` off the verified tip
- (L431) carried — P1 playground + copy tool → `v02/p1-playground` off P2
- (L432) carried — P4 video + aspect-ratio sheets → `v02/p4-media` off last green tip (placeholder portrait clip via ffmpeg unless Sean supplies his)
- (L433) carried — P3 rectangle buttons S/M/L → `v02/p3-buttons` off last green tip
- (L434) carried — morning: orchestrator re-runs all gates + perf on a quiet machine, captures, then pushes branches after Sean looks. No deploy, no publish, no merge. → gates re-run at `98cadb2` + branches pushed 2026-09-13 afternoon; captures carried below.
- (L437) `0c7dc11` item stagger 40→90ms + example sheets split into title / body / actions Items. Measured beats on index: 284 / 376 / 459ms (was 281 / 322, two beats).
- (L438) `6a7e3a7` Design menu: Shadow speed (Very slow 24s … Fast 3s + Variable, rAF-integrated, no phase jumps) · Glow colour + Glow strength with per-palette Light/Medium/Bold · 8 palettes mildest→wildest (Mono, Midnight Purple, Aurora, Rainbow, Neon Gold, Biolume, Demon Pink, Glitch) · warm × dark as a 4-cell CSS model (Warm + Dark mode painted cream sheets before) · DialRoot `productionEnabled` (Show dials did nothing on Vercel: dialkit defaults to dev-only). Independent review: pass, no blockers.
- (L439) **DECIDED 2026-09-13 (Sean): "we are taking our strawman and hardening it now."** Tonight's values are decisions, not strawmen: 90ms stagger, palettes + strengths, speed steps, warm dark hexes. Older strawmen (snappy/gentle) stay marked.
- (L440) carried — `e59c7a2` WIP: F1 `<VistaSheet.Shadow asChild>` overwrote the child's ref (package defect, `src/Shadow.tsx` cloneElement) → composed + `src/Shadow.test.ts`; F2 reduced-motion subscribed live; F3 labels hardened; F4 demo uses a ref. UNVERIFIED (see first item).
- (L441) carried — deploy the demo (Sean's explicit go per deploy; `vercel deploy` → `vercel promote`). → deployed 2dfe523, see VistaSheet afternoon section.

### Overnight v0.2 run ledger — 2026-09-13

- (L453) e59c7a2 WIP verified at dc3bd44 before launch: 95 vitest · tsc 6 (baseline) · audit:vars PASS · build:lib + banner PASS · geometry 117 passed.

### Carried at wrap-continue — 2026-09-13 (afternoon, thread VistaSheet)

- (L470) carried — independent review of the Shadow per-frame fix `d3f294b`/`09d8f2e`: PASS-WITH-FINDINGS; current spec proven red on pre-fix Shadow (framesOver1 140/141 vs budget 6, post-fix 3); dead peak gates removed, writes held ≤1/frame (`7dedb59`).
- (L471) carried — 48px default sheet radius across package + examples: `f5a3a8f` (incl. Search/Chat recipes 28→48, flagship 36→48 and media-card 28→48 kept as strawman); slider ceiling 48→64 `d5a9a3e` (strawman).
- (L472) new — playground live option switching: red `eb4eb25` → fix `58b0097` (example-only; specimen key was the whole generated JSX); recipe switch while open covered `9962b1e`; radio/label wrap fix `eb3d0dd`.
- (L473) carried — `play.html` captures per shape (contact sheet + full-size) sent to Sean, 2026-09-13.
- (L479) found — media ratio self-check flake (failed 2 of 3 full runs under load): sampler now ends on the sheet's settled signal, not wall clock (`673a9a1`).
- (L480) found — orchestrator gates at `eb3d0dd`: vitest 177 · tsc 6 (baseline) · audit PASS · build+banner PASS · geometry 252/252 · perf PASS (load ~8, warning).
- (L481) awaiting Sean — DialKit "Iridescent shadow" values he shared (Neon Gold, opacity 0.22, length 161, blur 69, saturation 1.40, spin 16s; crossfade 0–0.25) differ from the Neon Gold preset in `example/main.tsx:293` (0.30–0.60 / 42–60 / 32–46 / 10s); strawman: bake in as Neon Gold defaults. → baked in 2dfe523 (Bold 0.22/161/69, Medium 0.17/140/60, Light 0.11/113/48 — Light/Medium scaled by old ratios, strawman; spin 16s = Slow step; crossfade already 0–0.25).
- (L487) v0.2 stack fast-forwarded into main (Sean's go, 2026-09-13): main 973cc2f → c10def5 → 2dfe523, pushed. Not merged on purpose: v02/p4-media's 9ad603e (stale "P3 stopped" ledger line) and v02/sheet-radius-48's 52b4070 (WIP superseded by f5a3a8f).
- (L488) Old branches deleted locally and on origin (Sean's go): v02/p1-playground, v02/p2-shapes, v02/p3-buttons, v02/p4-media, v02/sheet-radius-48, feat/customization-parity.
- (L489) Demo deployed to production from main @ 2dfe523 (Sean ran the CLI; the auto-mode classifier blocks vercel deploy and self-edits to permissions): https://vista-sheet.vercel.app serves index-DWTJnWuG.css (48px) + main-BQfH1qgx.js (Neon Gold 161). Deployment dpl_XXgwjYXsnggseCVfzTZgr4tnHdfS.

### Sean's v0.2 localhost test notes — 2026-09-13 (evening, thread VistaSheet)

- (L505) 1 → fixed `44aa28d` (command vs report; geometry 253/253, red-proven); independent review running.
- (L508) 12. Render deploy (Sean interviews with Render 2026-09-14): static site `vista-sheet` https://vista-sheet.onrender.com, service `srv-dajphh9594qs73d4i740`, build `npm ci && npx vite build example` → `example/dist`, NODE_VERSION 22, autoDeploy OFF. Deploy `dep-dajphhp594qs73d4i8ng` live from `e73cf59` (same `main-BQfH1qgx.js` as Vercel).
- (L511) 11 → Magic Patterns design system "VistaSheet" `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38` (artifact `58ad360e…`), 10 components / 46 static previews, both chat bugs rendered as intended. NOT published — Sean publishes after a look. https://www.magicpatterns.com/design-system/ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38
- (L515) 2 + 3 → fixed `b601927` (always-emit palette block, shared button rules in BASE_CSS, bubble text = surface; 116 class-of-bug codegen tests red-proven; vitest 293 · geometry 253/253). Independent review PASS-WITH-FINDINGS.
- (L520) 7 → review board: 152/152 tiles on b601927 (32 unique open hashes per viewport), `scratchpad/board/index.html`; re-run `board/capture.mjs` after the neutral default lands.
- (L531) 15 → neutral default `d178ccd` (+ flagship `#a4441f`), riders `e0b1ad8` (`.vs-grid-label` rule, allowlist dropped = 16), `cce0fe8` (applyingRef comment = 18). Survivors kept on purpose: glow presets (main.tsx, example.css:245), tuner amber warn colour. Builder gates: vitest 293 · tsc 6 · audit PASS · geometry 252–253/253 with `media.spec.ts` timing flakes under load (different sub-case each run) — orchestrator to confirm on a quiet solo run.
- (L532) T2 review (workflow run wf_7766f136-d8a): PASS, no must-fix — neutral set consistent across README/DESIGN/state.ts/PACKAGE-DESIGN, audit PASS, grid-label rule matches inherited look, no StrictMode anywhere.
- (L533) Overnight run STOPPED at wrap-continue ~01:00 PT (Sean: clear context, save tokens) — relaunched and finished, see below. T3 builder was mid-lane: its unverified red test saved on branch `wip/t3-red-test` (`2b5701e`, example/trigger-activation.spec.ts), removed from main. Relaunch in the fresh thread: `Workflow({scriptPath: "~/.claude/projects/-Users-seansmith-Code-disc-sheet/memory/plans/v02-quality-wave/overnight-t3-n2.js"})` (T3 → N2, cap 1.5M) → orchestrator gates (quiet solo geometry) → push → Render `trigger_deploy` → verify asset → stop. Pre-approved by Sean.
- (L534) T3 → `af272b6` a drag never swallows the next tap or Enter: sticky `draggedRef` deleted, per-gesture max travel read once in `handleClick` (`src/Trigger.tsx`). `example/trigger-activation.spec.ts` red-proven 4/5 against pre-fix (act-4 4px wobble is inferred, not proof; act-5 regression check). Review (wf_6b021250-886) PASS, no must-fix.
- (L535) N2 → `ad24c04` focus model (TreeWalker tabbables incl. inputs/select/textarea, trap owns every Tab, scroll lock/aria-hidden/trap last until exit-complete, Content tabbable while overflowing) + `ebff8dc` review fix: initial focus is an opt-in `Sheet initialFocus` ref (ad24c04 had shipped a universal first-text-field heuristic — deleted), Search/Chat recipes emit it live + in codegen, `Close` reveals on keyboard focus (was focused-but-invisible before settle, red-proven). Sean note 6 closed. Reviews: ad24c04 PASS-WITH-FINDINGS (the heuristic) → ebff8dc PASS.
- (L536) Orchestrator gate re-run on `ebff8dc` (2026-09-14 ~02:20 PT): vitest 296/296 · tsc 6 baseline · audit:vars PASS · build:lib + client banner PASS · geometry 266/266 (no media.spec flake). Pushed `f6677d1..ebff8dc`.
- (L537) Render redeployed (12b, Render half): deploy `dep-dajrql95efls73a49h9g` from `ebff8dc`, status live 2026-09-14 09:24:53Z; https://vista-sheet.onrender.com/ serves `assets/main-ByIa7MPx.js` = local `npx vite build example` hash. Vercel still on `2dfe523` (needs Sean's paste). Overnight job done — STOP; T4–T6, N1, MP after Thu 9am.

### 2026-10-04 — link-preview (`explore/link-preview` @ 25e7b02)

- (L543) `<VistaSheet.Root preview>` hover card built; two independent reviews APPROVE. Gates: vitest 311 · link-preview spec 26 · geometry 292 · tsc 6 baseline · build:lib + banner · perf PASS. Non-test src net +636 vs b38a84c (cut from +901).
- (L544) 24. carried — Decide: preview placement (strawman ABOVE-first, `anchors.ts` constant; Sean's original spec was below-first) and 240px min height (`PREVIEW_MIN_HEIGHT_PX`). Decided: above-first and 240px confirmed by Sean 2026-10-04.
- (L545) 25. carried — Decide: merge `explore/link-preview` to main / open PR / keep exploring. Strawman: PR after 26–27. Decided: open a PR after items 26 and 27, no merge yet (Sean, 2026-10-04).
- (L546) 26. carried — Write README + docs/PACKAGE-DESIGN.md sections for preview mode (types: RootComponentProps/PreviewRootProps; card is aria-hidden — no focusables inside).
- (L547) 27. carried — Real-iPhone long-press check (only synthetic CDP touch tested). Done: Sean tested on a real iPhone via Vercel preview 2026-10-05, "works well enough for right now".
- (L548) 28. carried — Demo fixtures preview as near-blank pages; swap in content-rich owned pages.

### 2026-10-06 — canvas branch findings

- (L563) 39. BUG (library, `src/`) — A Root mounted with `defaultOpen` never settles: `collapseProgress` stays 1, `data-vista-sheet-settled` is never set, `<Close>` stays opacity 0, `initialFocus` likely never fires. Observed independently by two agents on 2026-10-06 in canvas.html open tiles (8/8 `open-*` tiles: settled=false, close opacity 0 after 3.5s). Likely cause (inferred, not reproduced as cause): `src/Root.tsx` ~226-285 — the fallback rAF that starts the morph clock for a defaultOpen mount (~262-270) is cancelled by effect cleanup (~273-278) when deps change (`resolveMotion` returns fresh transition objects each render); on re-run `wasOpen` is already true so the early return (~236) never re-arms it. Knock-ons: `Sheet.tsx:124-132` (settled attr), `useDialogBehavior.ts:203-209` (initialFocus), Close reveal. Needs debug-trace + fix + a test; canvas open tiles become the visual check. **Status 2026-10-07: fixed on `canvas`** — merge `2b54a7b` (fix/default-open-settle `eb73f1e`); all 26 defaultOpen canvas tiles now settled, Close opacity 1, Shadow ::after 1 / ::before 0.

### 2026-10-07 — canvas review round 1+2 (html-review sess_0246bd1a6e4f)

- (L576) 49. in flight (other lane) — Playback: ultra-slow / frame-by-frame morph playback, slow-mo choreography with a scrubbable timeline, autoplay for motion and heavier interaction displays (comments 21, 27, 30, 31). **Status 2026-10-07: done on `canvas`** — virtual clock `c66c6ec` `0d4ff99` `d8bd05a`, Motion Lab `1b62cdf` `22c5e03`, autoplay `adc4a56`. Awaiting Sean's review.
- (L577) 50. in flight (other lane) — Isometric exploded view of the Z-stack (comment 26). **Status 2026-10-07: done on `canvas`** — `a4c2bec`, `cc0b6ba`. Awaiting Sean's review.
- (L578) 51. in flight (other lane) — Anatomy as one foundation plus per-recipe variants: "why is media different here?" (comment 25). **Status 2026-10-07: done on `canvas`** — `9223b62`, assets `e20442d`. Awaiting Sean's review.
- (L579) 52. in flight (other lane) — defaultOpen settle bug (item 39): explains the missing close buttons on open tiles (comment 14), the closed-shape shadow persisting on open sheets (comment 20), and likely the Sheet geometry › Radius 16 tile painting 48px corners (round-2 review). Canvas open tiles are the visual check once it lands; recapture posters after. **Status 2026-10-07: posters, frames and anatomy recaptured (headless, `1b34701`).** Radius 16 now paints 16px corners (computed border-radius 16px); the tile was the same settle bug, no canvas change needed.
