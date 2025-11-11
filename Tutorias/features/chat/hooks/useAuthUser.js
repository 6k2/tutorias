import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../app/config/firebase';

// Tiny hook that exposes the current Firebase user info.
// We keep it simple because Expo apps often reuse this across screens.
export function useAuthUser() {
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    const current = auth.currentUser;
    if (current) {
      setAuthUser({
        uid: current.uid,
        displayName: current.displayName || 'Sin nombre',
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
        return;
      }
      setAuthUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Sin nombre',
        photoURL: firebaseUser.photoURL || null,
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) {
      setProfile(null);
      return () => {};
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        const data = snapshot.data() || {};
        setProfile({
          role: data.role || 'student',
          matricula: data.matricula || null,
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
        });
      },
      () => {
        setProfile(null);
      }
    );

    profileUnsubRef.current = unsubscribe;
    return () => {
      unsubscribe();
      if (profileUnsubRef.current === unsubscribe) {
        profileUnsubRef.current = null;
      }
    };
  }, [authUser?.uid]);

  const mergedUser = useMemo(() => {
    if (authUser === undefined) return undefined;
    if (authUser === null) return null;
    return {
      uid: authUser.uid,
      displayName: authUser.displayName || 'Sin nombre',
      photoURL: authUser.photoURL || null,
      role: profile?.role || 'student',
      matricula: profile?.matricula || null,
      subjects: profile?.subjects || [],
    };
  }, [authUser, profile]);

  return mergedUser;
}
