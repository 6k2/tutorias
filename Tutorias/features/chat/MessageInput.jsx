import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { app } from '../../app/config/firebase';
import { webTokens } from '../../components/web/WebUI';
import { useThemeColor } from '../../hooks/useThemeColor';
import { enqueueSyncAction, useConnectivity } from '../../tools/offline';
import { setTyping as setTypingFlag } from './hooks/usePresence';
import { persistMessage } from './utils/persistMessage';

const ACCEPTED_TYPES = ['image/*', 'application/pdf'];
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const isWeb = Platform.OS === 'web';

export function MessageInput({ conversationId, currentUser, partner, onQueueMessage }) {
  const [draftText, setDraftText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [sendState, setSendState] = useState('idle');
  const [uploadState, setUploadState] = useState({ phase: 'idle', progress: 0, error: null });
  const [error, setError] = useState(null);
  const typingTimeout = useRef(null);
  const uploadTaskRef = useRef(null);
  const connectivity = useConnectivity();

  const nativeBackground = useThemeColor({}, 'background');
  const nativeText = useThemeColor({}, 'text');
  const nativeMuted = useThemeColor({}, 'icon');
  const nativeTint = useThemeColor({}, 'tint');

  const colors = useMemo(
    () => ({
      background: isWeb ? webTokens.color.elevated : nativeBackground,
      input: isWeb ? webTokens.color.input : nativeBackground,
      text: isWeb ? webTokens.color.ink : nativeText,
      muted: isWeb ? webTokens.color.muted : nativeMuted,
      border: isWeb ? webTokens.color.line : `${nativeMuted}55`,
      brand: isWeb ? webTokens.color.brand : nativeTint,
      bad: isWeb ? webTokens.color.bad : nativeTint,
      chip: isWeb ? webTokens.color.chip : `${nativeMuted}18`,
    }),
    [nativeBackground, nativeMuted, nativeText, nativeTint]
  );

  const draftKey =
    currentUser?.uid && conversationId
      ? `offline:chatDraft:${currentUser.uid}:${conversationId}`
      : null;

  const makeMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const restoreDraft = useCallback(async () => {
    if (!draftKey) {
      setDraftText('');
      setSelectedAttachment(null);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(draftKey);
      const parsed = raw ? JSON.parse(raw) : null;
      setDraftText(parsed?.text || '');
    } catch (draftError) {
      console.warn('chat: draft restore failed', draftError);
      setDraftText('');
    }
    setSelectedAttachment(null);
    setUploadState({ phase: 'idle', progress: 0, error: null });
    setError(null);
  }, [draftKey]);

  useEffect(() => {
    restoreDraft();
  }, [restoreDraft]);

  useEffect(() => {
    if (!draftKey) return;
    AsyncStorage.setItem(draftKey, JSON.stringify({ text: draftText })).catch((draftError) => {
      console.warn('chat: draft persist failed', draftError);
    });
  }, [draftKey, draftText]);

  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (uploadTaskRef.current) uploadTaskRef.current.cancel();
      if (conversationId && currentUser?.uid) {
        setTypingFlag(conversationId, currentUser.uid, false);
      }
    },
    [conversationId, currentUser?.uid]
  );

  const resetComposer = useCallback(() => {
    setDraftText('');
    setSelectedAttachment(null);
    setUploadState({ phase: 'idle', progress: 0, error: null });
    setError(null);
    if (draftKey) AsyncStorage.removeItem(draftKey).catch(() => {});
    if (conversationId && currentUser?.uid) {
      setTypingFlag(conversationId, currentUser.uid, false);
    }
  }, [conversationId, currentUser?.uid, draftKey]);

  const handleChangeText = useCallback(
    (value) => {
      setDraftText(value);
      setError(null);
      if (!conversationId || !currentUser?.uid) return;
      setTypingFlag(conversationId, currentUser.uid, value.length > 0);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        setTypingFlag(conversationId, currentUser.uid, false);
      }, 3000);
    },
    [conversationId, currentUser?.uid]
  );

  const handlePickAttachment = useCallback(async () => {
    if (connectivity.isOffline) {
      setError('Conectate para adjuntar archivos.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const sizeBytes = asset.size || asset.fileSize || null;
      if (sizeBytes && sizeBytes > MAX_ATTACHMENT_BYTES) {
        setError('El archivo supera 15 MB.');
        return;
      }
      const mimeType = asset.mimeType || '';
      const isPdf = mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
      setSelectedAttachment({
        uri: asset.uri,
        name: asset.name || `archivo-${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`,
        type: isPdf ? 'pdf' : 'image',
        mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
        sizeBytes,
      });
      setUploadState({ phase: 'idle', progress: 0, error: null });
      setError(null);
    } catch (pickError) {
      console.error('No se pudo seleccionar archivo', pickError);
      setError('No se pudo seleccionar el archivo.');
    }
  }, [connectivity.isOffline]);

  const cancelUpload = useCallback(() => {
    uploadTaskRef.current?.cancel();
    uploadTaskRef.current = null;
    setSendState('idle');
    setUploadState({ phase: 'idle', progress: 0, error: null });
  }, []);

  const removeAttachment = useCallback(() => {
    cancelUpload();
    setSelectedAttachment(null);
    setError(null);
  }, [cancelUpload]);

  const uploadAttachment = useCallback(
    async (file, messageId) => {
      const storage = getStorage(app);
      const safeName = String(file.name || `adjunto-${Date.now()}`).replace(/[^A-Za-z0-9._-]/g, '_');
      const path = `conversations/${conversationId}/${messageId}/${safeName}`;
      const fileRef = storageRef(storage, path);
      const response = await fetch(file.uri);
      const blob = await response.blob();

      setUploadState({ phase: 'uploading', progress: 0, error: null });

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, blob, { contentType: file.mimeType });
        uploadTaskRef.current = task;
        task.on(
          'state_changed',
          (snapshot) => {
            const total = snapshot.totalBytes || 1;
            setUploadState({
              phase: 'uploading',
              progress: Math.round((snapshot.bytesTransferred / total) * 100),
              error: null,
            });
          },
          reject,
          resolve
        );
      });

      uploadTaskRef.current = null;
      const url = await getDownloadURL(fileRef);
      setUploadState({ phase: 'uploaded', progress: 100, error: null });
      return {
        url,
        type: file.type,
        name: file.name,
        mimeType: file.mimeType,
        storagePath: path,
        sizeBytes: file.sizeBytes,
      };
    },
    [conversationId]
  );

  const handleSend = useCallback(async () => {
    if (!conversationId || !currentUser?.uid) return;
    if (!partner?.uid) {
      setError('No se pudo identificar al destinatario.');
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed && !selectedAttachment) return;

    setSendState('sending');
    setError(null);

    try {
      const messageId = makeMessageId();
      const clientId = `${conversationId}:${messageId}`;

      if (connectivity.isOffline) {
        if (selectedAttachment) {
          setSendState('idle');
          setError('Los adjuntos requieren conexion. Puedes quitarlo y enviar solo texto.');
          return;
        }
        const payload = {
          conversationId,
          messageId,
          clientId,
          from: currentUser.uid,
          to: partner.uid,
          text: trimmed,
          senderName: currentUser.displayName,
          queuedAt: Date.now(),
        };
        const entry = await enqueueSyncAction('chat:sendMessage', payload);
        onQueueMessage?.(entry, payload);
        resetComposer();
        setSendState('idle');
        return;
      }

      const attachments = selectedAttachment ? [await uploadAttachment(selectedAttachment, messageId)] : [];
      await persistMessage({
        conversationId,
        messageId,
        clientId,
        from: currentUser.uid,
        to: partner.uid,
        text: trimmed,
        senderName: currentUser.displayName,
        attachments,
        localCreatedAt: Date.now(),
      });
      resetComposer();
      setSendState('idle');
    } catch (sendError) {
      console.error('Error al enviar mensaje', sendError);
      const isCanceled = sendError?.code === 'storage/canceled';
      setSendState('idle');
      setUploadState((prev) => ({
        phase: isCanceled ? 'idle' : 'error',
        progress: isCanceled ? 0 : prev.progress,
        error: isCanceled ? null : 'No se pudo subir el archivo.',
      }));
      setError(isCanceled ? null : 'No se pudo enviar. Reintenta o quita el adjunto.');
    }
  }, [
    connectivity.isOffline,
    conversationId,
    currentUser?.displayName,
    currentUser?.uid,
    draftText,
    makeMessageId,
    onQueueMessage,
    partner?.uid,
    resetComposer,
    selectedAttachment,
    uploadAttachment,
  ]);

  const handleKeyPress = useCallback(
    (event) => {
      if (!isWeb) return;
      const nativeEvent = event?.nativeEvent || {};
      if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
        event.preventDefault?.();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = Boolean(draftText.trim() || selectedAttachment);
  const isBusy = sendState === 'sending';

  return (
    <View style={[styles.container, isWeb && styles.webContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      {connectivity.isOffline ? (
        <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.chip }]}>
          <MaterialIcons name="wifi-off" size={15} color={colors.brand} />
          <Text style={[styles.noticeText, { color: colors.text }]}>
            Sin conexion. Los mensajes de texto se enviaran al reconectar.
          </Text>
        </View>
      ) : null}

      {selectedAttachment ? (
        <View style={[styles.attachmentPreview, { borderColor: colors.border, backgroundColor: colors.chip }]}>
          <View style={styles.attachmentIcon}>
            <MaterialIcons name={selectedAttachment.type === 'image' ? 'image' : 'picture-as-pdf'} size={18} color={colors.brand} />
          </View>
          <View style={styles.attachmentBody}>
            <Text style={[styles.attachmentLabel, { color: colors.text }]} numberOfLines={1}>
              {selectedAttachment.name}
            </Text>
            <Text style={[styles.attachmentMeta, { color: colors.muted }]}>
              {uploadState.phase === 'uploading'
                ? `Subiendo ${uploadState.progress}%`
                : uploadState.phase === 'error'
                ? uploadState.error || 'Error al subir'
                : selectedAttachment.type === 'pdf'
                ? 'PDF listo para enviar'
                : 'Imagen lista para enviar'}
            </Text>
          </View>
          {uploadState.phase === 'uploading' ? (
            <Pressable onPress={cancelUpload} style={styles.previewAction} accessibilityRole="button">
              <Text style={[styles.previewActionText, { color: colors.brand }]}>Cancelar</Text>
            </Pressable>
          ) : uploadState.phase === 'error' ? (
            <Pressable onPress={handleSend} style={styles.previewAction} accessibilityRole="button">
              <Text style={[styles.previewActionText, { color: colors.brand }]}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={removeAttachment} disabled={isBusy && uploadState.phase === 'uploading'} style={styles.previewIconButton} accessibilityRole="button">
            <MaterialIcons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={handlePickAttachment}
          style={[styles.iconButton, isWeb && styles.webIconButton, { borderColor: colors.border, backgroundColor: colors.input }]}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Adjuntar imagen o PDF"
        >
          <MaterialIcons name="add" size={22} color={isBusy ? colors.muted : colors.brand} />
        </Pressable>
        <TextInput
          style={[styles.input, isWeb && styles.webInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
          placeholder="Escribe un mensaje"
          placeholderTextColor={colors.muted}
          value={draftText}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          editable={!isBusy || uploadState.phase !== 'uploading'}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={isBusy || !canSend}
          style={[
            styles.sendButton,
            isWeb && styles.webSendButton,
            {
              backgroundColor: colors.brand,
              opacity: isBusy || !canSend ? 0.45 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialIcons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
      {error ? <Text style={[styles.errorText, { color: colors.bad }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  webContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    outlineStyle: 'none',
  },
  webInput: {
    minHeight: 44,
    borderRadius: 14,
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  attachmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentBody: {
    flex: 1,
    minWidth: 0,
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  attachmentMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  previewAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  previewActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  previewIconButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
