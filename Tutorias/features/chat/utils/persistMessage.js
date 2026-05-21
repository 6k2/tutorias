import {
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../app/config/firebase';

const fallbackPreview = (payload) => {
  if (payload.text) return payload.text;
  const attachment = Array.isArray(payload.attachments) ? payload.attachments[0] : null;
  const type = payload.attachmentType || attachment?.type;
  if (type === 'image') return 'Foto';
  if (type) return attachment?.name || 'Archivo';
  return 'Nuevo mensaje';
};

export async function persistMessage(payload) {
  const { conversationId, from, to } = payload;
  if (!conversationId || !from || !to) {
    throw new Error('persistMessage: missing data');
  }

  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  const messageRef = payload.messageId ? doc(messagesCollection, payload.messageId) : doc(messagesCollection);
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : payload.attachmentURL
    ? [
        {
          url: payload.attachmentURL,
          type: payload.attachmentType || 'file',
          name: payload.attachmentName || null,
          storagePath: payload.storagePath || null,
          sizeBytes: payload.sizeBytes || null,
        },
      ]
    : [];
  const messageData = {
    conversationId,
    clientId: payload.clientId || messageRef.id,
    from,
    to,
    text: payload.text || null,
    attachments,
    attachmentURL: attachments[0]?.url || null,
    attachmentType: attachments[0]?.type || null,
    senderName: payload.senderName || null,
    createdAt: serverTimestamp(),
    localCreatedAt: payload.localCreatedAt || Date.now(),
    notified: payload.notified || false,
  };

  const batch = writeBatch(db);
  batch.set(messageRef, messageData);
  batch.update(doc(db, 'conversations', conversationId), {
    lastMessage: fallbackPreview(messageData),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadBy: arrayUnion(to),
    lastMessageMeta: {
      from,
      senderName: payload.senderName || null,
      type: attachments.length ? 'attachment' : 'text',
      messageId: messageRef.id,
      clientId: messageData.clientId,
    },
  });
  await batch.commit();
  return { ...messageData, id: messageRef.id };
}
