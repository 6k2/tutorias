const ROLE_LABELS = {
  teacher: 'Docente',
  docente: 'Docente',
  profesor: 'Docente',
  profesora: 'Docente',
  student: 'Estudiante',
  estudiante: 'Estudiante',
  alumno: 'Estudiante',
  alumna: 'Estudiante',
};

const AVATAR_COLORS = [
  '#2563EB',
  '#06B6D4',
  '#059669',
  '#7C3AED',
  '#F97316',
  '#DB2777',
  '#0F766E',
  '#4F46E5',
];

export const buildConversationKey = (uidA, uidB) => {
  if (!uidA || !uidB) return null;
  return [uidA, uidB].sort().join('_');
};

export const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const isRemotePhotoURL = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

export const roleLabel = (role, relationship) => {
  if (relationship) return relationship;
  return ROLE_LABELS[normalizeRole(role)] || 'Contacto';
};

export const stableColorForUid = (uid = '') => {
  const text = String(uid || 'contacto');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const displayNameForProfile = (profile = {}, fallback = {}) => {
  const safeProfile = profile || {};
  const safeFallback = fallback || {};
  const explicit =
    safeProfile.displayName ||
    safeProfile.username ||
    safeProfile.name ||
    safeProfile.email ||
    safeFallback.displayName ||
    safeFallback.username ||
    safeFallback.email;
  if (explicit && String(explicit).trim() && explicit !== 'Sin nombre') {
    return String(explicit).trim();
  }

  const relationship = safeProfile.relationship || safeFallback.relationship;
  const subjectName = safeProfile.subjectName || safeFallback.subjectName;
  const role = roleLabel(safeProfile.role || safeFallback.role, relationship);
  return subjectName ? `${role} de ${subjectName}` : role;
};

export const initialForProfile = (profile = {}, fallback = {}) => {
  const safeProfile = profile || {};
  const safeFallback = fallback || {};
  const name = displayNameForProfile(safeProfile, safeFallback);
  const first = String(name || '').trim()[0];
  if (first) return first.toUpperCase();
  return String(safeProfile.uid || safeFallback.uid || '?')[0].toUpperCase();
};

export const normalizeParticipantProfile = (user = {}, conversationId, meta = {}) => {
  const safeUser = user || {};
  const safeMeta = meta || {};
  const uid = safeUser?.uid || null;
  const isStudent = uid && safeMeta?.studentId === uid;
  const isTeacher = uid && safeMeta?.teacherId === uid;
  const relationship =
    safeUser?.relationship ||
    safeMeta?.relationship ||
    (isTeacher ? 'Docente' : isStudent ? 'Estudiante' : null);
  const subjectName = safeUser?.subjectName || safeMeta?.subjectName || null;

  return {
    uid,
    displayName: displayNameForProfile(safeUser, {
      displayName: isTeacher ? safeMeta?.teacherDisplayName : isStudent ? safeMeta?.studentDisplayName : null,
      relationship,
      role: safeUser?.role,
      subjectName,
    }),
    photoURL: isRemotePhotoURL(safeUser?.photoURL) ? safeUser.photoURL : null,
    role: safeUser?.role || (isTeacher ? 'teacher' : isStudent ? 'student' : null),
    relationship,
    conversationId,
    subjectKey: safeUser?.subjectKey || safeMeta?.subjectKey || null,
    subjectName,
    avatarColor: stableColorForUid(uid),
  };
};

const asRecord = (value) => (value && typeof value === 'object' ? value : {});

export const participantsFromConversation = (conversation = {}, currentUid = null) => {
  const safeConversation = asRecord(conversation);
  if (!Object.keys(safeConversation).length) return [];
  const profileMap = asRecord(safeConversation.participantProfiles);
  const profiles = Object.values(profileMap).filter((item) => item?.uid);
  if (profiles.length) {
    return profiles.map((profile) => ({
      ...profile,
      photoURL: isRemotePhotoURL(profile.photoURL) ? profile.photoURL : null,
    }));
  }
  return Array.isArray(safeConversation.participants)
    ? safeConversation.participants.map((profile) => ({
      ...profile,
      photoURL: isRemotePhotoURL(profile.photoURL) ? profile.photoURL : null,
    }))
    : [];
};

export const partnerFromConversation = (conversation = {}, currentUid = null) => {
  const safeConversation = asRecord(conversation);
  if (!Object.keys(safeConversation).length) return null;
  const participants = participantsFromConversation(safeConversation, currentUid);
  const partner = participants.find((item) => item?.uid && item.uid !== currentUid);
  if (partner) {
    return {
      ...partner,
      displayName: displayNameForProfile(partner, safeConversation.enrollmentMeta || {}),
      avatarColor: partner.avatarColor || stableColorForUid(partner.uid),
    };
  }

  const meta = safeConversation.enrollmentMeta || {};
  const participantUids = Array.isArray(safeConversation.participantUids)
    ? safeConversation.participantUids
    : [];
  const uid =
    participantUids.find((item) => item && item !== currentUid) ||
    (meta.studentId && meta.studentId !== currentUid ? meta.studentId : meta.teacherId);
  if (!uid) return null;

  return normalizeParticipantProfile(
    {
      uid,
      role: uid === meta.teacherId ? 'teacher' : 'student',
    },
    safeConversation.id,
    meta
  );
};
