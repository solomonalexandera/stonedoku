/*
 * Comprehensive cleanup script for Firebase project.
 * Deletes all Auth users, Firestore data, and Realtime Database data.
 *
 * Usage (dry-run):
 *   node scripts/cleanup-all.js
 *
 * To execute (DANGEROUS):
 *   RUN_DELETE=1 GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/cleanup-all.js
 */

const admin = require('firebase-admin');

const DRY_RUN = process.env.RUN_DELETE !== '1';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS must point to a service account JSON');
  if (!DRY_RUN) {
    console.log('For dry-run, continuing without credentials...');
  } else {
    process.exit(1);
  }
}

try {
  admin.initializeApp();
} catch (e) {
  console.log('Admin already initialized');
}

async function deleteAllAuthUsers() {
  console.log('\n=== Firebase Auth Users ===');
  console.log(DRY_RUN ? 'Dry-run: will list users only' : 'LIVE: will delete users');

  const auth = admin.auth();
  let nextPageToken;
  let total = 0;
  
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    const users = list.users;
    if (users.length === 0) break;
    
    for (const u of users) {
      total++;
      if (DRY_RUN) {
        console.log('USER:', u.uid, u.email || u.displayName || '(anonymous)');
      } else {
        console.log('Deleting user', u.uid);
        await auth.deleteUser(u.uid);
      }
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);

  console.log('Processed', total, 'auth users');
}

async function deleteAllFirestoreData() {
  console.log('\n=== Firestore Collections ===');
  console.log(DRY_RUN ? 'Dry-run: will list collections only' : 'LIVE: will delete collections');

  const firestore = admin.firestore();
  const collections = await firestore.listCollections();
  
  for (const collection of collections) {
    console.log(`Collection: ${collection.id}`);
    
    if (!DRY_RUN) {
      // Delete in batches
      const batchSize = 500;
      let query = collection.limit(batchSize);
      
      let deleted = 0;
      let snapshot = await query.get();
      
      while (snapshot.size > 0) {
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        deleted += snapshot.size;
        console.log(`  Deleted ${deleted} documents from ${collection.id}`);
        
        snapshot = await query.get();
      }
    } else {
      const count = await collection.count().get();
      console.log(`  Would delete ${count.data().count} documents`);
    }
  }
}

async function deleteAllRealtimeDbData() {
  console.log('\n=== Realtime Database ===');
  console.log(DRY_RUN ? 'Dry-run: will list data only' : 'LIVE: will delete all data');

  const rtdb = admin.database();
  const paths = ['presence', 'lobbies', 'matches', 'onlineUsers'];
  
  for (const path of paths) {
    const ref = rtdb.ref(path);
    const snapshot = await ref.once('value');
    
    if (snapshot.exists()) {
      const count = Object.keys(snapshot.val() || {}).length;
      console.log(`Path /${path}: ${count} entries`);
      
      if (!DRY_RUN) {
        await ref.remove();
        console.log(`  Deleted /${path}`);
      }
    } else {
      console.log(`Path /${path}: empty`);
    }
  }
}

async function run() {
  console.log('========================================');
  console.log('Firebase Cleanup Script');
  console.log('========================================');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE DELETE');
  console.log('========================================');
  
  try {
    await deleteAllAuthUsers();
    await deleteAllFirestoreData();
    await deleteAllRealtimeDbData();
    
    console.log('\n========================================');
    console.log('Cleanup complete!');
    if (DRY_RUN) {
      console.log('\nTo actually delete, run:');
      console.log('RUN_DELETE=1 GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/cleanup-all.js');
    }
    console.log('========================================');
  } catch (error) {
    console.error('\nError during cleanup:', error);
    process.exit(1);
  }
}

run();
