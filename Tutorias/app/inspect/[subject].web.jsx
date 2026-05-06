import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
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
} from '../../components/web/WebUI';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useOffersOffline } from '../../hooks/useOffersOffline';
import { useConnectivity } from '../../tools/offline';

export default function InspectSubjectWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const subjectKey = decodeParam(params.subject);
  const subjectName = decodeParam(params.name) || subjectKey;
  const { offers, loading, fromCache } = useOffersOffline(subjectKey);
  const { user, ready } = useAuthGuard({ dest: 'Reservas', delayMs: 400 });
  const connectivity = useConnectivity();
  const topAlert = useTopAlert();
  const [usernames, setUsernames] = useState({});
  const [rowLoading, setRowLoading] = useState('');

  useEffect(() => {
    let alive = true;
    const ids = Array.from(new Set(offers.map((offer) => offer.uid).filter(Boolean)));
    if (!ids.length) {
      setUsernames({});
      return undefined;
    }
    Promise.all(
      ids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          return [uid, snap.data()?.username || snap.data()?.email || 'Docente'];
        } catch {
          return [uid, 'Docente'];
        }
      })
    ).then((pairs) => {
      if (alive) setUsernames(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [offers]);

  const availableOffers = useMemo(
    () => offers.map((offer) => {
      const max = Number(offer.maxStudents || 0);
      const enrolled = Number(offer.enrolledCount || 0);
      const pending = Number(offer.pendingCount || 0);
      const available = max === 0 || enrolled + pending < max;
      return { ...offer, max, enrolled, pending, available };
    }),
    [offers]
  );

  const inspectOffer = async (offer) => {
    if (connectivity.isOffline) {
      topAlert.show('Necesitas conexión a internet para ver los detalles.', 'info');
      return;
    }
    if (!ready || !user) {
      topAlert.show('Debes iniciar sesión para reservar una tutoría.', 'info');
      router.push('/login');
      return;
    }
    if (!offer.available) {
      topAlert.show('No hay cupos disponibles.', 'info');
      return;
    }
    setRowLoading(offer.id);
    router.push({
      pathname: '/inspect/[subject]/[offerId]',
      params: { subject: subjectKey, offerId: offer.id, name: subjectName },
    });
  };

  return (
    <WebShell
      title={`Docentes en ${subjectName}`}
      subtitle="Compara cupos, precio y primer horario disponible antes de entrar al detalle de reserva."
      active="/explore"
      actions={<WebButton label="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} />}
    >
      {(connectivity.isOffline || fromCache) ? (
        <WebBadge tone="amber" icon="cloud-off">Datos guardados para uso sin conexión</WebBadge>
      ) : null}
      {loading ? <LoadingState label="Cargando docentes..." /> : null}
      {!loading && availableOffers.length === 0 ? (
        <EmptyState
          icon="person-search"
          title="Todavía no hay clases disponibles"
          text="Cuando un docente publique cupos para esta materia aparecerán aquí."
          action={<WebButton label="Volver al inicio" icon="home" variant="secondary" onPress={() => router.push('/')} />}
        />
      ) : null}
      <View style={styles.list}>
        {availableOffers.map((offer, index) => (
          <WebCard key={offer.id} delay={index * 70} style={styles.offerCard}>
            <View style={styles.offerMain}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(usernames[offer.uid] || offer.username || 'D')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.teacherName}>{usernames[offer.uid] || offer.username || 'Docente'}</Text>
                  <WebBadge tone={offer.available ? 'green' : 'red'}>
                    {offer.available ? 'Disponible' : 'Ocupado'}
                  </WebBadge>
                </View>
                <Text style={styles.meta}>
                  Cupos: {offer.max === 0 ? 'Sin límite' : `${offer.enrolled + offer.pending}/${offer.max}`}
                </Text>
                <View style={styles.chips}>
                  <WebBadge tone="gray" icon="schedule">{formatSlot(Array.isArray(offer.schedule) ? offer.schedule[0] : null)}</WebBadge>
                  <WebBadge tone="blue" icon="payments">{offer.price ? `$${Number(offer.price).toFixed(2)}` : 'Precio por definir'}</WebBadge>
                </View>
              </View>
            </View>
            <WebButton
              label="Ver detalle"
              icon="north-east"
              onPress={() => inspectOffer(offer)}
              disabled={!offer.available || connectivity.isOffline}
              loading={rowLoading === offer.id}
            />
          </WebCard>
        ))}
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap',
  },
  offerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 280,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: webTokens.color.brand,
    fontSize: 22,
    fontWeight: '900',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  teacherName: {
    color: webTokens.color.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  meta: {
    color: webTokens.color.muted,
    marginTop: 5,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
});
