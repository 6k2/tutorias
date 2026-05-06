import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from './config/firebase';
import {
  EmptyState,
  LoadingState,
  WebBadge,
  WebButton,
  WebCard,
  WebShell,
  formatSlot,
  roleIsTeacher,
  webTokens,
} from '../components/web/WebUI';
import { useTopAlert } from '../components/TopAlert';
import { RESERVATION_STATUS } from '../constants/firestore';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { markReservationSynced, updateReservationStatus, updateReservationStatusOffline, useReservations } from '../hooks/useReservations';
import { useConnectivity, useOfflineSync } from '../tools/offline';

export default function AgendaWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const connectivity = useConnectivity();
  const { user, ready, isOfflineUser } = useAuthGuard({ dest: 'Agenda', delayMs: 400 });
  const [role, setRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    if (typeof params.tab === 'string') {
      const normalized = params.tab.toLowerCase();
      setActiveTab(normalized.includes('confirm') ? 'confirmed' : 'pending');
    }
  }, [params.tab]);

  useEffect(() => {
    let alive = true;
    async function loadRole() {
      if (!user?.uid) {
        setRole('');
        setRoleLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (alive) setRole(snap.data()?.role || '');
      } finally {
        if (alive) setRoleLoading(false);
      }
    }
    loadRole();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const { reservations, loading, fromCache } = useReservations(role, user?.uid);
  const isTeacher = roleIsTeacher(role);
  const offlineMode = connectivity.isOffline || isOfflineUser;

  useOfflineSync(
    {
      'reservations:updateStatus': async (payload) => {
        const { id, nextStatus, userId } = payload || {};
        if (!id || !nextStatus) return;
        await updateReservationStatus(id, nextStatus);
        if (userId) await markReservationSynced(userId, id);
      },
    },
    { isOffline: offlineMode }
  );

  const groups = useMemo(() => ({
    pending: reservations.filter((item) => item.status === RESERVATION_STATUS.PENDING),
    confirmed: reservations.filter((item) => item.status === RESERVATION_STATUS.CONFIRMED),
  }), [reservations]);

  const changeStatus = async (reservationId, nextStatus) => {
    if (!reservationId || !user?.uid) return;
    setUpdatingId(reservationId);
    try {
      const result = await updateReservationStatusOffline(reservationId, nextStatus, {
        isOffline: offlineMode,
        userId: user.uid,
      });
      if (result.queued) topAlert.show('Cambio guardado sin conexión. Se sincronizará luego.', 'info');
      else topAlert.show(nextStatus === RESERVATION_STATUS.CONFIRMED ? 'Reserva confirmada.' : 'Solicitud actualizada.', 'success');
    } catch {
      topAlert.show('No se pudo actualizar la reserva.', 'error');
    } finally {
      setUpdatingId('');
    }
  };

  const loadingState = !ready || roleLoading || loading;
  const visible = groups[activeTab] || [];

  return (
    <WebShell
      title="Agenda"
      subtitle={isTeacher ? 'Gestiona solicitudes y reservas confirmadas de tus estudiantes.' : 'Revisa tus reservas pendientes y confirmadas.'}
      active="/agenda"
      actions={<WebButton label="Inicio" icon="home" variant="secondary" onPress={() => router.push('/')} />}
    >
      {(offlineMode || fromCache) ? <WebBadge tone="amber" icon="cloud-off">Mostrando datos sin conexión</WebBadge> : null}
      {loadingState ? <LoadingState label="Preparando agenda..." /> : (
        <>
          <View style={styles.tabs}>
            <TabButton label="Pendientes" count={groups.pending.length} active={activeTab === 'pending'} onPress={() => setActiveTab('pending')} />
            <TabButton label="Confirmadas" count={groups.confirmed.length} active={activeTab === 'confirmed'} onPress={() => setActiveTab('confirmed')} />
          </View>
          {visible.length === 0 ? (
            <EmptyState icon="event-busy" title="Nada por aquí" text={activeTab === 'pending' ? 'No hay solicitudes pendientes.' : 'No hay reservas confirmadas.'} />
          ) : (
            <View style={styles.grid}>
              {visible.map((item, index) => (
                <WebCard key={item.id} delay={index * 60} style={styles.reservationCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.iconWrap}><MaterialIcons name={isTeacher ? 'school' : 'event'} size={24} color={webTokens.color.brand} /></View>
                    <WebBadge tone={item.status === RESERVATION_STATUS.CONFIRMED ? 'green' : 'amber'}>{item.statusLabel || item.status}</WebBadge>
                  </View>
                  <Text style={styles.cardTitle}>{item.subjectName || 'Tutoría'}</Text>
                  <Text style={styles.muted}>{isTeacher ? `Estudiante: ${item.studentDisplayName || item.studentId}` : `Docente: ${item.teacherDisplayName || item.teacherId}`}</Text>
                  <Text style={styles.slot}>{formatSlot(item.slot)}</Text>
                  {item._pendingSync ? <WebBadge tone="amber">Pendiente por sincronizar</WebBadge> : null}
                  {isTeacher && activeTab === 'pending' ? (
                    <View style={styles.actions}>
                      <WebButton label="Rechazar" icon="close" variant="danger" disabled={updatingId === item.id} onPress={() => changeStatus(item.id, RESERVATION_STATUS.REJECTED)} />
                      <Pressable style={styles.accept} onPress={() => changeStatus(item.id, RESERVATION_STATUS.CONFIRMED)} disabled={updatingId === item.id}>
                        {updatingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialIcons name="check" size={18} color="#FFFFFF" /><Text style={styles.acceptText}>Aceptar</Text></>}
                      </Pressable>
                    </View>
                  ) : null}
                </WebCard>
              ))}
            </View>
          )}
        </>
      )}
    </WebShell>
  );
}

function TabButton({ label, count, active, onPress }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 6, borderWidth: 1, borderColor: webTokens.color.line, alignSelf: 'flex-start', gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14 },
  tabActive: { backgroundColor: webTokens.color.brand },
  tabText: { color: webTokens.color.muted, fontWeight: '900' },
  tabTextActive: { color: '#FFFFFF' },
  count: { backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: webTokens.color.brand, fontWeight: '900', fontSize: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  reservationCard: { gap: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  cardTitle: { color: webTokens.color.ink, fontSize: 21, fontWeight: '900' },
  muted: { color: webTokens.color.muted, lineHeight: 21 },
  slot: { color: webTokens.color.brand, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  accept: { minHeight: 46, borderRadius: 999, backgroundColor: webTokens.color.good, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  acceptText: { color: '#FFFFFF', fontWeight: '900' },
});
