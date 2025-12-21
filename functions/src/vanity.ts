import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Vanity lookup function
 * Routes: /profile/:handle -> redirect to SPA /profile/<uid>
 * Or return a minimal OG HTML page for crawlers
 */
export const vanityLookup = onRequest(async (req, res) => {
  try {
    const path = (req.path || req.url || "").replace(/^\//, "");
    // Extract handle from /profile/<handle> or /u/<handle>
    const parts = path.split("/").filter(Boolean);
    let handle = "";
    if (parts[0] === "profile" && parts[1]) handle = parts[1];
    else if (parts[0] === "u" && parts[1]) handle = parts[1];
    else {
      res.status(400).send("Bad request");
      return;
    }

    const db = admin.firestore();
    const doc = await db.collection("vanityLinks").doc(handle).get();
    if (!doc.exists) {
      // Not found — render a minimal SPA boot with 404 meta
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Not found</title>
  </head>
  <body>Not found</body>
</html>`;
      res.status(404).send(html);
      return;
    }

    const data = doc.data() || {};
    const uid = data.uid || data.userId || null;
    if (!uid) {
      res.status(500).send("Invalid vanity record");
      return;
    }

    // Redirect to canonical SPA route — client will render profile for uid
    const target = `/profile/${uid}`;
    res.set("Cache-Control", "public, max-age=60");
    res.redirect(302, target);
  } catch (e: any) {
    console.error("vanityLookup error", e);
    res.status(500).send("Server error");
  }
});
