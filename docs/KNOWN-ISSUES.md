# Known issues

Browser and platform issues, plus the known limits scattered across README, DESIGN.md and the backlog. Status values: **open**, **parked** (decided not to fix now), **by design**, **test-only** (the component is fine; a spec assumes Chromium).

Last cross-browser run: 2026-10-07, Playwright 1.62, `npm run test:browsers`, run in a separate worktree at `8090664`, before the motion 12-14 change (`46cf886`) and this file (`391e836`). Chromium 313/313, WebKit 303/314, iOS-emulated WebKit 295/314, Pixel-emulated Chromium 311/313. Firefox did not run (see below).

## How to run the browser matrix

```bash
npm run test:geometry   # default: chromium + the webkit squircle spec
npm run test:browsers   # opt-in: chromium, firefox, webkit, mobile-safari (iPhone 15), mobile-chrome (Pixel 7)
npm run test:browsers -- --project=webkit   # one project
PW_PORT=5331 npm run test:browsers          # own dev-server port (default 4873)
```

All headless. A full project takes about 9 minutes. Playwright's WebKit is the Safari engine, not Safari: it does not exercise the iOS toolbar, Safe Area or real touch. Spot-check on the Xcode Simulator (`xcrun simctl`) for those.

## Component and platform

| Issue | Affects | Symptom | Workaround | Status |
|---|---|---|---|---|
| `corner-shape: squircle` unsupported | Safari, Firefox (stable) | `shape="squircle"` falls back to a tuned `border-radius`; close to, not identical to, a superellipse | None needed; the fallback is intentional | by design (Sean, 2026-09-13). Revisit when `corner-shape` ships in stable WebKit |
| Firefox not covered by the suite | Firefox | No product result yet. The run launched inside the agent sandbox and never started a browser; see "Firefox run, 2026-10-08" below | Re-run outside the agent sandbox (below) | open |
| Keyboard focus does not open a link preview | Safari (default settings) | Observed: after Tab, the link is not focused in Playwright WebKit. Inferred, not verified: Safari skips links unless "Press Tab to highlight each item" is on (Option+Tab otherwise), so keyboard users in default Safari would never reach the focus-open path | Unverified: enable the Safari setting, or give the preview trigger a `tabIndex={0}` wrapper | open, browser behaviour |
| Link preview long-press untested on a real iPhone | iOS Safari | Only a synthetic CDP touch (Chromium) is covered. iOS's long-press callout and text selection are unverified. Playwright's WebKit has no CDP, so 3 touch specs cannot run there | Manual check on a device | open |
| Mouse-driven drag intermittently does not register | Playwright WebKit (desktop and iPhone emulation) | Dragging the trigger sometimes leaves it where it started: `buttons.spec.ts` snap cases fail on different cases per run (1 of 12 on desktop WebKit, 4 on mobile-safari); `geometry.spec.ts:2852` fails every time | Not known. Cause unconfirmed: either Playwright's synthetic mouse in WebKit or a real Motion-drag gap in Safari. Check by dragging by hand in Safari | open, needs a manual Safari check |
| Canvas dissection never reports ready | WebKit, iOS WebKit | `data-exploded-ready` is never set, so the exploded z-stack does not finish (30s timeout) | None known | open (canvas page, not the package) |
| Autoplay moves focus into a canvas iframe | WebKit, iOS WebKit | `document.activeElement` becomes an `IFRAME` while the canvas autoplays; the canvas's own focus should stay on `BODY` | None known | open (canvas page, not the package) |
| No `inert` on background content | All | Was open. The page is now `inert` while a modal sheet is open | n/a | resolved (a11y/p0 P0-1, `b0d06fa`; README Accessibility) |
| Focus trap does not see into shadow DOM or iframes | All | Was by design. Focus guards plus `inert` now cover them: shadow-aware tab stops, and an iframe blur fallback | n/a | resolved (a11y/p0 P0-1, `b0d06fa`) |
| No keyboard repositioning of the trigger | All | Was by design. Arrow keys and public `setAnchor` now move it | A consumer "Move" control is still needed for strict WCAG 2.5.7 (README) | resolved (a11y/p0 P0-3, `e843b31`) |
| Resize mid-close transient | All | Resizing the viewport while closing desyncs shadow and surface by about 300-370px (position only; gated at 450px) | None | open, bounded |
| First open after page load stalls ~50ms | Chromium on Sean's GPU | One dropped frame on the very first open | Open once at load if a cold open must be recorded | open, bounded |
| Safari/iOS untested for aspect-ratio sheets | Safari, iOS | Px size derives from `innerHeight` against a `dvh` max-height cap; not verified on iOS | Manual check | open |
| Shared / Media inside a rectangle trigger | All | Unsupported in v0.2 | Use plain children | open |
| Dia toolbar picks up the glow colour | Dia | With the sheet anchored top and the demo glow on, the toolbar tints. Mechanism inferred: top-edge colour sampling when no `theme-color` is set | Add `<meta name="theme-color">` | parked (demo only) |
| Dia corner mismatch | Dia | Shadow tighter than the sheet; not reproducible in Chrome 154 | None | parked, needs a console check in Dia |
| `motion` 12, 13 and 14 supported | All | Peer range is `^12 \|\| ^13 \|\| ^14`. `geometry.spec.ts` passed 137/137 on 12.43.0, 13.5.1 and 14.0.0 (2026-10-07). `npm run perf` passed on 12.43.0 and 14.0.0; on 13.5.1 the first run failed under heavy load (raster 97.0ms vs 93.3ms limit, load average ~110), then passed 3 of 3 sequential reruns on a quiet machine (raster median 70.0 / 38.9 / 62.7ms, dropped frames median 1 / 1 / 1, longest interval 16.7ms each) | None | resolved |
| iOS home-page disc offset | iOS Simulator (iPhone 18 Pro, iOS 27) | The bottom-centre disc on `/` sits about 170px above the bottom edge, over the floating toolbar. Evidence: [docs/known-issues/ios-disc-offset.png](known-issues/ios-disc-offset.png). Cause not investigated | None | open |
| Nothing consumes the package yet | n/a | Gate-tested, not battle-tested | n/a | open |

## Firefox run, 2026-10-08

- A Firefox matrix run (`npm run test:browsers -- --project=firefox`, 313 tests, 4 workers) started 2026-10-08 and did not complete. Its output stops at test 120 of 313.
- All 116 failures it recorded are `browserType.launch: Timeout 180000ms exceeded`, with `sandbox_extension_issue_file_to_process failed ... (Operation not permitted)` and `RenderCompositorSWGL failed mapping default framebuffer` in the launch log. Firefox never started. That is an environment (agent sandbox) launch failure, not a product result.
- No assertion failures were recorded: 0 of 116. No Firefox product results exist yet. Evidence: [docs/known-issues/firefox-launch-timeout-2026-10-08.txt](known-issues/firefox-launch-timeout-2026-10-08.txt).
- To re-run outside the agent sandbox, from a normal terminal: `npx playwright test -c example/playwright.config.ts --project=firefox`.

## Tests that assume Chromium

These fail in other engines for reasons that are not component bugs. They are not skipped; the matrix reports them as failures.

| Spec | Fails on | Why |
|---|---|---|
| `link-preview.spec.ts` (f) long-press, (f) short tap, (g) console errors | WebKit, mobile-safari | Use `newCDPSession` for touch; CDP is Chromium-only |
| `link-preview.spec.ts` (e) scroll closes | mobile-safari | `mouse.wheel` is unsupported in mobile WebKit |
| `link-preview.spec.ts` (h) keyboard focus | WebKit, mobile-safari | After Tab the link is not focused in Playwright WebKit; the Safari-setting explanation is inferred, not verified (see above) |
| `canvas.spec.ts` behaviour-draggable | WebKit, mobile-safari | Reads `getComputedStyle().userSelect`, which WebKit exposes only as `-webkit-user-select`. Likely a measurement gap; not verified |
| `canvas-lab.spec.ts:20` | WebKit, mobile-safari | Arrow-key frame step lands 1.5ms off the expected tick (314.1 vs 315.625). Likely timer rounding in the test's frame math; not verified |
| `canvas-lab.spec.ts:87`, `focus.spec.ts:215` | mobile-safari (focus.spec also mobile-chrome) | Assume the desktop layout (the second legend, the Recipe selector); not present at phone width. Inferred, not verified |
| `geometry.spec.ts:2235`, `:2809` | mobile-safari | Drive the anchor with the mouse on a touch-emulated device; same family as the drag issue above. Inferred, not verified |

## Known Chromium flakes

Carried over from earlier runs (agent report; logs not retained). Pass on rerun; run under load (several browsers at once) to make them worse.

- `geometry.spec.ts:316`
- `geometry.spec.ts:2347`
- `media.spec.ts:289`
- `media.spec.ts:606` (1.72px vs 1px)

None of the four failed in the 2026-10-07 Chromium run (313 passed).
