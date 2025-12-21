# Functions Dev Notes

## Service account setup (local/dev)

Functions now centralize Admin SDK initialization in `src/firebaseAdmin.ts`. Set one of the following before running scripts, emulators, or builds locally:

- `FIREBASE_SERVICE_ACCOUNT` — raw JSON string of the service account.
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to the service account JSON file.
- `GOOGLE_APPLICATION_CREDENTIALS` / `SA_PATH` — legacy path env vars (still supported).

Optional overrides:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_DATABASE_URL`

Example:
```bash
export FIREBASE_SERVICE_ACCOUNT_PATH=$HOME/.config/sa-stonedoku.json
npm --prefix functions run build
firebase emulators:start --only functions
```
