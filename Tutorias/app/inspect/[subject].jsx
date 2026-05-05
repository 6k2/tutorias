import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useOffersOffline } from '../../hooks/useOffersOffline';
import { useConnectivity } from '../../tools/offline';
import { Badge, Button, Card, EmptyState, Page, PageHeader } from '../../components/ui/Primitives';
import { tokens } from '../../components/ui/tokens';

const mapSchedule = (schedule = []) => { const first = Array.isArray(schedule) ? schedule[0] : null; if (!first) return 'Horario por definir'; const pad = (val) => String(val ?? 0).padStart(2, '0'); return `${first.day} · ${pad(first.hourStart)}:00 - ${pad(first.hourEnd)}:00`; };

export default function InspectSubjectScreen() {
  const router = useRouter();
  const { subject, name } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const connectivity = useConnectivity();
  const { offers, loading, fromCache } = useOffersOffline(subjectKey);
  const [usernames, setUsernames] = useState({});
  const [rowLoading, setRowLoading] = useState({});
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Reservas', delayMs: 400 });

  useEffect(() => { let cancelled = false; async function loadNames() { const ids = Array.from(new Set((offers || []).map((offer) => offer.uid).filter(Boolean))); const names = {}; await Promise.all(ids.map(async (uid) => { try { const us = await getDoc(doc(db, 'users', uid)); const data = us.data() || {}; if (data.username) names[uid] = data.username; } catch (error) { console.warn('inspect: username lookup failed', error); } })); if (!cancelled) setUsernames(names); } if (offers?.length) loadNames(); else setUsernames({}); return () => { cancelled = true; }; }, [offers]);

  const renderedOffers = useMemo(() => offers || [], [offers]);
  const empty = !loading && renderedOffers.length === 0;
  const availableCount = renderedOffers.filter((it) => Number(it.maxStudents || 0) === 0 || Number(it.enrolledCount || 0) < Number(it.maxStudents || 0)).length;

  const handleInspect = async (offer) => {
    if (connectivity.isOffline) return topAlert.show('Necesitas conexión a internet para ver los detalles.', 'info');
    setRowLoading((prev) => ({ ...prev, [offer.id]: true }));
    try {
      if (!ready || !user) return topAlert.show('Debes iniciar sesión para reservar una tutoría', 'info');
      const max = Number(offer.maxStudents || 0); const enrolled = Number(offer.enrolledCount || 0); const available = max === 0 || enrolled < max;
      if (!available) return topAlert.show('No hay cupos disponibles', 'info');
      router.push({ pathname: '/inspect/[subject]/[offerId]', params: { subject: subjectKey, offerId: offer.id, name: subjectName } });
    } finally { setRowLoading((prev) => ({ ...prev, [offer.id]: false })); }
  };

  return (
    <Page contentStyle={[styles.content, isDesktop && styles.desktopContent]}>
      <PageHeader eyebrow="Catálogo" title={`Clases de ${subjectName}`} subtitle="Compara docentes, cupos y horarios con una vista de escritorio más densa y clara." action={<Button variant="secondary" icon="arrow-back" onPress={() => router.back()}>Volver</Button>} meta={(connectivity.isOffline || fromCache) ? <Badge tone="amber">Datos offline/cache</Badge> : <Badge tone="green">{availableCount} disponibles</Badge>} />
      {loading && <Card style={styles.loading}><ActivityIndicator color={tokens.color.brand} /><Text style={styles.muted}>Cargando docentes...</Text></Card>}
      {empty && <EmptyState icon="event-busy" title="Aún no hay clases disponibles" message="Vuelve pronto o consulta otra materia del catálogo." />}
      <View style={[styles.offerGrid, isDesktop && styles.offerGridDesktop]}>
        {renderedOffers.map((it) => { const enrolled = Number(it.enrolledCount || 0); const max = Number(it.maxStudents || 0); const available = max === 0 || enrolled < max; const isRowLoading = !!rowLoading[it.id]; return <Card key={it.id} style={styles.offerCard}><View style={styles.offerTop}><Badge tone={available ? 'green' : 'red'}>{available ? 'Disponible' : 'Sin cupos'}</Badge><Text style={styles.price}>{it.price ? `$${Number(it.price).toFixed(2)}` : 'Precio por definir'}</Text></View><Text style={styles.teacher}>{usernames[it.uid] || it.username || 'Docente'}</Text><Text style={styles.subject}>{subjectName}</Text><View style={styles.details}><Text style={styles.detail}>Cupos: {max === 0 ? 'Sin límite' : `${enrolled}/${max}`}</Text><Text style={styles.detail}>{mapSchedule(it.schedule)}</Text></View><Button icon="north-east" loading={isRowLoading} disabled={!available || connectivity.isOffline} onPress={() => handleInspect(it)}>Ver detalle</Button></Card>; })}
      </View>
    </Page>
  );
}
const styles = StyleSheet.create({ content: { paddingBottom: 110 }, desktopContent: { paddingLeft: 284, maxWidth: 1420 }, loading: { flexDirection: 'row', gap: 12, alignItems: 'center' }, muted: { color: tokens.color.muted, fontWeight: '700' }, offerGrid: { gap: 16 }, offerGridDesktop: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }, offerCard: { gap: 14 }, offerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, price: { color: tokens.color.ink, fontWeight: '900' }, teacher: { color: tokens.color.ink, fontSize: 24, fontWeight: '900' }, subject: { color: tokens.color.brand, fontWeight: '900' }, details: { backgroundColor: tokens.color.panelSoft, borderRadius: 16, padding: 14, gap: 6 }, detail: { color: tokens.color.muted, fontWeight: '700' } });
