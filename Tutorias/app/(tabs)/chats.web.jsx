import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { ensureConversationRecord } from '../../features/chat/api/conversations';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useChatEnrollments } from '../../features/chat/hooks/useChatEnrollments';
import { useUserConversations } from '../../features/chat/hooks/useConversation';
import { usePresence, useSelfPresence } from '../../features/chat/hooks/usePresence';
import { persistMessage } from '../../features/chat/utils/persistMessage';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { ThemeOverrideProvider } from '../../hooks/useThemeOverride';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../tools/offline';
import { EmptyState, LoadingState, WebBadge, WebButton, WebCard, WebShell, roleIsStudent, webTokens } from '../../components/web/WebUI';

export default function ChatsWebScreen() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const [bootReady, setBootReady] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createUid, setCreateUid] = useState('');
  const [createName, setCreateName] = useState('');
  const selectionBootedRef = useRef(false);

  useSelfPresence(currentUser?.uid);

  useEffect(() => {
    let alive = true;
    ensureOfflineReady().finally(() => {
      if (alive) setBootReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const enrollments = useChatEnrollments(currentUser);
  const { items: conversations, loading, fromCache } = useUserConversations(currentUser?.uid, {
    allowedKeys: enrollments.allowedKeys,
    metaByKey: enrollments.metaByKey,
  });
  const isStudent = roleIsStudent(currentUser?.role);
  const materialsInbox = useMaterialsInbox(isStudent ? currentUser?.uid : null, { disabled: !isStudent });

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0 && !selectionBootedRef.current) {
      setActiveConversationId(conversations[0].id);
      selectionBootedRef.current = true;
    }
  }, [activeConversationId, conversations]);

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
      [payload.conversationId]: [...(prev[payload.conversationId] || []), { ...payload, entryId: entry?.id }],
    }));
  }, []);

  const flushQueuedMessage = useCallback(async (payload) => {
    if (!payload) return;
    await persistMessage({
      conversationId: payload.conversationId,
      from: payload.from,
      to: payload.to,
      text: payload.text,
      senderName: payload.senderName || currentUser?.displayName || 'Sin nombre',
    });
    resolvePendingMessage(payload.conversationId, payload.clientId);
  }, [currentUser?.displayName, resolvePendingMessage]);

  useOfflineSync({ 'chat:sendMessage': flushQueuedMessage }, { isOffline: connectivity.isOffline });

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const activePartner = useMemo(() => {
    if (!activeConversation) return null;
    const currentUid = currentUser?.uid;
    const participants = Array.isArray(activeConversation.participants) ? activeConversation.participants : [];
    const match = participants.find((participant) => participant?.uid && participant.uid !== currentUid);
    if (match) return match;
    const meta = activeConversation.enrollmentMeta || {};
    const uid = meta.studentId === currentUid ? meta.teacherId : meta.studentId;
    return uid ? {
      uid,
      displayName: meta.studentId === uid ? meta.studentDisplayName : meta.teacherDisplayName,
      subjectName: meta.subjectName,
    } : null;
  }, [activeConversation, currentUser?.uid]);

  const partnerPresence = usePresence(activePartner?.uid);
  const pendingForActive = activeConversationId ? pendingMessages[activeConversationId] || [] : [];

  const createConversation = async () => {
    if (!createUid || !currentUser) return;
    const ref = await ensureConversationRecord({
      myUser: currentUser,
      otherUser: { uid: createUid, displayName: createName || 'Sin nombre' },
      meta: null,
    });
    if (ref) setActiveConversationId(ref.id);
    setCreateModalVisible(false);
    setCreateUid('');
    setCreateName('');
  };

  if (!bootReady || currentUser === undefined) {
    return <WebShell title="Chats" active="/chats"><LoadingState label="Preparando conversaciones..." /></WebShell>;
  }

  if (!currentUser) {
    return (
      <WebShell title="Chats" subtitle="Inicia sesión para conversar con docentes y estudiantes." active="/chats">
        <EmptyState icon="lock" title="Necesitas iniciar sesión" text="Los chats se activan cuando entras a tu cuenta." />
      </WebShell>
    );
  }

  return (
    <ThemeOverrideProvider value="light">
      <WebShell
        title="Chats"
        subtitle="Conversaciones con contexto de reserva, presencia y materiales nuevos."
        active="/chats"
        actions={
          <>
            {connectivity.isOffline || fromCache ? <WebBadge tone="amber" icon="cloud-off">Modo sin conexión</WebBadge> : null}
            {isStudent && materialsInbox.newCount ? <WebBadge tone="amber" icon="notifications">{materialsInbox.newCount} materiales nuevos</WebBadge> : null}
            <WebButton label="Nuevo chat" icon="add-comment" onPress={() => setCreateModalVisible(true)} />
          </>
        }
      >
        <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <WebCard style={styles.modalCard} animated={false}>
              <Text style={styles.modalTitle}>Crear conversación</Text>
              <TextInput placeholder="UID del destinatario" placeholderTextColor="#98A2B3" value={createUid} onChangeText={setCreateUid} style={styles.modalInput} />
              <TextInput placeholder="Nombre (opcional)" placeholderTextColor="#98A2B3" value={createName} onChangeText={setCreateName} style={styles.modalInput} />
              <View style={styles.modalActions}>
                <WebButton label="Cancelar" icon="close" variant="secondary" onPress={() => setCreateModalVisible(false)} />
                <WebButton label="Crear" icon="check" onPress={createConversation} />
              </View>
            </WebCard>
          </View>
        </Modal>

        <WebCard style={styles.chatFrame}>
          <View style={styles.sidebarPane}>
            <ChatSidebar
              currentUid={currentUser.uid}
              conversations={conversations}
              loadingConversations={loading}
              fromCache={fromCache}
              onSelectConversation={(conversation) => setActiveConversationId(conversation.id)}
              activeConversationId={activeConversationId}
              loadingEnrollments={enrollments.loading}
              onCreateConversation={() => setCreateModalVisible(true)}
              bottomOffset={0}
              showCreateButton={false}
            />
          </View>
          <View style={styles.threadPane}>
            {activePartner ? (
              <View style={styles.threadHeader}>
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerInitial}>{(activePartner.displayName || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerName}>{activePartner.displayName || 'Sin nombre'}</Text>
                  <Text style={styles.partnerMeta}>
                    {partnerPresence.online ? 'En línea ahora' : 'Fuera de línea'}{activePartner.subjectName ? ` · ${activePartner.subjectName}` : ''}
                  </Text>
                </View>
                <MaterialIcons name="more-horiz" size={24} color={webTokens.color.brand} />
              </View>
            ) : null}
            {!activeConversation && !loading ? (
              <EmptyState icon="forum" title="Selecciona una conversación" text="Elige un chat de la bandeja para continuar." />
            ) : (
              <ChatThread
                conversation={activeConversation}
                currentUser={currentUser}
                partner={activePartner}
                pendingMessages={pendingForActive}
                onQueueMessage={registerPendingMessage}
                bottomInset={0}
                showHeader={false}
              />
            )}
            {loading ? (
              <View style={styles.overlayLoading}><ActivityIndicator color={webTokens.color.brand} /></View>
            ) : null}
          </View>
        </WebCard>
      </WebShell>
    </ThemeOverrideProvider>
  );
}

const styles = StyleSheet.create({
  chatFrame: {
    padding: 0,
    overflow: 'hidden',
    height: 'calc(100vh - 190px)',
    minHeight: 620,
    flexDirection: 'row',
  },
  sidebarPane: {
    width: 380,
    borderRightWidth: 1,
    borderRightColor: webTokens.color.line,
    backgroundColor: '#F8FAFF',
  },
  threadPane: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  threadHeader: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: webTokens.color.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
  },
  partnerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  partnerInitial: {
    color: webTokens.color.brand,
    fontWeight: '900',
    fontSize: 18,
  },
  partnerName: {
    color: webTokens.color.ink,
    fontWeight: '900',
    fontSize: 17,
  },
  partnerMeta: {
    color: webTokens.color.muted,
    marginTop: 2,
  },
  overlayLoading: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.45)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  },
  modalTitle: {
    color: webTokens.color.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 14,
    padding: 13,
    color: webTokens.color.ink,
    outlineStyle: 'none',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
