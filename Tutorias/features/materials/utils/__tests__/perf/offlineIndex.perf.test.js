import { performance } from 'perf_hooks';
import {
  readOfflineIndex,
  writeOfflineIndex,
  upsertOfflineEntry,
} from '../../offlineCache';

jest.setTimeout(20000);

describe('@perf offline index workload', () => {
  const insertUser = 'perf-upsert-user';
  const readUser = 'perf-read-user';

  afterEach(async () => {
    await writeOfflineIndex(insertUser, null);
    await writeOfflineIndex(readUser, null);
  });

  it('inserta 400 materiales en el índice en menos de 700ms', async () => {
    const total = 400;
    const start = performance.now();
    for (let i = 0; i < total; i += 1) {
      await upsertOfflineEntry(insertUser, {
        materialId: `material-${i}`,
        reservationId: `res-${Math.floor(i / 5)}`,
        localPath: `/tmp/material-${i}.pdf`,
      });
    }
    const duration = performance.now() - start;

    const index = await readOfflineIndex(insertUser);
    expect(Object.keys(index)).toHaveLength(total);
    expect(duration).toBeLessThan(700);
  });

  it('lee un índice cargado en menos de 500ms', async () => {
    const entries = {};
    for (let i = 0; i < 200; i += 1) {
      entries[`material-${i}`] = {
        materialId: `material-${i}`,
        reservationId: `res-${i}`,
        localPath: `/tmp/material-${i}.pdf`,
        updatedAt: Date.now(),
      };
    }
    await writeOfflineIndex(readUser, entries);

    const start = performance.now();
    const indexSnapshot = await readOfflineIndex(readUser);
    const duration = performance.now() - start;

    expect(Object.keys(indexSnapshot)).toHaveLength(Object.keys(entries).length);
    expect(indexSnapshot['material-0']).toBeDefined();
    expect(duration).toBeLessThan(500);
  });
});
