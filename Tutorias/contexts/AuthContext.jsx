import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../app/config/firebase';
import { ensureOfflineReady, useConnectivity } from '../tools/offline';

const CACHED_USER_KEY = 'auth:lastUserSnapshot';
const AuthContext = createContext(null);

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
      return JSON.parse(globalThis.atob(padded));
    }
    if (typeof Buffer !== 'undefined') {
      return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    }
  } catch (error) {
    console.warn('AuthContext: failed to decode token payload', error);
  }
  return null;
};

const loadCachedUser = async () => {
  try {
    return parseJSON(await AsyncStorage.getItem(CACHED_USER_KEY));
  } catch (error) {
    console.warn('AuthContext: failed to load cached user', error);
    return null;
  }
};

const persistCachedUser = async (snapshot) => {
  try {
    if (!snapshot) {
      await AsyncStorage.removeItem(CACHED_USER_KEY);
      return;
    }
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('AuthContext: failed to persist cached user', error);
  }
};

const buildUserSnapshot = async (firebaseUser, previous = null) => {
  if (!firebaseUser) return null;
  let profile = {};
  let tokenRole = null;

  try {
    const token = await getIdToken(firebaseUser, false);
    const payload = decodeJwtPayload(token);
    tokenRole = typeof payload?.role === 'string' ? payload.role : null;
  } catch (error) {
    console.warn('AuthContext: unable to inspect token claims', error);
  }

  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    profile = snap.exists() ? snap.data() || {} : {};
  } catch (error) {
    console.warn('AuthContext: unable to load user profile', error);
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || profile.email || previous?.email || '',
    displayName: firebaseUser.displayName || profile.username || profile.displayName || previous?.displayName || '',
    username: profile.username || previous?.username || '',
    role: profile.role || tokenRole || previous?.role || '',
    photoURL: firebaseUser.photoURL || profile.photoURL || previous?.photoURL || null,
    providerId: firebaseUser.providerId,
    refreshedAt: Date.now(),
  };
};

export function AuthProvider({ children }) {
  const connectivity = useConnectivity();
  const [state, setState] = useState({
    status: 'loading',
    user: null,
    isOfflineUser: false,
    error: null,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      await ensureOfflineReady().catch(() => {});
      const cached = await loadCachedUser();

      if (active && !auth.currentUser && cached && connectivity.isOffline) {
        setState({ status: 'authenticated', user: cached, isOfflineUser: true, error: null });
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!active) return;
        if (!firebaseUser) {
          if (cached && connectivity.isOffline) {
            setState({ status: 'authenticated', user: cached, isOfflineUser: true, error: null });
          } else {
            await persistCachedUser(null);
            setState({ status: 'anonymous', user: null, isOfflineUser: false, error: null });
          }
          return;
        }

        setState((prev) => ({ ...prev, status: 'loading', isOfflineUser: false }));
        const snapshot = await buildUserSnapshot(firebaseUser, cached);
        if (!active) return;
        await persistCachedUser(snapshot);
        setState({ status: 'authenticated', user: snapshot, isOfflineUser: false, error: null });
      });
    };

    bootstrap().catch((error) => {
      console.error('AuthContext: bootstrap failed', error);
      if (active) setState({ status: 'error', user: null, isOfflineUser: false, error });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [connectivity.isOffline]);

  const value = useMemo(
    () => ({
      ...state,
      ready: state.status !== 'loading',
      isAuthenticated: state.status === 'authenticated' && !!state.user,
      role: String(state.user?.role || '').toLowerCase(),
      isOffline: connectivity.isOffline,
      lastOnlineAt: connectivity.lastOnlineAt,
    }),
    [connectivity.isOffline, connectivity.lastOnlineAt, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useSession = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useSession must be used inside AuthProvider');
  }
  return value;
};
