import {HttpsError, onCall} from "firebase-functions/v2/https";
import {Timestamp} from "firebase-admin/firestore";
import {db, rtdb} from "./firebaseAdmin";
import * as admin from "firebase-admin";

type Action =
  | "mute"
  | "unmute"
  | "block"
  | "unblock"
  | "clearGlobalChat"
  | "clearUserGlobalChat";

async function assertAdmin(auth: any): Promise<void> {
  // Check custom claims instead of /admins collection
  if (!auth.token.admin && !auth.token.superAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

async function assertUserExists(uid: string) {
  const firestore = db();
  const snap = await firestore.doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Target user profile is missing.");
  }
}

async function updateModerationState(uid: string, patch: Record<string, unknown>) {
  const firestore = db();
  await assertUserExists(uid);
  await firestore.doc(`users/${uid}`).set({
    moderation: patch,
  }, {merge: true});
}

function notifyUser(uid: string, message: string, type: string) {
  const ref = rtdb().ref(`moderation/notices/${uid}`);
  return ref.set({
    message,
    type,
    at: admin.database.ServerValue.TIMESTAMP,
  });
}

export const moderate = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");

  const data = request.data || {};
  const action = data.action as Action;
  const targetUid = data.targetUid as string | undefined;
  if (!action) throw new HttpsError("invalid-argument", "Action required.");

  // Check admin/superAdmin custom claims instead of /admins collection
  await assertAdmin(request.auth);

  const realtime = rtdb();

  if (["mute", "unmute", "block", "unblock", "clearUserGlobalChat"].includes(action) && !targetUid) {
    throw new HttpsError("invalid-argument", "targetUid required.");
  }

  switch (action) {
    case "mute":
      await realtime.ref(`mutes/${targetUid}`).set(true);
      await updateModerationState(targetUid!, {
        muted: true,
        mutedAt: Timestamp.now(),
      });
      await notifyUser(targetUid!, "You have been muted by an administrator.", "mute");
      return {ok: true};
    case "unmute":
      await realtime.ref(`mutes/${targetUid}`).remove();
      await updateModerationState(targetUid!, {
        muted: false,
        mutedAt: admin.firestore.FieldValue.delete(),
      });
      await notifyUser(targetUid!, "Your mute has been lifted.", "unmute");
      return {ok: true};
    case "block":
      await realtime.ref(`blocks/${targetUid}`).set(true);
      await updateModerationState(targetUid!, {
        blocked: true,
        blockedAt: Timestamp.now(),
      });
      await notifyUser(targetUid!, "You have been blocked from messaging by an administrator.", "block");
      return {ok: true};
    case "unblock":
      await realtime.ref(`blocks/${targetUid}`).remove();
      await updateModerationState(targetUid!, {
        blocked: false,
        blockedAt: admin.firestore.FieldValue.delete(),
      });
      await notifyUser(targetUid!, "Your messaging block has been lifted.", "unblock");
      return {ok: true};
    case "clearGlobalChat":
      await realtime.ref("globalChat").remove();
      return {ok: true, cleared: "globalChat"};
    case "clearUserGlobalChat": {
      const snap = await realtime.ref("globalChat").get();
      const updates: Record<string, null> = {};
      snap.forEach((child) => {
        const val = child.val() || {};
        if (val.userId === targetUid) updates[child.key as string] = null;
      });
      if (Object.keys(updates).length > 0) {
        await realtime.ref("globalChat").update(updates);
      }
      return {ok: true, cleared: Object.keys(updates).length};
    }
    default:
      throw new HttpsError("invalid-argument", "Unsupported action.");
  }
});

export const backfillModerationFields = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in required.");
  await assertAdmin(callerUid);

  const firestore = db();
  const batch = firestore.batch();
  const snapshot = await firestore.collection("users")
    .where("moderation", "==", null)
    .limit(500)
    .get();

  let count = 0;
  snapshot.forEach((docSnap) => {
    batch.set(docSnap.ref, {
      moderation: {
        muted: false,
        blocked: false,
      },
    }, {merge: true});
    count += 1;
  });

  if (count > 0) await batch.commit();
  return {updated: count};
});
