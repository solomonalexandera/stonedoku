/**
 * Admin management Cloud Functions
 * Handles role appointments, user search, and admin operations using custom claims
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getAdmin} from "./firebaseAdmin";

const admin = getAdmin();

interface AppointAdminData {
  targetUid: string;
  role: 'user' | 'moderator' | 'admin' | 'superAdmin';
  reason?: string;
  expiresAt?: number;
}

interface SearchUsersData {
  query: string;
  limit?: number;
}

/**
 * Appoint or update a user's admin role
 * Requires caller to be an admin or super-admin
 */
export const appointAdmin = onCall(
  async (request) => {
    // 1. Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to manage roles"
      );
    }

    // 2. Check caller permissions from custom claims
    const callerClaims = request.auth.token;
    if (!callerClaims.admin && !callerClaims.superAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can manage user roles"
      );
    }

    // 3. Verify role hierarchy
    const {targetUid, role, reason, expiresAt} = request.data as AppointAdminData;

    // Super-admins can appoint anyone
    // Regular admins can only appoint moderators
    if (role === "admin" && !callerClaims.superAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only super-admins can appoint admins"
      );
    }

    if (role === "superAdmin" && !callerClaims.superAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only super-admins can appoint super-admins"
      );
    }

    // 4. Get target user info
    let targetUser;
    try {
      targetUser = await admin.auth().getUser(targetUid);
    } catch (error) {
      throw new HttpsError(
        "not-found",
        `User ${targetUid} not found`
      );
    }

    // 5. Set custom claims based on role
    const claims: Record<string, any> = {
      appointedBy: request.auth.uid,
      appointedAt: Date.now(),
    };

    // Reset all role claims first
    claims.superAdmin = false;
    claims.admin = false;
    claims.moderator = false;

    // Set appropriate claims based on role
    if (role === "superAdmin") {
      claims.superAdmin = true;
      claims.admin = true;
      claims.moderator = true;
    } else if (role === "admin") {
      claims.admin = true;
      claims.moderator = true;
    } else if (role === "moderator") {
      claims.moderator = true;
    }
    // role === 'user' keeps all flags false

    if (expiresAt) {
      claims.expiresAt = expiresAt;
    }

    await admin.auth().setCustomUserClaims(targetUid, claims);

    // 6. Update Firestore user document with role and formatted username/displayName
    const userUpdate: Record<string, any> = {
      role,
      appointedBy: request.auth.uid,
      appointedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (reason) {
      userUpdate.appointmentReason = reason;
    }

    if (expiresAt) {
      userUpdate.roleExpiresAt = expiresAt;
    }

    // Ensure email is in the profile (from Auth user if not already there)
    if (targetUser.email && !userUpdate.email) {
      userUpdate.email = targetUser.email;
    }

    // If granting admin role (not revoking to 'user'), apply admin prefix to username/displayName
    if (role !== 'user') {
      // Get current user data to format username/displayName
      const userDoc = await admin.firestore().collection("users").doc(targetUid).get();
      const userData = userDoc.data();
      
      if (userData) {
        const currentUsername = userData.username || '';
        const currentDisplayName = userData.displayName || currentUsername || '';
        
        // Apply admin- prefix if not already present
        const formattedUsername = currentUsername.startsWith('admin-') 
          ? currentUsername 
          : `admin-${currentUsername}`;
        const formattedDisplayName = currentDisplayName.startsWith('admin-')
          ? currentDisplayName
          : `admin-${currentDisplayName}`;
        
        userUpdate.username = formattedUsername;
        userUpdate.usernameLower = formattedUsername.toLowerCase();
        userUpdate.displayName = formattedDisplayName;
        
        // Reserve the new username
        const usernamesRef = admin.firestore().collection("usernames").doc(formattedUsername.toLowerCase());
        await usernamesRef.set({
          userId: targetUid,
          username: formattedUsername,
          usernameLower: formattedUsername.toLowerCase(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } else if (role === 'user') {
      // If revoking admin role, remove admin- prefix from username/displayName
      const userDoc = await admin.firestore().collection("users").doc(targetUid).get();
      const userData = userDoc.data();
      
      if (userData) {
        const currentUsername = userData.username || '';
        const currentDisplayName = userData.displayName || '';
        
        // Remove admin- prefix if present
        const cleanUsername = currentUsername.replace(/^admin-/, '');
        const cleanDisplayName = currentDisplayName.replace(/^admin-/, '');
        
        userUpdate.username = cleanUsername;
        userUpdate.usernameLower = cleanUsername.toLowerCase();
        userUpdate.displayName = cleanDisplayName;
        
        // Reserve the new username
        const usernamesRef = admin.firestore().collection("usernames").doc(cleanUsername.toLowerCase());
        await usernamesRef.set({
          userId: targetUid,
          username: cleanUsername,
          usernameLower: cleanUsername.toLowerCase(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    await admin.firestore().collection("users").doc(targetUid).set(userUpdate, {merge: true});

    // 7. Create audit log
    await admin.firestore().collection("adminAudit").add({
      action: role === "user" ? "revoked" : "appointed",
      targetUid,
      targetEmail: targetUser.email || null,
      targetRole: role,
      performedBy: request.auth.uid,
      performedByEmail: request.auth.token.email || null,
      reason: reason || null,
      expiresAt: expiresAt || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: `User ${targetUser.email} ${role === "user" ? "role revoked" : `appointed as ${role}`}`,
    };
  }
);

/**
 * Search for users by username or email
 * Requires caller to be an admin
 */
export const searchUsers = onCall(
  async (request) => {
    // Verify authentication and permissions
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    if (!request.auth.token.admin && !request.auth.token.superAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can search users"
      );
    }

    const {query, limit = 20} = request.data as SearchUsersData;

    if (!query || query.length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "Query must be at least 2 characters"
      );
    }

    const results: any[] = [];

    // Search by email using Firebase Auth
    if (query.includes("@")) {
      try {
        const user = await admin.auth().getUserByEmail(query);
        const userDoc = await admin.firestore().collection("users").doc(user.uid).get();
        const userData = userDoc.data();

        results.push({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || userData?.displayName || null,
          username: userData?.username || null,
          role: userData?.role || "user",
          createdAt: user.metadata.creationTime,
        });
      } catch (error) {
        // User not found, continue to username search
      }
    }

    // Search by username in Firestore
    const queryLower = query.toLowerCase();
    const usersSnapshot = await admin.firestore()
      .collection("users")
      .where("username", ">=", queryLower)
      .where("username", "<=", queryLower + "\uf8ff")
      .limit(limit)
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      // Skip if already added via email search
      if (results.some((r) => r.uid === doc.id)) continue;

      let authUser;
      try {
        authUser = await admin.auth().getUser(doc.id);
      } catch (error) {
        // User doesn't exist in Auth, skip
        continue;
      }

      results.push({
        uid: doc.id,
        email: authUser.email || null,
        displayName: userData.displayName || authUser.displayName || null,
        username: userData.username || null,
        role: userData.role || "user",
        createdAt: authUser.metadata.creationTime,
      });
    }

    return {
      users: results.slice(0, limit),
      total: results.length,
    };
  }
);

/**
 * Get audit log for admin actions
 * Requires caller to be an admin
 */
export const getAuditLog = onCall(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    if (!request.auth.token.admin && !request.auth.token.superAdmin) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can view audit logs"
      );
    }

    const data = request.data as { limit?: number; startAfter?: string };
    const {limit = 50, startAfter} = data;

    let query = admin.firestore()
      .collection("adminAudit")
      .orderBy("timestamp", "desc")
      .limit(limit);

    if (startAfter) {
      const startDoc = await admin.firestore().collection("adminAudit").doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc) as any;
      }
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      logs,
      hasMore: snapshot.docs.length === limit,
      lastId: snapshot.docs[snapshot.docs.length - 1]?.id,
    };
  }
);
