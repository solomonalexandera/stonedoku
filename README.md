# Stonedoku

A web-based multiplayer Sudoku game built with HTML5, CSS3, and JavaScript, hosted on Firebase.

## Project Structure

```
stonedoku/
├── index.html              # Main HTML5 application entry point
├── styles.css              # Application styles
├── src/                    # Source code directory
│   ├── client/             # Frontend (browser) code
│   │   ├── core/           # Firebase initialization, config, state
│   │   │   ├── appState.js     # Central application state
│   │   │   ├── authFlow.js     # Authentication state management
│   │   │   ├── eventSetup.js   # DOM event listeners
│   │   │   ├── firebase.js     # Firebase SDK setup
│   │   │   └── gameFlow.js     # Game initialization and match flow
│   │   ├── lib/            # Pure utility libraries
│   │   │   ├── passwordPolicy.js
│   │   │   ├── profanityFilter.js
│   │   │   ├── sudokuGenerator.js
│   │   │   └── versionManager.js
│   │   ├── managers/       # Stateful services (factory pattern)
│   │   │   ├── viewManager.js      # View transitions
│   │   │   ├── presenceManager.js  # Online presence
│   │   │   ├── profileManager.js   # User profiles
│   │   │   ├── lobbyManager.js     # Game rooms
│   │   │   ├── matchManager.js     # 1v1 match state
│   │   │   ├── chatManager.js      # Chat functionality
│   │   │   └── ...                 # Other managers
│   │   ├── ui/             # UI components and view controllers
│   │   │   ├── gameUi.js       # Main game UI
│   │   │   ├── uiCore.js       # Player list, profiles, toasts
│   │   │   └── ...             # Other UI modules
│   │   └── entry.js        # Main application entry point
│   └── server/             # Backend (Firebase Functions)
├── firebase.json           # Firebase hosting configuration
├── functions/              # Firebase Functions source
└── .firebaserc             # Firebase project configuration
```

See `src/README.md` for detailed module documentation and `.github/MANAGERS.md` for the complete manager reference.

## Prerequisites

- [Node.js](https://nodejs.org/) (for Firebase CLI)
- Firebase CLI (provided via dev dependency `firebase-tools`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Authenticate the Firebase CLI:
   - In restricted/CI environments, prefer a service account instead of interactive login.

3. Initialize Firebase in this project (if needed):
   ```bash
   firebase init
   ```
   - Select "Hosting" when prompted
   - Use existing project or create a new one
   - Set public directory to `.` (current directory)
   - Configure as single-page app: No
   - Don't overwrite existing files
   
   Note: Update the project ID in `.firebaserc` to match your Firebase project name.

## Local Development

To run the app locally (with live reload):

```bash
npm run dev
```

The dev server binds to the correct port for your environment:
- On Google Cloud Workstations/IDX, open the Preview URL shown in the terminal (often `http://localhost:80/`).
- Otherwise, open `http://localhost:8080`.

If you’re seeing an “old” version, double-check you’re visiting the URL printed by `npm run dev` (not a different preview/forwarded port that might point at another server).

## Deployment

Local deploy (builds the bundle automatically via `firebase.json` predeploy):

```bash
npm run deploy
```

If you need to login interactively, use:

```bash
npx firebase-tools login --no-localhost
```

Deploy only specific parts:

```bash
npm run deploy:hosting
npm run deploy:functions
npm run deploy:rules
```

### GitHub Actions (auto-deploy)

This repo includes a workflow at `.github/workflows/firebase-deploy.yml` that deploys on push to `main`.

You must add this GitHub Actions secret:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the full JSON for a Google service account with permission to deploy (Firebase Admin / appropriate IAM roles for Hosting + Functions + Rules).

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Hosting
