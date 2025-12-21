import {onUserCreated} from "firebase-functions/v2/auth";
import * as admin from "firebase-admin";

admin.initializeApp();

// Triggered when a new Firebase Auth user is created.
export const sendOnboardingEmail = onUserCreated(async (event) => {
  try {
    const user = event.data;
    const email = user.email;
    const uid = user.uid;
    if (!email) return;

    // Generate email verification link
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
});
