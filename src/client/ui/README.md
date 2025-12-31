# /src/client/ui

UI-focused helpers and renderers that sit above pure logic but below view-level wiring.

## Naming conventions
- File names are lowerCamelCase mirroring their primary export (e.g., `gameHelpers.js` exports `createGameHelpers`).
- Factories use a `createX` prefix; stateful singletons use PascalCase (e.g., `BoardIntegritySystem`).
- Prefer human-readable words; avoid opaque abbreviations.
- Keep UI helpers presentation-focused; heavy domain logic belongs in managers or libs.

## Inventory
- `boardIntegrity.js` – grid integrity helpers for single/versus boards.
- `gameHelpers.js` – game-state helpers (tool limits, progress, highlights).
- `gameUi.js` – Sudoku board rendering and interaction wiring.
- `uiHelpers.js` – general UI utilities (toasts, profile overlays, badge rendering).
- `index.js` – barrel exports.
