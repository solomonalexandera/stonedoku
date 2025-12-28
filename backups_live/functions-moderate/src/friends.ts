import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {getAdmin} from "./firebaseAdmin";

const admin = getAdmin();

export const syncFriendsOnRequest = onDocumentUpdated(
  "friendRequests/{requestId}",
  async (evt: any) => {
    try {
      const before = evt.data?.before?.data?.() || evt.data?.before?.data || null;
      const after = evt.data?.after?.data?.() || evt.data?.after?.data || null;
      if (!before || !after) return;

      const beforeStatus = before.status;
      const afterStatus = after.status;
      if (beforeStatus === afterStatus) return;
      if (beforeStatus !== "pending" || afterStatus !== "accepted") return;

      const fromUid = after.fromUid;
      const toUid = after.toUid;
      if (!fromUid || !toUid) return;

      const db = admin.firestore();
      const FieldValue = admin.firestore.FieldValue;
      const fromRef = db.collection("users").doc(String(fromUid));
      const toRef = db.collection("users").doc(String(toUid));

      await Promise.all([
        fromRef.set({friends: FieldValue.arrayUnion(String(toUid))}, {merge: true}),
        toRef.set({friends: FieldValue.arrayUnion(String(fromUid))}, {merge: true}),
      ]);
    } catch (e) {
      console.error("syncFriendsOnRequest error", e);
    }
  }
);

export const removeFriendsOnRemoval = onDocumentCreated(
  "friendRemovals/{docId}",
  async (evt: any) => {
    try {
      const snap = evt.data;
      const data = (snap && snap.data && snap.data()) ? snap.data() : (snap || {});
      const users = Array.isArray(data.users) ? data.users : [];
      if (users.length !== 2) return;
      const [a, b] = users.map((u: any) => String(u));
      if (!a || !b) return;

      const db = admin.firestore();
      const FieldValue = admin.firestore.FieldValue;
      const aRef = db.collection("users").doc(a);
      const bRef = db.collection("users").doc(b);

      await Promise.all([
        aRef.set({friends: FieldValue.arrayRemove(b)}, {merge: true}),
        bRef.set({friends: FieldValue.arrayRemove(a)}, {merge: true}),
      ]);
    } catch (e) {
      console.error("removeFriendsOnRemoval error", e);
    }
  }
);

