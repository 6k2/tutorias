import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ensureConversationRecord } from '../../features/chat/api/conversations';
import { ChatLayout } from '../../features/chat/ChatLayout';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useChatEnrollments } from '../../features/chat/hooks/useChatEnrollments';
import { useSelfPresence } from '../../features/chat/hooks/usePresence';
import { persistMessage } from '../../features/chat/utils/persistMessage';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ensureOfflineReady, useConnectivity, useOfflineSync } from '../../tools/offline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_OVERLAY = 110;

export default function ChatsScreen() {
  const currentUser = useAuthUser();
  const connectivity = useConnectivity();
  const insets = useSafeAreaInsets();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [pendingMessages, setPendingMessages] = useState({});
  const [bootReady, setBootReady] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createUid, setCreateUid] = useState('');
  const [createName, setCreateName] = useState('');

  useSelfPresence(currentUser?.uid);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const bottomOffset = (insets.bottom ?? 0) + TAB_BAR_OVERLAY;

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
  const isStudent = String(currentUser?.role || '').toLowerCase() === 'student';
  const materialsInbox = useMaterialsInbox(isStudent ? currentUser?.uid : null, {
    disabled: !isStudent,
  });

  useEffect(() => {
    if (!currentUser?.uid) {
      setPendingMessages({});
    }
  }, [currentUser?.uid]);

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

  const ensuredSelectedPartner = useMemo(() => {
    if (!selectedConversation) return null;
    return ensurePartnerProfile(selectedConversation, selectedPartner);
  }, [ensurePartnerProfile, selectedConversation, selectedPartner]);

  const threadProps = useMemo(() => {
    if (!selectedConversation) return { conversation: null, partner: null };
    return {
      conversation: selectedConversation,
      partner: ensuredSelectedPartner,
    };
  }, [selectedConversation, ensuredSelectedPartner]);

  const handleSelectConversation = useCallback(
    (conversation, partner) => {
      setSelectedConversation(conversation);
      setSelectedPartner(ensurePartnerProfile(conversation, partner));
    },
    [ensurePartnerProfile]
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

  const pendingForActive = selectedConversation?.id
    ? pendingMessages[selectedConversation.id] || []
    : [];

  const materialsBadgeCount = isStudent ? materialsInbox.newCount || 0 : 0;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: background,
          paddingBottom: bottomOffset,
          paddingTop: insets.top ?? 0,
        },
      ]}
    >
      <Modal visible={!!createModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#101225', padding: 16, borderRadius: 12 }}>
            <Text style={{ color: textColor, fontWeight: '700', marginBottom: 8 }}>Crear conversación</Text>
            <TextInput
              placeholder="UID del destinatario"
              placeholderTextColor="#888"
              value={createUid}
              onChangeText={setCreateUid}
              style={{ borderWidth: 1, borderColor: '#333', padding: 8, borderRadius: 8, color: textColor, marginBottom: 8 }}
            />
            <TextInput
              placeholder="Nombre (opcional)"
              placeholderTextColor="#888"
              value={createName}
              onChangeText={setCreateName}
              style={{ borderWidth: 1, borderColor: '#333', padding: 8, borderRadius: 8, color: textColor, marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable onPress={() => setCreateModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: '#999' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!createUid) return;
                  const other = { uid: createUid, displayName: createName || 'Sin nombre' };
                  try {
                    const ref = await ensureConversationRecord({ myUser: currentUser, otherUser: other, meta: null });
                    if (ref) {
                      setSelectedConversation({ id: ref.id, participants: [{ uid: currentUser.uid, displayName: currentUser.displayName || 'Sin nombre' }, other] });
                    }
                  } catch (e) {
                    console.error('failed create conversation', e);
                  }
                  setCreateModalVisible(false);
                  setCreateUid('');
                  setCreateName('');
                }}
                style={{ padding: 8 }}
              >
                <Text style={{ color: tintColor, fontWeight: '700' }}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
      <ChatLayout
        sidebar={
          <ChatSidebar
            currentUid={currentUser.uid}
            onSelectConversation={handleSelectConversation}
            activeConversationId={selectedConversation?.id || null}
            allowedKeys={enrollments.allowedKeys}
            metaByKey={enrollments.metaByKey}
            loadingEnrollments={enrollments.loading}
            onCreateConversation={() => setCreateModalVisible(true)}
            bottomOffset={bottomOffset}
          />
        }
        thread={
          <ChatThread
            conversation={threadProps.conversation}
            currentUser={currentUser}
            partner={threadProps.partner}
            pendingMessages={pendingForActive}
            onQueueMessage={registerPendingMessage}
            bottomInset={bottomOffset}
          />
        }
        isThreadOpen={Boolean(selectedConversation)}
        onBack={() => {
          setSelectedConversation(null);
          setSelectedPartner(null);
        }}
        offline={connectivity.isOffline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
});
