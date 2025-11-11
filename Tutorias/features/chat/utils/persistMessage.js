import {
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../app/config/firebase';

const fallbackPreview = (payload) => {
  if (payload.text) return payload.text;
  if (payload.attachmentType === 'image') return 'Foto';
  if (payload.attachmentType === 'audio') return 'Audio';
  if (payload.attachmentType) return 'Archivo';
  return 'Nuevo mensaje';
};

export async function persistMessage(payload) {
  const { conversationId, from, to } = payload;
  if (!conversationId || !from || !to) {
    throw new Error('persistMessage: missing data');
  }

  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  const messageRef = doc(messagesCollection);
  const messageData = {
    conversationId,
    from,
    to,
    text: payload.text || null,
    attachmentURL: payload.attachmentURL || null,
    attachmentType: payload.attachmentType || null,
    senderName: payload.senderName || null,
    createdAt: serverTimestamp(),
    notified: payload.notified || false,
  };

  await setDoc(messageRef, messageData);

  const conversationRef = doc(db, 'conversations', conversationId);
  await updateDoc(conversationRef, {
    lastMessage: fallbackPreview(messageData),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadBy: arrayUnion(to),
    lastMessageMeta: {
      from,
      senderName: payload.senderName || null,
      type: messageData.attachmentType ? 'attachment' : 'text',
    },
  });

  return { ...messageData, id: messageRef.id };
}
