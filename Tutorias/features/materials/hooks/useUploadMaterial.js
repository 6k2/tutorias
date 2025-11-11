import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import { app, db } from '../../../app/config/firebase';
import { TUTORING_MATERIALS_COLLECTION } from '../../../constants/firestore';
import { useConnectivity } from '../../../tools/offline';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
];

const fallbackDescription = (subjectName) =>
  `Recurso para ${subjectName || 'tu tutoría'}`;

const guessExtension = (name = '', mimeType = '') => {
  if (name && name.includes('.')) {
    return name.split('.').pop().toLowerCase();
  }
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('presentation')) return 'pptx';
  if (mimeType.includes('powerpoint')) return 'ppt';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType.includes('msword')) return 'doc';
  if (mimeType.includes('zip')) return 'zip';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  return 'bin';
};

const sanitizeFileName = (value) =>
  (value || 'material')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);

const computeMd5 = async (uri, existingHash) => {
  if (existingHash) return existingHash.toLowerCase();
  // Fallback for platforms where FileSystem cannot provide md5
  const fileContent = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    fileContent,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash.toLowerCase();
};

const pickDocument = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_MIME_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  if (Array.isArray(result.assets) && result.assets.length) {
    return result.assets[0];
  }
  return result;
};

export function useUploadMaterial({ teacherId, teacherName }) {
  const connectivity = useConnectivity();
  const [state, setState] = useState({
    uploading: false,
    progress: 0,
    reservationId: null,
  });

  const pickAndUpload = useCallback(
    async (reservationMeta = {}) => {
      if (!teacherId) {
        throw new Error('No se encontró el docente autenticado.');
      }
      if (connectivity.isOffline) {
        throw new Error('Conéctate para subir material.');
      }
      const file = await pickDocument();
      if (!file) {
        return { cancelled: true };
      }

      const reservationId = reservationMeta.id || reservationMeta.reservationId;
      if (!reservationId) {
        throw new Error('Falta el identificador de la reserva.');
      }
      const studentId = reservationMeta.studentId;
      if (!studentId) {
        throw new Error('Falta el estudiante asignado a la reserva.');
      }
      const subjectKey = reservationMeta.subjectKey || null;

      const fileInfo = await FileSystem.getInfoAsync(file.uri, { md5: true, size: true });
      const sizeBytes = Number(file.size ?? fileInfo.size ?? 0);
      if (!sizeBytes || Number.isNaN(sizeBytes)) {
        throw new Error('No pudimos leer el tamaño del archivo.');
      }
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new Error('El archivo supera los 25 MB permitidos.');
      }

      const md5 = await computeMd5(file.uri, fileInfo.md5);
      const duplicates = await getDocs(
        query(
          collection(db, TUTORING_MATERIALS_COLLECTION),
          where('reservationId', '==', reservationId),
          where('md5', '==', md5)
        )
      );
      if (!duplicates.empty) {
        throw new Error('Ya compartiste este archivo para la reserva.');
      }

      const mimeType = file.mimeType || fileInfo.mimeType || 'application/octet-stream';
      const extension = guessExtension(file.name, mimeType);
      const fileName = sanitizeFileName(file.name || `material-${Date.now()}.${extension}`);
      const safeTitle =
        reservationMeta.title ||
        fileName.replace(`.${extension}`, '') ||
        'Material de estudio';
      const description = reservationMeta.description || fallbackDescription(reservationMeta.subjectName);

      const storagePath = `materials/${reservationId}/${(Crypto.randomUUID?.() || Date.now().toString(36))}.${extension}`;

      const storage = getStorage(app);
      const ref = storageRef(storage, storagePath);
      const response = await fetch(file.uri);
      const blob = await response.blob();

      let didToggleUploading = false;
      try {
        setState({ uploading: true, progress: 0, reservationId });
        didToggleUploading = true;
        await new Promise((resolve, reject) => {
          const uploadTask = uploadBytesResumable(ref, blob, { contentType: mimeType });
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = snapshot.totalBytes
                ? snapshot.bytesTransferred / snapshot.totalBytes
                : 0;
              setState((prev) => ({ ...prev, progress: pct }));
            },
            (error) => reject(error),
            () => resolve(null)
          );
        });

        const materialsCollection = collection(db, TUTORING_MATERIALS_COLLECTION);
        const docRef = await addDoc(materialsCollection, {
          reservationId,
          subjectKey,
          teacherId,
          studentId,
          title: safeTitle,
          description,
          storagePath,
          fileName,
          mimeType,
          sizeBytes,
          md5,
          offlineReady: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, TUTORING_MATERIALS_COLLECTION, docRef.id), {
          offlineReady: true,
          updatedAt: serverTimestamp(),
        });

        return { id: docRef.id, storagePath };
      } finally {
        if (didToggleUploading) {
          setState({ uploading: false, progress: 0, reservationId: null });
        }
      }
    },
    [teacherId, connectivity.isOffline]
  );

  return {
    pickAndUpload,
    uploading: state.uploading,
    progress: state.progress,
    reservationId: state.reservationId,
  };
}
