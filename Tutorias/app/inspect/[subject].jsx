import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { OFFERS_COLLECTION } from '../../constants/firestore';

// Screen entry. Uses params to fetch offers for the chosen subject.
export default function InspectSubjectScreen() {
  const router = useRouter();
  const { subject, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usernames, setUsernames] = useState({});
  const [rowLoading, setRowLoading] = useState({});
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Reservas', delayMs: 400 });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const q = query(collection(db, OFFERS_COLLECTION), where('subject', '==', subjectKey));
        const snap = await getDocs(q);
        const rows = [];
        snap.forEach((document) => rows.push({ id: document.id, ...document.data() }));
        if (mounted) setItems(rows);
        const uids = Array.from(new Set(rows.map((r) => r.uid).filter(Boolean)));
        const names = {};
        await Promise.all(
          uids.map(async (uid) => {
            try {
              const us = await getDoc(doc(db, 'users', uid));
              const d = us.data() || {};
              if (typeof d.username === 'string' && d.username.trim()) names[uid] = d.username.trim();
            } catch (error) {
              console.error('inspect: username lookup failed', error);
            }
          })
        );
        if (mounted) setUsernames(names);
      } catch (error) {
        console.error('inspect: load failed', error);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (subjectKey) load(); else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [subjectKey]);

  const empty = !loading && items.length === 0;

  const handleInspect = async (offer) => {
    setRowLoading((prev) => ({ ...prev, [offer.id]: true }));
    try {
      if (!ready || !user) {
        topAlert.show('Debes iniciar sesion para reservar una tutoria', 'info');
        return;
      }
      const max = Number(offer.maxStudents || 0);
      const enrolled = Number(offer.enrolledCount || 0);
      const available = max === 0 ? true : enrolled < max;
      if (!available) {
        topAlert.show('No hay cupos disponibles', 'info');
        return;
      }
      router.push({
        pathname: '/inspect/[subject]/[offerId]',
        params: { subject: subjectKey, offerId: offer.id, name: subjectName },
      });
    } finally {
      setRowLoading((prev) => ({ ...prev, [offer.id]: false }));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets?.top ?? 0) + 12 }}
    >
      <View style={{ alignSelf: 'stretch', marginBottom: 8, zIndex: 10, position: 'relative' }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Docentes en {subjectName}</Text>
      {loading && <Text style={styles.note}>Cargando</Text>}
      {empty && (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>No hay clases disponibles todavia.</Text>
        </View>
      )}
      {items.map((it) => {
        const enrolled = Number(it.enrolledCount || 0);
        const max = Number(it.maxStudents || 0);
        const available = max === 0 ? true : enrolled < max;
        const isRowLoading = !!rowLoading[it.id];
        return (
          <View key={it.id} style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>{usernames[it.uid] || it.username || 'Docente'}</Text>
              <Text style={styles.rowSub}>
                Cupos: {max === 0 ? 'Sin limite' : `${enrolled}/${max}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.badge, available ? styles.badgeOk : styles.badgeBusy]}>
                <Text style={available ? styles.badgeOkText : styles.badgeBusyText}>
                  {available ? 'DISPONIBLE' : 'OCUPADO'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleInspect(it)}
                style={[styles.moreBtn, isRowLoading && styles.moreBtnDisabled]}
                disabled={isRowLoading}
              >
                {isRowLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.moreText}>-&gt;</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12, paddingTop: 24 },
  note: { color: '#C7C9D9' },
  backBtn: { alignSelf: 'flex-start', backgroundColor: '#FFD580', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  backText: { color: '#1B1E36', fontWeight: '800' },
  row: {
    backgroundColor: '#2C2F48',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { color: '#fff', fontWeight: '800' },
  rowSub: { color: '#C7C9D9', fontSize: 12 },
  badge: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  badgeOk: { backgroundColor: '#DCFCE7' },
  badgeBusy: { backgroundColor: '#FEE2E2' },
  badgeOkText: { color: '#065F46', fontWeight: '800' },
  badgeBusyText: { color: '#991B1B', fontWeight: '800' },
  moreBtn: { backgroundColor: '#FF8E53', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  moreBtnDisabled: { opacity: 0.6 },
  moreText: { color: '#fff', fontWeight: '900' },
});
