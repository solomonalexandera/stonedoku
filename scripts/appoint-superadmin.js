#!/usr/bin/env node

/**
 * One-time script to appoint a super-admin by email.
 * This script sets custom claims and updates Firestore so that when the user
 * next logs in, they will have full super-admin privileges automatically.
 *
 * Usage:
 *   node scripts/appoint-superadmin.js your-email@example.com
 *
 * Or via npm:
 *   npm run appoint-superadmin your-email@example.com
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to service account JSON
 *   - Or run from Firebase CLI with authenticated project
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

async function appointSuperAdmin(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}...`);
    
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`✓ Found user: ${user.uid}`);
    console.log(`  Display Name: ${user.displayName || '(not set)'}`);
    console.log(`  Email Verified: ${user.emailVerified}`);
    
    // Set custom claims
    console.log(`\n⚙️  Setting custom claims...`);
    await admin.auth().setCustomUserClaims(user.uid, {
      superAdmin: true,
      admin: true,
      moderator: true,
      appointedBy: 'bootstrap',
      appointedAt: Date.now()
    });
    console.log('✓ Custom claims set');
    
    // Update Firestore user document
    console.log(`⚙️  Updating Firestore...`);
    const userRef = admin.firestore().collection('users').doc(user.uid);
    await userRef.set({
      role: 'superAdmin',
      appointedBy: 'bootstrap',
      appointedAt: admin.firestore.FieldValue.serverTimestamp(),
      appointmentReason: 'Initial super-admin bootstrap'
    }, { merge: true });
    console.log('✓ Firestore updated');
    
    // Create audit log
    console.log(`⚙️  Creating audit log...`);
    await admin.firestore().collection('adminAudit').add({
      action: 'appointed',
      targetUid: user.uid,
      targetEmail: user.email,
      targetRole: 'superAdmin',
      performedBy: 'bootstrap',
      performedByEmail: 'system',
      reason: 'Initial super-admin bootstrap',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✓ Audit log created');
    
    console.log(`\n🎉 SUCCESS!\n`);
    console.log(`${email} is now a super-admin.`);
    console.log(`\nNext steps:`);
    console.log(`1. User should log out if currently logged in`);
    console.log(`2. User logs back in`);
    console.log(`3. Admin console will appear automatically\n`);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`User with email "${email}" not found.`);
      console.error(`Please ensure the user has created an account first.\n`);
    }
    
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('\n❌ Error: Email address required\n');
  console.error('Usage: node scripts/appoint-superadmin.js <email>\n');
  console.error('Example: node scripts/appoint-superadmin.js admin@example.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error(`\n❌ Error: Invalid email format: ${email}\n`);
  process.exit(1);
}

appointSuperAdmin(email);
