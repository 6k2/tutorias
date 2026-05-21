import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { app } from '../../app/config/firebase';
import { useThemeColor } from '../../hooks/useThemeColor';
import { enqueueSyncAction, useConnectivity } from '../../tools/offline';
import { setTyping as setTypingFlag } from './hooks/usePresence';
import { persistMessage } from './utils/persistMessage';

export function MessageInput({ conversationId, currentUser, partner, onQueueMessage }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const typingTimeout = useRef(null);
  const connectivity = useConnectivity();

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

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
      setText('');
      setAttachment(null);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(draftKey);
      const parsed = raw ? JSON.parse(raw) : null;
      setText(parsed?.text || '');
    } catch (draftError) {
      console.warn('chat: draft restore failed', draftError);
      setText('');
    }
    setAttachment(null);
    setUploadProgress(0);
    setError(null);
  }, [draftKey]);

  useEffect(() => {
    restoreDraft();
  }, [restoreDraft]);

  useEffect(() => {
    if (!draftKey) return;
    AsyncStorage.setItem(draftKey, JSON.stringify({ text })).catch((draftError) => {
      console.warn('chat: draft persist failed', draftError);
    });
  }, [draftKey, text]);

  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (conversationId && currentUser?.uid) {
        setTypingFlag(conversationId, currentUser.uid, false);
      }
    },
    [conversationId, currentUser?.uid]
  );

  const resetComposer = useCallback(() => {
    setText('');
    setAttachment(null);
    setUploadProgress(0);
    if (draftKey) AsyncStorage.removeItem(draftKey).catch(() => {});
    if (conversationId && currentUser?.uid) {
      setTypingFlag(conversationId, currentUser.uid, false);
    }
  }, [conversationId, currentUser?.uid, draftKey]);

  const handleChangeText = useCallback(
    (value) => {
      setText(value);
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const extension = asset.fileName?.split('.')?.pop()?.toLowerCase();
      const isPdf = extension === 'pdf';
      setAttachment({
        uri: asset.uri,
        name: asset.fileName || `archivo-${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`,
        type: isPdf ? 'pdf' : 'image',
        mimeType: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
        sizeBytes: asset.fileSize || null,
      });
      setUploadProgress(0);
      setError(null);
    } catch (pickError) {
      console.error('No se pudo seleccionar archivo', pickError);
      setError('No se pudo seleccionar el archivo.');
    }
  }, [connectivity.isOffline]);

  const uploadAttachment = useCallback(
    async (file, messageId) => {
      const storage = getStorage(app);
      const safeName = String(file.name || `adjunto-${Date.now()}`).replace(/[^A-Za-z0-9._-]/g, '_');
      const path = `conversations/${conversationId}/${messageId}/${safeName}`;
      const fileRef = storageRef(storage, path);
      const response = await fetch(file.uri);
      const blob = await response.blob();

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, blob, { contentType: file.mimeType });
        task.on(
          'state_changed',
          (snapshot) => {
            const total = snapshot.totalBytes || 1;
            setUploadProgress(Math.round((snapshot.bytesTransferred / total) * 100));
          },
          reject,
          resolve
        );
      });

      const url = await getDownloadURL(fileRef);
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
    if (!text.trim() && !attachment) return;

    setIsSending(true);
    setError(null);

    try {
      const trimmed = text.trim();
      const messageId = makeMessageId();
      const clientId = `${conversationId}:${messageId}`;

      if (connectivity.isOffline) {
        if (attachment) {
          setError('No se pueden enviar adjuntos sin conexion.');
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
        return;
      }

      const attachments = attachment ? [await uploadAttachment(attachment, messageId)] : [];
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
    } catch (sendError) {
      console.error('Error al enviar mensaje', sendError);
      setError('Hubo un error al enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  }, [
    attachment,
    connectivity.isOffline,
    conversationId,
    currentUser?.displayName,
    currentUser?.uid,
    makeMessageId,
    onQueueMessage,
    partner?.uid,
    resetComposer,
    text,
    uploadAttachment,
  ]);

  const handleKeyPress = useCallback(
    (event) => {
      if (Platform.OS !== 'web') return;
      const nativeEvent = event?.nativeEvent || {};
      if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
        event.preventDefault?.();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = Boolean(text.trim() || attachment);

  return (
    <View style={[styles.container, { borderTopColor: `${borderColor}44`, backgroundColor: background }]}>
      {connectivity.isOffline ? (
        <View style={[styles.offlineBanner, { borderColor: `${borderColor}44`, backgroundColor: `${borderColor}12` }]}>
          <Text style={[styles.offlineText, { color: textColor }]}>
            Sin conexion. Los mensajes de texto se enviaran al reconectar.
          </Text>
        </View>
      ) : null}

      {attachment ? (
        <View style={styles.attachmentPreview}>
          <View style={styles.attachmentInfo}>
            <MaterialIcons name={attachment.type === 'image' ? 'image' : 'attach-file'} size={18} color={tintColor} />
            <Text style={[styles.attachmentLabel, { color: textColor }]} numberOfLines={1}>
              {attachment.name}
            </Text>
            {isSending && uploadProgress > 0 ? (
              <Text style={[styles.progressText, { color: tintColor }]}>{uploadProgress}%</Text>
            ) : null}
          </View>
          <Pressable onPress={() => setAttachment(null)} disabled={isSending}>
            <Text style={[styles.removeAttachment, { color: tintColor }]}>Quitar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={handlePickAttachment}
          style={[styles.iconButton, { borderColor: `${borderColor}55` }]}
          disabled={connectivity.isOffline || isSending}
          accessibilityRole="button"
          accessibilityLabel="Adjuntar archivo"
        >
          <MaterialIcons name="add" size={21} color={connectivity.isOffline ? `${tintColor}66` : tintColor} />
        </Pressable>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${borderColor}55` }]}
          placeholder="Escribe un mensaje"
          placeholderTextColor={`${borderColor}aa`}
          value={text}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={isSending || !canSend}
          style={[
            styles.sendButton,
            {
              backgroundColor: tintColor,
              opacity: isSending || !canSend ? 0.5 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          {isSending ? (
            <Text style={styles.sendButtonText}>...</Text>
          ) : (
            <MaterialIcons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
      {error ? <Text style={[styles.errorText, { color: tintColor }]}>{error}</Text> : null}
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
  offlineBanner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
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
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  attachmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentLabel: {
    flex: 1,
    fontSize: 13,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
  },
  removeAttachment: {
    fontSize: 13,
    fontWeight: '700',
  },
});
