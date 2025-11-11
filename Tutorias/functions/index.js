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

exports.sendChatNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const payload = snapshot.data();
    if (!payload) return null;

    const statusSnap = await rtdb.ref(`status/${payload.to}`).get();
    const isOnline = statusSnap.exists() && Boolean(statusSnap.val().online);
    if (isOnline) {
      return null;
    }

    functions.logger.info('Notificación pendiente', {
      to: payload.to,
      text: payload.text,
      conversationId: context.params.conversationId,
    });

    // TODO: Enviar FCM real cuando guardemos tokens del usuario.
    return null;
  });
