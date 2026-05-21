import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { useThemeColor } from '../../hooks/useThemeColor';
import { initialForProfile, stableColorForUid } from './utils/profiles';
import { subscribeTyping, usePresence } from './hooks/usePresence';
import { MessageInput } from './MessageInput';

const PAGE_SIZE = 24;

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
  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'icon');
  const borderColor = `${mutedColor}40`;
  const safeBottomInset = Math.max(0, bottomInset);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setReachedEnd(false);
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
    }, 60);
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
    nearBottomRef.current = distanceFromBottom < 96;
  }, []);

  if (!conversationId) {
    return (
      <View style={[styles.emptyThread, { backgroundColor: background }]}>
        <MaterialIcons name="forum" size={38} color={mutedColor} />
        <Text style={[styles.emptyText, { color: mutedColor }]}>
          Selecciona una conversacion.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: background, paddingBottom: safeBottomInset }]}>
      {showHeader ? (
        <ThreadHeader
          partner={partner}
          presence={presence}
          textColor={textColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
        />
      ) : null}
      <FlatList
        ref={listRef}
        data={combinedMessages}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwnMessage={item.from === currentUser?.uid}
            textColor={textColor}
            tintColor={tintColor}
            mutedColor={mutedColor}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={80}
        ListHeaderComponent={
          !reachedEnd && combinedMessages.length ? (
            <Pressable style={styles.loadOlder} onPress={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? (
                <ActivityIndicator color={tintColor} />
              ) : (
                <Text style={[styles.loadOlderText, { color: tintColor }]}>Cargar anteriores</Text>
              )}
            </Pressable>
          ) : null
        }
        ListFooterComponent={
          isPartnerTyping ? (
            <View style={styles.typingRow}>
              <Text style={[styles.typingText, { color: mutedColor }]}>Escribiendo...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={tintColor} style={styles.emptyLoader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: mutedColor }]}>No hay mensajes aun.</Text>
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

function ThreadHeader({ partner, presence, textColor, mutedColor, borderColor }) {
  const color = partner?.avatarColor || stableColorForUid(partner?.uid);
  return (
    <View style={[styles.header, { borderBottomColor: borderColor }]}>
      <View style={[styles.headerAvatar, { backgroundColor: color }]}>
        {partner?.photoURL ? (
          <Image source={{ uri: partner.photoURL }} style={styles.headerImage} />
        ) : (
          <Text style={styles.headerInitials}>{initialForProfile(partner)}</Text>
        )}
      </View>
      <View style={styles.headerInfo}>
        <Text style={[styles.headerName, { color: textColor }]}>{partner?.displayName || 'Contacto'}</Text>
        <Text style={[styles.headerPresence, { color: mutedColor }]}>
          {presence.online ? 'En linea' : formatLastSeen(presence.lastSeen)}
          {partner?.subjectName ? ` · ${partner.subjectName}` : ''}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({ message, isOwnMessage, textColor, tintColor, mutedColor }) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const bubbleTextColor = isOwnMessage ? '#fff' : textColor;
  const timestampColor = isOwnMessage ? '#ffffffcc' : mutedColor;

  return (
    <View style={[styles.messageRow, isOwnMessage ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubbleBase,
          isOwnMessage
            ? [styles.bubbleOwn, { backgroundColor: tintColor }]
            : [styles.bubbleOther, { borderColor: `${mutedColor}55`, backgroundColor: `${mutedColor}15` }],
        ]}
      >
        {message.text ? (
          <Text style={[styles.messageText, { color: bubbleTextColor }]}>{message.text}</Text>
        ) : null}
        {attachments.map((attachment, index) => (
          <View key={`${attachment.url || attachment.name || index}`} style={styles.attachmentBubble}>
            <MaterialIcons
              name={attachment.type === 'image' ? 'image' : 'attach-file'}
              size={16}
              color={bubbleTextColor}
            />
            <Text style={[styles.attachmentText, { color: bubbleTextColor }]} numberOfLines={1}>
              {attachment.name || (attachment.type === 'image' ? 'Imagen' : 'Archivo')}
            </Text>
          </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  headerName: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerPresence: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  loadOlder: {
    alignSelf: 'center',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  loadOlderText: {
    fontWeight: '800',
  },
  messageRow: {
    marginBottom: 10,
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
    gap: 5,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: '700',
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
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '700',
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
  },
});
