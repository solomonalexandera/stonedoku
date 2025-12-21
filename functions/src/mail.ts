import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getAdmin} from "./firebaseAdmin";

const admin = getAdmin();

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
      const username = data.username || data.usernameLower || "";
      if (!email) return;

      const siteUrl =
        process.env.PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        "https://stone-doku.web.app";
      const handle = (username || uid || "").toString();
      const continueUrl = `${siteUrl}#/profile/${encodeURIComponent(handle)}`;
      const link = await admin.auth().generateEmailVerificationLink(
        email,
        {url: continueUrl}
      );

      const db = admin.firestore();
      await db.collection("mailQueue").add({
        to: email,
        subject: "Verify your Stonedoku account",
        template: "email_verification",
        data: {link, uid, displayName: data.displayName || ""},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processed: false,
      });
    } catch (e) {
      console.error("sendOnboardingEmail error", e);
    }
  }
);
