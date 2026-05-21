import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ensureConversationRecord } from '../../features/chat/api/conversations';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useChatContacts } from '../../features/chat/hooks/useChatContacts';
import { useUserConversations } from '../../features/chat/hooks/useConversation';
import { usePresence, useSelfPresence } from '../../features/chat/hooks/usePresence';
import { persistMessage } from '../../features/chat/utils/persistMessage';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../tools/offline';
import { useTopAlert } from '../../components/TopAlert';
import { EmptyState, LoadingState, WebBadge, WebButton, WebCard, WebShell, roleIsStudent, webTokens } from '../../components/web/WebUI';

export default function ChatsWebScreen() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const topAlert = useTopAlert();
  const [bootReady, setBootReady] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [startingContactId, setStartingContactId] = useState('');
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

  const contactsData = useChatContacts(currentUser);
  const { items: conversations, loading, fromCache } = useUserConversations(currentUser?.uid, {
    allowedKeys: contactsData.allowedKeys,
    metaByKey: contactsData.metaByKey,
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

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contactsData.contacts;
    return contactsData.contacts.filter((contact) => {
      const haystack = [
        contact.displayName,
        contact.relationship,
        contact.subjectName,
        ...(contact.contexts || []).map((context) => context.subjectName),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [contactSearch, contactsData.contacts]);

  const startConversation = async (contact) => {
    if (!contact?.uid || !currentUser) return;
    setStartingContactId(contact.id);
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
      setCreateModalVisible(false);
      setContactSearch('');
    } catch (error) {
      console.error('chat: failed to start conversation', error);
      topAlert.show('No se pudo iniciar la conversación.', 'error');
    } finally {
      setStartingContactId('');
    }
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
    <WebShell
      title="Chats"
      subtitle="Inicia conversaciones solo con docentes y compañeros conectados a tus matrículas confirmadas."
      active="/chats"
      actions={
        <>
          {connectivity.isOffline || fromCache || contactsData.fromCache ? <WebBadge tone="amber" icon="cloud-off">Modo sin conexión</WebBadge> : null}
          {isStudent && materialsInbox.newCount ? <WebBadge tone="amber" icon="notifications">{materialsInbox.newCount} materiales nuevos</WebBadge> : null}
          <WebButton label="Iniciar conversación" icon="add-comment" onPress={() => setCreateModalVisible(true)} />
        </>
      }
    >
      <ContactPickerModal
        visible={createModalVisible}
        contacts={filteredContacts}
        rawCount={contactsData.contacts.length}
        loading={contactsData.loading}
        search={contactSearch}
        startingContactId={startingContactId}
        onSearch={setContactSearch}
        onClose={() => setCreateModalVisible(false)}
        onStart={startConversation}
      />

      <WebCard style={styles.chatFrame}>
        <View style={styles.sidebarPane}>
          <ChatSidebar
            currentUid={currentUser.uid}
            conversations={conversations}
            loadingConversations={loading}
            fromCache={fromCache}
            onSelectConversation={(conversation) => setActiveConversationId(conversation.id)}
            activeConversationId={activeConversationId}
            loadingEnrollments={contactsData.loading}
            onCreateConversation={() => setCreateModalVisible(true)}
            bottomOffset={0}
            showCreateButton
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
            <EmptyState
              icon="forum"
              title="Selecciona o inicia una conversación"
              text="Usa el botón de iniciar conversación para ver docentes y compañeros disponibles."
            />
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
  );
}

function ContactPickerModal({
  visible,
  contacts,
  rawCount,
  loading,
  search,
  startingContactId,
  onSearch,
  onClose,
  onStart,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <WebCard style={styles.modalCard} animated={false}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Iniciar conversación</Text>
              <Text style={styles.modalText}>Docentes y compañeros aparecen según tus matrículas confirmadas.</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose} accessibilityRole="button">
              <MaterialIcons name="close" size={22} color={webTokens.color.brand} />
            </Pressable>
          </View>

          <TextInput
            placeholder="Buscar por nombre, materia o relación"
            placeholderTextColor={webTokens.color.muted}
            value={search}
            onChangeText={onSearch}
            style={styles.modalInput}
          />

          {loading ? (
            <View style={styles.contactLoading}>
              <ActivityIndicator color={webTokens.color.brand} />
              <Text style={styles.modalText}>Cargando usuarios disponibles...</Text>
            </View>
          ) : rawCount === 0 ? (
            <EmptyState
              icon="groups"
              title="Aún no hay usuarios disponibles"
              text="Cuando tengas matrículas confirmadas, aquí verás al docente y a tus compañeros de materia."
            />
          ) : contacts.length === 0 ? (
            <EmptyState icon="search-off" title="Sin resultados" text="Prueba con otro nombre o materia." />
          ) : (
            <ScrollView contentContainerStyle={styles.contactList}>
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.uid}
                  contact={contact}
                  loading={startingContactId === contact.id}
                  onStart={() => onStart(contact)}
                />
              ))}
            </ScrollView>
          )}
        </WebCard>
      </View>
    </Modal>
  );
}

function ContactRow({ contact, loading, onStart }) {
  const initial = (contact.displayName || '?')[0].toUpperCase();
  const subjects = (contact.contexts || [])
    .map((context) => context.subjectName)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(', ');

  return (
    <View style={styles.contactRow}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>{initial}</Text>
      </View>
      <View style={styles.contactBody}>
        <View style={styles.contactTop}>
          <Text style={styles.contactName}>{contact.displayName || 'Sin nombre'}</Text>
          <WebBadge tone={contact.relationship.includes('Docente') ? 'blue' : 'green'}>
            {contact.relationship}
          </WebBadge>
        </View>
        <Text style={styles.contactMeta}>{subjects || contact.subjectName || 'Materia confirmada'}</Text>
      </View>
      <WebButton label="Iniciar" icon="chat" small loading={loading} onPress={onStart} />
    </View>
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
    backgroundColor: webTokens.color.surfaceAlt,
  },
  threadPane: {
    flex: 1,
    backgroundColor: webTokens.color.elevated,
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
    backgroundColor: webTokens.color.chip,
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
    backgroundColor: 'rgba(124,167,255,.12)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: webTokens.color.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    maxWidth: 760,
    width: '100%',
    maxHeight: '86vh',
    alignSelf: 'center',
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalTitle: {
    color: webTokens.color.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  modalText: {
    color: webTokens.color.muted,
    marginTop: 4,
    lineHeight: 21,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    backgroundColor: webTokens.color.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: webTokens.color.line,
    backgroundColor: webTokens.color.input,
    borderRadius: 14,
    padding: 13,
    color: webTokens.color.ink,
    outlineStyle: 'none',
  },
  contactLoading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  contactList: {
    gap: 10,
    paddingBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 18,
    backgroundColor: webTokens.color.surfaceAlt,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webTokens.color.chip,
  },
  contactInitial: {
    color: webTokens.color.brand,
    fontWeight: '900',
    fontSize: 18,
  },
  contactBody: {
    flex: 1,
    minWidth: 0,
  },
  contactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  contactName: {
    color: webTokens.color.ink,
    fontWeight: '900',
    fontSize: 16,
    flex: 1,
  },
  contactMeta: {
    color: webTokens.color.muted,
    marginTop: 4,
  },
});
