import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../app/config/firebase';
import { enqueueSyncAction } from '../tools/offline';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../constants/firestore';

const STORAGE_PREFIX = 'offline:reservations:';
const watchers = new Map();

const notifyWatchers = (key, payload) => {
  const listeners = watchers.get(key);
  if (!listeners) return;
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (error) {
      console.warn('useReservations: watcher failed', error);
    }
  });
};

const subscribeToCache = (key, callback) => {
  if (!key || typeof callback !== 'function') return () => {};
  let listeners = watchers.get(key);
  if (!listeners) {
    listeners = new Set();
    watchers.set(key, listeners);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) watchers.delete(key);
  };
};

const parseCache = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.records)) {
      return parsed.records;
    }
  } catch (error) {
    console.warn('useReservations: failed to parse cache', error);
  }
  return null;
};

const loadCache = async (key) => {
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return parseCache(raw);
  } catch (error) {
    console.warn('useReservations: failed to load cache', error);
    return null;
  }
};

const persistCache = async (key, records) => {
  if (!key) return;
  try {
    if (!records || records.length === 0) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ records, updatedAt: Date.now() })
    );
  } catch (error) {
    console.warn('useReservations: failed to persist cache', error);
  }
};

const sortReservations = (rows) => {
  const copy = [...rows];
  copy.sort((a, b) => {
    const timeA = a.updatedAt?.toMillis?.()
      ? a.updatedAt.toMillis()
      : a.updatedAt || a.createdAt?.toMillis?.() || a.createdAt || 0;
    const timeB = b.updatedAt?.toMillis?.()
      ? b.updatedAt.toMillis()
      : b.updatedAt || b.createdAt?.toMillis?.() || b.createdAt || 0;
    return timeB - timeA;
  });
  return copy;
};

const STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: 'Pendiente',
  [RESERVATION_STATUS.CONFIRMED]: 'Confirmada',
  [RESERVATION_STATUS.REJECTED]: 'Rechazada',
  [RESERVATION_STATUS.CANCELLED]: 'Cancelada',
};

const withLabels = (rows = []) =>
  rows.map((item) => ({
    ...item,
    statusLabel: STATUS_LABELS[item.status] || item.status,
  }));

export const useReservations = (role, uid, options = {}) => {
  const { disabled = false } = options;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const storageKeyRef = useRef(null);

  useEffect(() => {
    if (!uid || !role || disabled) {
      setRecords([]);
      setLoading(false);
      setFromCache(false);
      return () => {};
    }

    const storageKey = `${STORAGE_PREFIX}${uid}`;
    storageKeyRef.current = storageKey;
    let active = true;

    const applyRecords = (rows, metaFromCache = false) => {
      if (!active) return;
      const sorted = sortReservations(rows);
      setRecords(withLabels(sorted));
      setFromCache(metaFromCache);
      setLoading(false);
    };

    const unsubscribeWatcher = subscribeToCache(storageKey, (payload) => {
      if (Array.isArray(payload)) {
        applyRecords(payload, true);
      }
    });

    loadCache(storageKey).then((cached) => {
      if (cached && active) {
        applyRecords(cached, true);
      }
    });

    const field = String(role).toLowerCase() === 'teacher' ? 'teacherId' : 'studentId';
    const q = query(collection(db, RESERVATIONS_COLLECTION), where(field, '==', uid));

    const unsubscribeSnapshot = onSnapshot(
      q,
      { includeMetadataChanges: true },
      async (snapshot) => {
        if (!active) return;

        if (snapshot.metadata.fromCache && snapshot.empty) {
          const cached = await loadCache(storageKey);
          if (cached) {
            applyRecords(cached, true);
            return;
          }
        }

        const rows = [];
        snapshot.forEach((item) => {
          rows.push({ id: item.id, ...item.data() });
        });
        applyRecords(rows, snapshot.metadata.fromCache);
        persistCache(storageKey, rows);
        notifyWatchers(storageKey, rows);
      },
      (error) => {
        console.error('useReservations: snapshot failed', error);
        if (active) {
          setRecords([]);
          setFromCache(false);
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribeSnapshot();
      unsubscribeWatcher();
    };
  }, [role, uid, disabled]);

  const reservations = useMemo(() => records, [records]);

  return { reservations, loading, fromCache, storageKey: storageKeyRef.current };
};

const updateReservationStatusServer = async (reservationId, nextStatus) => {
  if (!reservationId || !nextStatus) {
    throw new Error('Missing reservation data');
  }

  await runTransaction(db, async (transaction) => {
    const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    const reservationSnap = await transaction.get(reservationRef);
    if (!reservationSnap.exists()) {
      throw new Error('Reservation not found');
    }

    const reservation = reservationSnap.data() || {};
    const prevStatus = reservation.status;
    const timestamp = serverTimestamp();

    if (prevStatus === nextStatus) {
      transaction.update(reservationRef, { updatedAt: timestamp });
      return;
    }

    const updates = { status: nextStatus, updatedAt: timestamp };

    let offerRef = null;
    let offerData = null;
    if (reservation.offerId) {
      offerRef = doc(db, OFFERS_COLLECTION, reservation.offerId);
      const offerSnap = await transaction.get(offerRef);
      if (offerSnap.exists()) {
        offerData = offerSnap.data() || {};
      }
    }

    transaction.update(reservationRef, updates);

    if (!offerRef || !offerData) {
      return;
    }

    const pending = Number(offerData.pendingCount || 0);
    const enrolled = Number(offerData.enrolledCount || 0);
    const wasPending = prevStatus === RESERVATION_STATUS.PENDING;
    const wasConfirmed = prevStatus === RESERVATION_STATUS.CONFIRMED;

    let nextPending = pending;
    let nextEnrolled = enrolled;

    if (nextStatus === RESERVATION_STATUS.CONFIRMED) {
      nextPending = wasPending ? Math.max(0, pending - 1) : pending;
      nextEnrolled = wasConfirmed ? enrolled : enrolled + 1;
    } else if (
      nextStatus === RESERVATION_STATUS.REJECTED ||
      nextStatus === RESERVATION_STATUS.CANCELLED
    ) {
      nextPending = wasPending ? Math.max(0, pending - 1) : pending;
      nextEnrolled = wasConfirmed ? Math.max(0, enrolled - 1) : enrolled;
    }

    transaction.update(offerRef, {
      pendingCount: nextPending,
      enrolledCount: nextEnrolled,
      updatedAt: timestamp,
    });
  });
};

const applyOptimisticUpdate = (records, reservationId, nextStatus) => {
  return records.map((item) => {
    if (item.id !== reservationId) return item;
    return {
      ...item,
      status: nextStatus,
      updatedAt: Date.now(),
      syncStatus: 'pending',
      _pendingSync: true,
    };
  });
};

const clearPendingFlag = (records, reservationId) =>
  records.map((item) => {
    if (item.id !== reservationId) return item;
    const clone = { ...item };
    delete clone._pendingSync;
    delete clone.syncStatus;
    return clone;
  });

export const updateReservationStatusOffline = async (
  reservationId,
  nextStatus,
  context = {}
) => {
  const { isOffline = false, userId = null } = context;
  if (!reservationId || !nextStatus) {
    throw new Error('Missing reservation data');
  }

  if (!isOffline) {
    await updateReservationStatusServer(reservationId, nextStatus);
    return { queued: false };
  }

  if (!userId) {
    throw new Error('updateReservationStatusOffline requires userId when offline');
  }

  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const cached = (await loadCache(storageKey)) || [];
  const optimistic = applyOptimisticUpdate(cached, reservationId, nextStatus);

  await persistCache(storageKey, optimistic);
  notifyWatchers(storageKey, optimistic);

  await enqueueSyncAction('reservations:updateStatus', {
    id: reservationId,
    nextStatus,
    userId,
  });

  return { queued: true, optimistic: withLabels(sortReservations(optimistic)) };
};

export const markReservationSynced = async (userId, reservationId) => {
  if (!userId || !reservationId) return;
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const cached = (await loadCache(storageKey)) || [];
  if (!cached.length) return;
  const updated = clearPendingFlag(cached, reservationId);
  await persistCache(storageKey, updated);
  notifyWatchers(storageKey, updated);
};

export { updateReservationStatusServer as updateReservationStatus };
