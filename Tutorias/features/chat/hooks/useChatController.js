import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthUser } from './useAuthUser';
import { useChatContacts } from './useChatContacts';
import { getConversationPartner, useUserConversations } from './useConversation';
import { useSelfPresence } from './usePresence';
import { useMaterialsInbox } from '../../materials/hooks/useMaterialsInbox';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../../tools/offline';
import { ensureConversationRecord } from '../api/conversations';
import { persistMessage } from '../utils/persistMessage';

const isStudentRole = (role) =>
  ['student', 'estudiante', 'alumno', 'alumna'].includes(String(role || '').trim().toLowerCase());

export function useChatController() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const [bootReady, setBootReady] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [startingContactId, setStartingContactId] = useState('');
  const selectionBootedRef = useRef(false);

  useSelfPresence(currentUser?.uid);

  useEffect(() => {
    let alive = true;
    ensureOfflineReady()
      .catch(() => {})
      .finally(() => {
        if (alive) setBootReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const contactsData = useChatContacts(currentUser);
  const conversationsData = useUserConversations(currentUser?.uid, {
    allowedKeys: contactsData.allowedKeys,
    metaByKey: contactsData.metaByKey,
  });
  const isStudent = isStudentRole(currentUser?.role);
  const materialsInbox = useMaterialsInbox(isStudent ? currentUser?.uid : null, {
    disabled: !isStudent,
  });

  useEffect(() => {
    if (!currentUser?.uid) {
      setPendingMessages({});
      setActiveConversationId(null);
      selectionBootedRef.current = false;
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (
      !activeConversationId &&
      conversationsData.items.length > 0 &&
      !selectionBootedRef.current
    ) {
      setActiveConversationId(conversationsData.items[0].id);
      selectionBootedRef.current = true;
    }
  }, [activeConversationId, conversationsData.items]);

  const activeConversation = useMemo(
    () => conversationsData.items.find((item) => item.id === activeConversationId) || null,
    [activeConversationId, conversationsData.items]
  );

  const activePartner = useMemo(
    () => getConversationPartner(activeConversation, currentUser?.uid),
    [activeConversation, currentUser?.uid]
  );

  const resolvePendingMessage = useCallback((conversationId, clientId) => {
    setPendingMessages((prev) => {
      const list = prev[conversationId] || [];
      const next = list.filter((item) => item.clientId !== clientId);
      if (!next.length) {
        const clone = { ...prev };
        delete clone[conversationId];
        return clone;
      }
      return { ...prev, [conversationId]: next };
    });
  }, []);

  const registerPendingMessage = useCallback((entry, payload) => {
    if (!payload?.conversationId || !payload?.clientId) return;
    setPendingMessages((prev) => ({
      ...prev,
      [payload.conversationId]: [
        ...(prev[payload.conversationId] || []),
        { ...payload, entryId: entry?.id, pending: true },
      ],
    }));
  }, []);

  const flushQueuedMessage = useCallback(
    async (payload) => {
      if (!payload) return;
      await persistMessage({
        conversationId: payload.conversationId,
        from: payload.from,
        to: payload.to,
        text: payload.text,
        senderName: payload.senderName || currentUser?.displayName,
        clientId: payload.clientId,
        localCreatedAt: payload.queuedAt,
      });
      resolvePendingMessage(payload.conversationId, payload.clientId);
    },
    [currentUser?.displayName, resolvePendingMessage]
  );

  const offlineSync = useOfflineSync(
    { 'chat:sendMessage': flushQueuedMessage },
    { isOffline: connectivity.isOffline }
  );

  const selectConversation = useCallback((conversationOrId) => {
    if (!conversationOrId) {
      setActiveConversationId(null);
      return;
    }
    const id = typeof conversationOrId === 'string' ? conversationOrId : conversationOrId?.id;
    if (!id) return;
    selectionBootedRef.current = true;
    setActiveConversationId(id);
  }, []);

  const startConversation = useCallback(
    async (contact) => {
      if (!contact?.uid || !currentUser?.uid) return null;
      setStartingContactId(contact.id || contact.uid);
      try {
        const ref = await ensureConversationRecord({
          myUser: currentUser,
          otherUser: contact,
          meta: contact.meta,
        });
        if (ref) {
          selectionBootedRef.current = true;
          setActiveConversationId(ref.id);
        }
        return ref;
      } finally {
        setStartingContactId('');
      }
    },
    [currentUser]
  );

  return {
    bootReady,
    currentUser,
    connectivity,
    contactsData,
    conversations: conversationsData.items,
    conversationsLoading: conversationsData.loading,
    conversationsFromCache: conversationsData.fromCache,
    activeConversationId,
    activeConversation,
    activePartner,
    pendingForActive: activeConversationId ? pendingMessages[activeConversationId] || [] : [],
    pendingMessages,
    materialsInbox,
    isStudent,
    startingContactId,
    offlineSync,
    selectConversation,
    startConversation,
    registerPendingMessage,
    resolvePendingMessage,
  };
}
