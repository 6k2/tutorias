import { collection, query, where, limit as fbLimit, startAfter as fbStartAfter, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export async function listTutors({ limit = 20, startAfter, subjectText = '' }) {
  let q = query(collection(db, 'users'), where('role', '==', 'tutor'), orderBy('displayName'), fbLimit(limit));
  if (startAfter) {
    q = query(q, fbStartAfter(startAfter));
  }
  const snap = await getDocs(q);
  let items = snap.docs.map(d => ({ id: d.id, ...d.data(), _cursor: d }));
  if (subjectText) {
    const lower = subjectText.toLowerCase();
    const exact = items.filter(i => (i.specialties || []).includes(subjectText));
    if (exact.length) {
      items = exact;
    } else {
      items = items.filter(i => (i.specialties || []).some(s => s.toLowerCase().includes(lower)) || (i.displayName || '').toLowerCase().includes(lower));
    }
  }
  const last = snap.docs[snap.docs.length - 1];
  return { items, nextCursor: last };
}
