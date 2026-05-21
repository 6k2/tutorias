import { useMemo } from 'react';
import { useConfirmedEnrollments } from '../../materials/hooks/useConfirmedEnrollments';
import { displayNameForProfile } from '../utils/profiles';

const emptySet = new Set();
const emptyMap = new Map();

export function useChatEnrollments(currentUser) {
  const uid = currentUser?.uid || null;
  const role = currentUser?.role || null;
  const { reservations, loading, fromCache } = useConfirmedEnrollments(uid, role);

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
          studentDisplayName: displayNameForProfile(
            {
              displayName:
                row.studentDisplayName ||
                row.reservation?.studentDisplayName ||
                row.reservation?.studentName,
              role: 'student',
              uid: studentId,
            },
            { relationship: 'Estudiante', subjectName: row.subjectName }
          ),
          teacherId,
          teacherDisplayName: displayNameForProfile(
            {
              displayName:
                row.teacherDisplayName ||
                row.reservation?.teacherDisplayName ||
                row.reservation?.teacherName,
              role: 'teacher',
              uid: teacherId,
            },
            { relationship: 'Docente', subjectName: row.subjectName }
          ),
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

  return {
    enrollments: records,
    allowedKeys,
    metaByKey,
    loading,
    fromCache,
  };
}
