import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../app/config/firebase';

const getProfileRole = (data = {}) =>
  data.role || data.tipo || data.userType || data.accountType || data.rol || 'student';

const normalizeProfile = (data = {}) => ({
  role: getProfileRole(data),
  displayName: data.username || data.displayName || data.name || data.nombre || null,
  photoURL: data.photoURL || data.avatarUrl || null,
  matricula: data.matricula || null,
  subjects: Array.isArray(data.subjects) ? data.subjects : [],
});

// Tiny hook that exposes the current Firebase user info.
// We keep it simple because Expo apps often reuse this across screens.
export function useAuthUser() {
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    const current = auth.currentUser;
    if (current) {
      setAuthUser({
        uid: current.uid,
        displayName: current.displayName || current.email || current.uid,
        photoURL: current.photoURL || null,
      });
    } else {
      setAuthUser(null);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (!firebaseUser) {
        setAuthUser(null);
        setProfile(null);
        setProfileReady(true);
        return;
      }
      setProfileReady(false);
      setAuthUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email || firebaseUser.uid,
        photoURL: firebaseUser.photoURL || null,
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) {
      setProfile(null);
      setProfileReady(true);
      return () => {};
    }

    setProfileReady(false);
    const profileRef = doc(db, 'users', uid);
    const fallbackTimer = setTimeout(() => {
      setProfileReady(true);
    }, 3500);

    getDoc(profileRef)
      .then((snapshot) => {
        setProfile(normalizeProfile(snapshot.data() || {}));
        setProfileReady(true);
      })
      .catch(() => {
        setProfileReady(true);
      });

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        clearTimeout(fallbackTimer);
        setProfile(normalizeProfile(snapshot.data() || {}));
        setProfileReady(true);
      },
      () => {
        clearTimeout(fallbackTimer);
        setProfile(null);
        setProfileReady(true);
      }
    );

    profileUnsubRef.current = unsubscribe;
    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
      if (profileUnsubRef.current === unsubscribe) {
        profileUnsubRef.current = null;
      }
    };
  }, [authUser?.uid]);

  const mergedUser = useMemo(() => {
    if (authUser === undefined) return undefined;
    if (authUser === null) return null;
    if (!profileReady) return undefined;
    return {
      uid: authUser.uid,
      displayName: profile?.displayName || authUser.displayName || authUser.uid,
      photoURL: profile?.photoURL || authUser.photoURL || null,
      role: profile?.role || 'student',
      matricula: profile?.matricula || null,
      subjects: profile?.subjects || [],
    };
  }, [authUser, profile, profileReady]);

  return mergedUser;
}
