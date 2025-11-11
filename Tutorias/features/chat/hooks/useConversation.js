import { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../app/config/firebase';

export function useConversation(myUser, otherUser) {
  const myUid = myUser?.uid;
  const otherUid = otherUser?.uid;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const participantsRef = useRef([]);

  useEffect(() => {
    if (!myUid || !otherUid) {
      setConversation(null);
      return undefined;
    }

    const sorted = [myUid, otherUid].sort();
    const conversationKey = sorted.join('_');
    setLoading(true);
    let unsubscribeConversation = () => {};

    async function ensureConversation() {
      const conversationsCol = collection(db, 'conversations');
      const existingQuery = query(
        conversationsCol,
        where('conversationKey', '==', conversationKey),
        limit(1)
      );
      const existingSnapshot = await getDocs(existingQuery);

      let conversationRef;
      if (existingSnapshot.empty) {
        conversationRef = await addDoc(conversationsCol, {
          conversationKey,
          participantUids: sorted,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null,
          lastMessageAt: null,
          unreadBy: [],
        });
      } else {
        conversationRef = existingSnapshot.docs[0].ref;
        const data = existingSnapshot.docs[0].data();
        if (!data.participantUids) {
          await updateDoc(conversationRef, { participantUids: sorted });
        }
      }

      const participantsCollection = collection(conversationRef, 'participants');
      const safeMyProfile = {
        uid: myUid,
        displayName: myUser?.displayName || 'Sin nombre',
        photoURL: myUser?.photoURL || null,
        conversationId: conversationRef.id,
      };
      const safeOtherProfile = {
        uid: otherUid,
        displayName: otherUser?.displayName || 'Sin nombre',
        photoURL: otherUser?.photoURL || null,
        conversationId: conversationRef.id,
      };
      await Promise.all([
        setDoc(doc(participantsCollection, myUid), safeMyProfile, { merge: true }),
        setDoc(doc(participantsCollection, otherUid), safeOtherProfile, { merge: true }),
      ]);

      const participantsSnapshot = await getDocs(participantsCollection);
      participantsRef.current = participantsSnapshot.docs.map((participantDoc) => ({
        id: participantDoc.id,
        ...participantDoc.data(),
      }));

      unsubscribeConversation = onSnapshot(conversationRef, (conversationDoc) => {
        if (!conversationDoc.exists()) {
          setConversation(null);
          return;
        }
        setConversation({
          id: conversationDoc.id,
          ...conversationDoc.data(),
          participants: participantsRef.current,
        });
      });
    }

    ensureConversation()
      .catch((error) => {
        console.error('No se pudo preparar la conversación', error);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubscribeConversation();
    };
  }, [myUid, otherUid, myUser?.displayName, myUser?.photoURL, otherUser?.displayName, otherUser?.photoURL]);

  return { conversation, loading, participants: conversation?.participants || [] };
}

export function useUserConversations(uid) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return undefined;
    }

    const participantsQuery = query(
      collectionGroup(db, 'participants'),
      where('uid', '==', uid)
    );

    const conversationWatchers = new Map();

    const unsubscribeParticipants = onSnapshot(participantsQuery, (snapshot) => {
      const nextConversationIds = new Set();
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (data?.conversationId) {
          nextConversationIds.add(data.conversationId);
        }
      });

      conversationWatchers.forEach((unsubscribe, conversationId) => {
        if (!nextConversationIds.has(conversationId)) {
          unsubscribe();
          conversationWatchers.delete(conversationId);
          setItems((prev) => prev.filter((item) => item.id !== conversationId));
        }
      });

      nextConversationIds.forEach((conversationId) => {
        if (conversationWatchers.has(conversationId)) {
          return;
        }

        const conversationRef = doc(db, 'conversations', conversationId);
        const unsubscribeConversation = onSnapshot(conversationRef, async (conversationDoc) => {
          if (!conversationDoc.exists()) {
            setItems((prev) => prev.filter((item) => item.id !== conversationId));
            return;
          }

          const participantsSnapshot = await getDocs(collection(conversationRef, 'participants'));
          const participants = participantsSnapshot.docs.map((participantDoc) => ({
            id: participantDoc.id,
            ...participantDoc.data(),
          }));

          setItems((prev) => {
            const filtered = prev.filter((item) => item.id !== conversationId);
            const nextItem = {
              id: conversationDoc.id,
              ...conversationDoc.data(),
              participants,
            };
            return [...filtered, nextItem].sort((a, b) => {
              const aTime = a.lastMessageAt?.toMillis?.() || 0;
              const bTime = b.lastMessageAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
          });
        });

        conversationWatchers.set(conversationId, unsubscribeConversation);
      });
    });

    return () => {
      unsubscribeParticipants();
      conversationWatchers.forEach((unsubscribe) => unsubscribe());
      conversationWatchers.clear();
    };
  }, [uid]);

  return items;
}
