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

export function ChatSidebar({ currentUid, onSelectConversation, activeConversationId }) {
  const [search, setSearch] = useState('');
  const conversations = useUserConversations(currentUid);

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  const filteredItems = useMemo(() => {
    const queryLower = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (!queryLower) return true;
      const partner = conversation.participants?.find((item) => item.uid !== currentUid);
      const name = partner?.displayName || 'Sin nombre';
      return name.toLowerCase().includes(queryLower);
    });
  }, [conversations, search, currentUid]);

  return (
    <View style={[styles.container, { backgroundColor: background }]}> 
      <View
        style={[
          styles.searchContainer,
          { borderColor: `${borderColor}40` },
        ]}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar"
          placeholderTextColor={`${borderColor}aa`}
          style={[styles.searchInput, { color: textColor, borderColor: `${borderColor}55` }]}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: borderColor }]}>No hay conversaciones.</Text>
          </View>
        ) : (
          filteredItems.map((conversation) => {
            const partner = conversation.participants?.find((item) => item.uid !== currentUid);
            const lastMessage = conversation.lastMessage || 'Envía el primer mensaje';
            const lastMessageAt = conversation.lastMessageAt;
            const unread = Array.isArray(conversation.unreadBy)
              ? conversation.unreadBy.includes(currentUid)
              : false;
            const isActive = conversation.id === activeConversationId;
            return (
              <Pressable
                key={conversation.id}
                onPress={() => onSelectConversation(conversation, partner)}
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
                    <View
                      style={[
                        styles.avatarFallback,
                        { backgroundColor: `${borderColor}33` },
                      ]}
                    >
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
                    <Text style={[styles.time, { color: `${borderColor}aa` }]}>
                      {formatTime(lastMessageAt)}
                    </Text>
                  </View>
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
                    {unread && <View style={[styles.unreadDot, { backgroundColor: tintColor }]} />}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '';
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
  scrollContent: {
    paddingBottom: 32,
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
    marginBottom: 6,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
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
});
