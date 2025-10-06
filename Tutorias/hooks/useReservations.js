import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../app/config/firebase';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../constants/firestore';

const STATUS_LABELS = {
  [RESERVATION_STATUS.PENDING]: 'Pending',
  [RESERVATION_STATUS.CONFIRMED]: 'Confirmed',
  [RESERVATION_STATUS.REJECTED]: 'Rejected',
  [RESERVATION_STATUS.CANCELLED]: 'Cancelled',
};

export function useReservationsByRole(role, uid) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !role) {
      setRecords([]);
      setLoading(false);
      return undefined;
    }
    const field = String(role).toLowerCase() === 'teacher' ? 'teacherId' : 'studentId';
    const q = query(collection(db, RESERVATIONS_COLLECTION), where(field, '==', uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const rows = [];
      snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
      rows.sort((a, b) => {
        const timeA = (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0);
        const timeB = (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0);
        return timeB - timeA;
      });
      setRecords(rows);
      setLoading(false);
    }, (error) => {
      console.error('useReservations: snapshot failed', error);
      setRecords([]);
      setLoading(false);
    });
    return () => unsub();
  }, [role, uid]);

  const reservations = useMemo(() => (
    records.map((item) => ({
      ...item,
      statusLabel: STATUS_LABELS[item.status] || item.status,
    }))
  ), [records]);

  return { reservations, loading };
}

export async function updateReservationStatus(reservationId, nextStatus) {
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
    if (prevStatus === nextStatus) {
      transaction.update(reservationRef, { updatedAt: serverTimestamp() });
      return;
    }

    const updates = { status: nextStatus, updatedAt: serverTimestamp() };
    transaction.update(reservationRef, updates);

    if (!reservation.offerId) return;

    const offerRef = doc(db, OFFERS_COLLECTION, reservation.offerId);
    const offerSnap = await transaction.get(offerRef);
    if (!offerSnap.exists()) return;

    const offerData = offerSnap.data() || {};
    const pending = Number(offerData.pendingCount || 0);
    const enrolled = Number(offerData.enrolledCount || 0);

    const wasPending = prevStatus === RESERVATION_STATUS.PENDING;
    const wasConfirmed = prevStatus === RESERVATION_STATUS.CONFIRMED;

    if (nextStatus === RESERVATION_STATUS.CONFIRMED) {
      transaction.update(offerRef, {
        pendingCount: wasPending ? Math.max(0, pending - 1) : pending,
        enrolledCount: wasConfirmed ? enrolled : enrolled + 1,
        updatedAt: serverTimestamp(),
      });
    } else if (nextStatus === RESERVATION_STATUS.REJECTED || nextStatus === RESERVATION_STATUS.CANCELLED) {
      transaction.update(offerRef, {
        pendingCount: wasPending ? Math.max(0, pending - 1) : pending,
        enrolledCount: wasConfirmed ? Math.max(0, enrolled - 1) : enrolled,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.update(offerRef, {
        updatedAt: serverTimestamp(),
      });
    }
  });
}
