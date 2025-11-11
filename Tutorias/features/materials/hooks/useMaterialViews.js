import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { toMillis } from '../utils/dates';

const emptyMap = {};

export function useMaterialViews(uid) {
  const [views, setViews] = useState(emptyMap);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setViews(emptyMap);
      setLoading(false);
      return () => {};
    }
    const coll = collection(db, 'users', uid, 'materialViews');
    let cancelled = false;
    setLoading(true);
    const unsubscribe = onSnapshot(
      coll,
      (snapshot) => {
        if (cancelled) return;
        const next = {};
        snapshot.forEach((docSnapshot) => {
          next[docSnapshot.id] = docSnapshot.data() || {};
        });
        setViews(next);
        setLoading(false);
      },
      (error) => {
        console.error('useMaterialViews: snapshot failed', error);
        if (!cancelled) {
          setViews(emptyMap);
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  const markMaterialViewed = useCallback(
    async (materialIds, reservationId) => {
      if (!uid) return;
      const ids = Array.isArray(materialIds) ? materialIds : [materialIds];
      if (!ids.length) return;
      await Promise.all(
        ids.map(async (materialId) => {
          const ref = doc(db, 'users', uid, 'materialViews', materialId);
          await setDoc(
            ref,
            {
              materialId,
              reservationId: reservationId || null,
              lastViewedAt: serverTimestamp(),
            },
            { merge: true }
          );
        })
      );
    },
    [uid]
  );

  const lastViewedMap = useMemo(() => views, [views]);

  const getLastViewedAt = useCallback(
    (materialId) => {
      const entry = lastViewedMap[materialId];
      if (!entry) return 0;
      return toMillis(entry.lastViewedAt);
    },
    [lastViewedMap]
  );

  return { views: lastViewedMap, loading, markMaterialViewed, getLastViewedAt };
}
