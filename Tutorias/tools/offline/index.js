import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '../../app/config/firebase';

/**
 * Offline toolkit shared across the app.
 * - ensureOfflineReady gates Firestore reads until cached writes settle.
 * - useConnectivity surfaces connection state for UI/sync decisions.
 * - enqueueSyncAction/flushSyncQueue build a single queue for deferred work.
 *
 * To extend with new offline modules, enqueue actions with a unique `actionKey`
 * and register a handler (see useOfflineSync in Step 6). Keep payloads serialisable.
 */
const OFFLINE_QUEUE_KEY = 'offlineQueue';
const DEFAULT_BOOT_TIMEOUT_MS = 2000;
let cachedReadyPromise = null;

const noop = () => {};

const withTimeout = (promise, ms) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    promise
      .then(() => {
        clearTimeout(timer);
        finish();
      })
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
  });

const loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[offline] Failed to load queue', error);
    return [];
  }
};

const persistQueue = async (queue) => {
  try {
    if (!queue || queue.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      return;
    }
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('[offline] Failed to persist queue', error);
  }
};

/**
 * Waits for Firestore pending writes to settle (or times out) before offline screens read cache.
 * @param {number} timeoutMs Optional timeout to avoid blocking when offline.
 * @returns {Promise<void>} resolves once Firestore has finished bootstrapping.
 */
export const ensureOfflineReady = (timeoutMs = DEFAULT_BOOT_TIMEOUT_MS) => {
  if (!cachedReadyPromise) {
    cachedReadyPromise = withTimeout(waitForPendingWrites(db), timeoutMs).catch(noop);
  }
  return cachedReadyPromise;
};

/**
 * Hook exposing offline/online state and the timestamp of the last known online moment.
 * Uses NetInfo listeners so we get immediate feedback plus background polling when supported.
 * @returns {{ isOffline: boolean, lastOnlineAt: number }} connectivity state.
 */
export const useConnectivity = () => {
  const [state, setState] = useState(() => ({ isOffline: false, lastOnlineAt: Date.now() }));
  const lastOnlineRef = useRef(Date.now());

  useEffect(() => {
    let mounted = true;
    const handleUpdate = (info) => {
      const isConnected = info.isConnected && info.isInternetReachable !== false;
      const offline = !isConnected;
      if (!offline) {
        lastOnlineRef.current = Date.now();
      }
      if (mounted) {
        setState({ isOffline: offline, lastOnlineAt: lastOnlineRef.current });
      }
    };

    const unsub = NetInfo.addEventListener(handleUpdate);
    NetInfo.fetch().then(handleUpdate).catch(noop);

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return state;
};

/**
 * Store a deferred action so it can be replayed when connectivity returns.
 * @param {string} actionKey Identifier resolved by flush handlers (e.g. `reservations:updateStatus`).
 * @param {any} payload Serialisable payload for the handler.
 * @returns {Promise<object>} the queued entry.
 */
export const enqueueSyncAction = async (actionKey, payload) => {
  if (!actionKey) throw new Error('enqueueSyncAction requires an actionKey');
  const entry = {
    id: `${actionKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    actionKey,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };
  const queue = await loadQueue();
  queue.push(entry);
  await persistQueue(queue);
  return entry;
};

/**
 * Attempts to execute queued actions. Handlers return promises and receive payload + entry metadata.
 * @param {Record<string, Function>} actionsMap map of actionKey -> async handler.
 * @returns {Promise<{ executed: object[], pending: object[] }>} processed summary.
 */
export const flushSyncQueue = async (actionsMap = {}) => {
  const queue = await loadQueue();
  if (!queue.length) {
    return { executed: [], pending: [] };
  }

  const executed = [];
  const pending = [];

  for (const entry of queue) {
    const handler = actionsMap[entry.actionKey];
    if (typeof handler !== 'function') {
      pending.push(entry);
      continue;
    }

    try {
      await handler(entry.payload, entry);
      executed.push(entry);
    } catch (error) {
      console.warn(`[offline] Failed to flush action ${entry.actionKey}`, error);
      pending.push({
        ...entry,
        retryCount: (entry.retryCount || 0) + 1,
        lastError: error?.message,
      });
    }
  }

  await persistQueue(pending);
  return { executed, pending };
};

/**
 * React hook that watches connectivity and drains the queue when we come back online.
 * Ideal place to register module-specific sync handlers.
 * @param {Record<string, Function>} actionsMap Map of actionKey to async handler.
 * @param {{ runOnMount?: boolean, isOffline?: boolean }} options Extra behaviour flags.
 * @returns {{ syncing: boolean, lastResult: {executed: object[], pending: object[]}, flush: Function }}
 */
export const useOfflineSync = (actionsMap = {}, options = {}) => {
  const { runOnMount = true, isOffline: offlineOverride } = options;
  const connectivityState = useConnectivity();
  const isOffline = typeof offlineOverride === 'boolean' ? offlineOverride : connectivityState.isOffline;
  const actionsRef = useRef(actionsMap);
  actionsRef.current = actionsMap;

  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const lastResultRef = useRef({ executed: [], pending: [] });
  const [lastResult, setLastResult] = useState({ executed: [], pending: [] });
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const prevOfflineRef = useRef(isOffline);

  const flush = useCallback(async () => {
    if (syncingRef.current) {
      return lastResultRef.current;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushSyncQueue(actionsRef.current);
      lastResultRef.current = result;
      if (mountedRef.current) {
        setLastResult(result);
      }
      return result;
    } finally {
      syncingRef.current = false;
      if (mountedRef.current) {
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    const wasOffline = prevOfflineRef.current;
    prevOfflineRef.current = isOffline;
    if (isOffline) return;
    if (!wasOffline && !runOnMount && lastResultRef.current.executed.length) {
      return;
    }
    flush().catch((error) => {
      console.warn('[offline] flush failed', error);
    });
  }, [isOffline, runOnMount, flush]);

  return { syncing, lastResult, flush, connectivity: connectivityState };
};

export default {
  ensureOfflineReady,
  useConnectivity,
  enqueueSyncAction,
  flushSyncQueue,
  useOfflineSync,
};
