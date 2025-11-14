import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { ensureConversationRecord } from '../api/conversations';

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

const fetchParticipants = async (conversationRef) => {
  const participantsCollection = collection(conversationRef, 'participants');
  const snapshot = await getDocs(participantsCollection);
  return snapshot.docs.map((participantDoc) => ({
    id: participantDoc.id,
    ...participantDoc.data(),
  }));
};

const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  return 0;
};

const conversationSortValue = (conversation) => {
  if (!conversation) return 0;
  return (
    timestampValue(conversation.lastMessageAt) ||
    timestampValue(conversation.updatedAt) ||
    timestampValue(conversation.createdAt)
  );
};

const shouldPreferCandidate = (existing, candidate) => {
  if (!existing) return true;
  const candidateValue = conversationSortValue(candidate);
  const existingValue = conversationSortValue(existing);
  if (candidateValue !== existingValue) {
    return candidateValue > existingValue;
  }
  return String(candidate?.id || '').localeCompare(String(existing?.id || '')) < 0;
};



export function useConversation(myUser, otherUser, options = {}) {
  const { allowedKeys = null, metaByKey = null } = options;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const participantsRef = useRef([]);

  const conversationKey = buildConversationKey(myUser?.uid, otherUser?.uid);
  const enrollmentMeta = conversationKey ? metaByKey?.get?.(conversationKey) : null;
  const isAllowed = !allowedKeys || !conversationKey || allowedKeys.has(conversationKey);

  useEffect(() => {
    if (!myUser?.uid || !otherUser?.uid || !conversationKey) {
      setConversation(null);
      setLoading(false);
      setError(null);
      return () => {};
    }

    if (allowedKeys && allowedKeys.size && !isAllowed) {
      setConversation(null);
      setLoading(false);
      setError(new Error('not-authorized'));
      return () => {};
    }

    let unsubscribe = () => {};
    let active = true;
    setLoading(true);
    setError(null);

    const bootstrap = async () => {
      try {
        const conversationRef = await ensureConversationRecord({
          myUser,
          otherUser,
          meta: enrollmentMeta,
        });
        if (!conversationRef || !active) {
          return;
        }

        participantsRef.current = await fetchParticipants(conversationRef);
        unsubscribe = onSnapshot(conversationRef, (conversationDoc) => {
          if (!conversationDoc.exists()) {
            setConversation(null);
            return;
          }
          setConversation({
            id: conversationDoc.id,
            ...conversationDoc.data(),
            participants: participantsRef.current,
            enrollmentMeta,
          });
        });
      } catch (bootstrapError) {
        console.error('chat: unable to prepare conversation', bootstrapError);
        if (active) {
          setError(bootstrapError);
          setConversation(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    myUser?.uid,
    myUser?.displayName,
    myUser?.photoURL,
    otherUser?.uid,
    otherUser?.displayName,
    otherUser?.photoURL,
    conversationKey,
    allowedKeys,
    isAllowed,
    enrollmentMeta,
  ]);

  return {
    conversation,
    loading,
    participants: conversation?.participants || [],
    error,
  };
}

export function useUserConversations(uid, options = {}) {
  const { allowedKeys = null, metaByKey = null } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const participantsCache = useRef(new Map());

  const isConversationAllowed = useCallback(
    (data) => {
      if (!data?.conversationKey) return false;
      if (allowedKeys && allowedKeys.size && !allowedKeys.has(data.conversationKey)) {
        return false;
      }
      return true;
    },
    [allowedKeys]
  );

  const enrollmentForKey = useCallback(
    (key) => (metaByKey?.get?.(key) ? metaByKey.get(key) : null),
    [metaByKey]
  );

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      setFromCache(false);
      participantsCache.current.clear();
      return () => {};
    }

    setLoading(true);
    setFromCache(false);
    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(
      conversationsRef,
      where('participantUids', 'array-contains', uid)
    );

    let cancelled = false;

    const processSnapshot = async (snapshot) => {
      setFromCache((prev) => prev || snapshot.metadata?.fromCache || false);
      const seenIds = new Set();
      const nextItems = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        if (!isConversationAllowed(data)) {
          continue;
        }

        let participants = participantsCache.current.get(docSnapshot.id);
        if (!participants) {
          try {
            participants = await fetchParticipants(docSnapshot.ref);
            participantsCache.current.set(docSnapshot.id, participants);
          } catch (error) {
            console.error('chat: failed to load participants', error);
            participants = [];
          }
        }

        const enrollmentMeta = enrollmentForKey(data.conversationKey);
        const nextItem = {
          id: docSnapshot.id,
          ...data,
          participants,
          enrollmentMeta,
        };
        seenIds.add(docSnapshot.id);
        nextItems.push(nextItem);
      }

      Array.from(participantsCache.current.keys()).forEach((conversationId) => {
        if (!seenIds.has(conversationId)) {
          participantsCache.current.delete(conversationId);
        }
      });

      nextItems.sort((a, b) => conversationSortValue(b) - conversationSortValue(a));
      if (!cancelled) {
        setItems(nextItems);
        setLoading(false);
      }
    };

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        processSnapshot(snapshot).catch((error) => {
          console.error('chat: conversations snapshot process failed', error);
        });
      },
      (error) => {
        console.error('chat: conversations watch failed', error);
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      participantsCache.current.clear();
    };
  }, [uid, isConversationAllowed, enrollmentForKey]);

  return {
    items,
    loading,
    fromCache,
  };
}
