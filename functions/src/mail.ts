import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

// v2 Firestore trigger: when `users/{uid}` profile is created,
// queue welcome mail for an external mailer to process.
export const sendOnboardingEmail = onDocumentCreated(
  "users/{uid}",
  async (evt: any) => {
    try {
      const snap = evt.data;
      const data = (snap && snap.data && snap.data()) ?
        snap.data() : (snap || {});
      const email = data.email;
      const uid = data.userId || evt.params?.uid;
      if (!email) return;

      const link = await admin.auth().generateEmailVerificationLink(
        email,
        {url: `https://stone-doku.web.app/profile/${uid}`}
      );

      const db = admin.firestore();
      await db.collection("mailQueue").add({
        to: email,
        subject: "Welcome to Stonedoku!",
        template: "welcome_onboard",
        data: {link, uid, displayName: data.displayName || ""},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
      });
    } catch (e) {
      console.error("sendOnboardingEmail error", e);
    }
  }
);
