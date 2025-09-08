import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';

export async function getCurrentUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(uid, data) {
  const payload = { ...data, updatedAt: new Date() };
  if (data.localUri) {
    const response = await fetch(data.localUri);
    const blob = await response.blob();
    const storageRef = ref(storage, `avatars/${uid}.jpg`);
    await uploadBytes(storageRef, blob);
    const photoURL = await getDownloadURL(storageRef);
    payload.photoURL = photoURL;
  }
  delete payload.localUri;
  await updateDoc(doc(db, 'users', uid), payload);
  return payload;
}

export function observeAuthState(callback) {
  return auth.onAuthStateChanged(callback);
}
