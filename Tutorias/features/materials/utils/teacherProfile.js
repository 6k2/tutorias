const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const isNonEmpty = (value) => Boolean(value && typeof value === 'string' && value.trim());

export const buildTeacherProfile = ({ uid, displayName, subjects, bio }) => {
  if (!isNonEmpty(uid)) {
    throw new Error('uid is required for a teacher profile');
  }
  if (!isNonEmpty(displayName)) {
    throw new Error('displayName is required for a teacher profile');
  }
  if (!Array.isArray(subjects)) {
    throw new Error('subjects must be an array');
  }

  const cleanSubjects = subjects
    .map((subject) => trimString(subject))
    .filter(Boolean);

  return {
    uid: trimString(uid),
    displayName: trimString(displayName),
    subjects: cleanSubjects,
    bio: trimString(bio) || null,
    createdAt: Date.now(),
  };
};
