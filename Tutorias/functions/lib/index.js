const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

async function getUserNotificationTokens(uid) {
  if (!uid) return [];
  const userDoc = await db.collection('users').doc(uid).get();
  const data = userDoc.data() || {};
  if (Array.isArray(data.notificationTokens)) {
    return data.notificationTokens.filter(Boolean);
  }
  if (data.notificationTokens && typeof data.notificationTokens === 'object') {
    return Object.values(data.notificationTokens).filter(Boolean);
  }
  return [];
}

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

    const tokens = await getUserNotificationTokens(recipient);

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

exports.onTutoringMaterialCreate = functions.firestore
  .document('tutoringMaterials/{materialId}')
  .onCreate(async (snapshot, context) => {
    const material = snapshot.data();
    if (!material?.studentId) {
      return null;
    }

    const tokens = await getUserNotificationTokens(material.studentId);
    if (!tokens.length) {
      return null;
    }

    let subjectName = 'Tutoría';
    let teacherName = 'Tu tutor';
    try {
      const reservationSnap = await db.collection('reservations').doc(material.reservationId).get();
      if (reservationSnap.exists) {
        const reservationData = reservationSnap.data() || {};
        subjectName = reservationData.subjectName || subjectName;
        teacherName =
          reservationData.teacherDisplayName ||
          reservationData.teacherName ||
          reservationData.teacherId ||
          teacherName;
      }
    } catch (error) {
      console.warn('onTutoringMaterialCreate: reservation lookup failed', error);
    }

    const materialTitle = material.title || 'Nuevo material de estudio';
    await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title: teacherName,
        body: `${materialTitle} · ${subjectName}`,
      },
      data: {
        reservationId: material.reservationId || '',
        materialId: context.params.materialId,
      },
    });

    return null;
  });
