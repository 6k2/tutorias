import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import {
  RESERVATION_STATUS,
  RESERVATIONS_COLLECTION,
} from '../../../constants/firestore';
import { ensureOfflineReady } from '../../../tools/offline';

export function useConfirmedEnrollments(uid, role, options = {}) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [fromCache, setFromCache] = useState(false);

  const disabled = options?.disabled;

  useEffect(() => {
    if (!uid || disabled) {
      setReservations([]);
      setFromCache(false);
      setLoading(false);
      return () => {};
    }

    let unsub = () => {};
    let cancelled = false;
    setLoading(true);

    ensureOfflineReady()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        const normalizedRole = String(role || 'student').toLowerCase();
        const field = normalizedRole === 'teacher' ? 'teacherId' : 'studentId';
        const reservationsQuery = query(
          collection(db, RESERVATIONS_COLLECTION),
          where(field, '==', uid),
          where('status', '==', RESERVATION_STATUS.CONFIRMED)
        );
        unsub = onSnapshot(
          reservationsQuery,
          (snapshot) => {
            const rows = snapshot.docs.map((docSnapshot) => {
              const data = docSnapshot.data() || {};
              return {
                id: docSnapshot.id,
                reservation: data,
                studentId: data.studentId || null,
                studentDisplayName: data.studentDisplayName || data.studentName || null,
                teacherId: data.teacherId || null,
                teacherDisplayName: data.teacherDisplayName || data.teacherName || null,
                subjectKey: data.subjectKey || null,
                subjectName: data.subjectName || '',
                offerId: data.offerId || null,
                slot: data.slot || null,
              };
            });
            if (!cancelled) {
              setReservations(rows);
              setFromCache(snapshot.metadata?.fromCache ?? false);
              setLoading(false);
            }
          },
          (error) => {
            console.error('useConfirmedEnrollments: snapshot failed', error);
            if (!cancelled) {
              setReservations([]);
              setFromCache(false);
              setLoading(false);
            }
          }
        );
      });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, role, disabled]);

  return { reservations, loading, fromCache };
}
