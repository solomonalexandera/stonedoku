import {onRequest} from "firebase-functions/v2/https";
import {getAdmin} from "./firebaseAdmin";

const admin = getAdmin();

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
    handle = handle.toLowerCase();

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

    // If the vanity record is deprecated, try to use the user's current username
    let redirectHandle = handle;
    try {
      if (data.deprecated && uid) {
        const userSnap = await db.collection("users").doc(uid).get();
        const current = userSnap.data();
        if (current?.usernameLower) {
          redirectHandle = current.usernameLower;
        }
      }
    } catch (err) {
      console.warn("vanityLookup: failed to resolve latest handle", err);
    }

    // Redirect to hashed SPA route to avoid rewrite loops
    const base =
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://stone-doku.web.app";
    const target = `${base}#/profile/${encodeURIComponent(redirectHandle)}`;
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.redirect(302, target);
  } catch (e: any) {
    console.error("vanityLookup error", e);
    res.status(500).send("Server error");
  }
});
