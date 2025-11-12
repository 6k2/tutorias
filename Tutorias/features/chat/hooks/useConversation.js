import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
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
  const conversationWatchers = useRef(new Map());
  const conversationKeysById = useRef(new Map());
  const conversationIdByKey = useRef(new Map());
  const conversationsStore = useRef(new Map());
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

  const dropConversation = useCallback((conversationId) => {
    const unsubscribe = conversationWatchers.current.get(conversationId);
    if (unsubscribe) {
      unsubscribe();
    }
    conversationWatchers.current.delete(conversationId);
    const key = conversationKeysById.current.get(conversationId);
    if (key) {
      conversationIdByKey.current.delete(key);
    }
    conversationKeysById.current.delete(conversationId);
    participantsCache.current.delete(conversationId);
    conversationsStore.current.delete(conversationId);
    setItems(() => {
      if (!conversationsStore.current.size) {
        return [];
      }
      const next = Array.from(conversationsStore.current.values());
      next.sort((a, b) => conversationSortValue(b) - conversationSortValue(a));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      setFromCache(false);
      conversationWatchers.current.forEach((unsubscribe) => unsubscribe());
      conversationWatchers.current.clear();
      conversationKeysById.current.clear();
      conversationIdByKey.current.clear();
      conversationsStore.current.clear();
      participantsCache.current.clear();
      return () => {};
    }

    setLoading(true);
    const participantsQuery = query(
      collectionGroup(db, 'participants'),
      where('uid', '==', uid)
    );

    const unsubscribeParticipants = onSnapshot(
      participantsQuery,
      (snapshot) => {
        setFromCache((prev) => prev || snapshot.metadata?.fromCache || false);
        const nextConversationIds = new Set();
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          if (data?.conversationId) {
            nextConversationIds.add(data.conversationId);
          }
        });

        conversationWatchers.current.forEach((unsubscribe, conversationId) => {
          if (!nextConversationIds.has(conversationId)) {
            unsubscribe();
            conversationWatchers.current.delete(conversationId);
            conversationKeysById.current.delete(conversationId);
            setItems((prev) => prev.filter((item) => item.id !== conversationId));
          }
        });

        nextConversationIds.forEach((conversationId) => {
          if (conversationWatchers.current.has(conversationId)) {
            return;
          }

          const conversationRef = doc(db, 'conversations', conversationId);
          const unsubscribeConversation = onSnapshot(
            conversationRef,
            async (conversationDoc) => {
              setFromCache((prev) => prev || conversationDoc.metadata?.fromCache || false);

              if (!conversationDoc.exists()) {
                dropConversation(conversationId);
                return;
              }

              const data = conversationDoc.data();
              conversationKeysById.current.set(conversationId, data.conversationKey);
              if (!isConversationAllowed(data)) {
                dropConversation(conversationId);
                return;
              }

              let participants = participantsCache.current.get(conversationId);
              if (!participants) {
                try {
                  participants = await fetchParticipants(conversationRef);
                  participantsCache.current.set(conversationId, participants);
                } catch (error) {
                  console.error('chat: failed to load participants', error);
                  participants = [];
                }
              }

              const enrollmentMeta = enrollmentForKey(data.conversationKey);
              const nextItem = {
                id: conversationDoc.id,
                ...data,
                participants,
                enrollmentMeta,
              };

              const existingIdForKey = conversationIdByKey.current.get(data.conversationKey);
              if (existingIdForKey && existingIdForKey !== conversationId) {
                const existingItem = conversationsStore.current.get(existingIdForKey);
                if (existingItem && shouldPreferCandidate(existingItem, nextItem)) {
                  dropConversation(existingIdForKey);
                } else {
                  dropConversation(conversationId);
                  return;
                }
              }

              conversationIdByKey.current.set(data.conversationKey, conversationId);
              conversationsStore.current.set(conversationId, nextItem);
              setItems(() => {
                const ordered = Array.from(conversationsStore.current.values());
                ordered.sort((a, b) => conversationSortValue(b) - conversationSortValue(a));
                return ordered;
              });
              setLoading(false);
            },
            (error) => {
              console.error('chat: failed conversation watch', error);
            }
          );

          conversationWatchers.current.set(conversationId, unsubscribeConversation);
        });

        if (nextConversationIds.size === 0) {
          setLoading(false);
        }
      },
      (error) => {
        console.error('chat: participants watch failed', error);
        setItems([]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeParticipants();
      conversationWatchers.current.forEach((unsubscribe) => unsubscribe());
      conversationWatchers.current.clear();
      conversationKeysById.current.clear();
    };
  }, [uid, isConversationAllowed, enrollmentForKey, dropConversation]);

  useEffect(() => {
    if (!allowedKeys || !allowedKeys.size) {
      return;
    }
    conversationKeysById.current.forEach((key, conversationId) => {
      if (!allowedKeys.has(key)) {
        dropConversation(conversationId);
      }
    });
  }, [allowedKeys, dropConversation]);

  return {
    items,
    loading,
    fromCache,
  };
}
