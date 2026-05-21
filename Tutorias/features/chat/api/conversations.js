import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { buildConversationKey, normalizeParticipantProfile } from '../utils/profiles';

const emptySummary = {
  lastMessage: null,
  lastMessageAt: null,
  lastMessageMeta: null,
  unreadBy: [],
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
  const conversationRef = doc(db, 'conversations', conversationKey);
  const existingSnapshot = await getDoc(conversationRef);
  const myProfile = normalizeParticipantProfile(myUser, conversationRef.id, meta);
  const otherProfile = normalizeParticipantProfile(otherUser, conversationRef.id, meta);
  const participantProfiles = {
    [myUid]: myProfile,
    [otherUid]: otherProfile,
  };

  if (!existingSnapshot.exists()) {
    const timestamp = serverTimestamp();
    await setDoc(conversationRef, {
      conversationKey,
      participantUids: sorted,
      participantProfiles,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...emptySummary,
      subjectKey: meta?.subjectKey || null,
      subjectName: meta?.subjectName || '',
      reservationId: meta?.id || null,
    });
  } else {
    const data = existingSnapshot.data() || {};
    const updates = {
      participantProfiles: {
        ...(data.participantProfiles || {}),
        ...participantProfiles,
      },
    };
    if (!Array.isArray(data.participantUids) || data.participantUids.length !== 2) {
      updates.participantUids = sorted;
    }
    if (meta && meta.subjectKey && data.subjectKey !== meta.subjectKey) {
      updates.subjectKey = meta.subjectKey;
      updates.subjectName = meta.subjectName || '';
      updates.reservationId = meta.id || null;
    }
    await setDoc(conversationRef, updates, { merge: true });
  }

  await Promise.all([
    setDoc(
      doc(conversationRef, 'participants', myUid),
      myProfile,
      { merge: true }
    ),
    setDoc(
      doc(conversationRef, 'participants', otherUid),
      otherProfile,
      { merge: true }
    ),
  ]);

  return conversationRef;
};
