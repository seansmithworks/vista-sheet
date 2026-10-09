# Solar theme notes (for "Launch · Solar" frames)

Source: seansmithdesign.com branch `feed/night-theme` @ `cd3e8e5e` (the Night theme, the latest Space direction; provisional per the site thread). Read with `git show feed/night-theme:<path>`, nothing checked out. Paths below are on that ref. `/solar` code on `main` @ `2c211491` is secondary context only.

## Color

One palette, no day/night shift (`src/lib/ambient/constants.ts:684-690`, day and night both `NIGHT_THEME_COLORS`).

| Role | Value | Source |
|---|---|---|
| Sky / page (paper) | `#0c0e22` | `src/lib/ambient/constants.ts:489`, `src/app/globals.css:840` |
| Card surface (paper-edge) | `#13142a` at 0.94 opacity | `constants.ts:490`; card rule `src/components/feed/FeedCell.module.css:31-43`; opacity `src/lib/ambient/night-theme.ts:66` |
| Paper-soft | `#181a33` | `constants.ts:491`, `globals.css:842` |
| Ink | `#eef1f7` | `constants.ts:492` |
| Ink-soft (supporting text) | `#bdbbcd` | `constants.ts:493`; used for link-card supporting text `FeedCell.module.css:1419-1421` |
| Ink-secondary (meta labels) | `#a3a1b8` | `constants.ts:495`; meta line color `FeedCell.module.css:1570` |
| Ink-faint | `#8b89a3` | `constants.ts:494` |
| Rule | `#2e2f41` | `constants.ts:496` |
| Card hairline | ink at 12% | `night-theme.ts:67`; `FeedCell.module.css:38-42` |
| Accent (sun) | `#ffb37b` | `globals.css:848` (= `nightAccentColors(57)`, `night-theme.ts:68,82-101`; `constants.ts:476,497`) |
| Accent-soft | `#ff9c5d` | `globals.css:849` |
| Secondary accents | moss `#9fd4b8`, petrol `#a0b8d8`, indigo `#c2b2ec` | `globals.css:850-852` |
| Footer | `#07080f` (ink `#eef1f7`, faint `#8b89a3`) | `constants.ts:499-501` |
| Haze plum / haze indigo | `#3d2340` / `#2a3350` | `globals.css:857-858` |
| Sun core / sun deep | `#fff3df` / `#e0773f` | `globals.css:859-860` |
| Shadow (vignette) | `#03040c` | `globals.css:861` |

Coordinator's relayed "paper-soft (cards) #181a33" does not match the code: the card surface is `paper-edge #13142a` (`FeedCell.module.css:33-37`). Used the code.

## Type

- Display + body: Space Grotesk, variable 300-700 (`src/lib/fonts/nightTheme.ts:15-26`; pairing `globals.css:1109-1113`).
- Mono: JetBrains Mono, variable 100-800 (`nightTheme.ts:28-39`).
- Meta line: mono, 12px (`--font-size-eyebrow`, `globals.css:27`), uppercase, tracking 0.14em (`--tracking-eyebrow`, `globals.css:44`), ink-secondary, line-height 1.5 (`FeedCell.module.css:1563-1572`).
- Titles: weight 500-600, tracking -0.01em (`globals.css:47`; `FeedCell.module.css:130-140, 1529-1537`).

## Surface, radius, effects

- Cards: square-cornered feed cells (`.cell` sets no radius, `FeedCell.module.css:8-16`); "every real card surface on the site is 2px" = `--radius-chip` (`globals.css:874-876` comment, `944-948`).
- Controls/buttons: `--radius-control` = 4px (`globals.css:920-922, 947`); the email "pill" is 4px (`FeedCell.module.css:1304`).
- Media/screens: `--radius-screen` 6px (`globals.css:88`).
- Primary CTA: sun orange; dark paper text on the accent ground (`FeedCell.module.css:1423-1426` link-card CTA in accent; contact card ring note at `1444-1447`, 10.9:1).
- Sun treatment (contact card only): radial core `#fff3df` at glow*55% upper-left, linear accent to sun-deep at 165deg, accent lift shadow `0 18px 48px -14px` at glow*50%; glow 0.7 (`FeedCell.module.css:1360-1384`; `night-theme.ts:63`).
- Project media glow: radial accent 24% behind the device, 60% x 55% at center (`FeedCell.module.css:1389-1396`).
- Page atmosphere (`src/components/feed/night/night.module.css:50-89`; values `night-theme.ts:54-70`):
  - Stars: 6 per 100k px², peak alpha 0.6, max 1.5px, no twinkle, about 10% cool-tinted petrol (`NightLayers.tsx:136-160`).
  - Plum haze at 0.55: radial 70% x 55% at 50% 58%, plum at haze*85%; indigo radial 55% x 40% at 82% 18%, at haze*55%.
  - Vignette 0.45: radial 120% x 95%, transparent to 52%, shadow at vignette*90%.
  - In-card stars: density 22, alpha 0.07 (cap 0.1) (`night-theme.ts:61-62, 77`).

## Rules

- No planet or dot glyphs as markers; they read as status dots. Carry Space with star texture, haze, grade (memory `feedback-planet-glyphs-read-as-status-dots.md`; branch commit `12dc91cd`).
- No status tags/chips on cards (`9bbb9779` "drop status tags from feed cards").
- Space/sun is the frame, not the subject; the work stays large (memory `feedback-detail-view-show-the-work-first.md`).
- `[data-palette]` never switches colors; ambient constants are the runtime authority (memory `reference_ambient-is-the-runtime-palette-authority.md`).

## Superseded / not used

- `/solar` route on main (black `--color-device-black` reading panels, `--solar-ink #eef1f7`, `src/solar/detail/primitives/ReadingPanel.module.css:12-13`): secondary, not the skin source.
- The docs-site.pen "space" mode (`#06070C` bg, Geist) and Space.pen rounds 1-3: older, not used.
- No headless screenshot: no seansmithdesign.com dev server was running (only vista-sheet servers on 5180/5194).

## How docs-site.pen applies it

New theme value `mode: solar` on the existing variables (light/space values untouched): bg `#0C0E22`, bg-subtle `#13142A` at 0.94, stage/chip `#181A33`, line ink 12%, line-strong `#2E2F41`, text `#EEF1F7`, text-2 `#BDBBCD`, text-3 `#A3A1B8`, code-bg `#13142A`, primary/accent `#FFB37B` on `#0C0E22`, font-sans Space Grotesk, font-mono JetBrains Mono. Footer instances `#07080F`. Radii: cards 2, controls 4, media 6. Page: stars PNG (`docs-site-assets/solar-stars-*.png`, generated from the values above) plus plum/indigo haze over the first viewport; vignette and in-card stars left out (viewport-only effect; 0.07 alpha is invisible in a static comp). Hero stages: the light capture is cropped to the sheet and set on the card surface with the project-media accent glow.
