import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useTopAlert } from '../components/TopAlert';
import { useReservationsByRole, updateReservationStatus } from '../hooks/useReservations';
import { RESERVATION_STATUS } from '../constants/firestore';

const dayLabels = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
  Lun: 'Mon',
  Mar: 'Tue',
  Mie: 'Wed',
  Miac: 'Wed',
  'MiAc': 'Wed',
  Jue: 'Thu',
  Vie: 'Fri',
  Sab: 'Sat',
  'SA?b': 'Sat',
  Dom: 'Sun',
};

const hoursToLabel = (value) => {
  const hours = Number(value || 0);
  const padded = hours.toString().padStart(2, '0');
  return `${padded}:00`;
};

const formatSlot = (slot) => {
  if (!slot) return 'Horario por definir';
  const dayLabel = dayLabels[slot.day] || slot.day;
  return `${dayLabel} · ${hoursToLabel(slot.hourStart)} - ${hoursToLabel(slot.hourEnd)}`;
};

export default function AgendaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Agenda', delayMs: 400 });

  const [role, setRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (typeof params.tab === 'string') {
      const normalized = params.tab.toLowerCase();
      if (normalized.includes('confirm')) setActiveTab('confirmed');
      else if (normalized.includes('pend')) setActiveTab('pending');
    }
  }, [params.tab]);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      if (!user?.uid) {
        setRole('');
        setRoleLoading(false);
        return;
      }
      setRoleLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (active) setRole((snap.data() || {}).role || '');
      } catch (error) {
        console.error('agenda: load role failed', error);
        if (active) setRole('');
      } finally {
        if (active) setRoleLoading(false);
      }
    }
    loadRole();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const { reservations, loading: reservationsLoading } = useReservationsByRole(role, user?.uid);

  const isTeacher = String(role).toLowerCase() === 'teacher';

  const studentConfirmed = useMemo(
    () => reservations.filter((res) => res.status === RESERVATION_STATUS.CONFIRMED),
    [reservations]
  );
  const studentPending = useMemo(
    () => reservations.filter((res) => res.status === RESERVATION_STATUS.PENDING),
    [reservations]
  );

  const teacherPending = useMemo(
    () => reservations.filter((res) => res.status === RESERVATION_STATUS.PENDING),
    [reservations]
  );
  const teacherConfirmed = useMemo(
    () => reservations.filter((res) => res.status === RESERVATION_STATUS.CONFIRMED),
    [reservations]
  );

  const loadingState = !ready || roleLoading || reservationsLoading;

  const handleStatusChange = async (reservationId, nextStatus) => {
    if (!reservationId) return;
    setUpdatingId(reservationId);
    try {
      await updateReservationStatus(reservationId, nextStatus);
      if (nextStatus === RESERVATION_STATUS.CONFIRMED) {
        topAlert.show('Reservation confirmed. See you in class!', 'success');
      } else if (nextStatus === RESERVATION_STATUS.REJECTED) {
        topAlert.show('Request rejected.', 'info');
      } else if (nextStatus === RESERVATION_STATUS.CANCELLED) {
        topAlert.show('Reservation cancelled.', 'info');
      }
    } catch (error) {
      console.error('agenda: update reservation failed', error);
      topAlert.show('No se pudo actualizar la reserva', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!ready) return null;
  if (!user) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: (insets?.top ?? 0) + 16, marginBottom: 12 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color="#1B1E36" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.title}>Agenda</Text>
        {loadingState && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FF8E53" />
            <Text style={styles.loadingText}>Cargando reservas...</Text>
          </View>
        )}

        {!loadingState && !isTeacher && studentConfirmed.length === 0 && studentPending.length === 0 && (
          <Text style={styles.emptyText}>You don&apos;t have any sessions yet.</Text>
        )}

        {!loadingState && !isTeacher && studentConfirmed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmadas</Text>
            {studentConfirmed.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.subjectName || 'Tutoria'}</Text>
                <Text style={styles.cardSubtitle}>Con {item.teacherDisplayName || 'Docente'}</Text>
                <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
                <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              </View>
            ))}
          </View>
        )}

        {!loadingState && !isTeacher && studentPending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending confirmation</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{studentPending.length}</Text>
              </View>
            </View>
            {studentPending.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.subjectName || 'Tutoria'}</Text>
                <Text style={styles.cardSubtitle}>Con {item.teacherDisplayName || 'Docente'}</Text>
                <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
                <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              </View>
            ))}
          </View>
        )}

        {!loadingState && isTeacher && (
          <View style={styles.section}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
                onPress={() => setActiveTab('pending')}
              >
                <Text style={activeTab === 'pending' ? styles.tabTextActive : styles.tabText}>Pending</Text>
                {teacherPending.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{teacherPending.length}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'confirmed' && styles.tabBtnActive]}
                onPress={() => setActiveTab('confirmed')}
              >
                <Text style={activeTab === 'confirmed' ? styles.tabTextActive : styles.tabText}>Confirmed</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'pending' && teacherPending.length === 0 && (
              <Text style={styles.emptyText}>No hay solicitudes pendientes.</Text>
            )}
            {activeTab === 'pending' && teacherPending.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.subjectName || 'Tutoria'}</Text>
                <Text style={styles.cardSubtitle}>Estudiante: {item.studentDisplayName || item.studentId}</Text>
                <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleStatusChange(item.id, RESERVATION_STATUS.REJECTED)}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#991B1B" />
                    ) : (
                      <Text style={styles.rejectText}>Reject</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleStatusChange(item.id, RESERVATION_STATUS.CONFIRMED)}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#065F46" />
                    ) : (
                      <Text style={styles.acceptText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {activeTab === 'confirmed' && teacherConfirmed.length === 0 && (
              <Text style={styles.emptyText}>No hay reservas confirmadas.</Text>
            )}
            {activeTab === 'confirmed' && teacherConfirmed.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.subjectName || 'Tutoria'}</Text>
                <Text style={styles.cardSubtitle}>Estudiante: {item.studentDisplayName || item.studentId}</Text>
                <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
                <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD580',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  backText: { color: '#1B1E36', fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  loadingText: { color: '#C7C9D9' },
  emptyText: { color: '#C7C9D9', marginTop: 10 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  card: {
    backgroundColor: '#2C2F48',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cardSubtitle: { color: '#C7C9D9', marginTop: 4 },
  cardSlot: { color: '#FFD580', marginTop: 8, fontWeight: '700' },
  cardStatus: { color: '#C7C9D9', marginTop: 6 },
  badge: {
    backgroundColor: '#FF8E53',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#1B1E36', fontWeight: '800' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#2C2F48',
    borderRadius: 14,
    padding: 6,
    gap: 6,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: { backgroundColor: '#FF8E53' },
  tabText: { color: '#C7C9D9', fontWeight: '600' },
  tabTextActive: { color: '#1B1E36', fontWeight: '800' },
  tabBadge: {
    backgroundColor: '#1B1E36',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tabBadgeText: { color: '#FFD580', fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#DCFCE7' },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  acceptText: { color: '#065F46', fontWeight: '800' },
  rejectText: { color: '#991B1B', fontWeight: '800' },
});

