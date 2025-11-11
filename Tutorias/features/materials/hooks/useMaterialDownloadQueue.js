import { useMemo } from 'react';
import { useOfflineSync } from '../../../tools/offline';
import { downloadMaterialFile } from '../utils/offlineCache';

export function useMaterialDownloadQueue(uid, options = {}) {
  const actions = useMemo(() => {
    if (!uid) return {};
    return {
      'materials:download': async (payload) => {
        if (!payload || payload.userId !== uid) return;
        await downloadMaterialFile(payload);
      },
    };
  }, [uid]);

  const shouldDisable = !uid;
  return useOfflineSync(shouldDisable ? {} : actions, options);
}
