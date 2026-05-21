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
  const explicit =
    profile.displayName ||
    profile.username ||
    profile.name ||
    profile.email ||
    fallback.displayName ||
    fallback.username ||
    fallback.email;
  if (explicit && String(explicit).trim() && explicit !== 'Sin nombre') {
    return String(explicit).trim();
  }

  const relationship = profile.relationship || fallback.relationship;
  const subjectName = profile.subjectName || fallback.subjectName;
  const role = roleLabel(profile.role || fallback.role, relationship);
  return subjectName ? `${role} de ${subjectName}` : role;
};

export const initialForProfile = (profile = {}, fallback = {}) => {
  const name = displayNameForProfile(profile, fallback);
  const first = String(name || '').trim()[0];
  if (first) return first.toUpperCase();
  return String(profile.uid || fallback.uid || '?')[0].toUpperCase();
};

export const normalizeParticipantProfile = (user = {}, conversationId, meta = {}) => {
  const uid = user?.uid || null;
  const isStudent = uid && meta?.studentId === uid;
  const isTeacher = uid && meta?.teacherId === uid;
  const relationship =
    user?.relationship ||
    meta?.relationship ||
    (isTeacher ? 'Docente' : isStudent ? 'Estudiante' : null);
  const subjectName = user?.subjectName || meta?.subjectName || null;

  return {
    uid,
    displayName: displayNameForProfile(user, {
      displayName: isTeacher ? meta?.teacherDisplayName : isStudent ? meta?.studentDisplayName : null,
      relationship,
      role: user?.role,
      subjectName,
    }),
    photoURL: user?.photoURL || null,
    role: user?.role || (isTeacher ? 'teacher' : isStudent ? 'student' : null),
    relationship,
    conversationId,
    subjectKey: user?.subjectKey || meta?.subjectKey || null,
    subjectName,
    avatarColor: stableColorForUid(uid),
  };
};

export const participantsFromConversation = (conversation = {}, currentUid = null) => {
  const profileMap = conversation.participantProfiles || {};
  const profiles = Object.values(profileMap).filter((item) => item?.uid);
  if (profiles.length) return profiles;
  return Array.isArray(conversation.participants) ? conversation.participants : [];
};

export const partnerFromConversation = (conversation = {}, currentUid = null) => {
  const participants = participantsFromConversation(conversation, currentUid);
  const partner = participants.find((item) => item?.uid && item.uid !== currentUid);
  if (partner) {
    return {
      ...partner,
      displayName: displayNameForProfile(partner, conversation.enrollmentMeta || {}),
      avatarColor: partner.avatarColor || stableColorForUid(partner.uid),
    };
  }

  const meta = conversation.enrollmentMeta || {};
  const participantUids = Array.isArray(conversation.participantUids)
    ? conversation.participantUids
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
    conversation.id,
    meta
  );
};
