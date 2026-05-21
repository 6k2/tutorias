"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTutoringMaterialCreate = exports.onMessageCreate = exports.onAuthCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();
async function getUserNotificationTokens(uid) {
    if (!uid)
        return [];
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
    if (snapshot.exists)
        return null;
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
    // Optional Blaze-only mirror. Spark/free clients already update this summary with writeBatch.
    const payload = snapshot.data();
    if (!payload)
        return null;
    const recipient = payload.to;
    if (!recipient)
        return null;
    const attachment = Array.isArray(payload.attachments) ? payload.attachments[0] : null;
    const attachmentType = payload.attachmentType || attachment?.type || null;
    const preview = payload.text ||
        (attachmentType === 'image'
            ? 'Foto'
            : attachmentType
                ? attachment?.name || 'Archivo'
                : 'Nuevo mensaje');
    await db.collection('conversations').doc(context.params.conversationId).set({
        lastMessage: preview,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        unreadBy: admin.firestore.FieldValue.arrayUnion(recipient),
        lastMessageMeta: {
            from: payload.from,
            senderName: payload.senderName || null,
            type: attachmentType ? 'attachment' : 'text',
            messageId: context.params.messageId,
            clientId: payload.clientId || null,
        },
    }, { merge: true });
    if (payload.notified)
        return null;
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
    const notificationBody = payload.text ||
        (attachmentType === 'image'
            ? 'Te enviaron una foto'
            : attachmentType
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map