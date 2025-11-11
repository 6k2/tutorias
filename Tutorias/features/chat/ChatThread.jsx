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

export function ChatThread({ conversation, currentUser, partner }) {
  const conversationId = conversation?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [lastDocument, setLastDocument] = useState(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const presence = usePresence(partner?.uid);

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'icon');
  const borderColor = `${mutedColor}40`;

  useEffect(() => {
    setMessages([]);
    setLastDocument(null);
    setReachedEnd(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return undefined;

    setLoading(true);
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const docs = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setMessages(docs);
      setLastDocument(snapshot.docs[snapshot.docs.length - 1] || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !currentUser?.uid) return undefined;
    const conversationRef = doc(db, 'conversations', conversationId);
    updateDoc(conversationRef, {
      unreadBy: arrayRemove(currentUser.uid),
    }).catch(() => {
      // ignore errors (offline mode will retry later)
    });
  }, [conversationId, currentUser?.uid]);

  useEffect(() => {
    if (!conversationId || !partner?.uid) return undefined;
    return subscribeTyping(conversationId, partner.uid, setIsPartnerTyping);
  }, [conversationId, partner?.uid]);

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || reachedEnd || !lastDocument) {
      return;
    }
    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const nextQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDocument),
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
      setMessages((prev) => [...prev, ...docs]);
      setLastDocument(snapshot.docs[snapshot.docs.length - 1]);
    } catch (error) {
      console.error('Error al cargar más mensajes', error);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, reachedEnd, lastDocument]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [messages]);

  if (!conversationId) {
    return (
      <View style={[styles.emptyThread, { backgroundColor: background }]}> 
        <Text style={[styles.emptyText, { color: mutedColor }]}>Selecciona una conversación.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: background }]}> 
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
            {presence.online ? 'En línea' : formatLastSeen(presence.lastSeen)}
          </Text>
        </View>
      </View>
      <FlatList
        data={sortedMessages}
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
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.2}
        onEndReached={loadMore}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={tintColor} style={styles.loadingMore} /> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={tintColor} style={styles.emptyLoader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: mutedColor }]}>No hay mensajes aún.</Text>
            </View>
          )
        }
      />
      {isPartnerTyping && (
        <View style={styles.typingRow}>
          <Text style={[styles.typingText, { color: mutedColor }]}>Escribiendo…</Text>
        </View>
      )}
      <MessageInput conversationId={conversationId} currentUser={currentUser} partner={partner} />
    </View>
  );
}

function MessageBubble({ message, isOwnMessage, textColor, tintColor, mutedColor }) {
  const alignStyle = isOwnMessage ? styles.rowRight : styles.rowLeft;
  const bubbleStyle = isOwnMessage
    ? [styles.bubbleOwn, { backgroundColor: tintColor }]
    : [styles.bubbleOther, { borderColor: `${mutedColor}55`, backgroundColor: `${mutedColor}15` }];
  const displayTextColor = isOwnMessage ? '#fff' : textColor;

  return (
    <View style={[styles.messageRow, alignStyle]}>
      <View style={[styles.bubbleBase, ...bubbleStyle]}>
        {message.text ? (
          <Text style={[styles.messageText, { color: displayTextColor }]}>{message.text}</Text>
        ) : null}
        {message.attachmentURL ? (
          <Text style={[styles.attachmentText, { color: displayTextColor }]}>Archivo adjunto</Text>
        ) : null}
        <Text style={[styles.timestamp, { color: isOwnMessage ? '#ffffffcc' : mutedColor }]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_error) {
    return '';
  }
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Desconectado';
  const date = new Date(lastSeen);
  return `Última vez ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
    paddingBottom: 96,
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
