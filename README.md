# Stonedoku

A web-based application built with HTML5 and hosted on Firebase.

## Project Structure

```
stonedoku/
├── index.html      # Main HTML5 application file
├── styles.css      # Application styles
├── app.js          # Application JavaScript logic
├── firebase.json   # Firebase hosting configuration
└── .firebaserc     # Firebase project configuration
```

## Prerequisites

- [Node.js](https://nodejs.org/) (for Firebase CLI)
- [Firebase CLI](https://firebase.google.com/docs/cli)

## Setup

1. Install Firebase CLI globally (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

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
