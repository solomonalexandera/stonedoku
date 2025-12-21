import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export const api = onRequest(async (req, res) => {
  try {
    const raw = req.path || req.url || "";
    const parts = raw.split("/").filter(Boolean);
    // Expect paths like /avatar/:uid
    if (parts[0] === "avatar" && parts[1]) {
      const uid = parts[1];
      const db = admin.firestore();
      const userDoc = await db
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
      const bucket = admin.storage().bucket();
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

    res.status(400).json({error: "unknown endpoint"});
    return;
  } catch (e: any) {
    console.error("api error", e);
    res.status(500).json({error: "server error"});
    return;
  }
});
