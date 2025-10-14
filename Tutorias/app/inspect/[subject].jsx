import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useOffersOffline } from '../../hooks/useOffersOffline';
import { useConnectivity } from '../../tools/offline';

const mapSchedule = (schedule = []) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const first = schedule[0];
  if (!first) return null;
  const pad = (val) => String(val ?? 0).padStart(2, '0');
  return `${first.day} · ${pad(first.hourStart)}:00 - ${pad(first.hourEnd)}:00`;
};

// Screen entry. Uses params to fetch offers for the chosen subject.
export default function InspectSubjectScreen() {
  const router = useRouter();
  const { subject, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const connectivity = useConnectivity();
  const { offers, loading, fromCache } = useOffersOffline(subjectKey);
  const [usernames, setUsernames] = useState({});
  const [rowLoading, setRowLoading] = useState({});
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Reservas', delayMs: 400 });

  useEffect(() => {
    if (!offers || offers.length === 0) {
      setUsernames({});
      return;
    }
    let cancelled = false;
    const loadNames = async () => {
      const ids = Array.from(new Set(offers.map((offer) => offer.uid).filter(Boolean)));
      if (ids.length === 0) {
        setUsernames({});
        return;
      }
      const names = {};
      await Promise.all(
        ids.map(async (uid) => {
          try {
            const us = await getDoc(doc(db, 'users', uid));
            const data = us.data() || {};
            if (data.username) names[uid] = data.username;
          } catch (error) {
            console.warn('inspect: username lookup failed', error);
          }
        })
      );
      if (!cancelled) setUsernames(names);
    };
    loadNames();
    return () => {
      cancelled = true;
    };
  }, [offers]);

  const empty = !loading && offers.length === 0;

  const handleInspect = async (offer) => {
    if (connectivity.isOffline) {
      topAlert.show('Necesitas conexión a internet para ver los detalles.', 'info');
      return;
    }
    setRowLoading((prev) => ({ ...prev, [offer.id]: true }));
    try {
      if (!ready || !user) {
        topAlert.show('Debes iniciar sesión para reservar una tutoría', 'info');
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

  const renderedOffers = useMemo(() => offers, [offers]);

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

      {(connectivity.isOffline || fromCache) && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Datos guardados para uso sin conexión</Text>
        </View>
      )}

      {loading && <Text style={styles.note}>Cargando</Text>}
      {empty && (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>No hay clases disponibles todavía.</Text>
        </View>
      )}

      {renderedOffers.map((it) => {
        const enrolled = Number(it.enrolledCount || 0);
        const max = Number(it.maxStudents || 0);
        const available = max === 0 ? true : enrolled < max;
        const isRowLoading = !!rowLoading[it.id];
        const firstSlot = mapSchedule(it.schedule);
        return (
          <View key={it.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{usernames[it.uid] || it.username || 'Docente'}</Text>
              <Text style={styles.rowSub}>
                Cupos: {max === 0 ? 'Sin límite' : `${enrolled}/${max}`}
              </Text>
              {firstSlot && (
                <View style={styles.slotPill}>
                  <Text style={styles.slotPillText}>{firstSlot}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.badge, available ? styles.badgeOk : styles.badgeBusy]}>
                <Text style={available ? styles.badgeOkText : styles.badgeBusyText}>
                  {available ? 'DISPONIBLE' : 'OCUPADO'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleInspect(it)}
                style={[styles.moreBtn, (isRowLoading || connectivity.isOffline) && styles.moreBtnDisabled]}
                disabled={isRowLoading || connectivity.isOffline}
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
  offlineBanner: {
    backgroundColor: '#1f2937',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  offlineBannerText: { color: '#fcd34d', fontWeight: '700' },
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
  slotPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1B1E36',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  slotPillText: { color: '#FFD580', fontWeight: '700', fontSize: 12 },
});

