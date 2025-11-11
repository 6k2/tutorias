import { useEffect, useState } from 'react';
import {
  getDatabase,
  onValue,
  ref as databaseRef,
  set,
  onDisconnect,
} from 'firebase/database';
import { app } from '../../../app/config/firebase';

const realtimeDb = getDatabase(app);

// Listen to a user's presence info from the Realtime Database.
export function usePresence(uid) {
  const [presence, setPresence] = useState({ online: false, lastSeen: null });

  useEffect(() => {
    if (!uid) return undefined;
    const statusRef = databaseRef(realtimeDb, `status/${uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const value = snapshot.val();
      if (!value) {
        setPresence({ online: false, lastSeen: null });
        return;
      }
      setPresence({
        online: Boolean(value.online),
        lastSeen: typeof value.lastSeen === 'number' ? value.lastSeen : null,
      });
    });

    return unsubscribe;
  }, [uid]);

  return presence;
}

// Simple helper that keeps the logged user marked as online.
// We reuse this in ChatLayout to toggle presence when mounting/unmounting the screen.
export function useSelfPresence(uid) {
  useEffect(() => {
    if (!uid) return undefined;

    const statusRef = databaseRef(realtimeDb, `status/${uid}`);
    const connectedRef = databaseRef(realtimeDb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (!snapshot.val()) {
        return;
      }

      const now = Date.now();
      set(statusRef, { online: true, lastSeen: now }).catch((error) => {
        console.warn('No se pudo marcar presencia inmediata', error);
      });

      const disconnect = onDisconnect(statusRef);
      disconnect
        .set({ online: false, lastSeen: Date.now() })
        .catch((error) => console.warn('onDisconnect fallo', error));
    });

    return () => {
      unsubscribe();
      set(statusRef, { online: false, lastSeen: Date.now() }).catch(() => {
        // ignore: app might be closing
      });
    };
  }, [uid]);
}

export function subscribeTyping(conversationId, uid, callback) {
  if (!conversationId || !uid) return () => {};
  const typingRef = databaseRef(realtimeDb, `typing/${conversationId}/${uid}`);
  const unsubscribe = onValue(typingRef, (snapshot) => {
    callback(Boolean(snapshot.val()));
  });
  return unsubscribe;
}

export function setTyping(conversationId, uid, value) {
  if (!conversationId || !uid) return Promise.resolve();
  const typingRef = databaseRef(realtimeDb, `typing/${conversationId}/${uid}`);
  return set(typingRef, value);
}
