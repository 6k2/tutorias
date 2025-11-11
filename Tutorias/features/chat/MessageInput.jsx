import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { app } from '../../app/config/firebase';
import { setTyping as setTypingFlag } from './hooks/usePresence';
import { useThemeColor } from '../../hooks/useThemeColor';
import { enqueueSyncAction, useConnectivity } from '../../tools/offline';
import { persistMessage } from './utils/persistMessage';

export function MessageInput({ conversationId, currentUser, partner, onQueueMessage }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
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

  const restoreDraft = useCallback(async () => {
    if (!draftKey) {
      setText('');
      setAttachment(null);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(draftKey);
      if (!raw) {
        setText('');
        return;
      }
      const parsed = JSON.parse(raw);
      setText(parsed?.text || '');
    } catch (draftError) {
      console.warn('chat: draft restore failed', draftError);
      setText('');
    }
    setAttachment(null);
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
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      if (conversationId && currentUser?.uid) {
        setTypingFlag(conversationId, currentUser.uid, false);
      }
    },
    [conversationId, currentUser?.uid]
  );

  const resetComposer = useCallback(() => {
    setText('');
    setAttachment(null);
    if (draftKey) {
      AsyncStorage.removeItem(draftKey).catch(() => {});
    }
    if (conversationId && currentUser?.uid) {
      setTypingFlag(conversationId, currentUser.uid, false);
    }
  }, [conversationId, currentUser?.uid, draftKey]);

  const handleChangeText = useCallback(
    (value) => {
      setText(value);
      if (!conversationId || !currentUser?.uid) return;
      setTypingFlag(conversationId, currentUser.uid, value.length > 0);
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
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
      });
    } catch (pickError) {
      console.error('No se pudo seleccionar archivo', pickError);
      setError('No se pudo seleccionar el archivo.');
    }
  }, [connectivity.isOffline]);

  const uploadAttachment = useCallback(
    async (file) => {
      const storage = getStorage(app);
      const path = `conversations/${conversationId}/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      const response = await fetch(file.uri);
      const blob = await response.blob();
      await uploadBytes(fileRef, blob, { contentType: file.mimeType });
      const url = await getDownloadURL(fileRef);
      return { url, type: file.type };
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
      if (connectivity.isOffline) {
        if (attachment) {
          setError('No se pueden enviar adjuntos sin conexion.');
          return;
        }
        const payload = {
          conversationId,
          from: currentUser.uid,
          to: partner.uid,
          text: trimmed,
          senderName: currentUser.displayName || 'Sin nombre',
          clientId: `${conversationId}:${Date.now()}`,
          queuedAt: Date.now(),
        };
        const entry = await enqueueSyncAction('chat:sendMessage', payload);
        onQueueMessage?.(entry, payload);
        resetComposer();
        return;
      }

      let attachmentPayload = { attachmentURL: null, attachmentType: null };
      if (attachment) {
        attachmentPayload = await uploadAttachment(attachment);
      }

      await persistMessage({
        conversationId,
        from: currentUser.uid,
        to: partner.uid,
        text: trimmed,
        senderName: currentUser.displayName || 'Sin nombre',
        attachmentURL: attachmentPayload.url,
        attachmentType: attachmentPayload.type,
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
    currentUser?.uid,
    onQueueMessage,
    partner?.uid,
    resetComposer,
    text,
    uploadAttachment,
  ]);

  const canSend = Boolean(text.trim() || attachment);

  return (
    <View style={[styles.container, { borderTopColor: `${borderColor}44`, backgroundColor: background }]}>
      {connectivity.isOffline && (
        <View
          style={[
            styles.offlineBanner,
            { borderColor: `${borderColor}44`, backgroundColor: `${borderColor}12` },
          ]}
        >
          <Text style={[styles.offlineText, { color: textColor }]}>
            Sin conexion, enviaremos cuando vuelva.
          </Text>
        </View>
      )}
      {attachment && (
        <View style={styles.attachmentPreview}>
          <Text style={[styles.attachmentLabel, { color: textColor }]}>Adjunto: {attachment.name}</Text>
          <Pressable onPress={() => setAttachment(null)}>
            <Text style={[styles.removeAttachment, { color: tintColor }]}>Quitar</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable
          onPress={handlePickAttachment}
          style={[styles.iconButton, { borderColor: `${borderColor}55` }]}
          disabled={connectivity.isOffline}
        >
          <Text
            style={[
              styles.iconButtonText,
              { color: connectivity.isOffline ? `${tintColor}66` : tintColor },
            ]}
          >
            +
          </Text>
        </Pressable>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${borderColor}55` }]}
          placeholder="Escribe un mensaje"
          placeholderTextColor={`${borderColor}aa`}
          value={text}
          onChangeText={handleChangeText}
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
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
  },
  attachmentPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 13,
  },
  removeAttachment: {
    fontSize: 13,
    fontWeight: '600',
  },
});
