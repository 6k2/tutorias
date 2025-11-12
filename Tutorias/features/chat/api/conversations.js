import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
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

const normalizeParticipantUids = (uids = []) => {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  return unique.sort();
};

const locateConversationRef = async (conversationKey) => {
  const conversationsCol = collection(db, 'conversations');
  const canonicalRef = doc(conversationsCol, conversationKey);
  const canonicalSnapshot = await getDoc(canonicalRef);

  if (canonicalSnapshot.exists()) {
    return { ref: canonicalRef, snapshot: canonicalSnapshot };
  }

  const existingSnapshot = await getDocs(
    query(conversationsCol, where('conversationKey', '==', conversationKey), limit(1))
  );

  if (!existingSnapshot.empty) {
    return { ref: existingSnapshot.docs[0].ref, snapshot: existingSnapshot.docs[0] };
  }

  return { ref: canonicalRef, snapshot: null };
};

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
  const normalizedParticipants = normalizeParticipantUids(sorted);
  const timestamp = serverTimestamp();

  const { ref: conversationRef, snapshot } = await locateConversationRef(conversationKey);

  if (!snapshot) {
    await setDoc(conversationRef, {
      conversationKey,
      participantUids: normalizedParticipants,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...REQUIRED_FIELDS,
      subjectKey: meta?.subjectKey || null,
      subjectName: meta?.subjectName || '',
      reservationId: meta?.id || null,
    });
  } else {
    const data = snapshot.data() || {};
    const updates = {};
    const existingParticipants = normalizeParticipantUids(data.participantUids || []);
    if (existingParticipants.join(',') !== normalizedParticipants.join(',')) {
      updates.participantUids = normalizedParticipants;
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
      updates.updatedAt = timestamp;
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
