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

To run the app locally:

```bash
firebase serve
```

The app will be available at `http://localhost:5000`

## Deployment

To deploy the app to Firebase Hosting:

```bash
firebase deploy
```

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Hosting