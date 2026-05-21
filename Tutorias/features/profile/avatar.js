import { collectionGroup, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { db, app } from '../../app/config/firebase';

const REMOTE_URL_RE = /^https?:\/\//i;
const LOCAL_URL_RE = /^(file|blob|data|content):/i;

export function isRemotePhotoURL(value) {
  return typeof value === 'string' && REMOTE_URL_RE.test(value) && !LOCAL_URL_RE.test(value);
}

const extensionFromUri = (uri = '') => {
  const clean = String(uri).split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  const ext = match?.[1]?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'jpg';
};

const contentTypeForExt = (ext) => {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
};

export async function uploadProfileAvatar({ uid, uri }) {
  if (!uid || !uri) return '';
  if (isRemotePhotoURL(uri)) return uri;

  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = extensionFromUri(uri);
  const storage = getStorage(app);
  const avatarRef = ref(storage, `profile-avatars/${uid}/avatar.${ext}`);
  await uploadBytes(avatarRef, blob, { contentType: blob.type || contentTypeForExt(ext) });
  return getDownloadURL(avatarRef);
}

export async function resolveProfileAvatar({ uid, uri, fallbackURL = '' }) {
  if (!uri) return { photoURL: '', uploadFailed: false };
  if (isRemotePhotoURL(uri)) return { photoURL: uri, uploadFailed: false };

  try {
    const photoURL = await uploadProfileAvatar({ uid, uri });
    return { photoURL, uploadFailed: false };
  } catch (error) {
    console.warn('Profile avatar upload failed; keeping previous remote photo', error);
    return {
      photoURL: isRemotePhotoURL(fallbackURL) ? fallbackURL : '',
      uploadFailed: true,
      error,
    };
  }
}

export async function syncChatProfileForUser({ uid, displayName, photoURL, role }) {
  if (!uid) return;
  const participantsQuery = query(collectionGroup(db, 'participants'), where('uid', '==', uid));
  const snapshot = await getDocs(participantsQuery);
  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let writes = 0;
  const safePhotoURL = isRemotePhotoURL(photoURL) ? photoURL : null;
  const profilePatch = {
    displayName: displayName || null,
    photoURL: safePhotoURL,
    role: role || null,
  };

  const commitIfNeeded = async (force = false) => {
    if (writes === 0 || (!force && writes < 400)) return;
    await batch.commit();
    batch = writeBatch(db);
    writes = 0;
  };

  for (const participantDoc of snapshot.docs) {
    const conversationRef = participantDoc.ref.parent.parent;
    batch.set(participantDoc.ref, profilePatch, { merge: true });
    writes += 1;
    if (conversationRef) {
      batch.set(
        conversationRef,
        {
          participantProfiles: {
            [uid]: profilePatch,
          },
        },
        { merge: true }
      );
      writes += 1;
    }
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
}
