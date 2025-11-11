import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../app/config/firebase';

// Tiny hook that exposes the current Firebase user info.
// We keep it simple because Expo apps often reuse this across screens.
export function useAuthUser() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const current = auth.currentUser;
    if (current) {
      setUser({
        uid: current.uid,
        displayName: current.displayName || 'Sin nombre',
        photoURL: current.photoURL || null,
      });
    } else {
      setUser(null);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      setUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Sin nombre',
        photoURL: firebaseUser.photoURL || null,
      });
    });

    return unsubscribe;
  }, []);

  return user;
}
