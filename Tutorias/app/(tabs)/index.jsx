import React, { useMemo } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import { useSession } from '../../contexts/AuthContext';
import { Badge, Button, Card, Page } from '../../components/ui/Primitives';
import { tokens } from '../../components/ui/tokens';

const subjects = [
  { key: 'calculo', title: 'Cálculo', tag: 'STEM', image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=1600&auto=format&fit=crop' },
  { key: 'software', title: 'Software', tag: 'Código', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop' },
  { key: 'biologia', title: 'Biología', tag: 'Ciencias', image: 'https://png.pngtree.com/thumb_back/fw800/background/20230302/pngtree-dna-education-biology-image_1739954.jpg' },
  { key: 'algebra', title: 'Álgebra', tag: 'Matemática', image: 'https://t4.ftcdn.net/jpg/05/08/10/35/360_F_508103535_BvW4uJs6MKlAVrRPSwGJ1Y36t5pw0EvD.jpg' },
  { key: 'ingles', title: 'Inglés', tag: 'Idiomas', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop' },
];

export default function HomeScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const session = useSession();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const metrics = useMemo(() => [{ label: 'Materias', value: '5+' }, { label: 'Reserva', value: 'Pago mock' }, { label: 'Offline', value: 'Ready' }], []);

  const handleTeacherOffer = async (subject) => {
    try {
      if (!session.user?.uid) {
        topAlert.show('Inicia sesión para publicar una tutoría.', 'info');
        return;
      }
      const uid = session.user.uid;
      const id = `${uid}_${subject.key}`;
      const snap1 = await getDoc(doc(db, 'offers', id));
      const snap2 = await getDoc(doc(db, 'users', uid, 'offers', subject.key));
      if (snap1.exists() || snap2.exists()) {
        topAlert.show('Ya tienes una tutoría creada para esta materia', 'info');
        return;
      }
    } catch {
      // si la verificación falla, mantenemos el flujo existente y dejamos que la pantalla siguiente valide
    }
    router.push(`/matricula/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`);
  };

  return (
    <Page contentStyle={[styles.content, isDesktop && styles.desktopContent]}>
      <LinearGradient colors={['#111827', '#312E81', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroCopy}>
          <Badge tone="amber">Plataforma de tutorías</Badge>
          <Text style={styles.heroTitle}>Aprende con docentes disponibles, reserva y paga en minutos.</Text>
          <Text style={styles.heroSubtitle}>Una experiencia web-first para explorar clases, administrar reservas y coordinar materiales o chats desde un workspace claro.</Text>
          <View style={styles.actions}>
            {!session.isAuthenticated && <Button icon="login" onPress={() => router.push('/login')}>Iniciar sesión</Button>}
            <Button variant="secondary" icon="search" onPress={() => router.push('/inspect/calculo?name=Cálculo')}>Explorar clases</Button>
          </View>
        </View>
        <Card style={styles.heroPanel}>
          <Text style={styles.panelKicker}>Workspace</Text>
          <Text style={styles.panelTitle}>Vista rápida</Text>
          {metrics.map((item) => <View key={item.label} style={styles.metricLine}><Text style={styles.metricLabel}>{item.label}</Text><Text style={styles.metricValue}>{item.value}</Text></View>)}
        </Card>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Explora por materia</Text>
          <Text style={styles.sectionSubtitle}>Cards compactas, visuales y preparadas para escritorio. Las imágenes existentes se mantienen como fuente.</Text>
        </View>
        {session.role === 'teacher' && <Badge tone="green">Modo docente</Badge>}
      </View>

      <View style={[styles.grid, isDesktop ? styles.gridDesktop : styles.gridMobile]}>
        {subjects.map((subject) => (
          <Card key={subject.key} padded={false} style={styles.subjectCard}>
            <Image source={{ uri: subject.image }} style={styles.cardImage} resizeMode="cover" />
            <View style={styles.cardBody}>
              <View style={styles.cardTop}><Badge>{subject.tag}</Badge><MaterialIcons name="north-east" size={18} color={tokens.color.brand} /></View>
              <Text style={styles.cardTitle}>{subject.title}</Text>
              <Text style={styles.cardText}>Encuentra docentes, horarios y cupos activos para esta materia.</Text>
              <View style={styles.cardActions}>
                <Button style={{ flex: 1 }} icon="visibility" onPress={() => router.push(`/inspect/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`)}>Ver clases</Button>
                {session.role === 'teacher' && <Button variant="secondary" icon="add" onPress={() => handleTeacherOffer(subject)}>Publicar</Button>}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110 }, desktopContent: { paddingLeft: 284, maxWidth: 1420 },
  hero: { borderRadius: 36, padding: 30, minHeight: 360, flexDirection: 'row', gap: 24, overflow: 'hidden', alignItems: 'stretch' }, heroCopy: { flex: 1, justifyContent: 'center' }, heroTitle: { color: '#fff', fontSize: 54, lineHeight: 58, fontWeight: '900', maxWidth: 760, marginTop: 18 }, heroSubtitle: { color: '#DDE3FF', fontSize: 17, lineHeight: 27, maxWidth: 680, marginTop: 16 }, actions: { flexDirection: 'row', gap: 12, marginTop: 26, flexWrap: 'wrap' }, heroPanel: { width: 320, backgroundColor: 'rgba(255,255,255,.96)', alignSelf: 'center' }, panelKicker: { color: tokens.color.brand, fontWeight: '900', textTransform: 'uppercase' }, panelTitle: { color: tokens.color.ink, fontSize: 28, fontWeight: '900', marginVertical: 14 }, metricLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderTopWidth: 1, borderTopColor: tokens.color.line }, metricLabel: { color: tokens.color.muted, fontWeight: '800' }, metricValue: { color: tokens.color.ink, fontWeight: '900' },
  sectionHeader: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }, sectionTitle: { color: tokens.color.ink, fontSize: 30, fontWeight: '900' }, sectionSubtitle: { color: tokens.color.muted, marginTop: 6 },
  grid: { gap: 18 }, gridDesktop: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }, gridMobile: {}, subjectCard: { overflow: 'hidden' }, cardImage: { width: '100%', height: 180, backgroundColor: tokens.color.brandSoft }, cardBody: { padding: 18, gap: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardTitle: { color: tokens.color.ink, fontSize: 24, fontWeight: '900' }, cardText: { color: tokens.color.muted, lineHeight: 21 }, cardActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
