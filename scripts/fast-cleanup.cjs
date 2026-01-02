#!/usr/bin/env node
/*
 * Fast cleanup script using Firebase CLI token for authentication
 */

const admin = require('firebase-admin');
const { execSync } = require('child_process');

// Get Firebase CLI access token
let accessToken;
try {
  accessToken = execSync('firebase login:ci --no-localhost 2>/dev/null || firebase login:list 2>/dev/null', { encoding: 'utf8' }).trim();
} catch (e) {
  // Token not needed if using application default credentials
}

// Initialize admin with project ID
admin.initializeApp({
  projectId: 'stonedoku-c0898',
  databaseURL: 'https://stonedoku-c0898-default-rtdb.europe-west1.firebasedatabase.app'
});

async function deleteAllAuthUsers() {
  console.log('\n🗑️  Deleting all Firebase Auth users...');
  
  const auth = admin.auth();
  let deleted = 0;
  let nextPageToken;
  
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    const uids = result.users.map(u => u.uid);
    
    if (uids.length === 0) break;
    
    // Delete in batch
    const deleteResult = await auth.deleteUsers(uids);
    deleted += deleteResult.successCount;
    
    if (deleteResult.failureCount > 0) {
      console.log(`⚠️  Failed to delete ${deleteResult.failureCount} users`);
      deleteResult.errors.forEach(err => {
        console.log(`   Error: ${err.error.message}`);
      });
    }
    
    console.log(`   Deleted ${deleted} users so far...`);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  console.log(`✅ Deleted ${deleted} auth users total`);
}

async function deleteAllFirestoreData() {
  console.log('\n🗑️  Deleting all Firestore data...');
  
  const firestore = admin.firestore();
  const collections = await firestore.listCollections();
  
  for (const collection of collections) {
    let deleted = 0;
    const batchSize = 500;
    
    while (true) {
      const snapshot = await collection.limit(batchSize).get();
      if (snapshot.empty) break;
      
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      deleted += snapshot.size;
      process.stdout.write(`\r   ${collection.id}: ${deleted} documents deleted`);
    }
    console.log(`\n✅ Deleted collection: ${collection.id}`);
  }
}

async function deleteAllRealtimeDbData() {
  console.log('\n🗑️  Deleting all Realtime Database data...');
  
  const rtdb = admin.database();
  const rootRef = rtdb.ref();
  
  const snapshot = await rootRef.once('value');
  if (snapshot.exists()) {
    await rootRef.remove();
    console.log('✅ Cleared Realtime Database');
  } else {
    console.log('ℹ️  Realtime Database already empty');
  }
}

async function main() {
  console.log('========================================');
  console.log('🔥 FIREBASE CLEANUP - stonedoku-c0898');
  console.log('========================================\n');
  console.log('⚠️  WARNING: This will delete ALL data!');
  console.log('   - All Auth users');
  console.log('   - All Firestore collections');
  console.log('   - All Realtime Database data\n');
  
  try {
    await deleteAllAuthUsers();
    await deleteAllFirestoreData();
    await deleteAllRealtimeDbData();
    
    console.log('\n========================================');
    console.log('✅ Cleanup complete!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main();
