import {onRequest} from "firebase-functions/v2/https";
import {getAdmin} from "./firebaseAdmin";

const admin = getAdmin();
const firestore = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

function buildResetLink(rawLink: string): string {
  try {
    const generated = new URL(rawLink);
    const oobCode = generated.searchParams.get("oobCode");
    const apiKey = generated.searchParams.get("apiKey");
    const lang = generated.searchParams.get("lang") || "en";

    const base =
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://stone-doku.web.app";
    const target = new URL(base);
    const params = new URLSearchParams();
    if (oobCode) params.set("oobCode", oobCode);
    if (apiKey) params.set("apiKey", apiKey);
    params.set("mode", "resetPassword");
    params.set("lang", lang);
    target.hash = `#/reset?${params.toString()}`;
    return target.toString();
  } catch (e) {
    console.error("Failed to build password reset link", e);
    return rawLink;
  }
}

export const api = onRequest(async (req, res) => {
  try {
    const raw = req.path || req.url || "";
    const partsRaw = raw.split("/").filter(Boolean);
    const parts = partsRaw[0] === "api" ? partsRaw.slice(1) : partsRaw;
    // Expect paths like /avatar/:uid
    if (parts[0] === "avatar" && parts[1]) {
      const uid = parts[1];
      const userDoc = await firestore
        .collection("users")
        .doc(uid)
        .get();
      if (!userDoc.exists) {
        res.status(404).json({error: "user not found"});
        return;
      }
      const data = userDoc.data() || {};
      const profilePicture = data.profilePicture;
      // If profilePicture is already an https URL, just return it
      if (
        typeof profilePicture === "string" &&
        profilePicture.startsWith("http")
      ) {
        res.json({url: profilePicture});
        return;
      }

      // Otherwise attempt to find a storage file under avatars/{uid}/
      const bucket = storage.bucket();
      // If profilePicture stored as a storage path like avatars/uid/filename
      let filePath = null;
      if (
        typeof profilePicture === "string" &&
        profilePicture.includes("avatars/")
      ) {
        const partsArr = profilePicture.split("/");
        const idx = partsArr.indexOf("avatars");
        if (idx !== -1) filePath = partsArr.slice(idx).join("/");
      }
      // Fallback: list files under avatars/{uid}/ and pick the latest
      if (!filePath) {
        const [files] = await bucket.getFiles({
          prefix: `avatars/${uid}/`,
        });
        if (!files || files.length === 0) {
          res.status(404).json({error: "no avatar"});
          return;
        }
        // pick most recently updated
        files.sort((a: any, b: any) => {
          const au = a.metadata?.updated || 0;
          const bu = b.metadata?.updated || 0;
          return bu - au;
        });
        filePath = files[0].name;
      }

      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({error: "avatar not found"});
        return;
      }

      const expires = Date.now() + 1000 * 60 * 15; // 15 minutes
      const [url] = await file.getSignedUrl({action: "read", expires});
      res.json({url});
      return;
    }

    // Auth helpers: POST /auth/reset { email }
    if (parts[0] === "auth" && parts[1] === "reset") {
      if (req.method !== "POST") {
        res.status(405).json({error: "Method not allowed"});
        return;
      }
      // Ensure we can read the email from JSON or query params.
      let body: any = req.body;
      const rawBody: any = (req as any).rawBody;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = null;
        }
      } else if (!body && rawBody) {
        try {
          body = JSON.parse(rawBody.toString("utf8"));
        } catch (e) {
          body = null;
        }
      }

      const email = body?.email || req.query?.email;
      if (!email) {
        res.status(400).json({error: "email required"});
        return;
      }

      // Generate password reset link and attempt to queue an email.
      // Be defensive: return a non-500 response when possible so the
      // client doesn't show a server error for user-caused issues.
      let actionLink: string | null = null;
      try {
        actionLink = await auth.generatePasswordResetLink(email, {
          url: process.env.PUBLIC_SITE_URL ? `${process.env.PUBLIC_SITE_URL}/reset` : "https://stone-doku.web.app/reset",
          handleCodeInApp: true,
        });
      } catch (err: any) {
        console.error("generatePasswordResetLink failed:", err);
        // If user not found or invalid email, surface a 400 instead of 500
        const code = err?.code || err?.status || null;
        if (String(code).includes("USER_NOT_FOUND") || String(err).toLowerCase().includes('user-not-found') || String(err).toLowerCase().includes('no user record')) {
          // Avoid leaking whether an account exists; respond with a neutral OK.
          res.json({ok: true, warning: "user_not_found"});
          return;
        }
        // For other known auth errors, return a 400 with message
        if (err && err.message) {
          res.status(400).json({error: err.message});
          return;
        }
        // Unknown error: fallthrough to server error
        console.error('Unexpected error generating reset link', err);
        res.status(500).json({error: 'server error generating reset link'});
        return;
      }

      const link = buildResetLink(actionLink);
      try {
        // Queue mail for downstream delivery; if this fails, don't fail the whole request
        await firestore.collection("mailQueue").add({
          to: email,
          subject: "Reset your Stonedoku password",
          template: "password_reset",
          data: {link},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processed: false,
        });
      } catch (e) {
        console.error('Failed to enqueue mailQueue entry:', e);
        // Still return ok to the client to avoid exposing internal failures.
        res.json({ok: true, warning: 'mail_enqueue_failed'});
        return;
      }

      res.json({ok: true});
      return;
    }

    res.status(400).json({error: "unknown endpoint"});
    return;
  } catch (e: any) {
    console.error("api error", e);
    res.status(500).json({error: "server error"});
    return;
  }
});
