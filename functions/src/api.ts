import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const api = onRequest(async (req, res) => {
  try {
    const parts = (req.path || req.url || '').split('/').filter(Boolean);
    // Expect paths like /avatar/:uid
    if (parts[0] === 'avatar' && parts[1]) {
      const uid = parts[1];
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'user not found' });
      const data = userDoc.data() || {};
      const profilePicture = data.profilePicture;
      // If profilePicture is already an https URL, just return it
      if (typeof profilePicture === 'string' && profilePicture.startsWith('http')) {
        return res.json({ url: profilePicture });
      }

      // Otherwise attempt to find a storage file under avatars/{uid}/
      const bucket = admin.storage().bucket();
      // If profilePicture stored as a storage path like avatars/uid/filename
      let filePath = null;
      if (typeof profilePicture === 'string' && profilePicture.includes('avatars/')) {
        filePath = profilePicture.split('/').slice(profilePicture.indexOf('avatars')).join('/');
      }
      // Fallback: list files under avatars/{uid}/ and pick the latest
      if (!filePath) {
        const [files] = await bucket.getFiles({ prefix: `avatars/${uid}/` });
        if (!files || files.length === 0) return res.status(404).json({ error: 'no avatar' });
        // pick most recently updated
        files.sort((a: any, b: any) => (b.metadata.updated || 0) - (a.metadata.updated || 0));
        filePath = files[0].name;
      }

      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ error: 'avatar not found' });

      const expires = Date.now() + 1000 * 60 * 15; // 15 minutes
      const [url] = await file.getSignedUrl({ action: 'read', expires });
      return res.json({ url });
    }

    res.status(400).json({ error: 'unknown endpoint' });
  } catch (e: any) {
    console.error('api error', e);
    res.status(500).json({ error: 'server error' });
  }
});
