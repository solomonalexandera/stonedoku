# Client Libraries

Pure utility modules with no side effects or internal state. These can be imported and used anywhere without causing application state changes.

## Naming conventions
- File names are lowerCamelCase with `Utils` suffix (e.g., `motionUtils.js`)
- Exports are PascalCase (e.g., `MotionUtils`)
- All modules are side-effect free

## Inventory
| File | Export | Description |
|------|--------|-------------|
| `sudokuGenerator.js` | `SudokuGenerator` | Puzzle generator and solver |
| `profanityFilter.js` | `ProfanityFilter` | Lightweight profanity masking |
| `passwordPolicy.js` | `PasswordPolicy` | Password strength validation |
| `motionUtils.js` | `MotionUtils` | Animation utilities with reduced-motion support |
| `versionUtils.js` | `ensureAppVersionFresh` | Version checking and cache management |
| `index.js` | - | Barrel exports |
