import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../../config/firebase';
import { useTopAlert } from '../../../components/TopAlert';
import {
  EmptyState,
  LoadingState,
  WebBadge,
  WebButton,
  WebCard,
  WebShell,
  decodeParam,
  formatSlot,
  webTokens,
} from '../../../components/web/WebUI';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../../../constants/firestore';
import { useUploadMaterial } from '../../../features/materials/hooks/useUploadMaterial';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { useConnectivity } from '../../../tools/offline';

const slotKey = (slot) => `${slot.day}-${slot.hourStart}-${slot.hourEnd}`;

export default function OfferDetailWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const connectivity = useConnectivity();
  const { user, ready } = useAuthGuard({ dest: 'Reserva', delayMs: 400 });
  const offerId = decodeParam(params.offerId);
  const subjectKey = decodeParam(params.subject);
  const subjectName = decodeParam(params.name) || subjectKey;
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [existingReservations, setExistingReservations] = useState([]);
  const [teacherReservations, setTeacherReservations] = useState([]);

  const teacherName = offer?.username || offer?.teacherDisplayName || 'Docente';
  const isOwnOffer = !!offer?.uid && !!user?.uid && offer.uid === user.uid;
  const schedule = useMemo(() => (Array.isArray(offer?.schedule) ? offer.schedule : []), [offer?.schedule]);
  const selectedKey = selectedSlot ? slotKey(selectedSlot) : '';
  const pendingCount = Number(offer?.pendingCount || 0);
  const enrolledCount = Number(offer?.enrolledCount || 0);
  const maxStudents = Number(offer?.maxStudents || 0);
  const unlimited = maxStudents === 0;
  const remaining = unlimited ? 'Sin límite' : Math.max(0, maxStudents - enrolledCount - pendingCount);
  const hasPending = existingReservations.some((res) => res.status === RESERVATION_STATUS.PENDING);
  const hasConfirmed = existingReservations.some((res) => res.status === RESERVATION_STATUS.CONFIRMED);
  const canBook = ready && selectedSlot && !hasPending && !hasConfirmed && !isOwnOffer && !connectivity.isOffline;

  const { pickAndUpload, uploading, reservationId: uploadingReservationId } = useUploadMaterial({
    teacherId: user?.uid || '',
    teacherName,
  });

  useEffect(() => {
    let alive = true;
    async function loadOffer() {
      if (!offerId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, OFFERS_COLLECTION, offerId));
        if (!snap.exists()) {
          topAlert.show('No encontramos la oferta seleccionada.', 'error');
          router.back();
          return;
        }
        if (alive) setOffer({ id: snap.id, ...snap.data() });
      } catch {
        topAlert.show('No se pudo cargar la oferta.', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadOffer();
    return () => {
      alive = false;
    };
  }, [offerId, router, topAlert]);

  useEffect(() => {
    if (!user?.uid || !offerId) return undefined;
    const reservationsQuery = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('offerId', '==', offerId),
      where('studentId', '==', user.uid),
      where('status', 'in', [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED])
    );
    return onSnapshot(reservationsQuery, (snap) => {
      const rows = [];
      snap.forEach((item) => rows.push({ id: item.id, ...item.data() }));
      setExistingReservations(rows);
    });
  }, [offerId, user?.uid]);

  useEffect(() => {
    if (!isOwnOffer || !offerId) {
      setTeacherReservations([]);
      return undefined;
    }
    const teacherQuery = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('offerId', '==', offerId),
      where('status', '==', RESERVATION_STATUS.CONFIRMED)
    );
    return onSnapshot(teacherQuery, (snap) => {
      const rows = [];
      snap.forEach((item) => rows.push({ id: item.id, ...item.data() }));
      setTeacherReservations(rows);
    });
  }, [isOwnOffer, offerId]);

  const handleBook = () => {
    if (!selectedSlot || !user) return;
    if (isOwnOffer) {
      topAlert.show('No puedes reservar tu propia tutoría.', 'info');
      return;
    }
    router.push({
      pathname: `/checkout/${offerId}`,
      params: {
        subject: subjectKey,
        name: subjectName,
        slot: encodeURIComponent(JSON.stringify(selectedSlot)),
      },
    });
  };

  const uploadMaterial = async (reservation) => {
    if (connectivity.isOffline) {
      topAlert.show('Conéctate para subir archivos.', 'info');
      return;
    }
    try {
      const result = await pickAndUpload({
        id: reservation.id,
        reservationId: reservation.id,
        studentId: reservation.studentId,
        subjectKey: reservation.subjectKey || subjectKey,
        subjectName,
      });
      if (!result?.cancelled) topAlert.show('Material publicado.', 'success');
    } catch (e) {
      topAlert.show(e?.message || 'No se pudo subir el material.', 'error');
    }
  };

  if (!ready || loading) {
    return <WebShell title="Detalle de tutoría" active="/"><LoadingState label="Preparando detalle..." /></WebShell>;
  }

  if (!offer) {
    return <WebShell title="Detalle de tutoría" active="/"><EmptyState title="Oferta no encontrada" text="No pudimos cargar esta tutoría." /></WebShell>;
  }

  return (
    <WebShell
      title={subjectName}
      subtitle={`Con ${teacherName}. Revisa cupos, precio y selecciona un horario antes de reservar.`}
      active="/"
      actions={<WebButton label="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} />}
    >
      <View style={styles.layout}>
        <WebCard style={styles.heroCard}>
          {Array.isArray(offer.images) && offer.images[0] ? (
            <Image source={{ uri: offer.images[0] }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, styles.placeholder]}><MaterialIcons name="image" size={44} color={webTokens.color.brand} /></View>
          )}
          <View style={styles.heroBody}>
            <WebBadge tone={isOwnOffer ? 'amber' : 'blue'}>{isOwnOffer ? 'Tu publicación' : 'Lista para reservar'}</WebBadge>
            <Text style={styles.title}>{subjectName}</Text>
            <Text style={styles.subtitle}>Docente: {teacherName}</Text>
            <View style={styles.metrics}>
              <Metric label="Inscritos" value={enrolledCount} />
              <Metric label="Pendientes" value={pendingCount} />
              <Metric label="Restantes" value={remaining} />
              <Metric label="Precio" value={offer.price ? `$${Number(offer.price).toFixed(2)}` : 'Pendiente'} />
            </View>
          </View>
        </WebCard>

        <WebCard style={styles.reserveCard}>
          <Text style={styles.blockTitle}>Horarios disponibles</Text>
          <View style={styles.slots}>
            {schedule.length === 0 ? <Text style={styles.muted}>Sin horarios configurados.</Text> : null}
            {schedule.map((slot) => {
              const key = slotKey(slot);
              const selected = selectedKey === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.slot, selected && styles.slotSelected, (hasPending || hasConfirmed || isOwnOffer) && styles.disabledSlot]}
                  onPress={() => setSelectedSlot(slot)}
                  disabled={hasPending || hasConfirmed || isOwnOffer}
                >
                  <MaterialIcons name="schedule" size={18} color={selected ? '#FFFFFF' : webTokens.color.brand} />
                  <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{formatSlot(slot)}</Text>
                </Pressable>
              );
            })}
          </View>
          {hasPending ? <WebBadge tone="amber" icon="hourglass-top">Ya tienes una solicitud pendiente</WebBadge> : null}
          {hasConfirmed ? <WebBadge tone="green" icon="check-circle">Ya tienes una reserva confirmada</WebBadge> : null}
          {isOwnOffer ? <WebBadge tone="amber" icon="info">No puedes reservar tu propia tutoría</WebBadge> : null}
          {connectivity.isOffline ? <WebBadge tone="amber" icon="cloud-off">Conéctate para reservar</WebBadge> : null}
          <WebButton label="Ir a pagar" icon="payments" onPress={handleBook} disabled={!canBook} style={{ marginTop: 18 }} />
        </WebCard>
      </View>

      {isOwnOffer ? (
        <WebCard>
          <Text style={styles.blockTitle}>Mis estudiantes</Text>
          {teacherReservations.length === 0 ? (
            <Text style={styles.muted}>Aún no hay reservas confirmadas.</Text>
          ) : (
            <View style={styles.students}>
              {teacherReservations.map((reservation) => (
                <View key={reservation.id} style={styles.studentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{reservation.studentDisplayName || reservation.studentId || 'Estudiante'}</Text>
                    <Text style={styles.muted}>{formatSlot(reservation.slot)}</Text>
                  </View>
                  <WebButton
                    label="Subir material"
                    icon="upload-file"
                    variant="secondary"
                    loading={uploading && uploadingReservationId === reservation.id}
                    disabled={connectivity.isOffline}
                    onPress={() => uploadMaterial(reservation)}
                  />
                </View>
              ))}
            </View>
          )}
        </WebCard>
      ) : null}
    </WebShell>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, .65fr)',
    gap: 18,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: 330,
    backgroundColor: webTokens.color.surfaceAlt,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    padding: 22,
    gap: 10,
  },
  title: {
    color: webTokens.color.ink,
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: webTokens.color.muted,
    fontWeight: '800',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
    marginTop: 8,
  },
  metric: {
    backgroundColor: webTokens.color.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: webTokens.color.line,
  },
  metricValue: {
    color: webTokens.color.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: webTokens.color.muted,
    marginTop: 2,
    fontWeight: '800',
  },
  reserveCard: {
    alignSelf: 'start',
    gap: 12,
  },
  blockTitle: {
    color: webTokens.color.ink,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  slots: {
    gap: 10,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    backgroundColor: webTokens.color.elevated,
  },
  slotSelected: {
    backgroundColor: webTokens.color.brand,
    borderColor: webTokens.color.brand,
  },
  disabledSlot: {
    opacity: 0.58,
  },
  slotText: {
    color: webTokens.color.ink,
    fontWeight: '800',
  },
  slotTextSelected: {
    color: '#FFFFFF',
  },
  muted: {
    color: webTokens.color.muted,
    lineHeight: 21,
  },
  students: {
    gap: 10,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: webTokens.color.surfaceAlt,
    borderWidth: 1,
    borderColor: webTokens.color.line,
  },
  studentName: {
    color: webTokens.color.ink,
    fontWeight: '900',
  },
});
