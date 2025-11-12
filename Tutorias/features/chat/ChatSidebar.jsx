import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useUserConversations } from './hooks/useConversation';
import { usePresence } from './hooks/usePresence';

export function ChatSidebar({
  currentUid,
  onSelectConversation,
  activeConversationId,
  allowedKeys,
  metaByKey,
  loadingEnrollments,
  onCreateConversation,
  bottomOffset = 0,
}) {
  const [search, setSearch] = useState('');
  const { items, loading, fromCache } = useUserConversations(currentUid, {
    allowedKeys,
    metaByKey,
  });

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  const filteredItems = useMemo(() => {
    const queryLower = search.trim().toLowerCase();
    return items.filter((conversation) => {
      if (!queryLower) return true;
      const partner = conversation.participants?.find((item) => item.uid !== currentUid);
      const name = partner?.displayName || 'Sin nombre';
      return name.toLowerCase().includes(queryLower);
    });
  }, [items, search, currentUid]);

  const emptyCopy = loading
    ? 'Cargando tus conversaciones...'
    : loadingEnrollments
    ? 'Verificando matriculas...'
    : 'No hay conversaciones disponibles.';

  const safeBottomOffset = Math.max(0, bottomOffset);
  const scrollPaddingBottom = safeBottomOffset + 32;

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <View style={[styles.searchContainer, { borderColor: `${borderColor}40` }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar"
          placeholderTextColor={`${borderColor}aa`}
          style={[styles.searchInput, { color: textColor, borderColor: `${borderColor}55` }]}
        />
        <View style={styles.headerButtons}>
          {fromCache && (
            <View style={[styles.cacheBadge, { borderColor: `${borderColor}44` }]}>
              <Text style={[styles.cacheBadgeText, { color: tintColor }]}>Offline</Text>
            </View>
          )}
          {typeof onCreateConversation === 'function' && (
            <Pressable onPress={() => onCreateConversation()} style={[styles.newButton, { borderColor: `${borderColor}44` }]}> 
              <Text style={{ color: tintColor, fontWeight: '700' }}>Nuevo</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}>
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
        { borderBottomColor: `${borderColor}33` },
        isActive && { backgroundColor: `${tintColor}18` },
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cacheBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  newButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cacheBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 8,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    justifyContent: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontSize: 14,
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
    marginTop: 2,
  },
});
