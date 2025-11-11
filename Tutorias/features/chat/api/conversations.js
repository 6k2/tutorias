import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';

const REQUIRED_FIELDS = {
  lastMessage: null,
  lastMessageAt: null,
  lastMessageMeta: null,
  unreadBy: [],
};

const buildConversationKey = (uidA, uidB) => {
  if (!uidA || !uidB) return null;
  const sorted = [uidA, uidB].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

const sanitizeProfile = (user = {}, conversationId, meta) => ({
  uid: user?.uid,
  displayName: user?.displayName || 'Sin nombre',
  photoURL: user?.photoURL || null,
  role: user?.role || null,
  conversationId,
  subjectKey: meta?.subjectKey || null,
  subjectName: meta?.subjectName || null,
});

/**
 * Ensure a conversation document exists for two users and create participants entries.
 * Returns the conversation ref (DocumentReference) or null.
 */
export const ensureConversationRecord = async ({ myUser, otherUser, meta }) => {
  const myUid = myUser?.uid;
  const otherUid = otherUser?.uid;
  if (!myUid || !otherUid) {
    return null;
  }

  const conversationKey = buildConversationKey(myUid, otherUid);
  if (!conversationKey) {
    return null;
  }

  const sorted = [myUid, otherUid].sort();
  const conversationsCol = collection(db, 'conversations');
  const existingQuery = query(
    conversationsCol,
    where('conversationKey', '==', conversationKey),
    limit(1)
  );
  const existingSnapshot = await getDocs(existingQuery);

  let conversationRef;
  if (existingSnapshot.empty) {
    const timestamp = serverTimestamp();
    conversationRef = await addDoc(conversationsCol, {
      conversationKey,
      participantUids: sorted,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...REQUIRED_FIELDS,
      subjectKey: meta?.subjectKey || null,
      subjectName: meta?.subjectName || '',
      reservationId: meta?.id || null,
    });
  } else {
    conversationRef = existingSnapshot.docs[0].ref;
    const data = existingSnapshot.docs[0].data() || {};
    const updates = {};
    if (!Array.isArray(data.participantUids) || data.participantUids.length !== 2) {
      updates.participantUids = sorted;
    }
    Object.entries(REQUIRED_FIELDS).forEach(([key, defaultValue]) => {
      if (!(key in data)) {
        updates[key] = defaultValue;
      }
    });
    if (meta && meta.subjectKey && data.subjectKey !== meta.subjectKey) {
      updates.subjectKey = meta.subjectKey;
      updates.subjectName = meta.subjectName || '';
      updates.reservationId = meta.id || null;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(conversationRef, updates);
    }
  }

  // write participant docs (merge)
  await Promise.all([
    setDoc(
      doc(conversationRef, 'participants', myUid),
      sanitizeProfile(myUser, conversationRef.id, meta),
      { merge: true }
    ),
    setDoc(
      doc(conversationRef, 'participants', otherUid),
      sanitizeProfile(otherUser, conversationRef.id, meta),
      { merge: true }
    ),
  ]);

  return conversationRef;
};
