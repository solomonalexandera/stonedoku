# Security & Permissions Documentation

This document describes the security rules and permissions system for Stonedoku.

## Overview

Stonedoku uses Firebase Security Rules to control access to:
- **Firestore**: User profiles, friend system, match history, chat, DMs
- **Realtime Database (RTDB)**: Presence, lobbies, live matches, notifications, moderation
- **Storage**: Avatar uploads and public assets

## Permission Levels

### User Roles (Custom Claims)
- **Super Admin**: `superAdmin: true` - Full system access, can appoint admins
- **Admin**: `admin: true` - Moderation, role management, and content management
- **Moderator**: `moderator: true` - Content moderation access (mute, block, clear chat)
- **Registered User**: Has email in auth token
- **Anonymous User**: No email, temporary guest access

### Role Hierarchy
```
Super Admin (highest)
  ├─ Can appoint/revoke: Admins, Moderators
  ├─ Full access to all admin features
  └─ Access to role management and audit logs

Admin
  ├─ Can appoint/revoke: Moderators only
  ├─ Full moderation powers
  ├─ Can manage community updates
  └─ Access to audit logs

Moderator
  ├─ Content moderation powers
  ├─ Can mute/unmute users
  ├─ Can block/unblock users
  └─ Can clear chat messages

Regular User
  └─ Standard application access
```

## Moderation Features

### Available to Moderators, Admins, and Super Admins

**User Moderation:**
- `mute` - Prevent user from sending messages (affects global chat and DMs)
- `unmute` - Remove mute restriction
- `block` - Prevent user from playing games
- `unblock` - Remove block restriction

**Chat Management:**
- `clearUserGlobalChat` - Delete all messages from a specific user in global chat
- `clearGlobalChat` - Clear entire global chat (use with caution)

### Moderation Actions

All moderation actions:
1. Update RTDB (`mutes/{uid}` or `blocks/{uid}`)
2. Update Firestore user profile (`moderation` field)
3. Send notification to affected user
4. Are logged for accountability

## Firestore Rules

### User Profiles (`/users/{userId}`)
- **Read**: Any authenticated user
- **Create**: Owner only, requires `userId`, `username`, `usernameLower` fields
- **Update**: Owner only, cannot change `userId`, `username`, or `usernameLower`
- **Delete**: Only anonymous users can delete their own profile

### Usernames (`/usernames/{username}`)
- **Read**: Public (for availability checks)
- **Create**: Authenticated users, validates against reserved terms
- **Reserved Terms**: `admin`, `staff`, `mod`, `moderator`, `support`, `system`, `root`, `owner`
- **Exception**: Admin-prefixed usernames (`admin-*`) allowed for actual admins
- **Update/Delete**: Forbidden (usernames are immutable)

### Friend System

#### Friend Requests (`/friendRequests/{requestId}`)
- **Read**: Participants only (fromUid or toUid)
- **Create**: Registered users can send requests
- **Update**: Recipient can accept/decline, sender can cancel
- **Delete**: Either participant

#### Friend Removals (`/friendRemovals/{docId}`)
- **Create**: Registered users, requires 2 user IDs
- **Read/Update/Delete**: Forbidden (Cloud Functions only)

### Match History (`/matchHistory/{matchId}`)
- **Read**: Participants only
- **Create**: Authenticated users, must be a participant, requires proper structure
- **Update/Delete**: Forbidden

### Global Chat (`/globalChat/{messageId}`)
- **Read**: Authenticated users only
- **Create**: Authenticated users, max 500 characters
- **Update/Delete**: Admins only (for moderation)

### Direct Messages

#### DM Participants (`/dmParticipants/{dmId}`)
- **Read**: Participants and admins
- **Create**: Authenticated users, exactly 2 participants, must be one of them
- **Update/Delete**: Admins only

#### DM Messages (`/directMessages/{dmId}/messages/{msgId}`)
- **Read**: Participants and admins
- **Create**: Participants only, max 1000 characters
- **Update/Delete**: Admins only (for moderation)

### Admin Features

#### Admin Audit Log (`/adminAudit/{logId}`)
- **Read**: Admins, super admins, and moderators
- **Write**: Cloud Functions only

#### Community Updates (`/updates/{updateId}`)
- **Read**: Public
- **Write**: Admins and super admins only

### Other Collections

#### Vanity Links (`/vanityLinks/{username}`)
- **Read**: Public
- **Create**: Registered users only
- **Update/Delete**: Forbidden

#### QA Reports (`/qaReports/{docId}`)
- **Read/Create**: Authenticated users
- **Update/Delete**: Forbidden

#### Client Logs (`/clientLogs/{logId}`)
- **Create**: Authenticated users
- **Read**: Admins only
- **Update/Delete**: Forbidden

## Realtime Database Rules

### Presence (`/presence/{userId}`)
- **Read**: Authenticated users
- **Write**: Owner only
- **Validation**: Must have `status`, `displayName`, `last_changed`

### Moderation Paths

#### Mutes (`/mutes/{userId}`)
- **Read**: Authenticated users
- **Write**: Admins, super admins, and moderators only
- **Purpose**: Track muted users (prevents chat messages)

#### Blocks (`/blocks/{userId}`)
- **Read**: Authenticated users
- **Write**: Admins, super admins, and moderators only
- **Purpose**: Track blocked users (prevents gameplay)

#### Moderation Notices (`/moderation/notices/{userId}`)
- **Read**: Owner only
- **Write**: Admins, super admins, and moderators only
- **Purpose**: Send moderation notifications to users

### Lobbies (`/lobbies/{roomCode}`)
- **Read**: Authenticated users
- **Write**: Host can create/update, participants can update their data
- **Validation**: Must have `host` and `code` fields

#### Lobby Players (`/lobbies/{roomCode}/players/{playerId}`)
- **Write**: Player themselves or host

#### Rematch Votes (`/lobbies/{roomCode}/rematchVotes/{voterId}`)
- **Write**: Voter only
- **Validation**: Vote must be boolean

### Matches (`/matches/{matchId}`)
- **Read**: Participants only
- **Write**: Participants only
- **Validation**: Must have `id`, `players`, `board`, `solution`

### Global Chat (`/globalChat/{messageId}`)
- **Read**: Authenticated users
- **Write**: Message author only
- **Validation**: Max 500 characters, must have required fields

### Direct Messages (`/directMessages/{dmId}/{messageId}`)
- **Read**: Participants only (validated via dmParticipants)
- **Write**: Participants only, must be message author
- **Validation**: Max 1000 characters, must have required fields

### DM Threads (`/dmThreads/{userId}/{otherUserId}`)
- **Read**: Thread participants
- **Write**: Thread participants
- **Validation**: Must have `lastText`, `lastTimestamp`, `lastFrom`

### Notifications (`/notifications/{userId}/{notificationId}`)
- **Read**: Owner only
- **Write**: Owner or notification sender
- **Validation**: Must have `type` and `timestamp`

## Storage Rules

### Avatars (`/avatars/{userId}/*`)
- **Read**: Public
- **Write**: Owner only
- **Restrictions**:
  - Max file size: 5MB
  - Content type: `image/*` only

### Public Assets (`/public/*`)
- **Read**: Public
- **Write**: Forbidden

## Security Best Practices

### For Developers

1. **Never bypass security rules** in client code
2. **Validate user input** before submitting to Firebase
3. **Use custom claims** for role-based access, not Firestore documents
4. **Test permission changes** using Firebase Emulator Suite
5. **Sanitize user content** to prevent XSS attacks

### Field Validation

- **User profiles**: Enforce required fields on creation
- **Chat messages**: Length limits (500 chars for global, 1000 for DM)
- **Usernames**: 3-20 characters, alphanumeric and underscore only
- **File uploads**: Size and type restrictions

### Rate Limiting

While Firebase doesn't provide built-in rate limiting, the app uses:
- **Debouncing**: Username availability checks (400ms)
- **Cooldowns**: Audio feedback to prevent spam
- **Token-based cancellation**: Prevents race conditions

## Testing Permissions

Run permission tests using Playwright:

```bash
npm run test:playwright
```

Tests validate:
- Anonymous users cannot impersonate others
- Unauthenticated users cannot read protected data
- Username documents are immutable
- Vanity links require email authentication

## Deployment

Deploy security rules:

```bash
# Deploy all rules
npm run deploy:rules

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only database
firebase deploy --only storage
```

## Troubleshooting

### Permission Denied Errors

1. Check if user is authenticated: `auth != null`
2. Verify custom claims are set correctly
3. Ensure user owns the resource they're accessing
4. Check field validation requirements

### Common Issues

- **Anonymous users**: Limited access, cannot create vanity links
- **Reserved usernames**: Cannot use admin/staff/mod terms
- **File uploads**: Must be under 5MB and image type
- **Chat messages**: Must respect character limits

## Security Monitoring

- **Admin audit log**: Tracks all admin actions
- **Client logs**: Developers can review for debugging
- **QA reports**: Diagnostic data for troubleshooting

## Contact

For security concerns, contact the development team through the admin console or support channels.
