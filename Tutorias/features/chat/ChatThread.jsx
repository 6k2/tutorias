import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  arrayRemove,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../app/config/firebase';
import { webTokens } from '../../components/web/WebUI';
import { useThemeColor } from '../../hooks/useThemeColor';
import { initialForProfile, stableColorForUid } from './utils/profiles';
import { subscribeTyping, usePresence } from './hooks/usePresence';
import { MessageInput } from './MessageInput';

const PAGE_SIZE = 24;
const isWeb = Platform.OS === 'web';

export function ChatThread({
  conversation,
  currentUser,
  partner,
  pendingMessages = [],
  onQueueMessage,
  bottomInset = 0,
  showHeader = true,
}) {
  const conversationId = conversation?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);

  const presence = usePresence(partner?.uid);
  const nativeBackground = useThemeColor({}, 'background');
  const nativeText = useThemeColor({}, 'text');
  const nativeTint = useThemeColor({}, 'tint');
  const nativeMuted = useThemeColor({}, 'icon');

  const colors = useMemo(
    () => ({
      background: isWeb ? webTokens.color.elevated : nativeBackground,
      surface: isWeb ? webTokens.color.surface : nativeBackground,
      input: isWeb ? webTokens.color.input : nativeBackground,
      text: isWeb ? webTokens.color.ink : nativeText,
      muted: isWeb ? webTokens.color.muted : nativeMuted,
      border: isWeb ? webTokens.color.line : `${nativeMuted}40`,
      brand: isWeb ? webTokens.color.brand : nativeTint,
      brandSoft: isWeb ? webTokens.color.surfaceAlt : `${nativeTint}18`,
      good: isWeb ? webTokens.color.good : '#059669',
      bad: isWeb ? webTokens.color.bad : nativeTint,
    }),
    [nativeBackground, nativeMuted, nativeText, nativeTint]
  );
  const safeBottomInset = Math.max(0, bottomInset);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setReachedEnd(false);
    nearBottomRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return undefined;

    setLoading(true);
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const docs = snapshot.docs
          .map((docSnapshot) => ({
            id: docSnapshot.id,
            status: 'sent',
            ...docSnapshot.data(),
          }))
          .reverse();
        setMessages(docs);
        setCursor(snapshot.docs[snapshot.docs.length - 1] || null);
        setReachedEnd(snapshot.docs.length < PAGE_SIZE);
        setLoading(false);
      },
      (error) => {
        console.error('chat: message watch failed', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUser?.uid) return undefined;
    updateDoc(doc(db, 'conversations', conversationId), {
      unreadBy: arrayRemove(currentUser.uid),
    }).catch(() => {});
  }, [conversationId, currentUser?.uid, messages.length]);

  useEffect(() => {
    if (!conversationId || !partner?.uid) return undefined;
    return subscribeTyping(conversationId, partner.uid, setIsPartnerTyping);
  }, [conversationId, partner?.uid]);

  useEffect(() => {
    if (!nearBottomRef.current) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length, pendingMessages.length, isPartnerTyping]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !cursor || reachedEnd || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const nextQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(nextQuery);
      if (snapshot.empty) {
        setReachedEnd(true);
        return;
      }
      const docs = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          status: 'sent',
          ...docSnapshot.data(),
        }))
        .reverse();
      setMessages((prev) => [...docs, ...prev]);
      setCursor(snapshot.docs[snapshot.docs.length - 1]);
      if (snapshot.docs.length < PAGE_SIZE) setReachedEnd(true);
    } catch (error) {
      console.error('chat: load older failed', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, cursor, reachedEnd, loadingOlder]);

  const normalizedPending = useMemo(() => {
    return (pendingMessages || []).map((pending) => ({
      id: `pending:${pending.clientId}`,
      clientId: pending.clientId,
      text: pending.text,
      attachments: [],
      createdAt: pending.queuedAt,
      localCreatedAt: pending.queuedAt,
      from: pending.from || currentUser?.uid,
      to: pending.to || partner?.uid,
      status: 'sending',
      pending: true,
    }));
  }, [pendingMessages, currentUser?.uid, partner?.uid]);

  const combinedMessages = useMemo(() => {
    const byClientId = new Map();
    [...messages, ...normalizedPending].forEach((message) => {
      const key = message.clientId || message.id;
      const existing = byClientId.get(key);
      if (!existing || existing.pending) {
        byClientId.set(key, message);
      }
    });
    return [...byClientId.values()].sort((a, b) => getMillis(a) - getMillis(b));
  }, [messages, normalizedPending]);

  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    nearBottomRef.current = distanceFromBottom < 110;
  }, []);

  if (!conversationId) {
    return (
      <View style={[styles.emptyThread, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
          <MaterialIcons name="forum" size={34} color={colors.brand} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Selecciona una conversacion</Text>
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          Tus chats activos apareceran aqui con mensajes en tiempo real.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: safeBottomInset }]}>
      {showHeader ? (
        <ThreadHeader
          partner={partner}
          presence={presence}
          colors={colors}
        />
      ) : null}
      <FlatList
        ref={listRef}
        data={combinedMessages}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            previousMessage={combinedMessages[index - 1]}
            isOwnMessage={item.from === currentUser?.uid}
            colors={colors}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isWeb && styles.webListContent]}
        onScroll={handleScroll}
        scrollEventThrottle={80}
        ListHeaderComponent={
          !reachedEnd && combinedMessages.length ? (
            <Pressable style={[styles.loadOlder, { backgroundColor: colors.input, borderColor: colors.border }]} onPress={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text style={[styles.loadOlderText, { color: colors.brand }]}>Cargar anteriores</Text>
              )}
            </Pressable>
          ) : null
        }
        ListFooterComponent={
          isPartnerTyping ? (
            <View style={styles.typingRow}>
              <Text style={[styles.typingText, { color: colors.muted }]}>Escribiendo...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={styles.emptyLoader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aun no hay mensajes.</Text>
            </View>
          )
        }
      />
      <MessageInput
        conversationId={conversationId}
        currentUser={currentUser}
        partner={partner}
        onQueueMessage={onQueueMessage}
      />
    </View>
  );
}

function ThreadHeader({ partner, presence, colors }) {
  const color = partner?.avatarColor || stableColorForUid(partner?.uid);
  return (
    <View style={[styles.header, isWeb && styles.webHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.headerAvatar, { backgroundColor: color }]}>
        {partner?.photoURL ? (
          <Image source={{ uri: partner.photoURL }} style={styles.headerImage} />
        ) : (
          <Text style={styles.headerInitials}>{initialForProfile(partner)}</Text>
        )}
      </View>
      <View style={styles.headerInfo}>
        <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{partner?.displayName || 'Contacto'}</Text>
        <Text style={[styles.headerPresence, { color: colors.muted }]} numberOfLines={1}>
          {presence.online ? 'En linea ahora' : formatLastSeen(presence.lastSeen)}
          {partner?.subjectName ? ` · ${partner.subjectName}` : ''}
          {partner?.relationship ? ` · ${partner.relationship}` : ''}
        </Text>
      </View>
      <View style={[styles.headerStatus, { backgroundColor: presence.online ? colors.good : colors.input }]}>
        <Text style={[styles.headerStatusText, { color: presence.online ? '#fff' : colors.muted }]}>
          {presence.online ? 'Online' : 'Offline'}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({ message, previousMessage, isOwnMessage, colors }) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const hasText = Boolean(message.text);
  if (!hasText && !attachments.length && !message.pending) return null;

  const sameSenderAsPrevious = previousMessage?.from && previousMessage.from === message.from;
  const bubbleTextColor = isOwnMessage ? '#fff' : colors.text;
  const timestampColor = isOwnMessage ? '#ffffffcc' : colors.muted;

  return (
    <View style={[styles.messageRow, sameSenderAsPrevious && styles.messageRowTight, isOwnMessage ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubbleBase,
          isWeb && styles.webBubbleBase,
          isOwnMessage
            ? [styles.bubbleOwn, { backgroundColor: colors.brand }]
            : [styles.bubbleOther, { borderColor: colors.border, backgroundColor: colors.input }],
        ]}
      >
        {hasText ? (
          <Text style={[styles.messageText, { color: bubbleTextColor }]}>{message.text}</Text>
        ) : null}
        {attachments.map((attachment, index) => (
          <Pressable
            key={`${attachment.url || attachment.name || index}`}
            style={[styles.attachmentBubble, { borderColor: isOwnMessage ? '#ffffff55' : colors.border }]}
            onPress={() => attachment.url && Linking.openURL(attachment.url)}
            accessibilityRole="link"
          >
            <MaterialIcons
              name={attachment.type === 'image' ? 'image' : 'picture-as-pdf'}
              size={16}
              color={bubbleTextColor}
            />
            <Text style={[styles.attachmentText, { color: bubbleTextColor }]} numberOfLines={1}>
              {attachment.name || (attachment.type === 'image' ? 'Imagen' : 'Archivo')}
            </Text>
          </Pressable>
        ))}
        <View style={styles.metaRow}>
          {message.pending ? (
            <Text style={[styles.pendingText, { color: timestampColor }]}>Enviando</Text>
          ) : null}
          <Text style={[styles.timestamp, { color: timestampColor }]}>{formatTimestamp(message)}</Text>
        </View>
      </View>
    </View>
  );
}

function getMillis(message) {
  const value = message?.createdAt;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (message?.localCreatedAt) return message.localCreatedAt;
  return 0;
}

function formatTimestamp(message) {
  const millis = getMillis(message);
  if (!millis) return '';
  try {
    return new Date(millis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Fuera de linea';
  const date = new Date(lastSeen);
  return `Visto ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyThread: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webHeader: {
    minHeight: 72,
    paddingHorizontal: 18,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerInitials: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '900',
  },
  headerPresence: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '700',
  },
  headerStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  webListContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  loadOlder: {
    alignSelf: 'center',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  loadOlderText: {
    fontWeight: '900',
  },
  messageRow: {
    marginBottom: 10,
  },
  messageRowTight: {
    marginBottom: 5,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  bubbleBase: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  webBubbleBase: {
    maxWidth: '68%',
    borderRadius: 16,
  },
  bubbleOwn: {
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  attachmentBubble: {
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 220,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 7,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '900',
  },
  emptyState: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyLoader: {
    marginVertical: 24,
  },
  typingRow: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
