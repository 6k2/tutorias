import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ensureConversationRecord } from '../../features/chat/api/conversations';
import { ChatLayout } from '../../features/chat/ChatLayout';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useChatEnrollments } from '../../features/chat/hooks/useChatEnrollments';
import { useUserConversations } from '../../features/chat/hooks/useConversation';
import { useSelfPresence } from '../../features/chat/hooks/usePresence';
import { persistMessage } from '../../features/chat/utils/persistMessage';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../tools/offline';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_SAFE_PADDING = 72;
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

export default function ChatsScreen() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const autoSelectOnLoad = width >= 768;
  const selectionBootedRef = useRef(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [bootReady, setBootReady] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createUid, setCreateUid] = useState('');
  const [createName, setCreateName] = useState('');

  useSelfPresence(currentUser?.uid);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const contentBottomInset = (insets.bottom ?? 0) + TAB_BAR_SAFE_PADDING;

  useEffect(() => {
    let alive = true;
    ensureOfflineReady()
      .catch(() => {})
      .finally(() => {
        if (alive) setBootReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const enrollments = useChatEnrollments(currentUser);
  const {
    items: conversationItems,
    loading: conversationsLoading,
    fromCache: conversationsFromCache,
  } = useUserConversations(currentUser?.uid, {
    allowedKeys: enrollments.allowedKeys,
    metaByKey: enrollments.metaByKey,
  });
  const isStudent = String(currentUser?.role || '').toLowerCase() === 'student';
  const materialsInbox = useMaterialsInbox(isStudent ? currentUser?.uid : null, {
    disabled: !isStudent,
  });

  useEffect(() => {
    if (!currentUser?.uid) {
      setPendingMessages({});
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!activeConversationId) return;
    const exists = conversationItems.some((item) => item.id === activeConversationId);
    if (!exists) {
      setActiveConversationId(null);
    }
  }, [activeConversationId, conversationItems]);

  useEffect(() => {
    if (!autoSelectOnLoad) {
      selectionBootedRef.current = false;
      return;
    }
    if (selectionBootedRef.current || activeConversationId) {
      selectionBootedRef.current = true;
      return;
    }
    if (conversationItems.length > 0) {
      setActiveConversationId(conversationItems[0].id);
      selectionBootedRef.current = true;
    }
  }, [autoSelectOnLoad, conversationItems, activeConversationId]);

  const registerPendingMessage = useCallback((entry, payload) => {
    if (!payload?.conversationId || !payload?.clientId) return;
    setPendingMessages((prev) => {
      const prevList = prev[payload.conversationId] || [];
      return {
        ...prev,
        [payload.conversationId]: [...prevList, { ...payload, entryId: entry?.id }],
      };
    });
  }, []);

  const resolvePendingMessage = useCallback((conversationId, clientId) => {
    if (!conversationId || !clientId) return;
    setPendingMessages((prev) => {
      const pending = prev[conversationId];
      if (!pending || pending.length === 0) return prev;
      const nextList = pending.filter((item) => item.clientId !== clientId);
      if (nextList.length === 0) {
        const clone = { ...prev };
        delete clone[conversationId];
        return clone;
      }
      return { ...prev, [conversationId]: nextList };
    });
  }, []);

  const flushQueuedMessage = useCallback(
    async (payload) => {
      if (!payload) return;
      await persistMessage({
        conversationId: payload.conversationId,
        from: payload.from,
        to: payload.to,
        text: payload.text,
        senderName: payload.senderName || currentUser?.displayName || 'Sin nombre',
      });
      resolvePendingMessage(payload.conversationId, payload.clientId);
    },
    [resolvePendingMessage, currentUser?.displayName]
  );

  useOfflineSync(
    { 'chat:sendMessage': flushQueuedMessage },
    { isOffline: connectivity.isOffline }
  );

  const ensurePartnerProfile = useCallback(
    (conversation, candidate) => {
      if (!conversation) return candidate || null;
      const currentUid = currentUser?.uid;
      const candidateHasValidUid = candidate?.uid && candidate.uid !== currentUid;
      if (candidateHasValidUid) {
        return candidate;
      }

      const participants = Array.isArray(conversation.participants)
        ? conversation.participants
        : [];
      const participantMatch = participants.find(
        (participant) => participant?.uid && participant.uid !== currentUid
      );
      if (participantMatch) {
        return participantMatch;
      }

      const meta = conversation.enrollmentMeta || {};
      const participantUids = Array.isArray(conversation.participantUids)
        ? conversation.participantUids
        : [];
      const fallbackUid =
        participantUids.find((uid) => uid && uid !== currentUid) ||
        (meta.studentId && meta.studentId !== currentUid
          ? meta.studentId
          : meta.teacherId && meta.teacherId !== currentUid
          ? meta.teacherId
          : null);

      if (!fallbackUid) {
        return candidate?.uid ? candidate : candidate || null;
      }

      const fallbackName =
        (meta.studentId === fallbackUid && (meta.studentDisplayName || 'Sin nombre')) ||
        (meta.teacherId === fallbackUid && (meta.teacherDisplayName || 'Sin nombre')) ||
        candidate?.displayName ||
        'Sin nombre';

      const fallbackRole =
        meta.studentId === fallbackUid
          ? 'student'
          : meta.teacherId === fallbackUid
          ? 'teacher'
          : candidate?.role || null;

      return {
        uid: fallbackUid,
        displayName: fallbackName,
        photoURL: candidate?.photoURL || null,
        role: fallbackRole,
        conversationId: conversation.id,
        subjectKey: meta.subjectKey || candidate?.subjectKey || null,
        subjectName: meta.subjectName || candidate?.subjectName || null,
      };
    },
    [currentUser?.uid]
  );

  const activeConversation = useMemo(
    () => conversationItems.find((conversation) => conversation.id === activeConversationId) || null,
    [conversationItems, activeConversationId]
  );

  const activePartner = useMemo(() => {
    if (!activeConversation) return null;
    return ensurePartnerProfile(activeConversation, null);
  }, [activeConversation, ensurePartnerProfile]);

  const threadProps = useMemo(() => {
    if (!activeConversation) return { conversation: null, partner: null };
    return {
      conversation: activeConversation,
      partner: activePartner,
    };
  }, [activeConversation, activePartner]);

  const handleSelectConversation = useCallback(
    (conversation) => {
      if (!conversation?.id) return;
      selectionBootedRef.current = true;
      setActiveConversationId(conversation.id);
    },
    []
  );

  if (!bootReady || currentUser === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tintColor} />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.infoText, { color: textColor }]}>Inicia sesion para usar los chats.</Text>
      </View>
    );
  }

  const pendingForActive = activeConversationId ? pendingMessages[activeConversationId] || [] : [];

  const materialsBadgeCount = isStudent ? materialsInbox.newCount || 0 : 0;

  return (
    <>
      <Modal visible={!!createModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: background }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Crear conversacion</Text>
            <TextInput
              placeholder="UID del destinatario"
              placeholderTextColor={`${textColor}66`}
              value={createUid}
              onChangeText={setCreateUid}
              style={[styles.modalInput, { borderColor: `${textColor}22`, color: textColor }]}
            />
            <TextInput
              placeholder="Nombre (opcional)"
              placeholderTextColor={`${textColor}66`}
              value={createName}
              onChangeText={setCreateName}
              style={[styles.modalInput, { borderColor: `${textColor}22`, color: textColor }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateModalVisible(false)} style={styles.modalAction}>
                <Text style={{ color: `${textColor}80` }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!createUid) return;
                  const other = { uid: createUid, displayName: createName || 'Sin nombre' };
                  try {
                    const ref = await ensureConversationRecord({
                      myUser: currentUser,
                      otherUser: other,
                      meta: null,
                    });
                    if (ref) {
                      selectionBootedRef.current = true;
                      setActiveConversationId(ref.id);
                    }
                  } catch (e) {
                    console.error('failed create conversation', e);
                  }
                  setCreateModalVisible(false);
                  setCreateUid('');
                  setCreateName('');
                }}
                style={styles.modalAction}
              >
                <Text style={{ color: tintColor, fontWeight: '700' }}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]} edges={['top']}>
        {isStudent && materialsBadgeCount > 0 && (
          <View style={styles.materialsBanner}>
            <MaterialIcons name="cloud-download" size={18} color="#1B1E36" />
            <Text style={styles.materialsBannerText}>
              {materialsBadgeCount === 1
                ? 'Nuevo material de estudio'
                : `${materialsBadgeCount} materiales nuevos`}
            </Text>
          </View>
        )}
        <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
          <ChatLayout
            sidebar={
              <ChatSidebar
                currentUid={currentUser.uid}
                conversations={conversationItems}
                loadingConversations={conversationsLoading}
                fromCache={conversationsFromCache}
                onSelectConversation={handleSelectConversation}
                activeConversationId={activeConversationId}
                loadingEnrollments={enrollments.loading}
                onCreateConversation={() => setCreateModalVisible(true)}
                bottomOffset={contentBottomInset}
              />
            }
            thread={
              <ChatThread
                conversation={threadProps.conversation}
                currentUser={currentUser}
                partner={threadProps.partner}
                pendingMessages={pendingForActive}
                onQueueMessage={registerPendingMessage}
                bottomInset={contentBottomInset}
              />
            }
            isThreadOpen={Boolean(activeConversation)}
            onBack={() => {
              selectionBootedRef.current = false;
              setActiveConversationId(null);
            }}
            offline={connectivity.isOffline}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
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
    padding: 24,
    backgroundColor: '#00000055',
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  modalAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
