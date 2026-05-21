import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatLayout } from '../../features/chat/ChatLayout';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useChatController } from '../../features/chat/hooks/useChatController';
import { initialForProfile, stableColorForUid } from '../../features/chat/utils/profiles';
import { useThemeColor } from '../../hooks/useThemeColor';

const TAB_BAR_OVERLAY = 110;

export default function ChatsScreen() {
  const chat = useChatController();
  const insets = useSafeAreaInsets();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const bottomOffset = (insets.bottom ?? 0) + TAB_BAR_OVERLAY;

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
      console.error('failed create conversation', error);
    }
  };

  if (!chat.bootReady || chat.currentUser === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <ActivityIndicator color={tintColor} />
      </View>
    );
  }

  if (!chat.currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: background }]}>
        <Text style={[styles.infoText, { color: textColor }]}>Inicia sesion para usar los chats.</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: background,
          paddingBottom: bottomOffset,
          paddingTop: insets.top ?? 0,
        },
      ]}
    >
      <ContactPickerModal
        visible={createModalVisible}
        contacts={filteredContacts}
        loading={chat.contactsData.loading}
        search={contactSearch}
        startingContactId={chat.startingContactId}
        textColor={textColor}
        tintColor={tintColor}
        borderColor={borderColor}
        background={background}
        onSearch={setContactSearch}
        onClose={() => setCreateModalVisible(false)}
        onStart={startConversation}
      />

      {chat.isStudent && chat.materialsInbox.newCount > 0 ? (
        <View style={styles.materialsBanner}>
          <MaterialIcons name="cloud-download" size={18} color="#1B1E36" />
          <Text style={styles.materialsBannerText}>
            {chat.materialsInbox.newCount === 1
              ? 'Nuevo material de estudio'
              : `${chat.materialsInbox.newCount} materiales nuevos`}
          </Text>
        </View>
      ) : null}

      <ChatLayout
        sidebar={
          <ChatSidebar
            currentUid={chat.currentUser.uid}
            conversations={chat.conversations}
            loadingConversations={chat.conversationsLoading}
            fromCache={chat.conversationsFromCache}
            onSelectConversation={chat.selectConversation}
            activeConversationId={chat.activeConversationId}
            loadingEnrollments={chat.contactsData.loading}
            onCreateConversation={() => setCreateModalVisible(true)}
            bottomOffset={bottomOffset}
          />
        }
        thread={
          <ChatThread
            conversation={chat.activeConversation}
            currentUser={chat.currentUser}
            partner={chat.activePartner}
            pendingMessages={chat.pendingForActive}
            onQueueMessage={chat.registerPendingMessage}
            bottomInset={bottomOffset}
          />
        }
        isThreadOpen={Boolean(chat.activeConversation)}
        onBack={() => chat.selectConversation(null)}
        offline={chat.connectivity.isOffline}
      />
    </View>
  );
}

function ContactPickerModal({
  visible,
  contacts,
  loading,
  search,
  startingContactId,
  textColor,
  tintColor,
  borderColor,
  background,
  onSearch,
  onClose,
  onStart,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: background, borderColor: `${borderColor}55` }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Iniciar conversacion</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={22} color={tintColor} />
            </Pressable>
          </View>
          <TextInput
            placeholder="Buscar por nombre, materia o relacion"
            placeholderTextColor={`${borderColor}aa`}
            value={search}
            onChangeText={onSearch}
            style={[styles.searchInput, { color: textColor, borderColor: `${borderColor}55` }]}
          />
          {loading ? (
            <ActivityIndicator color={tintColor} style={{ margin: 20 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.contactList}>
              {contacts.map((contact) => (
                <Pressable
                  key={contact.uid}
                  style={[styles.contactRow, { borderColor: `${borderColor}33` }]}
                  onPress={() => onStart(contact)}
                  disabled={startingContactId === contact.id}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: contact.avatarColor || stableColorForUid(contact.uid) }]}>
                    <Text style={styles.contactInitial}>{initialForProfile(contact)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactName, { color: textColor }]}>{contact.displayName || 'Contacto'}</Text>
                    <Text style={[styles.contactMeta, { color: `${borderColor}cc` }]}>
                      {contact.relationship} · {contact.subjectName || 'Materia confirmada'}
                    </Text>
                  </View>
                  {startingContactId === contact.id ? (
                    <ActivityIndicator color={tintColor} />
                  ) : (
                    <MaterialIcons name="chevron-right" size={22} color={tintColor} />
                  )}
                </Pressable>
              ))}
              {!contacts.length ? (
                <Text style={[styles.emptyContacts, { color: `${borderColor}cc` }]}>
                  No hay contactos disponibles.
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
  },
  materialsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFD580',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  materialsBannerText: {
    color: '#1B1E36',
    fontWeight: '700',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  modalCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  contactList: {
    gap: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  contactName: {
    fontWeight: '900',
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  emptyContacts: {
    textAlign: 'center',
    padding: 18,
  },
});
