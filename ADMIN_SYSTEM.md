# Admin System - Hybrid Custom Claims Implementation

This document describes the admin role management system implemented in Stonedoku.

## Overview

The admin system uses Firebase Custom Claims for fast, token-based permission checks combined with Firestore for detailed role metadata and audit trails. This hybrid approach provides:

- **Fast permission checks** - Claims are cached in the user's ID token
- **Secure** - Security rules enforce permissions at the database level
- **Auditable** - Complete history of all role changes
- **Hierarchical** - Support for multiple role levels (User, Moderator, Admin, Super-Admin)

## Architecture

### Custom Claims (Firebase Auth)
Stored in the user's ID token and checked on every request:
- `superAdmin: boolean` - Full access to all admin features
- `admin: boolean` - Access to admin console and role management (up to Moderator)
- `moderator: boolean` - Access to moderation tools
- `appointedBy: string` - UID of who granted the role
- `appointedAt: number` - Timestamp of appointment

### Firestore Metadata
Stored in `users/{uid}` document:
- `role: string` - Current role ('user' | 'moderator' | 'admin' | 'superAdmin')
- `appointedBy: string` - UID of appointer
- `appointedAt: Timestamp` - Server timestamp
- `appointmentReason?: string` - Optional reason for appointment
- `roleExpiresAt?: number` - Optional expiration timestamp

### Audit Log
Stored in `adminAudit` collection:
- `action: string` - 'appointed' or 'revoked'
- `targetUid: string` - User who received role change
- `targetEmail: string` - User's email
- `targetRole: string` - New role
- `performedBy: string` - UID of admin who made the change
- `performedByEmail: string` - Email of admin
- `reason?: string` - Optional reason
- `timestamp: Timestamp` - Server timestamp

## Getting Started

### 1. Bootstrap First Super-Admin

To appoint yourself as the first super-admin, run this one-time command:

```bash
npm run appoint-superadmin your-email@example.com
```

Or directly:

```bash
node scripts/appoint-superadmin.js your-email@example.com
```

This script:
1. Finds the user by email in Firebase Auth
2. Sets custom claims (superAdmin, admin, moderator)
3. Updates the Firestore user document
4. Creates an audit log entry

### 2. Login to Activate

After running the script:
1. If you're already logged in, **log out and log back in**
2. The app will automatically detect your admin status from custom claims
3. An "Admin Console" button will appear in the header navigation

### 3. Manage Other Admins

From the Admin Console (accessible via the gear icon in header):

1. Navigate to "Role Management" section (Super-Admin only)
2. Search for users by email or username
3. Select the desired role from dropdown
4. Click "Update" and optionally provide a reason
5. The user will have the new role on their next login/token refresh

## Role Hierarchy

- **Super-Admin** - Can appoint/revoke any role including other Super-Admins
- **Admin** - Can appoint/revoke Moderators and Users
- **Moderator** - Can access moderation tools, view audit logs
- **User** - Default role, no special permissions

## Security Rules

The Firestore security rules use custom claims:

```javascript
function isAdmin() {
  return request.auth.token.admin == true;
}

function isSuperAdmin() {
  return request.auth.token.superAdmin == true;
}

function isModerator() {
  return request.auth.token.moderator == true;
}
```

These functions are used throughout the rules to enforce permissions.

## Cloud Functions

### `appointAdmin`
- **Callable:** Yes
- **Auth Required:** Yes (Admin or Super-Admin)
- **Parameters:**
  - `targetUid: string` - UID of user to appoint
  - `role: string` - 'user' | 'moderator' | 'admin' | 'superAdmin'
  - `reason?: string` - Optional reason
  - `expiresAt?: number` - Optional expiration timestamp

### `searchUsers`
- **Callable:** Yes
- **Auth Required:** Yes (Admin or Super-Admin)
- **Parameters:**
  - `query: string` - Email or username to search
  - `limit?: number` - Max results (default 20)

### `getAuditLog`
- **Callable:** Yes
- **Auth Required:** Yes (Admin, Super-Admin, or Moderator)
- **Parameters:**
  - `limit?: number` - Max results (default 50)
  - `startAfter?: string` - Document ID for pagination

## Client-Side Usage

### Checking Admin Status

```javascript
// After user signs in
const idTokenResult = await auth.currentUser.getIdTokenResult();

if (idTokenResult.claims.superAdmin) {
  // User is a super-admin
}

if (idTokenResult.claims.admin) {
  // User is an admin
}

if (idTokenResult.claims.moderator) {
  // User is a moderator
}
```

### Forcing Token Refresh

After a role change, the user needs to refresh their token:

```javascript
// Force token refresh
await auth.currentUser.getIdToken(true);

// Re-fetch claims
const idTokenResult = await auth.currentUser.getIdTokenResult();
```

The app automatically loads claims on login, so typically the user just needs to log out and back in.

## Development Workflow

### Local Development

1. Start emulators:
```bash
npm run emulators
```

2. Run appointment script against emulator:
```bash
export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
export FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run appoint-superadmin test@example.com
```

### Deployment

1. Build functions:
```bash
cd functions && npm run build
```

2. Deploy everything:
```bash
npm run deploy
```

3. Or deploy only functions:
```bash
npm run deploy:functions
```

4. Or deploy only rules:
```bash
npm run deploy:rules
```

## Troubleshooting

### Admin button not showing
- Ensure you've logged out and back in after appointment
- Check browser console for custom claims
- Verify `AppState.currentUser.isAdmin` is true

### "Permission denied" errors
- Verify security rules are deployed: `npm run deploy:rules`
- Check that custom claims are set correctly
- Ensure Functions are deployed: `npm run deploy:functions`

### Audit log not loading
- Check browser console for errors
- Verify `getAuditLog` function is deployed
- Ensure user has admin/moderator claims

## Files Modified

### Created
- `scripts/appoint-superadmin.js` - Bootstrap script
- `functions/src/admin.ts` - Cloud Functions for admin management
- `src/client/managers/adminManager.js` - Client-side admin UI manager

### Modified
- `src/client/entry.js` - Added custom claims check and admin UI
- `src/client/ui/adminConsoleUi.js` - Initialize admin manager
- `firebase/firestore.rules` - Use custom claims instead of admins collection
- `index.html` - Added role management and audit log UI
- `styles.css` - Added styling for admin UI components
- `package.json` - Added `appoint-superadmin` script
- `functions/src/index.ts` - Export new admin functions

## Future Enhancements

Potential improvements:
- Role expiration with automatic revocation
- Email notifications on role changes
- Invitation-based role acceptance
- Rate limiting for role changes
- IP/location logging for audit trail
- Temporary elevated permissions
- Role delegation workflows
