import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';

export default function InspectSubjectScreen() {
  const router = useRouter();
  const { subject, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const topAlert = useTopAlert();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const q = query(collection(db, 'offers'), where('subject', '==', subjectKey));
        const snap = await getDocs(q);
        const rows = [];
        snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
        if (mounted) setItems(rows);
      } catch (e) {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (subjectKey) load(); else setLoading(false);
    return () => { mounted = false; };
  }, [subjectKey]);

  const empty = !loading && items.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets?.top ?? 0) + 12 }}
    >
      <View style={{ alignSelf: 'stretch', marginBottom: 8 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Docentes en {subjectName}</Text>
      {loading && <Text style={styles.note}>Cargando…</Text>}
      {empty && (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>No hay clases disponibles todavía.</Text>
        </View>
      )}
      {items.map((it) => {
        const enrolled = Number(it.enrolledCount || 0);
        const max = Number(it.maxStudents || 0);
        const available = max === 0 ? true : enrolled < max;
        return (
          <View key={it.id} style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>{it.username || it.uid || 'Docente'}</Text>
              <Text style={styles.rowSub}>Cupos: {enrolled}/{max || '∞'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.badge, available ? styles.badgeOk : styles.badgeBusy]}>
                <Text style={available ? styles.badgeOkText : styles.badgeBusyText}>
                  {available ? 'DISPONIBLE' : 'OCUPADO'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => topAlert.show('Módulo, próximamente', 'info')} style={styles.moreBtn}>
                <Text style={styles.moreText}>➜</Text>
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
  moreBtn: { backgroundColor: '#FF8E53', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  moreText: { color: '#fff', fontWeight: '900' },
});
