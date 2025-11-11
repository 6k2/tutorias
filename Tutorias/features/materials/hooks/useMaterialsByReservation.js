import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { TUTORING_MATERIALS_COLLECTION } from '../../../constants/firestore';
import { ensureOfflineReady } from '../../../tools/offline';

export function useMaterialsByReservation(reservationId, options = {}) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(Boolean(reservationId));
  const [fromCache, setFromCache] = useState(false);

  const disabled = options?.disabled;

  useEffect(() => {
    if (!reservationId || disabled) {
      setMaterials([]);
      setLoading(false);
      setFromCache(false);
      return () => {};
    }

    let unsub = () => {};
    let cancelled = false;
    setLoading(true);

    ensureOfflineReady()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        const q = query(
          collection(db, TUTORING_MATERIALS_COLLECTION),
          where('reservationId', '==', reservationId),
          orderBy('createdAt', 'desc')
        );
        unsub = onSnapshot(
          q,
          (snapshot) => {
            const rows = snapshot.docs.map((docSnapshot) => ({
              id: docSnapshot.id,
              ...docSnapshot.data(),
            }));
            if (!cancelled) {
              setMaterials(rows);
              setFromCache(snapshot.metadata?.fromCache ?? false);
              setLoading(false);
            }
          },
          (error) => {
            console.error('useMaterialsByReservation: snapshot failed', error);
            if (!cancelled) {
              setMaterials([]);
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
  }, [reservationId, disabled]);

  return { materials, loading, fromCache };
}
