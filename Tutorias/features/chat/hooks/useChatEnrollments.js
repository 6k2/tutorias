import { useEffect, useMemo, useRef } from 'react';
import { useConfirmedEnrollments } from '../../materials/hooks/useConfirmedEnrollments';
import { ensureConversationRecord } from '../api/conversations';

const emptySet = new Set();
const emptyMap = new Map();

export function useChatEnrollments(currentUser) {
  const uid = currentUser?.uid || null;
  const role = currentUser?.role || null;
  const normalizedRole = String(role || 'student').toLowerCase();
  const { reservations, loading, fromCache } = useConfirmedEnrollments(uid, role);
  const ensuredKeysRef = useRef(new Set());
  const ensuringKeysRef = useRef(new Set());

  const records = useMemo(() => {
    if (!reservations.length) return [];
    return reservations
      .map((row) => {
        const studentId = row.studentId;
        const teacherId = row.teacherId;
        const participants = [studentId, teacherId].filter(Boolean).sort();
        const conversationKey =
          participants.length === 2 ? `${participants[0]}_${participants[1]}` : null;
        return {
          id: row.id,
          studentId,
          studentDisplayName:
            row.studentDisplayName ||
            row.reservation?.studentDisplayName ||
            row.reservation?.studentName ||
            'Sin nombre',
          teacherId,
          teacherDisplayName:
            row.teacherDisplayName ||
            row.reservation?.teacherDisplayName ||
            row.reservation?.teacherName ||
            'Sin nombre',
          subjectKey: row.subjectKey || null,
          subjectName: row.subjectName || '',
          conversationKey,
          reservation: row.reservation,
        };
      })
      .filter((row) => row.conversationKey);
  }, [reservations]);

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

  useEffect(() => {
    ensuredKeysRef.current = new Set();
    ensuringKeysRef.current = new Set();
  }, [uid]);

  useEffect(() => {
    if (!uid || !currentUser) return;

    records.forEach((record) => {
      if (!record.conversationKey) return;
      if (
        ensuredKeysRef.current.has(record.conversationKey) ||
        ensuringKeysRef.current.has(record.conversationKey)
      ) {
        return;
      }

      const partner =
        normalizedRole === 'teacher'
          ? {
              uid: record.studentId,
              displayName: record.studentDisplayName || 'Sin nombre',
              role: 'student',
            }
          : {
              uid: record.teacherId,
              displayName: record.teacherDisplayName || 'Sin nombre',
              role: 'teacher',
            };

      if (!partner.uid) {
        return;
      }

      ensuringKeysRef.current.add(record.conversationKey);
      ensureConversationRecord({
        myUser: currentUser,
        otherUser: partner,
        meta: record,
      })
        .then(() => {
          ensuredKeysRef.current.add(record.conversationKey);
        })
        .catch((error) => {
          console.error('useChatEnrollments: failed to ensure conversation', error);
        })
        .finally(() => {
          ensuringKeysRef.current.delete(record.conversationKey);
        });
    });
  }, [records, uid, normalizedRole, currentUser]);

  return {
    enrollments: records,
    allowedKeys,
    metaByKey,
    loading,
    fromCache,
  };
}
