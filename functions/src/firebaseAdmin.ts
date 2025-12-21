import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

type ServiceAccount = admin.ServiceAccount & {
  project_id?: string;
  storageBucket?: string;
  databaseURL?: string;
};

function readServiceAccountFromEnv(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT JSON parse failed", e);
    }
  }

  const candidatePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.SA_PATH ||
    "";

  if (candidatePath) {
    const resolved = path.resolve(candidatePath);
    if (fs.existsSync(resolved)) {
      try {
        return JSON.parse(fs.readFileSync(resolved, "utf8"));
      } catch (e) {
        console.error("Service account file read/parse failed", e);
      }
    }
  }

  return null;
}

let initialized = false;

export function getAdmin(): typeof admin {
  if (!initialized) {
    const sa = readServiceAccountFromEnv();
    if (sa) {
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
        storageBucket: sa.storageBucket || process.env.FIREBASE_STORAGE_BUCKET,
        databaseURL: sa.databaseURL || process.env.FIREBASE_DATABASE_URL,
      });
    } else if (!admin.apps.length) {
      admin.initializeApp();
    }
    initialized = true;
  }
  return admin;
}

export const db = () => getAdmin().firestore();
export const auth = () => getAdmin().auth();
export const storage = () => getAdmin().storage();
export const rtdb = () => getAdmin().database();
