import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { ensureConversationRecord } from '../api/conversations';
import {
  buildConversationKey,
  partnerFromConversation,
  participantsFromConversation,
} from '../utils/profiles';

const fetchParticipants = async (conversationRef) => {
  const participantsCollection = collection(conversationRef, 'participants');
  const snapshot = await getDocs(participantsCollection);
  return snapshot.docs.map((participantDoc) => ({
    id: participantDoc.id,
    ...participantDoc.data(),
  }));
};

const enrichConversation = (conversationDoc, enrollmentMeta, fallbackParticipants = []) => {
  const data = conversationDoc.data() || {};
  const conversation = {
    id: conversationDoc.id,
    ...data,
    enrollmentMeta,
  };
  const profiles = participantsFromConversation(conversation);
  return {
    ...conversation,
    participants: profiles.length ? profiles : fallbackParticipants,
  };
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
  const myConversationUser = useMemo(() => (myUser?.uid ? {
    uid: myUser.uid,
    displayName: myUser.displayName,
    photoURL: myUser.photoURL,
    role: myUser.role,
  } : null), [myUser?.uid, myUser?.displayName, myUser?.photoURL, myUser?.role]);
  const otherConversationUser = useMemo(() => (otherUser?.uid ? {
    uid: otherUser.uid,
    displayName: otherUser.displayName,
    photoURL: otherUser.photoURL,
    role: otherUser.role,
  } : null), [otherUser?.uid, otherUser?.displayName, otherUser?.photoURL, otherUser?.role]);

  useEffect(() => {
    if (!myConversationUser?.uid || !otherConversationUser?.uid || !conversationKey) {
      setConversation(null);
      setLoading(false);
      setError(null);
      return () => {};
    }

    if (allowedKeys && !isAllowed) {
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
          myUser: myConversationUser,
          otherUser: otherConversationUser,
          meta: enrollmentMeta,
        });
        if (!conversationRef || !active) {
          return;
        }

        unsubscribe = onSnapshot(conversationRef, (conversationDoc) => {
          if (!conversationDoc.exists()) {
            setConversation(null);
            return;
          }
          const next = enrichConversation(conversationDoc, enrollmentMeta, participantsRef.current);
          setConversation(next);
          if (!participantsFromConversation(next).length) {
            fetchParticipants(conversationRef)
              .then((participants) => {
                participantsRef.current = participants;
                if (active) setConversation(enrichConversation(conversationDoc, enrollmentMeta, participants));
              })
              .catch((error) => console.error('chat: failed to load participants', error));
          }
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
    myConversationUser,
    otherConversationUser,
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
  const { allowedKeys = null, metaByKey = null, disabled = false } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const conversationWatchers = useRef(new Map());
  const conversationKeysById = useRef(new Map());

  const isConversationAllowed = useCallback(
    (data) => {
      if (!data?.conversationKey) return false;
      if (allowedKeys && !allowedKeys.has(data.conversationKey)) {
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
    setItems((prev) => prev.filter((item) => item.id !== conversationId));
    const unsubscribe = conversationWatchers.current.get(conversationId);
    if (unsubscribe) {
      unsubscribe();
    }
    conversationWatchers.current.delete(conversationId);
    conversationKeysById.current.delete(conversationId);
  }, []);

  useEffect(() => {
    if (!uid || disabled) {
      setItems([]);
      setLoading(false);
      setFromCache(false);
      conversationWatchers.current.forEach((unsubscribe) => unsubscribe());
      conversationWatchers.current.clear();
      conversationKeysById.current.clear();
      return () => {};
    }

    setLoading(true);
    const watchers = conversationWatchers.current;
    const keysById = conversationKeysById.current;
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

              const enrollmentMeta = enrollmentForKey(data.conversationKey);
              let nextItem = enrichConversation(conversationDoc, enrollmentMeta);
              if (!participantsFromConversation(nextItem).length) {
                try {
                  const participants = await fetchParticipants(conversationRef);
                  nextItem = enrichConversation(conversationDoc, enrollmentMeta, participants);
                } catch (error) {
                  console.error('chat: failed to load participants', error);
                }
              }

              setItems((prev) => {
                const filtered = prev.filter((item) => item.id !== conversationDoc.id);
                const merged = [...filtered, nextItem];
                merged.sort((a, b) => {
                  const timeA =
                    a.lastMessageAt?.toMillis?.() ||
                    a.updatedAt?.toMillis?.() ||
                    0;
                  const timeB =
                    b.lastMessageAt?.toMillis?.() ||
                    b.updatedAt?.toMillis?.() ||
                    0;
                  return timeB - timeA;
                });
                return merged;
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
      watchers.forEach((unsubscribe) => unsubscribe());
      watchers.clear();
      keysById.clear();
    };
  }, [uid, disabled, isConversationAllowed, enrollmentForKey, dropConversation]);

  useEffect(() => {
    if (!allowedKeys) {
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

export function getConversationPartner(conversation, currentUid) {
  return partnerFromConversation(conversation, currentUid);
}
