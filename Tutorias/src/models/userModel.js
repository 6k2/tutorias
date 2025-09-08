// Firestore user document schema
// {
//   uid: string,
//   role: 'student' | 'tutor',
//   displayName: string,
//   photoURL: string,
//   bio: string,
//   specialties: string[],
//   createdAt: Timestamp,
//   updatedAt: Timestamp
// }

export function createEmptyUser(uid, role) {
  return {
    uid,
    role,
    displayName: '',
    photoURL: '',
    bio: '',
    specialties: [],
    createdAt: null,
    updatedAt: null,
  };
}
