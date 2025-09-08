import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function signUpWithEmail({ email, password, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = cred.user;
  const userDoc = {
    uid,
    role,
    displayName: '',
    photoURL: '',
    bio: '',
    specialties: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), userDoc);
  return cred.user;
}

export function signInWithEmail({ email, password }) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return fbSignOut(auth);
}
