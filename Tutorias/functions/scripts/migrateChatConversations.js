/* eslint-disable no-console */
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'tutorias-7d6f0',
});
const db = admin.firestore();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = args.has('--dry-run') || !apply;

const buildConversationKey = (uids = []) => {
  const sorted = uids.filter(Boolean).sort();
  return sorted.length === 2 ? `${sorted[0]}_${sorted[1]}` : null;
};

const normalizeProfile = (uid, source = {}, conversationId) => ({
  uid,
  displayName: source.displayName || source.username || source.name || source.email || uid,
  photoURL: source.photoURL || null,
  role: source.role || null,
  relationship: source.relationship || null,
  conversationId,
  subjectKey: source.subjectKey || null,
  subjectName: source.subjectName || null,
});

async function copySubcollection(fromRef, toRef, name) {
  const snapshot = await fromRef.collection(name).get();
  let count = 0;
  for (const docSnap of snapshot.docs) {
    count += 1;
    if (dryRun) continue;
    await toRef.collection(name).doc(docSnap.id).set(docSnap.data(), { merge: true });
  }
  return count;
}

async function migrateConversation(docSnap) {
  const data = docSnap.data() || {};
  const key = data.conversationKey || buildConversationKey(data.participantUids || []);
  if (!key) {
    console.warn(`skip ${docSnap.id}: missing conversationKey/participantUids`);
    return { skipped: true };
  }

  if (docSnap.id === key && data.participantProfiles) {
    return { skipped: true, alreadyNormalized: true };
  }

  const targetRef = db.collection('conversations').doc(key);
  const participantUids = Array.isArray(data.participantUids) ? data.participantUids.filter(Boolean).sort() : key.split('_');
  const participantProfiles = { ...(data.participantProfiles || {}) };

  const participantsSnap = await docSnap.ref.collection('participants').get();
  participantsSnap.forEach((participantDoc) => {
    const profile = participantDoc.data() || {};
    const uid = profile.uid || participantDoc.id;
    participantProfiles[uid] = normalizeProfile(uid, profile, key);
  });

  participantUids.forEach((uid) => {
    if (!participantProfiles[uid]) {
      participantProfiles[uid] = normalizeProfile(uid, {}, key);
    }
  });

  const nextData = {
    ...data,
    conversationKey: key,
    participantUids,
    participantProfiles,
    migratedFrom: docSnap.id === key ? data.migratedFrom || null : docSnap.id,
    migrationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const messageCount = await copySubcollection(docSnap.ref, targetRef, 'messages');
  const participantCount = await copySubcollection(docSnap.ref, targetRef, 'participants');

  if (!dryRun) {
    await targetRef.set(nextData, { merge: true });
    if (docSnap.id !== key) {
      await docSnap.ref.set(
        {
          migratedTo: key,
          migrationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  console.log(`${dryRun ? '[dry-run]' : '[apply]'} ${docSnap.id} -> ${key} (${messageCount} messages, ${participantCount} participants)`);
  return { migrated: true };
}

async function main() {
  console.log(`Chat migration mode: ${dryRun ? 'dry-run' : 'apply'}`);
  const snapshot = await db.collection('conversations').get();
  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const result = await migrateConversation(docSnap);
    if (result.migrated) migrated += 1;
    else skipped += 1;
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
