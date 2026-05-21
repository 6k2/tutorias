import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useChatController } from '../../features/chat/hooks/useChatController';
import { EmptyState, LoadingState, WebBadge, WebButton, WebCard, WebShell, webTokens } from '../../components/web/WebUI';
import { initialForProfile, stableColorForUid } from '../../features/chat/utils/profiles';
import { useTopAlert } from '../../components/TopAlert';

export default function ChatsWebScreen() {
  const chat = useChatController();
  const topAlert = useTopAlert();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

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
      topAlert.show('No se pudo iniciar la conversacion.', 'error');
    }
  };

  if (!chat.bootReady || chat.currentUser === undefined) {
    return <WebShell title="Chats" active="/chats"><LoadingState label="Preparando conversaciones..." /></WebShell>;
  }

  if (!chat.currentUser) {
    return (
      <WebShell title="Chats" subtitle="Inicia sesion para conversar con docentes y estudiantes." active="/chats">
        <EmptyState icon="lock" title="Necesitas iniciar sesion" text="Los chats se activan cuando entras a tu cuenta." />
      </WebShell>
    );
  }

  return (
    <WebShell
      title="Chats"
      subtitle="Conversaciones de tus matriculas confirmadas, con mensajes en tiempo real."
      active="/chats"
      actions={
        <>
          {chat.isStudent && chat.materialsInbox.newCount ? (
            <WebBadge tone="amber" icon="notifications">{chat.materialsInbox.newCount} materiales nuevos</WebBadge>
          ) : null}
          <WebButton label="Iniciar conversacion" icon="add-comment" onPress={() => setCreateModalVisible(true)} />
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
          {!chat.activeConversation && !chat.conversationsLoading ? (
            <EmptyState
              icon="forum"
              title="Selecciona o inicia una conversacion"
              text="Tus docentes y companeros disponibles aparecen segun tus matriculas confirmadas."
            />
          ) : (
            <ChatThread
              conversation={chat.activeConversation}
              currentUser={chat.currentUser}
              partner={chat.activePartner}
              pendingMessages={chat.pendingForActive}
              onQueueMessage={chat.registerPendingMessage}
              bottomInset={0}
              showHeader
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
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>Iniciar conversacion</Text>
              <Text style={styles.modalText}>Docentes y companeros aparecen segun tus matriculas confirmadas.</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onClose} accessibilityRole="button">
              <MaterialIcons name="close" size={22} color={webTokens.color.brand} />
            </Pressable>
          </View>

          <View style={styles.modalSearch}>
            <MaterialIcons name="search" size={18} color={webTokens.color.muted} />
            <TextInput
              placeholder="Buscar por nombre, materia o relacion"
              placeholderTextColor={webTokens.color.muted}
              value={search}
              onChangeText={onSearch}
              style={styles.modalInput}
            />
          </View>

          {loading ? (
            <View style={styles.contactLoading}>
              <ActivityIndicator color={webTokens.color.brand} />
              <Text style={styles.modalText}>Cargando usuarios disponibles...</Text>
            </View>
          ) : rawCount === 0 ? (
            <EmptyState
              icon="groups"
              title="Aun no hay usuarios disponibles"
              text="Cuando tengas matriculas confirmadas, aqui veras al docente y a tus companeros."
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
    <Pressable style={({ hovered }) => [styles.contactRow, hovered && styles.contactRowHover]} onPress={onStart} disabled={loading} accessibilityRole="button">
      <View style={[styles.contactAvatar, { backgroundColor: contact.avatarColor || stableColorForUid(contact.uid) }]}>
        <Text style={styles.contactInitial}>{initialForProfile(contact)}</Text>
      </View>
      <View style={styles.contactBody}>
        <View style={styles.contactTop}>
          <Text style={styles.contactName} numberOfLines={1}>{contact.displayName || 'Contacto'}</Text>
          <WebBadge tone={contact.relationship?.includes('Docente') ? 'blue' : 'green'}>
            {contact.relationship || 'Contacto'}
          </WebBadge>
        </View>
        <Text style={styles.contactMeta} numberOfLines={1}>{subjects || contact.subjectName || 'Materia confirmada'}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={webTokens.color.brand} />
      ) : (
        <View style={styles.contactAction}>
          <MaterialIcons name="chevron-right" size={22} color={webTokens.color.brand} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chatFrame: {
    padding: 0,
    overflow: 'hidden',
    height: 'calc(100vh - 182px)',
    minHeight: 620,
    flexDirection: 'row',
    borderRadius: 16,
  },
  sidebarPane: {
    width: 392,
    borderRightWidth: 1,
    borderRightColor: webTokens.color.line,
    backgroundColor: webTokens.color.surface,
  },
  threadPane: {
    flex: 1,
    backgroundColor: webTokens.color.elevated,
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
  modalTitleWrap: {
    flex: 1,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    backgroundColor: webTokens.color.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearch: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    backgroundColor: webTokens.color.input,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
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
    borderRadius: 14,
    backgroundColor: webTokens.color.surface,
  },
  contactRowHover: {
    backgroundColor: webTokens.color.surfaceAlt,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
    fontWeight: '700',
  },
  contactAction: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: webTokens.color.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
