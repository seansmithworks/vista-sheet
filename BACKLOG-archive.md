# vista-sheet BACKLOG archive

Append-only. Items moved out of `BACKLOG.md` on 2026-10-07 because they are done, obsolete, or merged into another open line. Grouped by the heading they sat under. `(L123)` is the line number in `BACKLOG.md` at `8090664`; the full pre-cleanup text, including prose notes that were not checkbox items, stays readable with `git show 8090664:BACKLOG.md`.

Each moved item carries `[done]`, `[obsolete]` or `[merged]` plus a one-line reason and evidence (SHA or file:line), all checked against the tree on 2026-10-07.

## Moved 2026-10-07 (checked against code and git)

### 2026-09-25 — review files rescued from the old (compromised, since wiped) Mac

- (L7) [merged] `example/media.spec.ts` — old copy has an uncommitted test fix (starts the frame sampler before the click so the 640ms open spring is captured). Likel…
  - Merged into the media.spec flake line in Parked.
- (L9) [obsolete] `package.json` — old copy is v0.1.0 (live is 0.1.1) with a different `prepublishOnly` chain. Probably stale; skim and discard.
  - Rescued package.json is the older copy (0.1.0); live is a superset (prepare, test excludes, jsdom). Only difference is a `record` script tied to untracked scripts/record-demo.mjs, which is in BACKLOG 59. Evidence: diff of .rescued-2026-09-24/package.json vs package.json.

### Waiting on Sean (morning)

- (L29) [done] `npm login` then `npm publish --access public` (token expired 2026-08-31, verified 401)
  - 0.1.0 is on npm (published 2026-09-15). Evidence: npm view @seansmithworks/vista-sheet time.
- (L30) [done] Merge feat/customization-parity → main
  - v0.2 stack fast-forwarded into main and feat/customization-parity deleted. Evidence: e73cf59.
- (L31) [obsolete] Review flagship captures + parked taste calls (added by Phase 4)
  - Stale 2026-08-31 review request; flagship and its taste calls were superseded by the 2026-09-13 'hardening' decision and the 48px radius change. Evidence: f5a3a8f.
- (L32) [obsolete] `/model` default is now Fable 5 for ALL new sessions (saved by tonight's `/model fable`) — re-pick daily default per your own escalation-only rule
  - Not repo work; the global default model is now opus. Evidence: ~/.claude/settings.json:68.

### Greenfield install / first-run experience (Sean, 2026-08-31 — resurfaced from a phone ask that was NEVER captured)

- (L61) [obsolete] Greenfield consumer app Sean can actually open. Phase 1's gate built one (`.../d4c0a3bb-.../consumer-next`, node_modules + 0.1.0 tarball, routes `/`, …
  - The consumer app directory no longer exists and its scratchpad is dead. The clean-install path is now covered by the tester-ready re-run. Evidence: ls ~/Code/_experiments (no disc-sheet-consumer or vista-sheet-consumer); ORCHESTRATOR-log 2026-10-05.
- (L62) [done] README quickstart is not runnable. Three defects found 2026-08-31 by reading it as a fresh installer: (1) the Usage snippet mounts `<Avatar />` twice,…
  - README Usage snippet is copy-paste runnable: `export default`, `"use client"` shown, and a 'Pasted as-is' paragraph says what you will see. All three defects fixed. Evidence: 52d38af, 30ba168; README.md:128-170.
- (L63) [obsolete] The greenfield page must be the README snippet verbatim, not a hand-tuned demo — the point is to test the documented path, which is what an installer …
  - Consumer app is gone; the README snippet itself was verified by the 2026-10-05 clean-install re-run (git/tarball/copy-in x Next16/Vite8). Evidence: ORCHESTRATOR-log 2026-10-05.

### REOPENED: morph smoothness — Sean's verdict 2026-08-31, after using the prod consumer app

- (L73) [obsolete] Phase 3 dispatched (diagnosis only, no edits): rAF frame-timing to separate JANK from CHOREOGRAPHY, a frame-by-frame breakdown, and an Emil-format rev…
  - Phase 3 diagnosis was overtaken by Sean's verdict 'It's looking good' (2026-09-01) and V4 as the shipped motion default. Evidence: 23c3c49.
- (L74) [obsolete] Taste calls arising from Phase 3 are Sean's — do not pre-empt spring/duration changes as "perf fixes".
  - Same as Phase 3: motion taste calls closed by V4. Evidence: 23c3c49.

### Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- (L79) [done] STRAWMAN BUILT 77f6d9b, awaiting Sean — `SURFACE_CLOSE_LEAD_DELAY_MS` is now 35 (was 100). Two constants to revert (it and the derived `DEFAULT_SHARED…
  - Lead delay is 35 and shipped; Sean's V4 pick kept lead 35. Evidence: src/motion.ts:82; 23c3c49.
- (L80) [done] PARKED — add a `prepack` script. `npm pack` does not run `prepublishOnly`, so a pack without a prior `npm run build:lib` ships stale compiled `dist/`.…
  - `prepare` runs build:lib, and npm runs prepare on pack, so a pack can no longer ship stale dist. Evidence: ad74b2e; package.json scripts.prepare.
- (L81) [done] PARKED — `motion@13.1.1` resolves in consumers; geometry suite runs v12. Untested combination. Verify the v13 projection path or pin the peer range.
  - Peer range pinned to >=12 <14 after the full suite ran green on motion 12.43.0 and 13.1.1. Motion 14 remains open as BACKLOG 32. Evidence: 4fa3929; README.md:120.

### Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

- (L118) [obsolete] Sean's call — the tuner is live at http://localhost:3000/tune (prod build, detached server). Dial it, then hand back either the panel's Copy JSON or j…
  - The localhost:3000 consumer /tune is gone; Sean picked V4 from it. Evidence: 23c3c49.

### Tuner productization (Sean, 2026-08-31 — from the /tune session)

- (L122) [done] Ship the tuner via `npx disc-sheet add tuner`, NOT as a package dependency. Scaffolds a `/tune` route + dialkit as a devDependency into the consumer's…
  - `npx @seansmithworks/vista-sheet add tuner` copies the tuner in; dialkit stays a devDependency. Evidence: ec2ca6c; bin/vista-sheet.mjs:92.
- (L123) [done] Shadow dials — do these first. `DiscSheet.Shadow` is already a component with tokens; offset/blur/opacity dials are cheap and carry no correctness ris…
  - Shadow dials exist in the surface & shadow tuner page. Evidence: 6e7989a; example/surface/Tuner.tsx.
- (L124) [done] Shape dials (circle/squircle/square) — GATED behind child-radius masking. Adding the dial before the masking ships a control whose every non-circle se…
  - Shape presets with child-radius masking shipped, so the gate is lifted. Evidence: 5238e4e; src/shape.ts.

### Tuning snapshots (2026-08-31)

- (L131) [done] V4 is Sean's pick and it reverses the strawman's direction. V4: shell 375/32/1, avatar 340/30/1, lead 35, fill 0.45. The avatar is FASTER than both Ph…
  - V4 baked in as the shipped close defaults (shell 375/32/1, shared 340/30/1, lead 35). Evidence: 23c3c49; src/motion.ts.

### Checkpoint — 2026-09-01 (wrap-continue)

- (L139) [obsolete] ~~`npm login` && `npm publish --access public`~~ ON HOLD — do NOT publish. Sean decided 2026-09-01 to hold 0.1.0 and ship one bigger first release inc…
  - Hold lifted; 0.1.0 was published 2026-09-15. Evidence: npm view @seansmithworks/vista-sheet time.
- (L142) [obsolete] Consumer app has no version control — `git init` at ~/Code/_experiments/disc-sheet-consumer offered, not done. /tune exists only on disk.
  - Consumer app directory no longer exists. Evidence: ls ~/Code/_experiments.
- (L143) [obsolete] 4 orphaned next-server processes on ports 3921-3924 (dead session scratchpad `.../d4c0a3bb-.../consumer-next`). Offered to reap, Sean did not answer.
  - Nothing listens on ports 3921-3924; the session that spawned them is dead. Evidence: lsof -iTCP:3921-3924.
- (L144) [obsolete] Arrival-gap SIGN CONVENTION is unresolved: 77f6d9b reads −33.2ms (BACKLOG), +25ms (PACKAGE-DESIGN §3) and +8.4ms (the /tune rig) for the same commit. …
  - docs/PACKAGE-DESIGN.md no longer carries the +25ms figure and the -33.2ms line lived only here, so the contradiction is gone. Evidence: grep of docs/PACKAGE-DESIGN.md.
- (L146) [done] Consumer resolves motion@13.1.1 while the geometry suite gates on v12. Untested combination.
  - Duplicate of L81: motion 13 suite-verified and peer pinned. Evidence: 4fa3929.
- (L147) [done] `npm pack` still does not run `build:lib` (the prepack item). Every ship cycle this session needed a manual build + dist grep to prove the change ship…
  - Duplicate of L80: prepare builds before pack. Evidence: ad74b2e.

### 0.1.0 scope expansion — variations + settings (decided 2026-09-01)

- (L155) [done] Motion presets — named springs so consumers pick a feel instead of hand-tuning stiffness/damping; /tune becomes a preset picker that exports values.
  - `presets` export and `preset` Root prop shipped. Evidence: 2544796; src/motion.ts:404.
- (L156) [done] Shape + size variations — circle/squircle/square, size ramps, sheet dimensions. GATED on animated child-radius masking (see the v0.2 shape-presets ite…
  - Shape variants, trigger size ramp, sheet radius and media aspect ratios shipped. Evidence: 5238e4e; f5a3a8f; src/types.ts triggerSize.
- (L157) [done] Layout + behavior settings — anchors, placement, backdrop, dismiss, controlled/uncontrolled.
  - Anchors (seven), controlled/uncontrolled open, dismissOnBackdrop all exist. Evidence: src/types.ts:76-80,204.
- (L158) [done] One unified config surface — CSS custom properties + config object, design-system drop-in shape.
  - `preset` object plus `--vista-sheet-*` CSS variables with the README theming table. Evidence: 2544796; README theming table.
- (L159) [done] Answer: what do standard UI toolkits commonly ship that disc-sheet does not? Gap analysis against the real source, not a listicle.
  - Gap analysis against peer libraries was done in the 2026-09-01 plan gate and drove the preset/asChild/forwardRef decisions. Evidence: BACKLOG at 8090664, lines 163-185.

### Plan gate CLOSED — /adversarial-plan verdict RETHINK (2026-09-01)

- (L170) [done] `src/types.ts:80-84` JSDoc on the PUBLIC `surfaceCloseLeadDelayMs` prop says `transition.shared.close` "is derived from this value". FALSE since V4. I…
  - types.ts JSDoc now says the shared close is coupled by feel, not derived. Evidence: 8d42184; src/types.ts:131-137.
- (L171) [done] `src/motion.ts:57` and `:81-83` assert the same dead derivation, contradicted by `:102-110` in the same file. Four stale sites total, not two.
  - motion.ts comments no longer claim the derivation. Evidence: 8d42184; src/motion.ts:50-54.
- (L172) [done] Focus trap does not trap (`useDialogBehavior.ts:54-70`): Tab is only intercepted when activeElement is already the first or last focusable INSIDE the …
  - Focus trap owns every Tab and covers inputs. Evidence: 2413a6b, ad24c04; src/useDialogBehavior.ts.
- (L173) [done] No background `aria-hidden`/`inert`. `aria-modal="true"` (`Sheet.tsx:284`) is a hint browsers do not act on. Screen readers read the whole page behind…
  - Background aria-hidden via hideOutsideSiblings. Evidence: 2413a6b; src/useDialogBehavior.ts.
- (L174) [done] Scroll lock sets `body.overflow=hidden` with no scrollbar compensation — visible ~15px sideways page shift on open, on a library whose whole pitch is …
  - Scroll lock compensates the scrollbar with padding-right. Evidence: 2413a6b; src/useDialogBehavior.ts.
- (L175) [done] Geometry gate has never run against motion@13, which the verification consumer resolves. The only instrument that can prove the V4 feel survived a ref…
  - Full geometry suite ran green on motion 13.1.1. Evidence: 4fa3929.
- (L176) [done] `index.ts:61-67` exports five runtime geometry helpers (`anchorCenter`, `nearestAnchor`, `restingLeft`, `restingTop`, `sheetPlacement`). Decide before…
  - Geometry helpers are no longer exported from index.ts. Evidence: 9e8c5c9; src/index.ts.

### New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- (L189) [merged] Visual configurator on the site. Pick a variation, see it live, copy the code, paste it in. Two install paths: npm, or copy-paste from the tool. shadc…
  - Playground (play.html) built; the remaining site-embed half is in BACKLOG 33. Evidence: 6f10f70.
- (L190) [done] Showcase examples with media, tied to the already-parked "icon to advertisement" concept: iOS-squircle app icon morphing into an App Store-style previ…
  - media-card and video examples shipped. Evidence: e6d4c41; example/media-card, example/video.
- (L191) [obsolete] Naming system across all Sean's components/tools/frameworks. Immediate trigger: "disc-sheet" stops being accurate the moment the disc can be a squircl…
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

- (L233) [obsolete] Phase 6 — rebuild the consumer app on :3000 (build:lib -> pack -> reinstall -> rebuild -> restart) so Sean has something to put his hands on. Broken b…
  - Consumer app is gone. Evidence: ls ~/Code/_experiments.
- (L234) [done] Item 6 PUBLISH is Sean's hands, not mine — `npm login`, `npm publish`, repo public on GitHub. Outward-facing + needs his auth.
  - 0.1.0 published. Evidence: npm view.
- (L235) [merged] Item 7 site page — NOT overnight work, different repo.
  - Site page is BACKLOG 33.

### ⛔ Acceptance test findings — 2026-09-02, clean-install walk of the five-minute table

- (L275) [done] A1 (BLOCKS) — the README quickstart does not build as printed. `README.md:128` is `function ContactTrigger()` with no `export default`, and nothing in…
  - A1: README snippet has `export default`. Evidence: 52d38af; README.md:136.
- (L276) [done] A2 (BLOCKS the feature's whole point) — the `"use client"` guard is UNREACHABLE and never fires. Verified: `src/index.ts` exports only the `MorphSheet…
  - A2: the unreachable guard was removed and the README documents the real error. Evidence: 30ba168; README.md:190-211.
- (L277) [done] A3 (CONFUSES) — the `mass` trap is reopened by the union, and the README claims otherwise. F1's fix correctly removed `mass` from `DurationSpring`, bu…
  - A3: dev-only runtime warning for `mass` with `visualDuration`; README says to read the paragraph, not the type checker. Evidence: 30ba168; src/motion.ts:186; README.md:686-692.

### Item 3 CLOSED, item 2 blocked by tuner coverage — 2026-09-02

- (L292) [merged] Second gap: the tuner seeds from `SHIPPED` (the dialled default) and has no notion of which preset it is editing. Dialling `snappy` means dialling by …
  - Merged into the snappy/gentle line.
- (L293) [merged] Three options put to Sean, his call: (1) dial close-only and re-document the open springs honestly as un-dialled; (2) extend the tuner with an open-di…
  - Merged into the snappy/gentle line.

### Figma export — parked until Sean is at the Mac (2026-09-02)

- (L302) [obsolete] Correction to an earlier note: `scratchpad/variant-b.diff` will NOT `git apply` any more — it was cut against the original white ground and its contex…
  - Informational correction folded into the Variant A vs B item.

### PARKED — corner-spark micro-detail (research complete 2026-09-02, OFF the locked objective)

- (L318) [merged] Four open decisions, all Sean's: which mark · every open vs first-open-per-session · reduced-motion (drop or show static) · opt-in prop vs on by defau…
  - Merged into the corner-spark line.

### Sean's expansion asks — 2026-09-12 (playground, shapes, buttons, media)

- (L328) [done] The design-settings panel becomes the WYSIWYG "copy tool" — a playground page reached from npm to play with the component and copy what you build. (ex…
  - Playground page shipped. Evidence: 6f10f70; example/play.html.
- (L330) [merged] Custom shapes definable by any developer or agent, beyond the presets. (new) — reopens SCOPE LOCK → DEFERRED 2026-09-13 (Sean): future release, not v0…
  - Merged with the star line in Parked (deferred by Sean 2026-09-13).
- (L331) [done] Button-style triggers: rectangle/pill at small/medium/large with icon, icon+text, or text; by extension a search box or chat input as the trigger. (ne…
  - Rectangle button triggers S/M/L with icon/text. Evidence: f6fabd6; example/buttons.html.
- (L332) [done] Sheet content presets: list, grid, navigation, media. (extends: line 203 "Content layouts as package exports") — reopens SCOPE LOCK
  - list, grid, nav, media, video, search and chat recipes. Evidence: 8454dd5; example/play/recipes.ts:12.
- (L340) [done] The intent is prepackaged presets that show how flexible the tool is. (extends: line 182 "Showcase examples with media")
  - Prepackaged presets are the playground recipes. Evidence: example/play/recipes.ts.

### Carried at wrap-continue — 2026-09-11 (thread DiskSheet)

- (L356) [obsolete] parked — Close X scale-from-0 spin is a deliberate deviation from "start at 0.9+" (DESIGN.md §4.5); revisit only if it reads as popping in a recording…
  - Not a task: the Close X spin exception is documented in DESIGN.md with its revisit condition. Evidence: DESIGN.md:121.

### Carried at wrap-continue — 2026-09-11 (late evening, thread DiskSheet)

- (L414) [obsolete] consumer app in ~/Code/_experiments still imports @seansmithworks/morph-sheet; repoint on next rebuild
  - Consumer app is gone. Evidence: ls ~/Code/_experiments.

### Carried at wrap-continue — 2026-09-13 (thread DiskSheet)

- (L419) [obsolete] carried — map phases + pick the cut line with Sean (next round's first action). Plan Artifact v4: https://claude.ai/code/artifact/1ab67c7c-1efc-4fbf-a…
  - Cut line resolved: all four phases built, merged and deployed. Evidence: e73cf59.
- (L421) [obsolete] carried — open plan calls, strawmen already in the Artifact: reopen SCOPE LOCK for P3 buttons + P4 aspect ratio (rec: yes) · squircle = superellipse v…
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
- (L490) [obsolete] noticed — to let Claude deploy without Sean pasting the CLI, Sean adds `Bash(vercel link *)` and `Bash(vercel deploy *)` via /permissions (Claude is b…
  - Vercel is no longer the live demo; the one-demo-or-two call is BACKLOG 21. Evidence: gh repo view homepageUrl = vista-sheet.onrender.com.

### Sean's v0.2 localhost test notes — 2026-09-13 (evening, thread VistaSheet)

- (L494) [done] 1. `/play.html` drag → endless flicker. Cause verified: `AnchorSync` (stage-entry.tsx) reverts every drag across the postMessage round trip; any ancho…
  - Drag flicker fixed (command vs report), red-proven. Evidence: 44aa28d.
- (L495) [done] 2. Chat bubble invisible (Warm: `--vista-sheet-accent` never declared because codegen omits package-default values, `.vs-chat-bubble-out` has no fallb…
  - Chat bubble and codegen fixed. Evidence: b601927.
- (L496) [done] 3. Chat trigger/send icon 0×0 on all palettes/sizes: `.vs-button-icon`/`.vs-button-text` live only in SEARCH_RECIPE.css. Queued: move to BASE_CSS; tes…
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
- (L504) [done] 11. Full design system in Magic Patterns (new VistaSheet project) — awaiting Sean's go (outward: uploads unpublished source; MP re-creates components …
  - Magic Patterns design system created; the rebuild is 11b. Evidence: BACKLOG at 8090664, line 511.
- (L509) [done] 12b. Redeploy Render + Vercel after tonight's fixes: push main, `trigger_deploy` Render, Sean pastes Vercel line — needs Sean's go.
  - Render half redeployed at ebff8dc; Vercel half is BACKLOG 21. Evidence: 3bbc6a5.
- (L513) [done] 15. Sean: "NO CLAUDE BURNT ORANGE ALLOWED. Lets default to neutral color palette." Package default palette warm → neutral (src/styles.module.css:58,25…
  - Neutral is the package default; no orange ships. Evidence: d178ccd.
- (L516) [done] 16. `.vs-grid-label` (recipes.ts:205-209) is a genuinely unstyled element, allowlisted in `codegen.test.ts:143-149` — give it a rule and drop the allo…
  - `.vs-grid-label` rule added and allowlist entry dropped. Evidence: e0b1ad8.
- (L518) [done] 18. Comment at `example/play/stage-entry.tsx:42-45` noting `applyingRef` relies on synchronous `onAnchorChange` + no StrictMode (review of 44aa28d).
  - StrictMode comment added. Evidence: cce0fe8.

### 2026-10-07 — canvas review round 1+2 (html-review sess_0246bd1a6e4f)

- (L570) [done] 43. DECIDE — Trigger/button shadow reads heavy and generic (comments 7, 29), and "is there a stroke/border as well?" (yes: a 2px `--vista-sheet-surfac…
  - Softer shadow and Sean's dialled surface look shipped; ring width is a token. Evidence: 57bd049, 578f2ce.
- (L571) [done] 44. DECIDE — Button and disc hover/pressed are visually identical to rest (comment 28; see 41). Should the package ship hover/pressed styles?
  - Hover and pressed styles ship. Evidence: 57bd049, 5674e77.
- (L572) [done] 45. DECIDE — 48pt minimum tap target for rectangle buttons; the visual can stay smaller (comment 6). Library default.
  - 48px hit area on rectangle buttons. Evidence: 57bd049.

## Previously ticked items (carried over unchanged, 2026-10-07)

Every `- [x]` line that sat in `BACKLOG.md`, truncated to one line; full text at `8090664`.

### Overnight release-prep run — dispatched 2026-08-31 (Sean asleep; stage only, NO publish)

- (L15) Phase 0a — push feat/customization-parity to origin (done 2026-08-31, upstream set)
- (L16) Phase 0b — fresh baseline: vitest 15/15, Playwright 54/54 (43 geometry + 11 a11y)
- (L17) Phase 1 — build system + metadata + THE GATE: vite lib build (ESM + d.ts, vite-plugin-lib-inject-css per F1, NODE_ENV define-passt…
- (L18) Phase 2 — npx copy-in: zero-dep bin/disc-sheet.mjs `add`, tested in the same Next consumer, tsc green there, css-modules.d.ts coll…
- (L19) Phase 3 — flagship example (wave 5, unheld by Sean 2026-08-31): example/flagship.html second entry; tokens from README table not s…
- (L20) Phase 4 — experience audit: 13 mechanical found+fixed (M2 escalated to Opus, deltas now 0.1-0.4px), taste strawmen applied, #6 foc…
- (L21) Phase 5 — ce-code-review: 5 reviewers + validator, 6/6 findings confirmed AND fixed (headline: dist lacked "use client"), README R…

### Publish hold LIFTED 2026-08-31 (fix 1be78ac, gates 75/75 x3)

- (L25) Resting-disc squircle after interrupted close (reopen-mid-close -> Escape -> rest leaves the disc surface with a sheet-ish radius;…

### Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- (L78) **DONE bf48b0a — Phase 4 coupling landed.** `transition.shared` is now direction-aware; the close default (`DEFAULT_SHARED_CLOSE_S…

### Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

- (L99) Expose `surfaceCloseLeadDelayMs` as a Root prop. README + PACKAGE-DESIGN §3 updated: the row moved OUT of §3's internal table and …
- (L100) Tuner on a NEW `/tune` route in the prod consumer, built on **dialkit 1.4.3** (`DialRoot mode="inline" productionEnabled`, `useDia…
- (L101) Close path only, structurally: `transition.open` is never passed, so no dial can reach the open.
- (L102) Live readout (hand-built — dialkit is inputs only): arrival gap ms + min avatar inset px, median of the runs since the last dial c…
- (L103) Persistence + copy are dialkit's: `persist: true`, `id: "disc-sheet-close"` → localStorage key **`dialkit:disc-sheet-close`**. Pre…
- (L104) Strawman applied to the shipped defaults: `DEFAULT_CLOSE_SPRING` 375/32/1 → **317.4/29.44/1** (k=0.92), `DEFAULT_SHARED_CLOSE_SPRI…

### Checkpoint — 2026-09-01 (wrap-continue)

- (L138) **Sean's hands-on verdict on the production build at :3000.** CLOSED 2026-09-01 — "It's looking good." V4 stands as the shipped mo…

### New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- (L192) CONFIRMED 2026-09-01: the configurator answers ("both, site first" / "both in parallel") ARE Sean's. Build against them.
- (L193) "the ditter" = **dither** — one of Sean's other tools/effects that needs more work (cf. the surface-fx dither). Another package th…

### Overnight delivery run — dispatched 2026-09-02 (Sean asleep; NO publish, NO deploy)

- (L228) Phase 1 (2544796 + fixes 5345f0b) — motion presets — DONE. Reviewed by a non-builder, all 8 findings fixed and re-gated by the orc…
- (L229) Phase 2 (ec2ca6c) — tuner into this repo — DONE, gates re-verified by orchestrator (32 vitest / 75 Playwright / audit PASS), zero …
- (L230) Phase 3 (e6d4c41) — examples, all three — BUILT, gates green, screenshots sent to Sean. OPEN TASTE ITEM: list + contact float a sm…
- (L231) Phase 4 (f6072a2) — `"use client"` runtime guard — DONE. Dev-only, THROWS (fatal: nothing renders without hooks), wraps Root's fir…
- (L232) Phase 5 (4fa3929) — motion peer pinned to `>=12 <14` — v13.1.1 ran the FULL suite green (36 vitest / 75 Playwright), so the range …
- (L243) **F1 (most severe) `DurationSpring.mass` is a silent-failure trap.** Motion DISCARDS `visualDuration`+`bounce` whenever `mass` is …
- (L244) **F2 preset + partial directional `shared` inverts the arrival gap.** `Root.tsx:165` replaces `shared` wholesale, then the per-key…
- (L245) **F3 four of the eight new tests cannot fail.** `motion.test.ts:27-79` re-declares Root's merge expression inside the test body an…
- (L246) **F6 `presets` is mutable and shares references with the internal defaults.** The byte-identity-by-reference design means `presets…
- (L247) **F5 README advertises `bounce` without saying which spelling works.** `{duration:0.4, bounce:0.2}` is valid Motion syntax but `is…
- (L248) **F4 README overstates "field by field".** `shared` is replaced whole, not merged; that carve-out lives only in a code comment. F2…
- (L249) **F8 `Spring` became a union but its members are unexported.** A consumer holding a `Spring` and reading `.stiffness` now needs na…
- (L250) **F7 `visualDuration` alone is undefined behaviour.** Motion's `durationKeys` is `["duration","bounce"]` — `visualDuration` is not…

### Sean's expansion asks — 2026-09-12 (playground, shapes, buttons, media)

- (L333) Video sheet: a circle with Sean's picture expands to full video content. (extends: line 42 "icon to advertisement") — P4 on v02/p4…
- (L334) Media aspect ratios — the sheet sizes to the media, whether tall/phone portrait, wide, or narrow. (extends: line 148 "Shape + size…

### Carried at wrap-continue — 2026-09-11 (thread DiskSheet)

- (L352) **closed — shadow pop.** Sean re-recorded and judged the fix (`4a975d5`, glow OFF): "much better" on a6ebc97 clips, then "overall …
- (L353) **closed — `npm run perf` gate.** Headless GPU gate (PipelineReporter dropped frames + longest interval + raster, load gate, per-w…
- (L354) **carried — `npm run perf` gate** (audit item 3): `scripts/perf-morph.mjs` — own vite server on :5190, headed Chromium, 5 warm cyc…

### Shadow-pop root fix — dispatched 2026-09-11 (one painter, one clock)

- (L362) Step 1 — `<MorphSheet.Shadow>` paints both looks (disc + sheet shadow), crossfaded by opacity derived from `collapseProgress`, cla…
- (L363) Step 2 — crossfade window exposed as a dial (CSS custom properties, read via `readVarPx`), example DialKit slider added. (`09c3daa…
- (L364) Step 3 — remove `.sheet[data-morph-sheet-settled]`'s own box-shadow; keep the attribute (Close reveal depends on it). (`2aab652`)
- (L365) Step 4 — opacity values exposed as `--morph-sheet-*` custom properties for `asChild` consumers; documented in README. (`2aab652`)
- (L366) Step 5 — `example/CloseMask.tsx` fixed at the root: derive "closing" from `open === false`, not `getVelocity()` sign (velocity is …
- (L367) Step 6 — docs: README theming table + DOM contract prose, DESIGN.md §3/§4.1. (`2aab652`)

### Glow palettes for social clips — 2026-09-11

- (L371) Step 1 — palette presets in the example demo (Rainbow/Mono/Midnight Purple/Neon Gold) via DialKit's native select control, wired t…
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
- (L391) Gate rewritten: dropped frames + longest presented interval, screencast removed, new headless on ANGLE Metal, software renderer re…
- (L392) Each metric proven to fire headless: jank 108 dropped, block 150ms, gpu (48 layers) 142 dropped, +unrelated animation 111 / 150ms
- (L393) Rebaseline on a quiet machine (load1 2.5–2.8): raster 55.7ms, 1 dropped, 16.7ms longest interval (`f6239aa`)
- (L394) Headless raster vs headed at quiet load: 55.7ms vs 44.8ms, +24%, inside the old headed +37% tolerance; not interchangeable (`f6239…
- (L395) 3 plain `npm run perf` stability runs PASS (raster 43.2 / 65.5 / 44.5ms, dropped 1, longest 16.7ms) (`f6239aa`)
- (L396) Firing against the new baseline: `--inject-jank` dropped 106 FAIL, `--inject-block` 150ms FAIL, `--inject-gpu` dropped 148 FAIL, e…
- (L397) README "Measuring smoothness": limits, sensitivity and exit codes (`f6239aa`)

### Carried at wrap-continue — 2026-09-11 (evening, thread DiskSheet)

- (L401) **carried — DECIDE: rename the package.** Sean: "morph-sheet sucks as a name." Breaking changes are free until publish (not on npm…

### Carried at wrap-continue — 2026-09-11 (late evening, thread DiskSheet)

- (L408) **carried 2× since 2026-09-11 — DECIDE OR KILL: lock the package name.** Strawman: **VistaSheet** (Sean's own pitch). npm `vistash…
- (L413) Sean — rename GitHub repo seansmithworks/disc-sheet → vista-sheet before publish (package.json URLs already point there) → done 20…

### Carried at wrap-continue — 2026-09-13 (thread DiskSheet)

- (L422) Settings panel fixes live on Vercel (d70a954 build; icon, collision, dark mode) — promoted 2026-09-13.

### Carried at wrap-continue — 2026-09-13 (early morning, thread DiskSheet)

- (L429) **carried — verify `e59c7a2` WIP first** (review fixes stopped mid-flight at wrap): npm test, `tsc --noEmit` (6 pre-existing error…
- (L430) carried — P2 shapes (circle/squircle/rounded square/square; Shadow follows shape) → branch `v02/p2-shapes` off the verified tip
- (L431) carried — P1 playground + copy tool → `v02/p1-playground` off P2
- (L432) carried — P4 video + aspect-ratio sheets → `v02/p4-media` off last green tip (placeholder portrait clip via ffmpeg unless Sean sup…
- (L433) carried — P3 rectangle buttons S/M/L → `v02/p3-buttons` off last green tip
- (L434) carried — morning: orchestrator re-runs all gates + perf on a quiet machine, captures, then pushes branches after Sean looks. No d…
- (L437) `0c7dc11` item stagger 40→90ms + example sheets split into title / body / actions Items. Measured beats on index: 284 / 376 / 459m…
- (L438) `6a7e3a7` Design menu: Shadow speed (Very slow 24s … Fast 3s + Variable, rAF-integrated, no phase jumps) · Glow colour + Glow stre…
- (L439) **DECIDED 2026-09-13 (Sean): "we are taking our strawman and hardening it now."** Tonight's values are decisions, not strawmen: 90…
- (L440) carried — `e59c7a2` WIP: F1 `<VistaSheet.Shadow asChild>` overwrote the child's ref (package defect, `src/Shadow.tsx` cloneElement…
- (L441) carried — deploy the demo (Sean's explicit go per deploy; `vercel deploy` → `vercel promote`). → deployed 2dfe523, see VistaSheet …

### Overnight v0.2 run ledger — 2026-09-13

- (L453) e59c7a2 WIP verified at dc3bd44 before launch: 95 vitest · tsc 6 (baseline) · audit:vars PASS · build:lib + banner PASS · geometry…

### Carried at wrap-continue — 2026-09-13 (afternoon, thread VistaSheet)

- (L470) carried — independent review of the Shadow per-frame fix `d3f294b`/`09d8f2e`: PASS-WITH-FINDINGS; current spec proven red on pre-f…
- (L471) carried — 48px default sheet radius across package + examples: `f5a3a8f` (incl. Search/Chat recipes 28→48, flagship 36→48 and medi…
- (L472) new — playground live option switching: red `eb4eb25` → fix `58b0097` (example-only; specimen key was the whole generated JSX); re…
- (L473) carried — `play.html` captures per shape (contact sheet + full-size) sent to Sean, 2026-09-13.
- (L479) found — media ratio self-check flake (failed 2 of 3 full runs under load): sampler now ends on the sheet's settled signal, not wal…
- (L480) found — orchestrator gates at `eb3d0dd`: vitest 177 · tsc 6 (baseline) · audit PASS · build+banner PASS · geometry 252/252 · perf …
- (L481) awaiting Sean — DialKit "Iridescent shadow" values he shared (Neon Gold, opacity 0.22, length 161, blur 69, saturation 1.40, spin …
- (L487) v0.2 stack fast-forwarded into main (Sean's go, 2026-09-13): main 973cc2f → c10def5 → 2dfe523, pushed. Not merged on purpose: v02/…
- (L488) Old branches deleted locally and on origin (Sean's go): v02/p1-playground, v02/p2-shapes, v02/p3-buttons, v02/p4-media, v02/sheet-…
- (L489) Demo deployed to production from main @ 2dfe523 (Sean ran the CLI; the auto-mode classifier blocks vercel deploy and self-edits to…

### Sean's v0.2 localhost test notes — 2026-09-13 (evening, thread VistaSheet)

- (L505) 1 → fixed `44aa28d` (command vs report; geometry 253/253, red-proven); independent review running.
- (L508) 12. Render deploy (Sean interviews with Render 2026-09-14): static site `vista-sheet` https://vista-sheet.onrender.com, service `s…
- (L511) 11 → Magic Patterns design system "VistaSheet" `ds-60ccb99a-5c2b-4d5a-87ca-491e85e58c38` (artifact `58ad360e…`), 10 components / 4…
- (L515) 2 + 3 → fixed `b601927` (always-emit palette block, shared button rules in BASE_CSS, bubble text = surface; 116 class-of-bug codeg…
- (L520) 7 → review board: 152/152 tiles on b601927 (32 unique open hashes per viewport), `scratchpad/board/index.html`; re-run `board/capt…
- (L531) 15 → neutral default `d178ccd` (+ flagship `#a4441f`), riders `e0b1ad8` (`.vs-grid-label` rule, allowlist dropped = 16), `cce0fe8`…
- (L532) T2 review (workflow run wf_7766f136-d8a): PASS, no must-fix — neutral set consistent across README/DESIGN/state.ts/PACKAGE-DESIGN,…
- (L533) Overnight run STOPPED at wrap-continue ~01:00 PT (Sean: clear context, save tokens) — relaunched and finished, see below. T3 build…
- (L534) T3 → `af272b6` a drag never swallows the next tap or Enter: sticky `draggedRef` deleted, per-gesture max travel read once in `hand…
- (L535) N2 → `ad24c04` focus model (TreeWalker tabbables incl. inputs/select/textarea, trap owns every Tab, scroll lock/aria-hidden/trap l…
- (L536) Orchestrator gate re-run on `ebff8dc` (2026-09-14 ~02:20 PT): vitest 296/296 · tsc 6 baseline · audit:vars PASS · build:lib + clie…
- (L537) Render redeployed (12b, Render half): deploy `dep-dajrql95efls73a49h9g` from `ebff8dc`, status live 2026-09-14 09:24:53Z; https://…

### 2026-10-04 — link-preview (`explore/link-preview` @ 25e7b02)

- (L543) `<VistaSheet.Root preview>` hover card built; two independent reviews APPROVE. Gates: vitest 311 · link-preview spec 26 · geometry…
- (L544) 24. carried — Decide: preview placement (strawman ABOVE-first, `anchors.ts` constant; Sean's original spec was below-first) and 24…
- (L545) 25. carried — Decide: merge `explore/link-preview` to main / open PR / keep exploring. Strawman: PR after 26–27. Decided: open a P…
- (L546) 26. carried — Write README + docs/PACKAGE-DESIGN.md sections for preview mode (types: RootComponentProps/PreviewRootProps; card is…
- (L547) 27. carried — Real-iPhone long-press check (only synthetic CDP touch tested). Done: Sean tested on a real iPhone via Vercel previe…
- (L548) 28. carried — Demo fixtures preview as near-blank pages; swap in content-rich owned pages.

### 2026-10-06 — canvas branch findings

- (L563) 39. BUG (library, `src/`) — A Root mounted with `defaultOpen` never settles: `collapseProgress` stays 1, `data-vista-sheet-settled…

### 2026-10-07 — canvas review round 1+2 (html-review sess_0246bd1a6e4f)

- (L576) 49. in flight (other lane) — Playback: ultra-slow / frame-by-frame morph playback, slow-mo choreography with a scrubbable timeline…
- (L577) 50. in flight (other lane) — Isometric exploded view of the Z-stack (comment 26). **Status 2026-10-07: done on `canvas`** — `a4c2b…
- (L578) 51. in flight (other lane) — Anatomy as one foundation plus per-recipe variants: "why is media different here?" (comment 25). **St…
- (L579) 52. in flight (other lane) — defaultOpen settle bug (item 39): explains the missing close buttons on open tiles (comment 14), the …
