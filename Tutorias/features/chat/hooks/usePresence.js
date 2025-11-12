import { useEffect, useRef, useState } from 'react';
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref as databaseRef,
  remove,
  set,
} from 'firebase/database';
import { app } from '../../../app/config/firebase';

const realtimeDb = getDatabase(app);
const PRESENCE_TTL = 60 * 1000;
const TYPING_TTL = 3000;

const now = () => Date.now();

const isPresenceValid = (payload) => {
  if (!payload) return false;
  if (!payload.online) return false;
  if (typeof payload.expiresAt === 'number') {
    return payload.expiresAt > now();
  }
  return true;
};

export function usePresence(uid) {
  const [presence, setPresence] = useState({ online: false, lastSeen: null });
  const timeoutRef = useRef(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!uid) {
      clearTimer();
      setPresence({ online: false, lastSeen: null });
      return () => {};
    }
    const statusRef = databaseRef(realtimeDb, `status/${uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const value = snapshot.val();
      clearTimer();
      if (!value || !isPresenceValid(value)) {
        setPresence({ online: false, lastSeen: value?.lastSeen || null });
        return;
      }
      setPresence({
        online: true,
        lastSeen: typeof value.lastSeen === 'number' ? value.lastSeen : null,
      });
      if (typeof value.expiresAt === 'number') {
        const delay = Math.max(0, value.expiresAt - now());
        timeoutRef.current = setTimeout(() => {
          setPresence({
            online: false,
            lastSeen: typeof value.lastSeen === 'number' ? value.lastSeen : now(),
          });
        }, delay + 20);
      }
    });
    return () => {
      clearTimer();
      unsubscribe();
    };
  }, [uid]);

  return presence;
}

export function useSelfPresence(uid) {
  useEffect(() => {
    if (!uid) return undefined;

    const statusRef = databaseRef(realtimeDb, `status/${uid}`);
    const connectedRef = databaseRef(realtimeDb, '.info/connected');
    let heartbeatTimer = null;

    const writePresence = () => {
      const timestamp = now();
      return set(statusRef, {
        online: true,
        lastSeen: timestamp,
        expiresAt: timestamp + PRESENCE_TTL,
      }).catch((error) => {
        console.warn('presence: heartbeat failed', error);
      });
    };

    const startHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      writePresence();
      heartbeatTimer = setInterval(writePresence, PRESENCE_TTL / 2);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (!snapshot.val()) {
        return;
      }

      startHeartbeat();
      const disconnect = onDisconnect(statusRef);
      disconnect
        .set({
          online: false,
          lastSeen: now(),
          expiresAt: now() + PRESENCE_TTL,
        })
        .catch((error) => console.warn('presence: onDisconnect failed', error));
    });

    return () => {
      stopHeartbeat();
      unsubscribe();
      set(statusRef, {
        online: false,
        lastSeen: now(),
        expiresAt: now() + PRESENCE_TTL,
      }).catch(() => {});
    };
  }, [uid]);
}

export function subscribeTyping(conversationId, uid, callback) {
  if (!conversationId || !uid) return () => {};
  const typingRef = databaseRef(realtimeDb, `typing/${conversationId}/${uid}`);
  const unsubscribe = onValue(typingRef, (snapshot) => {
    const value = snapshot.val();
    if (!value || typeof value.expiresAt !== 'number') {
      callback(false);
      return;
    }
    callback(value.expiresAt > now());
  });
  return unsubscribe;
}

export function setTyping(conversationId, uid, value) {
  if (!conversationId || !uid) return Promise.resolve();
  const typingRef = databaseRef(realtimeDb, `typing/${conversationId}/${uid}`);
  if (!value) {
    return remove(typingRef).catch(() => {});
  }
  const timestamp = now();
  return set(typingRef, {
    value: true,
    expiresAt: timestamp + TYPING_TTL,
  });
}
