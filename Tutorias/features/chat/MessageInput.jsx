import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../../app/config/firebase';
import { setTyping as setTypingFlag } from './hooks/usePresence';
import { useThemeColor } from '../../hooks/useThemeColor';

export function MessageInput({ conversationId, currentUser, partner }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const typingTimeout = useRef(null);

  const background = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    setText('');
    setAttachment(null);
    setError(null);
  }, [conversationId]);

  useEffect(() => () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    if (conversationId && currentUser?.uid) {
      setTypingFlag(conversationId, currentUser.uid, false);
    }
  }, [conversationId, currentUser?.uid]);

  const resetComposer = useCallback(() => {
    setText('');
    setAttachment(null);
    if (conversationId && currentUser?.uid) {
      setTypingFlag(conversationId, currentUser.uid, false);
    }
  }, [conversationId, currentUser?.uid]);

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
      }, 2500);
    },
    [conversationId, currentUser?.uid]
  );

  const handlePickAttachment = useCallback(async () => {
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
  }, []);

  const sendNotification = useCallback(async (payload) => {
    try {
      const functions = getFunctions(app);
      const notify = httpsCallable(functions, 'sendChatNotification');
      await notify(payload);
    } catch (notifyError) {
      // TODO: manejar tokens no registrados. Por ahora solo dejamos log.
      console.log('Notificación pendiente de configurar', notifyError);
    }
  }, []);

  const uploadAttachment = useCallback(
    async (messageId, file) => {
      const storage = getStorage(app);
      const path = `conversations/${conversationId}/${messageId}/${file.name}`;
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
    if (!conversationId || !currentUser?.uid || !partner?.uid) return;
    if (!text.trim() && !attachment) return;

    setIsSending(true);
    setError(null);

    try {
      const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
      const messageRef = doc(messagesCollection);
      const messageData = {
        conversationId,
        from: currentUser.uid,
        to: partner.uid,
        text: text.trim() ? text.trim() : null,
        attachmentURL: null,
        attachmentType: null,
        createdAt: serverTimestamp(),
      };

      if (attachment) {
        const { url, type } = await uploadAttachment(messageRef.id, attachment);
        messageData.attachmentURL = url;
        messageData.attachmentType = type;
      }

      await setDoc(messageRef, messageData);

      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage:
          messageData.text || (messageData.attachmentType === 'image' ? '📷 Foto' : '📎 Archivo'),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadBy: arrayUnion(partner.uid),
      });

      sendNotification({
        conversationId,
        to: partner.uid,
        preview: messageData.text || 'Te enviaron un archivo',
      });

      resetComposer();
    } catch (sendError) {
      console.error('Error al enviar mensaje', sendError);
      setError('Hubo un error al enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  }, [conversationId, currentUser?.uid, partner?.uid, text, attachment, uploadAttachment, sendNotification, resetComposer]);

  return (
    <View style={[styles.container, { borderTopColor: `${borderColor}44`, backgroundColor: background }]}> 
      {attachment && (
        <View style={styles.attachmentPreview}>
          <Text style={[styles.attachmentLabel, { color: textColor }]}>Adjunto: {attachment.name}</Text>
          <Pressable onPress={() => setAttachment(null)}>
            <Text style={[styles.removeAttachment, { color: tintColor }]}>Quitar</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable onPress={handlePickAttachment} style={[styles.iconButton, { borderColor: `${borderColor}55` }]}> 
          <Text style={[styles.iconButtonText, { color: tintColor }]}>+</Text>
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
          disabled={isSending || (!text.trim() && !attachment)}
          style={[
            styles.sendButton,
            {
              backgroundColor: tintColor,
              opacity: isSending || (!text.trim() && !attachment) ? 0.5 : 1,
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
