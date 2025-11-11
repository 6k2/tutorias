## Materials module

Centralises the tutoring materials flow (uploads, reader hooks, offline cache).

### Hooks

- `useConfirmedEnrollments(uid, role)` – shared watcher for confirmed reservations. Reused by chat + profile to avoid duplicating queries.
- `useStudentMaterialsIndex(uid)` – streams every material that belongs to the current student and keeps a `Map` grouped by reservation.
- `useMaterialsByReservation(reservationId)` – lightweight snapshot used inside the modal to render the file list for a single booking.
- `useMaterialViews(uid)` – subscribes to `users/{uid}/materialViews` and exposes `markMaterialViewed(ids)` for the unread badge.
- `useMaterialsInbox(uid)` – combines the previous two hooks and returns `newCount`, `byReservation` and a memoised `markMaterialViewed`.
- `useUploadMaterial({ teacherId })` – opens `expo-document-picker`, validates files (<=25 MB, common formats), uploads to `/materials/<reservationId>/<uuid>` with `uploadBytesResumable`, stores metadata in Firestore, and flips `offlineReady` once the write hits the server.
- `useOfflineMaterial({ uid, material })` – manages local caching with `expo-file-system`, `AsyncStorage` and `enqueueSyncAction('materials:download', …)`. Returns helpers to `download` or `open` the cached asset offline.
- `useMaterialDownloadQueue(uid)` – registers the `'materials:download'` handler with `useOfflineSync` so queued downloads resume automatically.

### Offline cache layout

- Index key: `offline:materials:<uid>` → JSON map `{ [materialId]: { reservationId, materialId, localPath, updatedAt, checksum, mimeType, fileName } }`.
- Files land under `FileSystem.documentDirectory/materials/<uid>/<reservationId>/<fileName>`.
- Downloads happen once per material; newer `updatedAt` invalidates the cached entry.

### Cleanup

To remove a cached file, wipe the entry from AsyncStorage and delete the file path:

```js
import { removeOfflineEntry } from './utils/offlineCache';
import * as FileSystem from 'expo-file-system';

await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
await removeOfflineEntry(uid, materialId);
```

Refer to Expo docs for more details on [`expo-file-system`](https://docs.expo.dev/versions/latest/sdk/filesystem/) if you want to surface a manual “Liberar espacio” action.
