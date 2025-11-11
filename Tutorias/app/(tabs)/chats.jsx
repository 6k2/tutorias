import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ChatLayout } from '../../features/chat/ChatLayout';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useSelfPresence } from '../../features/chat/hooks/usePresence';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useChatEnrollments } from '../../features/chat/hooks/useChatEnrollments';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../tools/offline';
import { persistMessage } from '../../features/chat/utils/persistMessage';

export default function ChatsScreen() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [bootReady, setBootReady] = useState(false);

  useSelfPresence(currentUser?.uid);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

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

  const enrollments = useChatEnrollments(currentUser?.uid, currentUser?.role);

  useEffect(() => {
    if (!currentUser?.uid) {
      setPendingMessages({});
    }
  }, [currentUser?.uid]);

  const registerPendingMessage = useCallback((entry, payload) => {
    if (!payload?.conversationId || !payload?.clientId) return;
    setPendingMessages((prev) => {
      const prevList = prev[payload.conversationId] || [];
      return {
        ...prev,
        [payload.conversationId]: [...prevList, { ...payload, entryId: entry?.id }],
      };
    });
  }, []);

  const resolvePendingMessage = useCallback((conversationId, clientId) => {
    if (!conversationId || !clientId) return;
    setPendingMessages((prev) => {
      const pending = prev[conversationId];
      if (!pending || pending.length === 0) return prev;
      const nextList = pending.filter((item) => item.clientId !== clientId);
      if (nextList.length === 0) {
        const clone = { ...prev };
        delete clone[conversationId];
        return clone;
      }
      return { ...prev, [conversationId]: nextList };
    });
  }, []);

  const flushQueuedMessage = useCallback(
    async (payload) => {
      if (!payload) return;
      await persistMessage({
        conversationId: payload.conversationId,
        from: payload.from,
        to: payload.to,
        text: payload.text,
        senderName: payload.senderName || currentUser?.displayName || 'Sin nombre',
      });
      resolvePendingMessage(payload.conversationId, payload.clientId);
    },
    [resolvePendingMessage, currentUser?.displayName]
  );

  useOfflineSync(
    { 'chat:sendMessage': flushQueuedMessage },
    { isOffline: connectivity.isOffline }
  );

  const threadProps = useMemo(() => {
    if (!selectedConversation) return { conversation: null, partner: null };
    if (selectedPartner) {
      return { conversation: selectedConversation, partner: selectedPartner };
    }
    const partner = selectedConversation.participants?.find(
      (participant) => participant.uid !== currentUser?.uid
    );
    return { conversation: selectedConversation, partner: partner || null };
  }, [selectedConversation, selectedPartner, currentUser?.uid]);

  const handleSelectConversation = useCallback((conversation, partner) => {
    setSelectedConversation(conversation);
    setSelectedPartner(partner || null);
  }, []);

  if (!bootReady || currentUser === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tintColor} />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.infoText, { color: textColor }]}>Inicia sesion para usar los chats.</Text>
      </View>
    );
  }

  const pendingForActive = selectedConversation?.id
    ? pendingMessages[selectedConversation.id] || []
    : [];

  return (
    <ChatLayout
      sidebar={
        <ChatSidebar
          currentUid={currentUser.uid}
          onSelectConversation={handleSelectConversation}
          activeConversationId={selectedConversation?.id || null}
          allowedKeys={enrollments.allowedKeys}
          metaByKey={enrollments.metaByKey}
          loadingEnrollments={enrollments.loading}
        />
      }
      thread={
        <ChatThread
          conversation={threadProps.conversation}
          currentUser={currentUser}
          partner={threadProps.partner}
          pendingMessages={pendingForActive}
          onQueueMessage={registerPendingMessage}
        />
      }
      isThreadOpen={Boolean(selectedConversation)}
      onBack={() => {
        setSelectedConversation(null);
        setSelectedPartner(null);
      }}
      offline={connectivity.isOffline}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
