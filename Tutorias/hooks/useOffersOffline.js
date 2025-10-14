import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../app/config/firebase';
import { OFFERS_COLLECTION } from '../constants/firestore';

const SUBJECT_CACHE_PREFIX = 'offline:offers:';
const OFFER_CACHE_PREFIX = 'offline:offer:';

const loadSubjectCache = async (subjectKey) => {
  if (!subjectKey) return null;
  try {
    const raw = await AsyncStorage.getItem(`${SUBJECT_CACHE_PREFIX}${subjectKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.records) ? parsed.records : null;
  } catch (error) {
    console.warn('useOffersOffline: failed to load cache', error);
    return null;
  }
};

const persistSubjectCache = async (subjectKey, records) => {
  if (!subjectKey) return;
  try {
    if (!records || records.length === 0) {
      await AsyncStorage.removeItem(`${SUBJECT_CACHE_PREFIX}${subjectKey}`);
      return;
    }
    await AsyncStorage.setItem(
      `${SUBJECT_CACHE_PREFIX}${subjectKey}`,
      JSON.stringify({ records, updatedAt: Date.now() })
    );
    const pairs = records.map((offer) => [
      `${OFFER_CACHE_PREFIX}${offer.id}`,
      JSON.stringify({ ...offer, subject: subjectKey }),
    ]);
    if (pairs.length) {
      await AsyncStorage.multiSet(pairs);
    }
  } catch (error) {
    console.warn('useOffersOffline: failed to persist cache', error);
  }
};

/**
 * Returns offers for a subject with Firestore live updates + AsyncStorage fallback when offline.
 * @param {string} subjectKey Subject identifier (inspect/matrícula routes).
 * @returns {{ offers: Array, loading: boolean, fromCache: boolean }} offline-aware state.
 */
export const useOffersOffline = (subjectKey) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!subjectKey) {
      setOffers([]);
      setLoading(false);
      setFromCache(false);
      return () => {};
    }

    let active = true;

    loadSubjectCache(subjectKey).then((cached) => {
      if (cached && active) {
        setOffers(cached);
        setFromCache(true);
        setLoading(false);
      }
    });

    const q = query(collection(db, OFFERS_COLLECTION), where('subject', '==', subjectKey));
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      async (snapshot) => {
        if (!active) return;
        if (snapshot.metadata.fromCache && snapshot.empty) {
          const cached = await loadSubjectCache(subjectKey);
          if (cached) {
            setOffers(cached);
            setFromCache(true);
            setLoading(false);
            return;
          }
        }

        const rows = [];
        snapshot.forEach((docSnap) => rows.push({ id: docSnap.id, ...docSnap.data() }));
        setOffers(rows);
        setFromCache(snapshot.metadata.fromCache);
        setLoading(false);
        persistSubjectCache(subjectKey, rows);
      },
      (error) => {
        console.error('useOffersOffline: snapshot failed', error);
        if (active) {
          setOffers([]);
          setFromCache(false);
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [subjectKey]);

  return { offers, loading, fromCache };
};

/**
 * Looks up a single offer in the local cache (used in detail views when offline).
 * @param {string} offerId Firestore document id.
 * @returns {Promise<object|null>} cached offer or null if missing.
 */
export const getOfferByIdFromCache = async (offerId) => {
  if (!offerId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${OFFER_CACHE_PREFIX}${offerId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('useOffersOffline: failed to read offer cache', error);
    return null;
  }
};
