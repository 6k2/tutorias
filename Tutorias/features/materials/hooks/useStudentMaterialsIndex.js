import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { TUTORING_MATERIALS_COLLECTION } from '../../../constants/firestore';
import { ensureOfflineReady } from '../../../tools/offline';

export function useStudentMaterialsIndex(uid, options = {}) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [fromCache, setFromCache] = useState(false);

  const disabled = options?.disabled;

  useEffect(() => {
    if (!uid || disabled) {
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
          where('studentId', '==', uid),
          orderBy('updatedAt', 'desc')
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
            console.error('useStudentMaterialsIndex: snapshot failed', error);
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
  }, [uid, disabled]);

  const byReservation = useMemo(() => {
    if (!materials.length) return new Map();
    const map = new Map();
    materials.forEach((material) => {
      const bucket = map.get(material.reservationId) || [];
      bucket.push(material);
      map.set(material.reservationId, bucket);
    });
    return map;
  }, [materials]);

  return { materials, byReservation, loading, fromCache };
}
