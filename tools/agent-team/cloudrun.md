# Cloud Run Deployment — Agent Team

## Prereqs
- gcloud CLI authenticated to the project.
- Secret for `OPENAI_API_KEY` (recommended: Secret Manager).
- Billing + Cloud Run + Artifact Registry enabled.

## Build & Deploy
```bash
cd tools/agent-team
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/stonedoku-agent
gcloud run deploy stonedoku-agent \
  --image gcr.io/$(gcloud config get-value project)/stonedoku-agent \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated=false \
  --set-env-vars OPENAI_API_KEY=projects/$(gcloud config get-value project)/secrets/OPENAI_API_KEY/versions/latest \
  --set-env-vars DESIGN_BRIEF_PATH=/app/../DESIGN_BRIEF.md
```

## Invoke
```bash
curl -X POST https://<service-url>/run \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"task":"Implement the existing design brief in this repo"}'
```

Response:
```json
{ "status": "ok", "summary": { ... } }
```

## Security
- Prefer IAM-restricted Cloud Run (no unauthenticated access).
- Store `OPENAI_API_KEY` in Secret Manager; mount via env var.
- Optional: front with Firebase Auth token verification in a middleware if exposing publicly.
