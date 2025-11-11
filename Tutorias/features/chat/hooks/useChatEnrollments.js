import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { RESERVATION_STATUS } from '../../../constants/firestore';

const emptySet = new Set();
const emptyMap = new Map();

export function useChatEnrollments(uid, role) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!uid) {
      setRecords([]);
      setLoading(false);
      setFromCache(false);
      return () => {};
    }

    const normalizedRole = String(role || 'student').toLowerCase();
    const field = normalizedRole === 'teacher' ? 'teacherId' : 'studentId';
    const reservationsQuery = query(
      collection(db, 'reservations'),
      where(field, '==', uid),
      where('status', '==', RESERVATION_STATUS.CONFIRMED)
    );

    const unsubscribe = onSnapshot(
      reservationsQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() || {};
          const studentId = data.studentId;
          const teacherId = data.teacherId;
          const participants = [studentId, teacherId].filter(Boolean).sort();
          const conversationKey =
            participants.length === 2 ? `${participants[0]}_${participants[1]}` : null;
          return {
            id: docSnapshot.id,
            studentId,
            teacherId,
            subjectKey: data.subjectKey || null,
            subjectName: data.subjectName || '',
            conversationKey,
            reservation: data,
          };
        });
        setRecords(rows.filter((row) => row.conversationKey));
        setFromCache(snapshot.metadata?.fromCache ?? false);
        setLoading(false);
      },
      (error) => {
        console.error('chat: failed to load enrollments', error);
        setRecords([]);
        setFromCache(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, role]);

  const allowedKeys = useMemo(() => {
    if (!records.length) return emptySet;
    return new Set(records.map((row) => row.conversationKey));
  }, [records]);

  const metaByKey = useMemo(() => {
    if (!records.length) return emptyMap;
    const map = new Map();
    records.forEach((row) => {
      map.set(row.conversationKey, row);
    });
    return map;
  }, [records]);

  return {
    enrollments: records,
    allowedKeys,
    metaByKey,
    loading,
    fromCache,
  };
}
