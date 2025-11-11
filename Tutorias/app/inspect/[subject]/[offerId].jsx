import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, runTransaction, collection, query, where, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useTopAlert } from '../../../components/TopAlert';
import { useAuthGuard } from '../../../hooks/useAuthGuard';
import { useConnectivity } from '../../../tools/offline';
import { useUploadMaterial } from '../../../features/materials/hooks/useUploadMaterial';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../../../constants/firestore';

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
  'MiAc': 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
  Sab: 'Sáb',
  'SA?b': 'Sáb',
  Dom: 'Dom',
};

const hoursToLabel = (value) => {
  const hours = Number(value || 0);
  const padded = hours.toString().padStart(2, '0');
  return `${padded}:00`;
};

const slotKey = (slot) => `${slot.day}-${slot.hourStart}-${slot.hourEnd}`;

export default function OfferDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const connectivity = useConnectivity();
  const { user, ready } = useAuthGuard({ dest: 'Reserva', delayMs: 400 });
  const offerId = decodeURIComponent(params.offerId || '');
  const subjectKey = decodeURIComponent(params.subject || '');
  const subjectName = decodeURIComponent(params.name || subjectKey);

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [existingReservations, setExistingReservations] = useState([]);
  const [teacherReservations, setTeacherReservations] = useState([]);

  const teacherName = useMemo(() => {
    if (!offer) return '';
    return offer.username || offer.teacherDisplayName || 'Docente';
  }, [offer]);

  const {
    pickAndUpload,
    uploading: uploadingMaterial,
    reservationId: uploadingReservationId,
  } = useUploadMaterial({
    teacherId: user?.uid || '',
    teacherName,
  });

  const schedule = useMemo(() => (Array.isArray(offer?.schedule) ? offer.schedule : []), [offer?.schedule]);

  const pendingCount = Number(offer?.pendingCount || 0);
  const enrolledCount = Number(offer?.enrolledCount || 0);
  const maxStudents = Number(offer?.maxStudents || 0);
  const unlimited = maxStudents === 0;
  const remaining = unlimited ? undefined : Math.max(0, maxStudents - enrolledCount - pendingCount);

  const selectedKey = selectedSlot ? slotKey(selectedSlot) : null;

  const hasPending = existingReservations.some((res) => res.status === RESERVATION_STATUS.PENDING);
  const hasConfirmed = existingReservations.some((res) => res.status === RESERVATION_STATUS.CONFIRMED);
  const isOwnOffer = offer?.uid && user?.uid && offer.uid === user.uid;

  useEffect(() => {
    let active = true;
    async function loadOffer() {
      if (!offerId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, OFFERS_COLLECTION, offerId));
        if (!snap.exists()) {
          topAlert.show('No encontramos la oferta seleccionada', 'error');
          router.back();
          return;
        }
        if (active) {
          setOffer({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error('offer detail: load failed', error);
        topAlert.show('No se pudo cargar la oferta', 'error');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOffer();
    return () => {
      active = false;
    };
  }, [offerId, router, topAlert]);

  useEffect(() => {
    if (!user?.uid || !offerId) return undefined;
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('offerId', '==', offerId),
      where('studentId', '==', user.uid),
      where('status', 'in', [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED])
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((item) => rows.push({ id: item.id, ...item.data() }));
      setExistingReservations(rows);
    }, (error) => {
      console.error('offer detail: reservations watch failed', error);
    });
    return () => unsub();
  }, [offerId, user?.uid]);

  useEffect(() => {
    if (!isOwnOffer || !offerId) {
      setTeacherReservations([]);
      return () => {};
    }
    const teacherQuery = query(
      collection(db, RESERVATIONS_COLLECTION),
      where('offerId', '==', offerId),
      where('status', '==', RESERVATION_STATUS.CONFIRMED)
    );
    const unsub = onSnapshot(
      teacherQuery,
      (snap) => {
        const rows = [];
        snap.forEach((item) => rows.push({ id: item.id, ...item.data() }));
        setTeacherReservations(rows);
      },
      (error) => {
        console.error('offer detail: teacher reservations watch failed', error);
      }
    );
    return () => unsub();
  }, [isOwnOffer, offerId]);

  useEffect(() => {
    if (ready && !user) {
      topAlert.show('Debes iniciar sesión para ver esta oferta', 'info');
    }
  }, [ready, user, topAlert]);

  const formattedPrice = useMemo(() => {
    if (!offer || typeof offer.price === 'undefined' || offer.price === null) return '';
    const priceValue = Number(offer.price);
    if (Number.isNaN(priceValue)) return '';
    return `$${priceValue.toFixed(2)}`;
  }, [offer]);

  const formatSlot = (slot) => {
  if (!slot) return 'Horario por definir';
  const dayLabel = dayLabels[slot.day] || slot.day;
  return `${dayLabel} · ${hoursToLabel(slot.hourStart)} - ${hoursToLabel(slot.hourEnd)}`;
};

  const canBook = !loading && !submitting && !!selectedSlot && !hasPending && !hasConfirmed && !isOwnOffer;

  const handleBook = async () => {
    if (!selectedSlot) {
      topAlert.show('Selecciona un horario disponible', 'info');
      return;
    }
    if (!user) {
      topAlert.show('Debes iniciar sesión para reservar', 'info');
      return;
    }
    if (isOwnOffer) {
      topAlert.show('No puedes reservar tu propia tutoría', 'info');
      return;
    }
    if (hasPending) {
      topAlert.show('Ya tienes una solicitud pendiente', 'info');
      return;
    }
    if (hasConfirmed) {
      topAlert.show('Ya cuentas con una reserva confirmada', 'info');
      return;
    }

    setSubmitting(true);
    let offerSnapshot = null;
    try {
      offerSnapshot = await runTransaction(db, async (transaction) => {
        const offerRef = doc(db, OFFERS_COLLECTION, offerId);
        const snap = await transaction.get(offerRef);
        if (!snap.exists()) {
          throw new Error('Oferta no disponible');
        }
        const data = snap.data() || {};
        const max = Number(data.maxStudents || 0);
        const enrolled = Number(data.enrolledCount || 0);
        const pending = Number(data.pendingCount || 0);
        const unlimitedOffer = max === 0;
        if (!unlimitedOffer && enrolled + pending >= max) {
          throw new Error('No hay cupos disponibles');
        }
        transaction.update(offerRef, {
          pendingCount: pending + 1,
          updatedAt: serverTimestamp(),
        });
        return data;
      });

      const reservationData = {
        offerId,
        subjectKey,
        subjectName: offerSnapshot.subjectName || subjectName,
        teacherId: offerSnapshot.uid,
        studentId: user.uid,
        status: RESERVATION_STATUS.PENDING,
        slot: selectedSlot,
        price: offerSnapshot.price || null,
        studentDisplayName: user.displayName || user.email || '',
        teacherDisplayName: offerSnapshot.username || offerSnapshot.teacherDisplayName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, RESERVATIONS_COLLECTION), reservationData);

      setOffer((prev) => (prev ? { ...prev, pendingCount: Number(prev.pendingCount || 0) + 1 } : prev));
      topAlert.show('Solicitud enviada. Espera la confirmación del docente.', 'success');
      router.push('/agenda');
    } catch (error) {
      if (offerSnapshot && error?.message !== 'No hay cupos disponibles') {
        try {
          await runTransaction(db, async (transaction) => {
            const offerRef = doc(db, OFFERS_COLLECTION, offerId);
            const snap = await transaction.get(offerRef);
            if (!snap.exists()) return;
            const data = snap.data() || {};
            const pending = Number(data.pendingCount || 0);
            transaction.update(offerRef, {
              pendingCount: Math.max(0, pending - 1),
              updatedAt: serverTimestamp(),
            });
          });
        } catch (rollbackError) {
          console.error('offer detail: rollback failed', rollbackError);
        }
      }
      const message = error?.message === 'No hay cupos disponibles'
        ? 'No hay cupos disponibles'
        : 'No se pudo crear la reserva';
      topAlert.show(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadMaterial = useCallback(
    async (reservation) => {
      if (!reservation) return;
      if (connectivity.isOffline) {
        topAlert.show('Conéctate para subir archivos', 'info');
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
        if (result?.cancelled) return;
        topAlert.show('Material publicado ✅', 'success');
      } catch (error) {
        const message = error?.message || 'No se pudo subir el material';
        topAlert.show(message, 'error');
      }
    },
    [pickAndUpload, connectivity.isOffline, subjectKey, subjectName, topAlert]
  );

  if (!ready) return null;
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: (insets?.top ?? 0) + 40 }]}>
        <ActivityIndicator size="large" color="#FF8E53" />
        <Text style={styles.loadingText}>Cargando oferta...</Text>
      </View>
    );
  }
  if (!offer) {
    return (
      <View style={[styles.center, { paddingTop: (insets?.top ?? 0) + 40 }]}>
        <Text style={styles.loadingText}>No encontramos esta tutoría.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, paddingTop: (insets?.top ?? 0) + 12 }}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      {Array.isArray(offer.images) && offer.images[0] ? (
        <Image source={{ uri: offer.images[0] }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderText}>Sin imagen</Text>
        </View>
      )}

      <Text style={styles.title}>{subjectName}</Text>
      <Text style={styles.subtitle}>Con {teacherName}</Text>

      {formattedPrice ? <Text style={styles.price}>{formattedPrice}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Inscritos:</Text>
        <Text style={styles.metaValue}>{enrolledCount}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Pendientes:</Text>
        <Text style={styles.metaValue}>{pendingCount}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Cupos restantes:</Text>
        <Text style={styles.metaValue}>{unlimited ? 'Sin limite' : remaining}</Text>
      </View>

      {offer.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripcion</Text>
          <Text style={styles.sectionText}>{offer.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horarios disponibles</Text>
        <View style={styles.scheduleWrap}>
          {schedule.length === 0 && (
            <Text style={styles.sectionText}>Sin horarios configurados.</Text>
          )}
          {schedule.map((slot) => {
            const key = slotKey(slot);
            const isSelected = key === selectedKey;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                onPress={() => setSelectedSlot(slot)}
                disabled={hasPending || hasConfirmed || isOwnOffer}
              >
                <Text style={isSelected ? styles.slotChipTextSelected : styles.slotChipText}>
                  {formatSlot(slot)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {hasPending && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>Ya tienes una solicitud pendiente para esta tutoría.</Text>
        </View>
      )}
      {hasConfirmed && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>Reserva confirmada. Nos vemos en clase.</Text>
        </View>
      )}
      {isOwnOffer && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>No puedes reservar una tutoría que tú mismo publicaste.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.bookBtn, (!canBook) && styles.bookBtnDisabled]}
        onPress={handleBook}
        disabled={!canBook}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#1B1E36" />
        ) : (
          <Text style={styles.bookBtnText}>Reservar</Text>
        )}
      </TouchableOpacity>

      {isOwnOffer && (
        <View style={[styles.section, { marginBottom: 24 }]}>
          <Text style={styles.sectionTitle}>Mis estudiantes</Text>
          {teacherReservations.length === 0 ? (
            <Text style={styles.sectionText}>Aún no hay reservas confirmadas.</Text>
          ) : (
            teacherReservations.map((reservation) => (
              <View key={reservation.id} style={styles.teacherReservationCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {reservation.studentDisplayName || reservation.studentId || 'Estudiante'}
                  </Text>
                  {reservation.slot && (
                    <Text style={styles.sectionText}>{formatSlot(reservation.slot)}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.uploadBtn,
                    ((uploadingMaterial && uploadingReservationId === reservation.id) || connectivity.isOffline) &&
                      styles.uploadBtnDisabled,
                  ]}
                  onPress={() => handleUploadMaterial(reservation)}
                  disabled={
                    (uploadingMaterial && uploadingReservationId === reservation.id) || connectivity.isOffline
                  }
                >
                  {uploadingMaterial && uploadingReservationId === reservation.id ? (
                    <ActivityIndicator size="small" color="#1B1E36" />
                  ) : (
                    <>
                      <MaterialIcons name="upload-file" size={18} color="#1B1E36" />
                      <Text style={styles.uploadBtnText}>Subir material</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#1B1E36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: '#C7C9D9', marginTop: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD580',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  backText: { color: '#1B1E36', fontWeight: '800' },
  cover: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  coverPlaceholder: {
    backgroundColor: '#2C2F48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: { color: '#C7C9D9' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#C7C9D9', marginTop: 4 },
  price: { color: '#FF8E53', fontWeight: '800', fontSize: 20, marginTop: 10 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaLabel: { color: '#C7C9D9' },
  metaValue: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  section: { marginTop: 20 },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  sectionText: { color: '#C7C9D9', lineHeight: 20 },
  scheduleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2C2F48',
  },
  slotChipSelected: { backgroundColor: '#FF8E53' },
  slotChipText: { color: '#C7C9D9', fontWeight: '600' },
  slotChipTextSelected: { color: '#1B1E36', fontWeight: '800' },
  alertBox: {
    marginTop: 16,
    backgroundColor: '#2C2F48',
    padding: 14,
    borderRadius: 12,
  },
  alertText: { color: '#FFD580', fontWeight: '700' },
  bookBtn: {
    marginTop: 24,
    backgroundColor: '#FFD580',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.4 },
  bookBtnText: { color: '#1B1E36', fontWeight: '900', fontSize: 16 },
  teacherReservationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2F48',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD580',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  uploadBtnDisabled: { opacity: 0.4 },
  uploadBtnText: { color: '#1B1E36', fontWeight: '800' },
});
