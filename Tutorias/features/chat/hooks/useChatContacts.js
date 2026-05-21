import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../app/config/firebase';
import { RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../../../constants/firestore';
import { useChatEnrollments } from './useChatEnrollments';

const emptySet = new Set();
const emptyMap = new Map();

const teacherRoles = new Set(['teacher', 'docente', 'profesor', 'profesora']);

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const isTeacherRole = (role) => teacherRoles.has(normalizeRole(role));

const buildConversationKey = (uidA, uidB) => {
  if (!uidA || !uidB) return null;
  return [uidA, uidB].sort().join('_');
};

const reservationFromSnapshot = (docSnapshot) => {
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
};

const contactContext = (row, relationship) => ({
  id: row.id,
  reservationId: row.id,
  offerId: row.offerId || null,
  subjectKey: row.subjectKey || null,
  subjectName: row.subjectName || '',
  studentId: row.studentId || null,
  studentDisplayName: row.studentDisplayName || 'Sin nombre',
  teacherId: row.teacherId || null,
  teacherDisplayName: row.teacherDisplayName || 'Sin nombre',
  relationship,
});

const mergeContact = (map, contact) => {
  if (!contact?.uid || !contact?.conversationKey) return;
  const existing = map.get(contact.uid);
  if (!existing) {
    map.set(contact.uid, {
      ...contact,
      contexts: contact.contexts || [contact.meta].filter(Boolean),
    });
    return;
  }

  const contexts = [...existing.contexts];
  (contact.contexts || [contact.meta]).forEach((context) => {
    if (!context) return;
    const duplicate = contexts.some(
      (item) =>
        item.subjectKey === context.subjectKey &&
        item.relationship === context.relationship &&
        item.reservationId === context.reservationId
    );
    if (!duplicate) contexts.push(context);
  });

  const relationship = existing.relationship === contact.relationship
    ? existing.relationship
    : `${existing.relationship} / ${contact.relationship}`;

  map.set(contact.uid, {
    ...existing,
    relationship,
    contexts,
    subjectName: contexts.map((item) => item.subjectName).filter(Boolean).join(', '),
  });
};

export function useChatContacts(currentUser) {
  const uid = currentUser?.uid || null;
  const currentIsTeacher = isTeacherRole(currentUser?.role);
  const enrollments = useChatEnrollments(currentUser);
  const [peerRows, setPeerRows] = useState([]);
  const [peersLoading, setPeersLoading] = useState(false);
  const [peersFromCache, setPeersFromCache] = useState(false);

  const subjectKeys = useMemo(() => {
    const keys = new Set();
    enrollments.enrollments.forEach((row) => {
      if (row.subjectKey) keys.add(row.subjectKey);
    });
    return [...keys].sort();
  }, [enrollments.enrollments]);

  const subjectKeySignature = subjectKeys.join('|');

  useEffect(() => {
    if (!uid || currentIsTeacher || subjectKeys.length === 0) {
      setPeerRows([]);
      setPeersLoading(false);
      setPeersFromCache(false);
      return () => {};
    }

    let active = true;
    const rowsBySubject = new Map();
    const unsubscribers = [];
    setPeersLoading(true);

    subjectKeys.forEach((subjectKey) => {
      const reservationsQuery = query(
        collection(db, RESERVATIONS_COLLECTION),
        where('subjectKey', '==', subjectKey),
        where('status', '==', RESERVATION_STATUS.CONFIRMED)
      );

      const unsubscribe = onSnapshot(
        reservationsQuery,
        (snapshot) => {
          if (!active) return;
          rowsBySubject.set(subjectKey, snapshot.docs.map(reservationFromSnapshot));
          setPeerRows([...rowsBySubject.values()].flat());
          setPeersFromCache((prev) => prev || snapshot.metadata?.fromCache || false);
          setPeersLoading(false);
        },
        (error) => {
          console.error('useChatContacts: failed to load classmates', error);
          if (active) {
            rowsBySubject.set(subjectKey, []);
            setPeerRows([...rowsBySubject.values()].flat());
            setPeersLoading(false);
          }
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, currentIsTeacher, subjectKeySignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const contacts = useMemo(() => {
    if (!uid) return [];
    const map = new Map();

    enrollments.enrollments.forEach((row) => {
      if (currentIsTeacher) {
        const conversationKey = buildConversationKey(uid, row.studentId);
        mergeContact(map, {
          id: `${row.studentId}:student`,
          uid: row.studentId,
          displayName: row.studentDisplayName || 'Sin nombre',
          role: 'student',
          relationship: 'Estudiante',
          subjectName: row.subjectName || '',
          conversationKey,
          meta: contactContext(row, 'Estudiante'),
        });
        return;
      }

      const conversationKey = buildConversationKey(uid, row.teacherId);
      mergeContact(map, {
        id: `${row.teacherId}:teacher`,
        uid: row.teacherId,
        displayName: row.teacherDisplayName || 'Docente',
        role: 'teacher',
        relationship: 'Docente',
        subjectName: row.subjectName || '',
        conversationKey,
        meta: contactContext(row, 'Docente'),
      });
    });

    if (!currentIsTeacher) {
      peerRows.forEach((row) => {
        if (!row.studentId || row.studentId === uid) return;
        const conversationKey = buildConversationKey(uid, row.studentId);
        mergeContact(map, {
          id: `${row.studentId}:classmate`,
          uid: row.studentId,
          displayName: row.studentDisplayName || 'Compañero',
          role: 'student',
          relationship: 'Compañero',
          subjectName: row.subjectName || '',
          conversationKey,
          meta: contactContext(row, 'Compañero'),
        });
      });
    }

    return [...map.values()].sort((a, b) => {
      const priorityA = a.relationship.includes('Docente') ? 0 : 1;
      const priorityB = b.relationship.includes('Docente') ? 0 : 1;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''));
    });
  }, [uid, currentIsTeacher, enrollments.enrollments, peerRows]);

  const allowedKeys = useMemo(() => {
    if (!contacts.length) return emptySet;
    return new Set(contacts.map((contact) => contact.conversationKey).filter(Boolean));
  }, [contacts]);

  const metaByKey = useMemo(() => {
    if (!contacts.length) return emptyMap;
    const map = new Map();
    contacts.forEach((contact) => {
      if (contact.conversationKey) {
        map.set(contact.conversationKey, contact.meta);
      }
    });
    return map;
  }, [contacts]);

  return {
    contacts,
    allowedKeys,
    metaByKey,
    loading: enrollments.loading || peersLoading,
    fromCache: enrollments.fromCache || peersFromCache,
    enrollments: enrollments.enrollments,
  };
}
