# REQUIREMENTS — Stonedoku “Clash of Worlds”
Source brief: DESIGN_BRIEF.md

## Product & Experience
- Uphold the “order under strain” concept: brutalist slabs + gothic engravings; board as architectural core.
- Align everything to a strict grid with civic-scale spacing; panels feel like stone buttresses.
- Colors: stone neutrals; accents only for state (oxblood errors, aged brass highlights, forest green chat/valid). Avoid playful hues.
- Typography: humanist serif for headings; grotesk for UI/numerals with engraved styling.
- Motion: weighty easing, slow transitions; reduced-motion disables heavy transforms. Collapse easter eggs are subtle and self-heal.
- Sound (optional): low rumbles, pencil ticks; silence acceptable.

## UI Mechanics
- Single timer only (remove redundant time indicators).
- Undo/Erase quotas: Easy 4, Medium 3, Hard 0; show remaining; disable when exhausted.
- No hint feature in gameplay.
- Notes must render reliably (3×3 micotype grid); toggle is clear and stateful.
- Stats must live-update from Firestore profile (wins/losses/win-rate/games played). Record single-player results for signed-in users.
- Chat: integrated only (no external links); sender text readable in light/dark; tooltips on chat controls; tabs Global/Game/DMs with unread badges.
- Header controls: consistent sizing; tooltips for Theme/Sound/Updates/Profile/Logout. Hamburger only on mobile/tablet.
- Orientation tour: run once per user (persist flag); rerunnable from Profile “Orientation.”
- Profile: upload picture, edit bio, show member since date; copy URL with success/error feedback.
- 1v1: provide in-match “Leave/Resign” action; update results accordingly.

## Accessibility & Performance
- High-contrast support; etched focus states.
- Reduced-motion path for all motion specs, including collapse events.
- Keep assets lightweight; avoid blocking main thread; cache budgets remain aligned with Hosting setup.

## Security & Data
- No secrets committed. Use env/Secret Manager for API keys.
- Firebase rules honored (DM participants + threads, presence, matches).
- Respect cookie/preferences gate for localStorage/theme.
