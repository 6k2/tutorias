import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { usePresence, subscribeTyping } from './hooks/usePresence';
import { MessageInput } from './MessageInput';

const PAGE_SIZE = 20;

export function ChatThread({
  conversation,
  currentUser,
  partner,
  pendingMessages = [],
  onQueueMessage,
  bottomInset = 0,
}) {
  const conversationId = conversation?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const presence = usePresence(partner?.uid);

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'icon');
  const borderColor = `${mutedColor}40`;
  const safeBottomInset = Math.max(0, bottomInset);
  const listBottomPadding = safeBottomInset + 120;

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
        const docs = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        setMessages(docs.reverse());
        setCursor(snapshot.docs[snapshot.docs.length - 1] || null);
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
    const conversationRef = doc(db, 'conversations', conversationId);
    updateDoc(conversationRef, {
      unreadBy: arrayRemove(currentUser.uid),
    }).catch(() => {});
  }, [conversationId, currentUser?.uid]);

  useEffect(() => {
    if (!conversationId || !partner?.uid) return undefined;
    return subscribeTyping(conversationId, partner.uid, setIsPartnerTyping);
  }, [conversationId, partner?.uid]);

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
      const docs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setMessages((prev) => [...docs.reverse(), ...prev]);
      setCursor(snapshot.docs[snapshot.docs.length - 1]);
    } catch (error) {
      console.error('chat: load older failed', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, cursor, reachedEnd, loadingOlder]);

  const normalizedPending = useMemo(() => {
    if (!pendingMessages || pendingMessages.length === 0) return [];
    return pendingMessages.map((pending) => ({
      id: `pending:${pending.clientId}`,
      text: pending.text,
      createdAt: pending.queuedAt,
      from: pending.from || currentUser?.uid,
      to: pending.to || partner?.uid,
      pending: true,
    }));
  }, [pendingMessages, currentUser?.uid, partner?.uid]);

  const combinedMessages = useMemo(() => {
    const merged = [...messages, ...normalizedPending];
    merged.sort((a, b) => getMillis(a) - getMillis(b));
    return merged;
  }, [messages, normalizedPending]);

  if (!conversationId) {
    return (
      <View style={[styles.emptyThread, { backgroundColor: background }]}>
        <Text style={[styles.emptyText, { color: mutedColor }]}>
          Selecciona una conversacion.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: background, paddingBottom: safeBottomInset }]}
    >
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <View style={[styles.headerAvatar, { backgroundColor: `${mutedColor}30` }]}>
          {partner?.photoURL ? (
            <Image source={{ uri: partner.photoURL }} style={styles.headerImage} />
          ) : (
            <Text style={[styles.headerInitials, { color: textColor }]}>
              {partner?.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: textColor }]}>
            {partner?.displayName || 'Sin nombre'}
          </Text>
          <Text style={[styles.headerPresence, { color: mutedColor }]}>
            {isPartnerTyping
              ? 'Escribiendo...'
              : presence.online
              ? 'En linea'
              : formatLastSeen(presence.lastSeen)}
          </Text>
        </View>
      </View>
      <FlatList
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
        inverted
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        onEndReachedThreshold={0.2}
        onEndReached={loadOlder}
        ListFooterComponent={
          loadingOlder ? <ActivityIndicator color={tintColor} style={styles.loadingMore} /> : null
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
      {isPartnerTyping && (
        <View style={styles.typingRow}>
          <Text style={[styles.typingText, { color: mutedColor }]}>Escribiendo...</Text>
        </View>
      )}
      <MessageInput
        conversationId={conversationId}
        currentUser={currentUser}
        partner={partner}
        onQueueMessage={onQueueMessage}
      />
    </View>
  );
}

function MessageBubble({ message, isOwnMessage, textColor, tintColor, mutedColor }) {
  const alignStyle = isOwnMessage ? styles.rowRight : styles.rowLeft;
  const bubbleStyle = isOwnMessage
    ? [styles.bubbleBase, styles.bubbleOwn, { backgroundColor: tintColor }]
    : [
        styles.bubbleBase,
        styles.bubbleOther,
        { borderColor: `${mutedColor}55`, backgroundColor: `${mutedColor}15` },
      ];
  const bubbleTextColor = isOwnMessage
    ? isColorLight(tintColor)
      ? '#111115'
      : '#fff'
    : textColor;
  const timestampColor = isOwnMessage
    ? isColorLight(tintColor)
      ? '#11111599'
      : '#ffffffcc'
    : mutedColor;

  return (
    <View style={[styles.messageRow, alignStyle]}>
      <View style={bubbleStyle}>
        {message.text ? (
          <Text style={[styles.messageText, { color: bubbleTextColor }]}>{message.text}</Text>
        ) : null}
        {message.attachmentURL ? (
          <Text style={[styles.attachmentText, { color: bubbleTextColor }]}>Archivo adjunto</Text>
        ) : null}
        {message.pending && (
          <Text style={[styles.pendingText, { color: bubbleTextColor }]}>Pendiente...</Text>
        )}
        <Text style={[styles.timestamp, { color: timestampColor }]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function getMillis(message) {
  const value = message?.createdAt;
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Fuera de linea';
  const date = new Date(lastSeen);
  return `Visto ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function isColorLight(color) {
  if (!color) return false;
  const sanitized = String(color).trim().replace('#', '');
  if (sanitized.length !== 3 && sanitized.length !== 6) {
    return false;
  }
  const normalized =
    sanitized.length === 3
      ? sanitized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : sanitized;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 186;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyThread: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 22,
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
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerPresence: {
    fontSize: 13,
  },
  listContent: {
    padding: 16,
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
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    borderTopRightRadius: 4,
  },
  bubbleOther: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    marginBottom: 4,
  },
  attachmentText: {
    fontSize: 13,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    textAlign: 'right',
  },
  pendingText: {
    fontSize: 11,
    marginBottom: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  emptyLoader: {
    marginVertical: 24,
  },
  loadingMore: {
    marginVertical: 16,
  },
  typingRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
  },
});
