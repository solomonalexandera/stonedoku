import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Mailer: processes `mailQueue` documents and sends mail via SendGrid.
 * Reads `SENDGRID_API_KEY` from runtime env. Mailer is tolerant when
 * no key is configured (it marks items as not processed).
 */
async function getSendgridKey(): Promise<string|null> {
  return process.env.SENDGRID_API_KEY || null;
}

export const mailer = functions.onDocumentCreated(
  "mailQueue/{docId}",
  async (evt: any) => {
    const snap = evt.data;
    const data = (snap && snap.data && snap.data()) ? snap.data() : (snap || {});
    const docRef = admin.firestore().collection("mailQueue").doc(evt.params.docId);
    try {
      const key = await getSendgridKey();
      if (!key) {
        await docRef.update({processed: false, error: "sendgrid key missing", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
        console.warn("No SendGrid key configured; mail queued but not sent");
        return;
      }
      // Use SendGrid Web API via fetch to avoid an extra dependency.
      const sendgridKey = key;

      const to = data.to;
      const template = data.template;
      const subject = data.subject || "";
      const payload = data.data || {};

      // Basic templates handling: password_reset and welcome_onboard
      let text = "";
      let html = "";
      if (template === "password_reset") {
        const link = payload.link || "";
        text = `Reset your Stonedoku password: ${link}`;
        html = `<p>Reset your Stonedoku password by clicking <a href="${link}">here</a>.</p>`;
      } else if (template === "welcome_onboard") {
        const link = payload.link || "";
        text = `Welcome to Stonedoku! Verify your email: ${link}`;
        html = `<p>Welcome to Stonedoku!</p><p>Verify your email by clicking <a href="${link}">this link</a>.</p>`;
      } else {
        // Generic fallback
        text = payload.text || (subject + "\n");
        html = payload.html || text;
      }

      const msgBody = {
        personalizations: [
          { to: [{ email: to }], subject }
        ],
        from: { email: process.env.MAIL_FROM || "no-reply@stonedoku.example" },
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      };

      const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(msgBody)
      });

      if (!resp.ok) {
        throw new Error("sendgrid send failed: " + resp.status + " " + await resp.text());
      }

      await docRef.update({processed: true, processedAt: admin.firestore.FieldValue.serverTimestamp()});
    } catch (e: any) {
      console.error("mailer error", e);
      try {
        await docRef.update({processed: false, error: String(e), updatedAt: admin.firestore.FieldValue.serverTimestamp()});
      } catch (_){ }
    }
  }
);
