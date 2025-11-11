import { useMemo } from 'react';
import { useStudentMaterialsIndex } from './useStudentMaterialsIndex';
import { useMaterialViews } from './useMaterialViews';
import { toMillis } from '../utils/dates';

export function useMaterialsInbox(uid, options = {}) {
  const materialsResult = useStudentMaterialsIndex(uid, options);
  const viewsResult = useMaterialViews(uid);

  const newCount = useMemo(() => {
    if (!materialsResult.materials.length) return 0;
    return materialsResult.materials.reduce((counter, material) => {
      const materialUpdatedAt =
        toMillis(material.updatedAt) || toMillis(material.createdAt);
      const viewEntry = viewsResult.views[material.id];
      const lastViewedAt = toMillis(viewEntry?.lastViewedAt);
      if (!lastViewedAt || materialUpdatedAt > lastViewedAt) {
        return counter + 1;
      }
      return counter;
    }, 0);
  }, [materialsResult.materials, viewsResult.views]);

  return {
    materials: materialsResult.materials,
    byReservation: materialsResult.byReservation,
    loading: materialsResult.loading || viewsResult.loading,
    fromCache: materialsResult.fromCache,
    newCount,
    views: viewsResult.views,
    markMaterialViewed: viewsResult.markMaterialViewed,
  };
}
