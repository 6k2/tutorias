import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { usePresence, useSelfPresence } from '../../features/chat/hooks/usePresence';
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
  const isSmallScreen = width < 768;
  const autoSelectOnLoad = !isSmallScreen;
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
  const mutedColor = useThemeColor({}, 'icon');
  const headerBackground = useThemeColor({ light: '#f5f6ff', dark: '#1c1d2a' }, 'background');
  const headerBorder = `${mutedColor}22`;
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

  const partnerPresence = usePresence(activePartner?.uid);

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

  const handleBackToInbox = useCallback(() => {
    selectionBootedRef.current = false;
    setActiveConversationId(null);
  }, []);

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

  const currentUserInitial = getInitial(currentUser?.displayName || currentUser?.email);
  const partnerInitial = getInitial(activePartner?.displayName);

  const mobileSidebarHeader = isSmallScreen
    ? (
        <View
          style={[
            styles.mobileHeader,
            { backgroundColor: headerBackground, borderBottomColor: headerBorder },
          ]}
        >
          <View style={styles.mobileHeaderTopRow}>
            <View style={styles.mobileHeaderProfile}>
              {currentUser?.photoURL ? (
                <Image source={{ uri: currentUser.photoURL }} style={styles.mobileAvatar} />
              ) : (
                <View
                  style={[
                    styles.mobileAvatarFallback,
                    { backgroundColor: `${mutedColor}33` },
                  ]}
                >
                  <Text style={[styles.mobileAvatarInitials, { color: textColor }]}>
                    {currentUserInitial}
                  </Text>
                </View>
              )}
              <View style={styles.mobileHeaderTextGroup}>
                <Text style={[styles.mobileHeaderTitle, { color: textColor }]}>Mensajes</Text>
                <Text
                  style={[styles.mobileHeaderSubtitle, { color: `${mutedColor}cc` }]}
                  numberOfLines={1}
                >
                  Conversa con tus tutores y alumnos
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setCreateModalVisible(true)}
              style={[
                styles.mobileIconButton,
                { backgroundColor: `${tintColor}18`, borderColor: `${tintColor}30` },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Nueva conversacion"
            >
              <MaterialIcons name="chat" size={22} color={tintColor} />
            </Pressable>
          </View>
        </View>
      )
    : null;

  const mobileThreadHeader = isSmallScreen && activeConversation
    ? (
        <View
          style={[
            styles.mobileThreadBar,
            { backgroundColor: headerBackground, borderBottomColor: headerBorder },
          ]}
        >
          <Pressable
            onPress={handleBackToInbox}
            style={[styles.mobileThreadBack, { borderColor: `${mutedColor}33` }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver a la bandeja"
          >
            <MaterialIcons name="arrow-back-ios-new" size={20} color={textColor} />
          </Pressable>
          <View style={styles.mobileThreadInfoWrapper}>
            {activePartner?.photoURL ? (
              <Image source={{ uri: activePartner.photoURL }} style={styles.mobileThreadAvatar} />
            ) : (
              <View
                style={[
                  styles.mobileThreadAvatarFallback,
                  { backgroundColor: `${mutedColor}33` },
                ]}
              >
                <Text style={[styles.mobileThreadAvatarInitials, { color: textColor }]}>
                  {partnerInitial}
                </Text>
              </View>
            )}
            <View style={styles.mobileThreadTextGroup}>
              <Text style={[styles.mobileThreadName, { color: textColor }]} numberOfLines={1}>
                {activePartner?.displayName || 'Sin nombre'}
              </Text>
              <Text
                style={[styles.mobileThreadPresence, { color: `${mutedColor}cc` }]}
                numberOfLines={1}
              >
                {partnerPresence.online
                  ? 'En linea ahora'
                  : formatRelativePresence(partnerPresence.lastSeen)}
              </Text>
            </View>
          </View>
          <MaterialIcons name="more-vert" size={22} color={tintColor} />
        </View>
      )
    : null;

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
                showCreateButton={!isSmallScreen}
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
                showHeader={!isSmallScreen}
              />
            }
            isThreadOpen={Boolean(activeConversation)}
            onBack={handleBackToInbox}
            offline={connectivity.isOffline}
            mobileHeader={mobileSidebarHeader}
            mobileThreadHeader={mobileThreadHeader}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function getInitial(value) {
  if (!value) return '?';
  const trimmed = String(value).trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

function formatRelativePresence(lastSeen) {
  if (!lastSeen) return 'Fuera de linea';
  try {
    const lastSeenDate = new Date(lastSeen);
    const now = Date.now();
    const diff = now - lastSeenDate.getTime();
    if (Number.isNaN(diff)) {
      return 'Fuera de linea';
    }
    if (diff < 60 * 1000) {
      return 'Activo hace un momento';
    }
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
      return `Activo hace ${minutes} min`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(diff / (60 * 60 * 1000)));
      return `Activo hace ${hours} h`;
    }
    return `Visto ${lastSeenDate.toLocaleDateString()} ${lastSeenDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch (error) {
    return 'Fuera de linea';
  }
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
  mobileHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  mobileHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  mobileHeaderProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  mobileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  mobileAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  mobileHeaderTextGroup: {
    flex: 1,
  },
  mobileHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  mobileHeaderSubtitle: {
    fontSize: 13,
  },
  mobileIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  mobileThreadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  mobileThreadBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  mobileThreadInfoWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileThreadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  mobileThreadAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileThreadAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  mobileThreadTextGroup: {
    flex: 1,
  },
  mobileThreadName: {
    fontSize: 16,
    fontWeight: '700',
  },
  mobileThreadPresence: {
    fontSize: 12,
    marginTop: 2,
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
