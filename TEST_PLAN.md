# TEST_PLAN — Stonedoku “Clash of Worlds”
Source brief: DESIGN_BRIEF.md

## Manual Smoke (priority)
- **Auth flows**: sign up (onboarding once), sign in, logout sizing + tooltips, forgot password.
- **Lobby**: stats live update on win/loss; header tooltips (theme/sound/updates/profile/logout); hamburger hides on desktop.
- **Chat**: Global send/receive; DM send with proper rules (no permission_denied); sender contrast in light/dark; tooltips on chat controls; FAB opens integrated chat only.
- **Game (single)**: 
  - Undo/Erase quotas (Easy 4, Medium 3, Hard 0) decrement and disable.
  - Notes toggle places/removes micotype notes correctly.
  - Hint absent.
  - Single timer only; no duplicate time rows.
  - Stats increment wins/losses/games for signed-in users.
  - Reduced-motion: no big transforms; collapse effects fall back to color.
- **Game (versus)**:
  - Join/ready/rematch; resign button ends match and records loss for resigner.
  - Game chat tab visible; DM and global unaffected.
  - Postmatch reason shows resign/disconnect/board complete.
- **Profile**: upload picture, edit bio, member since renders, copy URL shows success/error toast, rerun Orientation button.
- **Orientation**: runs once by default; rerunnable from profile; doesn’t auto-repeat after completion.

## Accessibility
- Keyboard: focus-visible on all header/chat/game controls; tooltips accessible; modal focus trap.
- Contrast: sender names legible in light/dark; buttons/panels meet WCAG AA.
- Reduced motion: prefers-reduced-motion honored across grid, chat, modals, collapse effects.
- Labels: theme/sound/chat/emoji/send tooltips; settings toggles have titles; chat tabs labeled.

## Automated (where feasible)
- Playwright (existing suite):
  - Update/extend smoke for: DM send success; undo quota; notes toggling; resign flow; orientation flag persistence.
  - Add reduced-motion flag check (prefers-reduced-motion media + CSS change).
- Lint: functions build (`npm --prefix functions run build`) to ensure rules/functions compile.

## Performance
- Verify no extra timers/duplicate DOM listeners; chat/widget doesn’t spawn external links.
- Keep asset size unchanged; no blocking scripts added beyond agent tooling (isolated under tools/agent-team).
