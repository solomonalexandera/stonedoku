# Component States — Stonedoku “Clash of Worlds”
Source brief: DESIGN_BRIEF.md

## Header & Controls
- Default: stone background, engraved text; tooltips clarify Theme/Sound/Updates/Profile/Logout.
- Hover: deepen shadow, tint brass by 3–5%.
- Active/pressed: slight depress (1px), no bright glows.
- Focus-visible: etched outline using accent brass (or forest green in high-contrast).

## Sudoku Grid
- States per cell:
  - Given: carved glyph, darker limestone fill.
  - Empty: plain slab.
  - Selected: etched inset outline; warmed highlight.
  - Same-number: soft overlay on matching digits.
  - Correct entry: brief engraved glow + score tick.
  - Error entry: oxblood haze + shake; clears value.
  - Notes: 3×3 micotype grid; notes appear as faint ink.
  - Collapse event (rare): cracks, sag, or shadow arches; self-heals.

## Action Buttons (Undo/Erase/Notes/Resign)
- Enabled: brass gradient with stone shadow.
- Disabled (quota exhausted): desaturated stone, 40% opacity, no hover.
- Undo/Erase counters: show remaining uses (easy 4, medium 3, hard 0).
- Notes active: button toggled with inset glow; notes grid visible in empty cells.
- Resign: inline in versus header, minimal brass outline; confirms with modal/alert.

## Stats & Meta Panels
- Panels feel like buttresses: heavy border, inset gradient, engraved headings.
- Live stats: wins/losses/win-rate update on profile snapshot.
- Timers: single elapsed timer in headers; no duplicate time rows elsewhere.

## Chat
- Integrated chat only (no external links).
- Tabs: Global, Game (vs), DMs with unread badges.
- Messages: sender high-contrast in light/dark; timestamp muted.
- Controls: emoji/send with tooltips; toggles follow theme tooltips.

## Modals & Onboarding
- Vaulted cards with stone bevel.
- Onboarding: runs once; rerunnable from Profile “Orientation”.
- Reduced-motion: scale/fade only; remove heavy transforms.

## Accessibility
- High-contrast palette supported.
- Reduced-motion respected for all motion specs (including collapse).
- Focus outlines etched; tooltips and controls labelled.
