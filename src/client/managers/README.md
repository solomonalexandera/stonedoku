# /src/client/managers

This directory contains high-level "manager" modules that encapsulate major domains of application functionality. Each manager should be a self-contained ES module that exports its public API.

## Conventions
- One manager per file.
- Managers can import from `/src/client/lib` and `/src/client/ui`.
- Avoid circular dependencies between managers.
- Add an export for new managers to `index.js`.
