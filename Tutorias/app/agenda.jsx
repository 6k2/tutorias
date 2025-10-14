import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useTopAlert } from '../components/TopAlert';
import {
  useReservations,
  updateReservationStatusOffline,
  updateReservationStatus,
  markReservationSynced,
} from '../hooks/useReservations';
import { useConnectivity, useOfflineSync } from '../tools/offline';
import { RESERVATION_STATUS } from '../constants/firestore';

const dayLabels = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mié',
  Miac: 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
  Sab: 'Sáb',
  Dom: 'Dom',
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
  const connectivity = useConnectivity();
  const { user, ready, isOfflineUser } = useAuthGuard({ dest: 'Agenda', delayMs: 400 });

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
    // En modo offline mostramos un aviso informando que los cambios se sincronizan al reconectar.
    if (connectivity.isOffline) {
      topAlert.show('Modo sin conexi�n: los cambios se sincronizar�n cuando vuelvas a estar en l�nea.', 'info');
    }
  }, [connectivity.isOffline, topAlert]);

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

  const { reservations, loading: reservationsLoading, fromCache } = useReservations(role, user?.uid);

  const isTeacher = String(role).toLowerCase() === 'teacher';
  const offlineMode = connectivity.isOffline || isOfflineUser;

  const syncHandlers = useMemo(
    () => ({
      'reservations:updateStatus': async (payload) => {
        const { id, nextStatus, userId } = payload || {};
        if (!id || !nextStatus) return;
        await updateReservationStatus(id, nextStatus);
        if (userId) {
          await markReservationSynced(userId, id);
        }
      },
    }),
    []
  );

  const { syncing: syncingQueue, lastResult: lastSyncResult } = useOfflineSync(syncHandlers, {
    isOffline: offlineMode,
  });

  const syncSignatureRef = useRef('');
  useEffect(() => {
    const executed = Array.isArray(lastSyncResult.executed)
      ? lastSyncResult.executed.map((entry) => entry.id).sort()
      : [];
    const signature = executed.join('|');
    if (signature && signature !== syncSignatureRef.current) {
      topAlert.show('Cambios sincronizados con la nube.', 'success');
    }
    syncSignatureRef.current = signature;
  }, [lastSyncResult.executed, topAlert]);

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
    if (!reservationId || !user?.uid) return;
    setUpdatingId(reservationId);
    try {
      const result = await updateReservationStatusOffline(reservationId, nextStatus, {
        isOffline: offlineMode,
        userId: user.uid,
      });

      if (result.queued) {
        topAlert.show('Cambio guardado sin conexi�n. Se sincronizar� autom�ticamente.', 'info');
      } else if (nextStatus === RESERVATION_STATUS.CONFIRMED) {
        topAlert.show('Reserva confirmada. �Nos vemos en clase!', 'success');
      } else if (nextStatus === RESERVATION_STATUS.REJECTED) {
        topAlert.show('Solicitud rechazada.', 'info');
      } else if (nextStatus === RESERVATION_STATUS.CANCELLED) {
        topAlert.show('Reserva cancelada.', 'info');
      }
    } catch (error) {
      console.error('agenda: update reservation failed', error);
      topAlert.show('No se pudo actualizar la reserva', 'error');
    } finally {
      setUpdatingId(null);
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
      <Text style={styles.title}>Agenda</Text>

      {(offlineMode || fromCache) && (
        <View style={styles.offlineBadge}>
          <MaterialIcons name="cloud-off" size={18} color="#ffedd5" />
          <Text style={styles.offlineBadgeText}>Mostrando datos sin conexi�n</Text>
        </View>
      )}

      {syncingQueue && (
        <Text style={styles.syncingText}>Sincronizando cambios pendientes...</Text>
      )}

      {loadingState && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#FFD580" />
          <Text style={styles.loadingText}>Preparando agenda...</Text>
        </View>
      )}

      {!loadingState && !isTeacher && (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionTitle}>Mis reservas</Text>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pendientes</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{studentPending.length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'confirmed' && styles.tabBtnActive]}
              onPress={() => setActiveTab('confirmed')}
            >
              <Text style={[styles.tabText, activeTab === 'confirmed' && styles.tabTextActive]}>Confirmadas</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{studentConfirmed.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {activeTab === 'pending' && studentPending.length === 0 && (
            <Text style={styles.emptyText}>No tienes reservas pendientes.</Text>
          )}
          {activeTab === 'pending' && studentPending.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.subjectName || 'Tutor�a'}</Text>
              <Text style={styles.cardSubtitle}>Docente: {item.teacherDisplayName || item.teacherId}</Text>
              <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
              <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              {item._pendingSync && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>Pendiente por sincronizar</Text>
                </View>
              )}
            </View>
          ))}

          {activeTab === 'confirmed' && studentConfirmed.length === 0 && (
            <Text style={styles.emptyText}>No hay reservas confirmadas.</Text>
          )}
          {activeTab === 'confirmed' && studentConfirmed.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.subjectName || 'Tutor�a'}</Text>
              <Text style={styles.cardSubtitle}>Docente: {item.teacherDisplayName || item.teacherId}</Text>
              <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
              <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              {item._pendingSync && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>Pendiente por sincronizar</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {!loadingState && isTeacher && (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Solicitudes recibidas</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{teacherPending.length}</Text>
            </View>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pendientes</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{teacherPending.length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'confirmed' && styles.tabBtnActive]}
              onPress={() => setActiveTab('confirmed')}
            >
              <Text style={[styles.tabText, activeTab === 'confirmed' && styles.tabTextActive]}>Confirmadas</Text>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{teacherConfirmed.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {activeTab === 'pending' && teacherPending.length === 0 && (
            <Text style={styles.emptyText}>No hay solicitudes pendientes.</Text>
          )}
          {activeTab === 'pending' && teacherPending.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.subjectName || 'Tutor�a'}</Text>
              <Text style={styles.cardSubtitle}>Estudiante: {item.studentDisplayName || item.studentId}</Text>
              <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
              {item._pendingSync && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>Pendiente por sincronizar</Text>
                </View>
              )}
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
              <Text style={styles.cardTitle}>{item.subjectName || 'Tutor�a'}</Text>
              <Text style={styles.cardSubtitle}>Estudiante: {item.studentDisplayName || item.studentId}</Text>
              <Text style={styles.cardSlot}>{formatSlot(item.slot)}</Text>
              <Text style={styles.cardStatus}>Estado: {item.statusLabel}</Text>
              {item._pendingSync && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>Pendiente por sincronizar</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
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
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#312e81',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  offlineBadgeText: { color: '#ffedd5', fontWeight: '700' },
  syncingText: { color: '#9ca3af', marginBottom: 10 },
  syncBadge: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f97316',
    alignSelf: 'flex-start',
  },
  syncBadgeText: { color: '#1B1E36', fontWeight: '800', fontSize: 12 },
});
