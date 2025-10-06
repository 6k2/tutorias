import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../app/config/firebase';
import { ensureOfflineReady, useConnectivity } from '../tools/offline';

const CACHED_USER_KEY = 'auth:lastUserSnapshot';
const noop = () => {};

const parseJSON = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  if (!token) return null;
  const parts = token.split?.('.') || [];
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    if (typeof globalThis?.atob === 'function') {
      const decoded = globalThis.atob(padded);
      return JSON.parse(decoded);
    }
    if (typeof Buffer !== 'undefined') {
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
  } catch (error) {
    console.warn('useAuthGuard: failed to decode token payload', error);
  }
  return null;
};

const loadCachedUser = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    return parseJSON(raw);
  } catch (error) {
    console.warn('useAuthGuard: failed to load cached user', error);
    return null;
  }
};

const persistCachedUser = async (snapshot) => {
  if (!snapshot) return AsyncStorage.removeItem(CACHED_USER_KEY);
  try {
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('useAuthGuard: failed to persist cached user', error);
  }
};

const buildSnapshot = async (firebaseUser, previous = null) => {
  if (!firebaseUser) return null;
  let role = previous?.role ?? null;
  try {
    const token = await getIdToken(firebaseUser, false);
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.role === 'string') {
      role = payload.role;
    }
  } catch (error) {
    console.warn('useAuthGuard: unable to inspect token claims', error);
  }
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || previous?.displayName || '',
    role,
    providerId: firebaseUser.providerId,
  };
};

// dest = name of the protected area (shown in alert), delayMs = small delay so it feels natural
export function useAuthGuard(options = {}) {
  const { dest = 'esta sección', delayMs = 400, requireAuth = true, loginPath = '/login' } = options;
  const router = useRouter();
  const { isOffline } = useConnectivity();
  const cachedProfileRef = useRef(null);
  const [user, setUser] = useState(() => auth.currentUser || null);
  const [ready, setReady] = useState(false);
  const [isOfflineUser, setIsOfflineUser] = useState(false);
  const timer = useRef(null);

  const scheduleRedirect = useCallback(() => {
    if (!requireAuth) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        router.replace(`${loginPath}?alert=needAuth&dest=${encodeURIComponent(dest)}`);
      } catch {}
    }, delayMs);
  }, [dest, delayMs, loginPath, requireAuth, router]);

  // Watch auth changes and schedule redirect if needed
  useEffect(() => {
    let ignore = false;
    let unsubscribe = noop;

    const bootstrap = async () => {
      await ensureOfflineReady().catch(noop);
      if (ignore) return;

      const cached = await loadCachedUser();
      cachedProfileRef.current = cached;

      if (!auth.currentUser && cached && requireAuth && isOffline) {
        setUser(cached);
        setIsOfflineUser(true);
        setReady(true);
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (ignore) return;

        if (firebaseUser) {
          setUser(firebaseUser);
          setIsOfflineUser(false);
          setReady(true);
          const snapshot = await buildSnapshot(firebaseUser, cachedProfileRef.current);
          cachedProfileRef.current = snapshot;
          persistCachedUser(snapshot);
        } else {
          setReady(true);
          if (requireAuth && cachedProfileRef.current && isOffline) {
            setUser(cachedProfileRef.current);
            setIsOfflineUser(true);
          } else {
            setUser(null);
            setIsOfflineUser(false);
            cachedProfileRef.current = null;
            persistCachedUser(null);
            scheduleRedirect();
          }
        }
      });
    };

    bootstrap();

    return () => {
      ignore = true;
      if (timer.current) clearTimeout(timer.current);
      unsubscribe();
    };
  }, [isOffline, requireAuth, scheduleRedirect]);

  // Re-check when the screen focuses again
  useFocusEffect(
    useCallback(() => {
      if (!auth.currentUser && !cachedProfileRef.current && !isOfflineUser) scheduleRedirect();
      return () => {};
    }, [scheduleRedirect, isOfflineUser])
  );

  return {
    user,
    ready,
    isAuthed: !!user,
    isOfflineUser,
    cachedUser: cachedProfileRef.current,
  };
}

