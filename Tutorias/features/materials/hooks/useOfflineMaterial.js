import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { enqueueSyncAction, useConnectivity } from '../../../tools/offline';
import {
  downloadMaterialFile,
  getOfflineEntry,
} from '../utils/offlineCache';
import { toMillis } from '../utils/dates';

const STATUS = {
  IDLE: 'idle',
  READY: 'ready',
  DOWNLOADING: 'downloading',
  QUEUED: 'queued',
  ERROR: 'error',
  STALE: 'stale',
};

export function useOfflineMaterial({ uid, material }) {
  const connectivity = useConnectivity();
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!uid || !material?.id) {
      setEntry(null);
      setStatus(STATUS.IDLE);
      setError(null);
      return () => {};
    }
    getOfflineEntry(uid, material.id)
      .then((stored) => {
        if (!cancelled) {
          setEntry(stored);
        }
      })
      .catch(() => {
        if (!cancelled) setEntry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, material?.id, remoteUpdatedAt]);

  const remoteUpdatedAt = useMemo(() => {
    if (!material) return 0;
    return toMillis(material.updatedAt) || toMillis(material.createdAt);
  }, [material]);

  const needsRefresh = useMemo(() => {
    if (!entry?.updatedAt) return false;
    return remoteUpdatedAt > entry.updatedAt;
  }, [entry, remoteUpdatedAt]);

  useEffect(() => {
    if (entry?.localPath) {
      setStatus(needsRefresh ? STATUS.STALE : STATUS.READY);
    } else {
      setStatus(STATUS.IDLE);
    }
  }, [entry, needsRefresh]);

  const queueDownload = useCallback(async () => {
    if (!uid || !material?.id) {
      throw new Error('No hay datos del material para la descarga');
    }
    await enqueueSyncAction('materials:download', {
      userId: uid,
      reservationId: material.reservationId,
      materialId: material.id,
      storagePath: material.storagePath,
      fileName: material.fileName,
      mimeType: material.mimeType,
      md5: material.md5,
    });
    setStatus(STATUS.QUEUED);
    return { queued: true };
  }, [uid, material]);

  const downloadNow = useCallback(async () => {
    if (!uid || !material?.id || !material.storagePath) {
      throw new Error('Este material no contiene archivo para descargar.');
    }
    if (connectivity.isOffline) {
      return queueDownload();
    }
    setStatus(STATUS.DOWNLOADING);
    setError(null);
    try {
      const nextEntry = await downloadMaterialFile({
        userId: uid,
        reservationId: material.reservationId,
        materialId: material.id,
        storagePath: material.storagePath,
        fileName: material.fileName,
        mimeType: material.mimeType,
        md5: material.md5,
      });
      setEntry(nextEntry);
      setStatus(STATUS.READY);
      return { entry: nextEntry };
    } catch (downloadError) {
      console.warn('useOfflineMaterial: download failed', downloadError);
      setError(downloadError);
      setStatus(STATUS.ERROR);
      throw downloadError;
    }
  }, [uid, material, connectivity.isOffline, queueDownload]);

  const openMaterial = useCallback(async () => {
    try {
      let currentEntry = entry;
      if ((!currentEntry?.localPath || needsRefresh) && !connectivity.isOffline) {
        const result = await downloadNow();
        currentEntry = result?.entry || currentEntry;
      }

      if (!currentEntry?.localPath) {
        throw new Error(
          connectivity.isOffline
            ? 'Descarga el archivo antes de abrirlo sin conexión.'
            : 'No pudimos acceder al archivo local.'
        );
      }

      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(currentEntry.localPath);
        await Linking.openURL(contentUri);
      } else if (Platform.OS === 'ios') {
        await Linking.openURL(currentEntry.localPath);
      } else if (typeof window !== 'undefined') {
        // TODO(materials): habilitar visor dedicado en web si se necesita una vista previa embebida.
        window.open(currentEntry.localPath, '_blank');
      }
      return true;
    } catch (openError) {
      setError(openError);
      throw openError;
    }
  }, [entry, downloadNow, needsRefresh, connectivity.isOffline]);

  return {
    entry,
    status,
    error,
    needsRefresh,
    download: downloadNow,
    open: openMaterial,
    queued: status === STATUS.QUEUED,
  };
}
