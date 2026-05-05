import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../contexts/AuthContext';

export function useAuthGuard(options = {}) {
  const {
    dest = 'esta sección',
    delayMs = 250,
    requireAuth = true,
    loginPath = '/login',
    roles,
  } = options;
  const router = useRouter();
  const session = useSession();
  const timer = useRef(null);

  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => String(role).toLowerCase())
    : roles
    ? [String(roles).toLowerCase()]
    : [];

  const hasRequiredRole =
    normalizedRoles.length === 0 || normalizedRoles.includes(String(session.role || '').toLowerCase());

  const scheduleRedirect = useCallback(() => {
    if (!requireAuth || session.status === 'loading') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.replace({ pathname: loginPath, params: { next: dest } });
    }, delayMs);
  }, [delayMs, dest, loginPath, requireAuth, router, session.status]);

  useEffect(() => {
    if (!requireAuth) return undefined;
    if (session.status === 'anonymous' || session.status === 'error') {
      scheduleRedirect();
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [requireAuth, scheduleRedirect, session.status]);

  useFocusEffect(
    useCallback(() => {
      if (requireAuth && (session.status === 'anonymous' || session.status === 'error')) {
        scheduleRedirect();
      }
      return () => {};
    }, [requireAuth, scheduleRedirect, session.status])
  );

  return {
    user: session.user,
    ready: session.ready,
    status: session.status,
    isAuthed: session.isAuthenticated,
    isAuthenticated: session.isAuthenticated,
    isOfflineUser: session.isOfflineUser,
    cachedUser: session.user,
    role: session.role,
    hasRequiredRole,
    blockedByRole: session.isAuthenticated && !hasRequiredRole,
    isOffline: session.isOffline,
  };
}
