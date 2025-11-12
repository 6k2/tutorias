import * as FileSystem from 'expo-file-system';
import { getDownloadURL, getStorage, ref as storageRef } from 'firebase/storage';
import { app } from '../../../app/config/firebase';

const INDEX_PREFIX = 'offline:materials:';

const indexKey = (uid) => `${INDEX_PREFIX}${uid}`;

const safeJsonParse = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    //
  }
  return {};
};

const ensureDirAsync = async (dir) => {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists && info.isDirectory) {
      return;
    }
  } catch {
    // ignore read errors, attempt mkdir below
  }
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
};

const sanitizeFileName = (candidate, fallback) => {
  const base = (candidate || fallback || 'material')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
  return base || 'material';
};

const createFallbackStorage = () => {
  const store = new Map();
  return {
    getItem: async (key) => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => store.set(key, value),
    removeItem: async (key) => store.delete(key),
    clear: async () => store.clear(),
  };
};

let cachedAsyncStorage = null;

const getAsyncStorage = () => {
  if (cachedAsyncStorage) {
    return cachedAsyncStorage;
  }
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const module = require('@react-native-async-storage/async-storage');
    cachedAsyncStorage = module?.default ?? module;
  } catch (_error) {
    cachedAsyncStorage = createFallbackStorage();
  }
  return cachedAsyncStorage;
};

const getStorageClient = () => {
  const storage = getAsyncStorage();
  if (!storage) return null;
  return storage;
};

export const readOfflineIndex = async (uid) => {
  if (!uid) return {};
  const storage = getStorageClient();
  if (!storage || typeof storage.getItem !== 'function') return {};
  const raw = await storage.getItem(indexKey(uid));
  return safeJsonParse(raw);
};

export const writeOfflineIndex = async (uid, map) => {
  if (!uid) return;
  const storage = getStorageClient();
  if (!storage) return;
  const key = indexKey(uid);
  if (!map || !Object.keys(map).length) {
    await storage.removeItem(key);
    return;
  }
  await storage.setItem(key, JSON.stringify(map));
};

export const getOfflineEntry = async (uid, materialId) => {
  if (!uid || !materialId) return null;
  const map = await readOfflineIndex(uid);
  return map[materialId] || null;
};

export const upsertOfflineEntry = async (uid, entry) => {
  if (!uid || !entry?.materialId) return null;
  const map = await readOfflineIndex(uid);
  map[entry.materialId] = entry;
  await writeOfflineIndex(uid, map);
  return entry;
};

export const removeOfflineEntry = async (uid, materialId) => {
  if (!uid || !materialId) return null;
  const map = await readOfflineIndex(uid);
  if (!map[materialId]) return null;
  delete map[materialId];
  await writeOfflineIndex(uid, map);
  return null;
};

export const downloadMaterialFile = async ({
  userId,
  reservationId,
  materialId,
  storagePath,
  fileName,
  mimeType,
  md5,
}) => {
  if (!userId || !reservationId || !materialId || !storagePath) {
    throw new Error('Faltan datos para descargar el material');
  }
  if (!FileSystem.documentDirectory) {
    // TODO(materials): evaluar soporte de caché para Web cuando FileSystem no esté disponible.
    throw new Error('Almacenamiento local no disponible en esta plataforma');
  }
  const safeFileName = sanitizeFileName(fileName || `material-${materialId}`, `material-${materialId}`);
  const dir = `${FileSystem.documentDirectory}materials/${userId}/${reservationId}`;
  await ensureDirAsync(dir);
  const destination = `${dir}/${safeFileName}`;
  try {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  } catch {
    // ignore
  }

  const storage = getStorage(app);
  const ref = storageRef(storage, storagePath);
  const downloadUrl = await getDownloadURL(ref);
  await FileSystem.downloadAsync(downloadUrl, destination);

  const entry = {
    reservationId,
    materialId,
    localPath: destination,
    updatedAt: Date.now(),
    checksum: md5 || null,
    mimeType: mimeType || null,
    fileName: safeFileName,
  };
  await upsertOfflineEntry(userId, entry);
  return entry;
};
