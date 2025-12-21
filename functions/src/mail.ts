import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Triggered when a new Firebase Auth user is created (v1 trigger).
export const sendOnboardingEmail = functions.auth.user().onCreate(
  async (user: admin.auth.UserRecord) => {
    try {
      const email = user.email;
      const uid = user.uid;
      if (!email) return;

      const link = await admin.auth().generateEmailVerificationLink(
        email,
        {url: `https://stone-doku.web.app/profile/${uid}`}
      );

      // Queue a welcome email in Firestore for an external mailer to pick up
      const db = admin.firestore();
      await db.collection("mailQueue").add({
        to: email,
        subject: "Welcome to Stonedoku!",
        template: "welcome_onboard",
        data: {link, uid, displayName: user.displayName||""},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
      });
    } catch (e) {
      console.error("sendOnboardingEmail error", e);
    }
  }
);
