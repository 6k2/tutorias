import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Image } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePresence } from './hooks/usePresence';

export function ChatSidebar({
  currentUid,
  conversations = [],
  loadingConversations = false,
  fromCache = false,
  onSelectConversation,
  activeConversationId,
  loadingEnrollments,
  onCreateConversation,
  bottomOffset = 0,
  showCreateButton = true,
}) {
  const [search, setSearch] = useState('');

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  const surface = useThemeColor({ light: '#f4f5fb', dark: '#1e1f2b' }, 'background');
  const muted = `${borderColor}aa`;

  const filteredItems = useMemo(() => {
    const queryLower = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (!queryLower) return true;
      const partner = conversation.participants?.find((item) => item.uid !== currentUid);
      const name = partner?.displayName || 'Sin nombre';
      return name.toLowerCase().includes(queryLower);
    });
  }, [conversations, search, currentUid]);

  const emptyCopy = loadingConversations
    ? 'Cargando tus conversaciones...'
    : loadingEnrollments
    ? 'Verificando matriculas...'
    : 'No hay conversaciones disponibles.';

  const safeBottomOffset = Math.max(0, bottomOffset);
  const scrollPaddingBottom = safeBottomOffset + 32;

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <View style={[styles.searchContainer, { borderColor: `${borderColor}22` }]}>
        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: surface, borderColor: `${borderColor}22` },
          ]}
        >
          <MaterialIcons name="search" size={18} color={muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar"
            placeholderTextColor={muted}
            style={[styles.searchInput, { color: textColor }]}
          />
        </View>
        <View style={styles.headerButtons}>
          <View style={styles.chipsRow}>
            {fromCache && (
              <StatusChip label="Offline" tintColor={tintColor} borderColor={`${borderColor}33`} />
            )}
            {loadingEnrollments && (
              <StatusChip
                label="Sincronizando"
                tintColor={textColor}
                borderColor={`${borderColor}33`}
              />
            )}
          </View>
          {showCreateButton && typeof onCreateConversation === 'function' ? (
            <Pressable
              onPress={() => onCreateConversation()}
              style={[styles.newButton, { borderColor: `${borderColor}33` }]}
            >
              <MaterialIcons name="chat" size={16} color={tintColor} />
              <Text style={[styles.newButtonText, { color: tintColor }]}>Nuevo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollPaddingBottom, backgroundColor: background },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: borderColor }]}>{emptyCopy}</Text>
          </View>
        ) : (
          filteredItems.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              currentUid={currentUid}
              onSelect={onSelectConversation}
              isActive={conversation.id === activeConversationId}
              tintColor={tintColor}
              borderColor={borderColor}
              textColor={textColor}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ConversationRow({
  conversation,
  currentUid,
  onSelect,
  isActive,
  tintColor,
  borderColor,
  textColor,
}) {
  const partner = conversation.participants?.find((item) => item.uid !== currentUid);
  const presence = usePresence(partner?.uid);
  const lastMessage = conversation.lastMessage || 'Envia el primer mensaje';
  const lastMessageAt = conversation.lastMessageAt;
  const unread = Array.isArray(conversation.unreadBy)
    ? conversation.unreadBy.includes(currentUid)
    : false;

  return (
    <Pressable
      onPress={() => onSelect(conversation, partner)}
      style={[
        styles.item,
        {
          borderColor: `${borderColor}22`,
          backgroundColor: isActive ? `${tintColor}18` : `${borderColor}0f`,
        },
      ]}
    >
      <View style={styles.avatarWrapper}>
        {partner?.photoURL ? (
          <Image source={{ uri: partner.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: `${borderColor}33` }]}>
            <Text style={[styles.avatarInitials, { color: textColor }]}>
              {partner?.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {partner?.displayName || 'Sin nombre'}
          </Text>
          <Text style={[styles.time, { color: `${borderColor}aa` }]}>{formatTime(lastMessageAt)}</Text>
        </View>
        {conversation.enrollmentMeta?.subjectName ? (
          <Text style={[styles.subject, { color: `${borderColor}aa` }]} numberOfLines={1}>
            {conversation.enrollmentMeta.subjectName}
          </Text>
        ) : null}
        <View style={styles.itemFooter}>
          <Text
            style={[
              styles.preview,
              { color: unread ? tintColor : `${borderColor}cc` },
            ]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: presence.online ? '#059669' : `${borderColor}55` },
            ]}
          />
          {unread && <View style={[styles.unreadDot, { backgroundColor: tintColor }]} />}
        </View>
        <Text style={[styles.presenceText, { color: `${borderColor}aa` }]}>
          {presence.online ? 'En linea' : formatPresence(presence.lastSeen)}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusChip({ label, tintColor, borderColor }) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: borderColor || `${tintColor}55`,
          backgroundColor: `${tintColor}12`,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: tintColor }]}>{label}</Text>
    </View>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatPresence(lastSeen) {
  if (!lastSeen) return 'Fuera de linea';
  try {
    const date = new Date(lastSeen);
    return `Visto ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return 'Fuera de linea';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '600',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  subject: {
    fontSize: 12,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
  },
  preview: {
    fontSize: 13,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceText: {
    fontSize: 11,
    marginTop: 4,
  },
});
