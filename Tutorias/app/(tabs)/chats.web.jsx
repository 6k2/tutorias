import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useChatController } from '../../features/chat/hooks/useChatController';
import { usePresence } from '../../features/chat/hooks/usePresence';
import { EmptyState, LoadingState, WebBadge, WebButton, WebCard, WebShell, webTokens } from '../../components/web/WebUI';
import { initialForProfile, stableColorForUid } from '../../features/chat/utils/profiles';
import { useTopAlert } from '../../components/TopAlert';

export default function ChatsWebScreen() {
  const chat = useChatController();
  const topAlert = useTopAlert();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const partnerPresence = usePresence(chat.activePartner?.uid);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return chat.contactsData.contacts;
    return chat.contactsData.contacts.filter((contact) => {
      const haystack = [
        contact.displayName,
        contact.relationship,
        contact.subjectName,
        ...(contact.contexts || []).map((context) => context.subjectName),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contactSearch, chat.contactsData.contacts]);

  const startConversation = async (contact) => {
    try {
      await chat.startConversation(contact);
      setCreateModalVisible(false);
      setContactSearch('');
    } catch (error) {
      console.error('chat: failed to start conversation', error);
      topAlert.show('No se pudo iniciar la conversación.', 'error');
    }
  };

  if (!chat.bootReady || chat.currentUser === undefined) {
    return <WebShell title="Chats" active="/chats"><LoadingState label="Preparando conversaciones..." /></WebShell>;
  }

  if (!chat.currentUser) {
    return (
      <WebShell title="Chats" subtitle="Inicia sesión para conversar con docentes y estudiantes." active="/chats">
        <EmptyState icon="lock" title="Necesitas iniciar sesión" text="Los chats se activan cuando entras a tu cuenta." />
      </WebShell>
    );
  }

  return (
    <WebShell
      title="Chats"
      subtitle="Conversaciones de tus matrículas confirmadas, con mensajes en tiempo real."
      active="/chats"
      actions={
        <>
          {chat.connectivity.isOffline || chat.conversationsFromCache || chat.contactsData.fromCache ? (
            <WebBadge tone="amber" icon="cloud-off">Modo sin conexión</WebBadge>
          ) : null}
          {chat.isStudent && chat.materialsInbox.newCount ? (
            <WebBadge tone="amber" icon="notifications">{chat.materialsInbox.newCount} materiales nuevos</WebBadge>
          ) : null}
          <WebButton label="Iniciar conversación" icon="add-comment" onPress={() => setCreateModalVisible(true)} />
        </>
      }
    >
      <ContactPickerModal
        visible={createModalVisible}
        contacts={filteredContacts}
        rawCount={chat.contactsData.contacts.length}
        loading={chat.contactsData.loading}
        search={contactSearch}
        startingContactId={chat.startingContactId}
        onSearch={setContactSearch}
        onClose={() => setCreateModalVisible(false)}
        onStart={startConversation}
      />

      <WebCard style={styles.chatFrame}>
        <View style={styles.sidebarPane}>
          <ChatSidebar
            currentUid={chat.currentUser.uid}
            conversations={chat.conversations}
            loadingConversations={chat.conversationsLoading}
            fromCache={chat.conversationsFromCache}
            onSelectConversation={chat.selectConversation}
            activeConversationId={chat.activeConversationId}
            loadingEnrollments={chat.contactsData.loading}
            onCreateConversation={() => setCreateModalVisible(true)}
            bottomOffset={0}
            showCreateButton
          />
        </View>
        <View style={styles.threadPane}>
          {chat.activePartner ? (
            <View style={styles.threadHeader}>
              <View style={[styles.partnerAvatar, { backgroundColor: chat.activePartner.avatarColor || stableColorForUid(chat.activePartner.uid) }]}>
                <Text style={styles.partnerInitial}>{initialForProfile(chat.activePartner)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName}>{chat.activePartner.displayName || 'Contacto'}</Text>
                <Text style={styles.partnerMeta}>
                  {partnerPresence.online ? 'En línea ahora' : 'Fuera de línea'}
                  {chat.activePartner.subjectName ? ` · ${chat.activePartner.subjectName}` : ''}
                  {chat.activePartner.relationship ? ` · ${chat.activePartner.relationship}` : ''}
                </Text>
              </View>
              <MaterialIcons name="more-horiz" size={24} color={webTokens.color.brand} />
            </View>
          ) : null}
          {!chat.activeConversation && !chat.conversationsLoading ? (
            <EmptyState
              icon="forum"
              title="Selecciona o inicia una conversación"
              text="Tus docentes y compañeros disponibles aparecen según tus matrículas confirmadas."
            />
          ) : (
            <ChatThread
              conversation={chat.activeConversation}
              currentUser={chat.currentUser}
              partner={chat.activePartner}
              pendingMessages={chat.pendingForActive}
              onQueueMessage={chat.registerPendingMessage}
              bottomInset={0}
              showHeader={false}
            />
          )}
          {chat.conversationsLoading ? (
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
              text="Cuando tengas matrículas confirmadas, aquí verás al docente y a tus compañeros."
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
  const subjects = (contact.contexts || [])
    .map((context) => context.subjectName)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(', ');

  return (
    <View style={styles.contactRow}>
      <View style={[styles.contactAvatar, { backgroundColor: contact.avatarColor || stableColorForUid(contact.uid) }]}>
        <Text style={styles.contactInitial}>{initialForProfile(contact)}</Text>
      </View>
      <View style={styles.contactBody}>
        <View style={styles.contactTop}>
          <Text style={styles.contactName}>{contact.displayName || 'Contacto'}</Text>
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
  },
  partnerInitial: {
    color: '#fff',
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
  },
  contactInitial: {
    color: '#fff',
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
