# Client Libraries

Shared client-side libraries extracted from the monolithic `app.js` during refactor.

## Naming conventions
- File names are lowerCamelCase and map directly to their exported symbols (e.g., `profanityFilter.js` exports `ProfanityFilter`).
- Use PascalCase for class-like exports and `createX` for factories. Keep names descriptive and human readable.
- Modules here should remain side-effect free (except when a factory is explicitly created).

## Inventory
- `sudokuGenerator.js` – puzzle generator and solver used by game and tests.
- `profanityFilter.js` – lightweight client-side profanity masking.
- `index.js` – barrel exports.
