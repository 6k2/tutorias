import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config/firebase';

export function useTeacherOfferStatus(uid, subjects = [], options = {}) {
  const { disabled = false } = options;
  const subjectKeys = useMemo(
    () => subjects.map((subject) => subject.key).filter(Boolean),
    [subjects]
  );
  const signature = subjectKeys.join('|');
  const [statusBySubject, setStatusBySubject] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || disabled || subjectKeys.length === 0) {
      setStatusBySubject({});
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    async function load() {
      const entries = await Promise.all(
        subjectKeys.map(async (subjectKey) => {
          const offerId = `${uid}_${subjectKey}`;
          try {
            const [mainSnap, userSnap] = await Promise.all([
              getDoc(doc(db, 'offers', offerId)),
              getDoc(doc(db, 'users', uid, 'offers', subjectKey)),
            ]);
            return [subjectKey, { checked: true, hasExisting: mainSnap.exists() || userSnap.exists() }];
          } catch {
            return [subjectKey, { checked: true, hasExisting: false }];
          }
        })
      );

      if (active) {
        setStatusBySubject(Object.fromEntries(entries));
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [uid, disabled, signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    statusBySubject,
    loading,
    canCreate: (subjectKey) => {
      const status = statusBySubject[subjectKey];
      return Boolean(status?.checked && !status.hasExisting);
    },
  };
}
