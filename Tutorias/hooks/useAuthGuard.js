import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../app/config/firebase';

// dest = name of the protected area (shown in alert), delayMs = small delay so it feels natural
export function useAuthGuard(options = {}) {
  const { dest = 'esta sección', delayMs = 400, requireAuth = true, loginPath = '/login' } = options;
  const router = useRouter();
  const [user, setUser] = useState(() => auth.currentUser);
  const [ready, setReady] = useState(false);
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);
      if (!u) scheduleRedirect();
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleRedirect]);

  // Re-check when the screen focuses again
  useFocusEffect(
    useCallback(() => {
      if (!auth.currentUser) scheduleRedirect();
      return () => {};
    }, [scheduleRedirect])
  );

  return { user, ready, isAuthed: !!user };
}

