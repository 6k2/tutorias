const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK once per instance
admin.initializeApp();
const db = admin.firestore();

// Ensure a Firestore profile exists for every new auth user
exports.onAuthCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName } = user;
  const docRef = db.collection('users').doc(uid);
  const snapshot = await docRef.get();
  if (snapshot.exists) return null;
  await docRef.set({
    uid,
    email: email || null,
    username: displayName || null,
    role: 'Student',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return null;
});

