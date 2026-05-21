import React, { useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { webTokens } from '../../components/web/WebUI';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useUserConversations } from './hooks/useConversation';
import { usePresence } from './hooks/usePresence';
import {
  initialForProfile,
  partnerFromConversation,
  stableColorForUid,
} from './utils/profiles';

const isWeb = Platform.OS === 'web';

export function ChatSidebar({
  currentUid,
  onSelectConversation,
  activeConversationId,
  conversations: providedConversations,
  loadingConversations,
  conversationsFromCache,
  fromCache: providedFromCache,
  allowedKeys,
  metaByKey,
  loadingEnrollments,
  onCreateConversation,
  showCreateButton = true,
  bottomOffset = 0,
}) {
  const [search, setSearch] = useState('');
  const hasProvidedConversations = Array.isArray(providedConversations);
  const internal = useUserConversations(currentUid, {
    allowedKeys,
    metaByKey,
    disabled: hasProvidedConversations,
  });
  const items = hasProvidedConversations ? providedConversations : internal.items;
  const loading = hasProvidedConversations ? Boolean(loadingConversations) : internal.loading;
  const fromCache = hasProvidedConversations
    ? Boolean(conversationsFromCache ?? providedFromCache)
    : internal.fromCache;

  const nativeBackground = useThemeColor({}, 'background');
  const nativeText = useThemeColor({}, 'text');
  const nativeBorder = useThemeColor({}, 'icon');
  const nativeTint = useThemeColor({}, 'tint');

  const colors = useMemo(
    () => ({
      background: isWeb ? webTokens.color.surface : nativeBackground,
      row: isWeb ? webTokens.color.surface : nativeBackground,
      rowActive: isWeb ? webTokens.color.surfaceAlt : `${nativeTint}18`,
      input: isWeb ? webTokens.color.input : nativeBackground,
      text: isWeb ? webTokens.color.ink : nativeText,
      muted: isWeb ? webTokens.color.muted : nativeBorder,
      border: isWeb ? webTokens.color.line : `${nativeBorder}40`,
      brand: isWeb ? webTokens.color.brand : nativeTint,
      good: isWeb ? webTokens.color.good : '#059669',
      chip: isWeb ? webTokens.color.chip : `${nativeBorder}12`,
    }),
    [nativeBackground, nativeBorder, nativeText, nativeTint]
  );

  const filteredItems = useMemo(() => {
    const queryLower = search.trim().toLowerCase();
    return items.filter((conversation) => {
      if (!queryLower) return true;
      const partner = partnerFromConversation(conversation, currentUid);
      const haystack = [
        partner?.displayName,
        partner?.relationship,
        partner?.subjectName,
        conversation.enrollmentMeta?.subjectName,
        conversation.lastMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(queryLower);
    });
  }, [items, search, currentUid]);

  const emptyCopy = loading
    ? 'Cargando tus conversaciones...'
    : loadingEnrollments
    ? 'Verificando matriculas...'
    : search.trim()
    ? 'No hay conversaciones con esa busqueda.'
    : 'Inicia una conversacion desde tus matriculas confirmadas.';

  const safeBottomOffset = Math.max(0, bottomOffset);
  const scrollPaddingBottom = safeBottomOffset + 24;

  return (
    <View style={[styles.container, isWeb && styles.webContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, isWeb && styles.webToolbar, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, isWeb && styles.webSearchBox, { borderColor: colors.border, backgroundColor: colors.input }]}>
          <MaterialIcons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre, materia o mensaje"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} accessibilityRole="button">
              <MaterialIcons name="close" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {showCreateButton && typeof onCreateConversation === 'function' ? (
          <Pressable
            onPress={() => onCreateConversation()}
            style={[styles.newButton, isWeb && styles.webNewButton, { borderColor: colors.border, backgroundColor: colors.brand }]}
            accessibilityRole="button"
            accessibilityLabel="Iniciar conversacion"
          >
            <MaterialIcons name="add-comment" size={18} color="#fff" />
            <Text style={styles.newButtonText}>Iniciar</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.brand} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyCopy}</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name={fromCache ? 'cloud-done' : 'forum'} size={30} color={colors.brand} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyCopy}</Text>
          </View>
        ) : (
          filteredItems.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              currentUid={currentUid}
              onSelect={onSelectConversation}
              isActive={conversation.id === activeConversationId}
              colors={colors}
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
  colors,
}) {
  const partner = partnerFromConversation(conversation, currentUid);
  const presence = usePresence(partner?.uid);
  const lastMessage = conversation.lastMessage || 'Sin mensajes todavia';
  const lastMessageAt = conversation.lastMessageAt || conversation.updatedAt;
  const unread = Array.isArray(conversation.unreadBy)
    ? conversation.unreadBy.includes(currentUid)
    : false;

  return (
    <Pressable
      onPress={() => onSelect(conversation, partner)}
      style={({ hovered }) => [
        styles.item,
        isWeb && styles.webItem,
        {
          borderBottomColor: colors.border,
          backgroundColor: isActive ? colors.rowActive : colors.row,
        },
        hovered && isWeb && !isActive && { backgroundColor: colors.chip },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.avatarWrapper}>
        {partner?.photoURL ? (
          <Image source={{ uri: partner.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: partner?.avatarColor || stableColorForUid(partner?.uid) }]}>
            <Text style={styles.avatarInitials}>{initialForProfile(partner)}</Text>
          </View>
        )}
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.name, isWeb && styles.webName, { color: colors.text }]} numberOfLines={1}>
            {partner?.displayName || 'Contacto'}
          </Text>
          <Text style={[styles.time, { color: colors.muted }]}>{formatTime(lastMessageAt)}</Text>
        </View>
        <Text style={[styles.subject, { color: colors.muted }]} numberOfLines={1}>
          {[conversation.enrollmentMeta?.subjectName || partner?.subjectName, partner?.relationship]
            .filter(Boolean)
            .join(' · ') || 'Matricula confirmada'}
        </Text>
        <View style={styles.itemFooter}>
          <Text
            style={[
              styles.preview,
              { color: unread ? colors.text : colors.muted, fontWeight: unread ? '900' : '600' },
            ]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} /> : null}
        </View>
        <View style={styles.presenceRow}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: presence.online ? colors.good : colors.muted },
            ]}
          />
          <Text style={[styles.presenceText, { color: colors.muted }]} numberOfLines={1}>
            {presence.online ? 'En linea' : formatPresence(presence.lastSeen)}
          </Text>
        </View>
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
  webContainer: {
    minHeight: 0,
  },
  toolbar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  webToolbar: {
    padding: 14,
  },
  searchBox: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webSearchBox: {
    minHeight: 44,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    outlineStyle: 'none',
  },
  newButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  webNewButton: {
    borderRadius: 12,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  scrollContent: {
    paddingTop: 6,
  },
  emptyState: {
    minHeight: 220,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webItem: {
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  webName: {
    fontWeight: '900',
  },
  subject: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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
  presenceRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.9,
  },
  presenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
