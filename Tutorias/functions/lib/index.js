const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

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

exports.onMessageCreate = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const payload = snapshot.data();
    if (!payload || payload.notified) return null;

    const recipient = payload.to;
    if (!recipient) return null;

    const presenceSnap = await rtdb.ref(`status/${recipient}`).get();
    const isOnline = presenceSnap.exists() && Boolean(presenceSnap.val()?.online);
    if (isOnline) {
      return null;
    }

    const userDoc = await db.collection('users').doc(recipient).get();
    const data = userDoc.data() || {};
    let tokens = [];
    if (Array.isArray(data.notificationTokens)) {
      tokens = data.notificationTokens.filter(Boolean);
    } else if (data.notificationTokens && typeof data.notificationTokens === 'object') {
      tokens = Object.values(data.notificationTokens).filter(Boolean);
    }

    if (!tokens.length) {
      await snapshot.ref.update({ notified: true });
      return null;
    }

    const notificationTitle = payload.senderName || 'Tutorias';
    const notificationBody =
      payload.text ||
      (payload.attachmentType === 'image'
        ? 'Te enviaron una foto'
        : payload.attachmentType
        ? 'Te enviaron un archivo'
        : 'Nuevo mensaje');

    await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        conversationId: context.params.conversationId,
      },
    });

    await snapshot.ref.update({ notified: true });
    return null;
  });
