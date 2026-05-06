// Home screen aka vibes central xd
// Shows hero banner, subject cards, and quick actions.
// Teachers can go to Matricular from here to post their offer.
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useTopAlert } from "../../components/TopAlert";
import { useSession } from "../../contexts/AuthContext";

export default function HomeScreen() {
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const topAlert = useTopAlert();
  const session = useSession();
  const isAuthed = session.isAuthenticated;
  const authChecked = session.ready;
  const role = session.role;
  const uid = session.user?.uid || "";

  // Static list of subjects we show on the home feed
  const subjects = useMemo(
    () => [
      {
        key: "calculo",
        title: "Cálculo",
        image:
          "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=1600&auto=format&fit=crop",
      },
      {
        key: "software",
        title: "Software",
        image:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop",
      },
      {
        key: "biologia",
        title: "Biología",
        image:
          "https://png.pngtree.com/thumb_back/fw800/background/20230302/pngtree-dna-education-biology-image_1739954.jpg",
      },
      {
        key: "algebra",
        title: "Álgebra",
        image:
          "https://t4.ftcdn.net/jpg/05/08/10/35/360_F_508103535_BvW4uJs6MKlAVrRPSwGJ1Y36t5pw0EvD.jpg",
      },
      {
        key: "ingles",
        title: "Inglés",
        image:
          "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop",
      },
    ],
    []
  );

  const cardAnims = useRef(subjects.map(() => new Animated.Value(0))).current;
  const cardYs = useRef(Array(subjects.length).fill(undefined)).current;
  const cardShown = useRef(Array(subjects.length).fill(false)).current;
  const scrollYRef = useRef(0);

  const maybeAnimateVisible = useCallback(() => {
    const viewportBottom = windowHeight + scrollYRef.current;
    subjects.forEach((_, i) => {
      const cardY = cardYs[i];
      if (!cardShown[i] && typeof cardY === "number" && viewportBottom > cardY + 80) {
        cardShown[i] = true;
        Animated.timing(cardAnims[i], {
          toValue: 1,
          duration: 450,
          useNativeDriver: false,
        }).start();
      }
    });
  }, [cardAnims, cardShown, cardYs, subjects, windowHeight]);

  // Animate cards when they enter the viewport (fade/slide in).
  const onScroll = (e) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    scrollYRef.current = y;
    maybeAnimateVisible();
  };
  // Run once after mount to animate above-the-fold cards
  useEffect(() => {
    const id = requestAnimationFrame(() => maybeAnimateVisible());
    return () => cancelAnimationFrame(id);
  }, [maybeAnimateVisible]);
  // Detect small screens to adjust some styles
  const isSmall = windowHeight < 680 || windowWidth < 360;
  return ( // Main container view with background color
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero con gradiente */}
        <LinearGradient
          colors={["#FF8E53", "#FF7F50", "#1B1E36"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroTitle, isSmall && { fontSize: 34 }]}>TUTORIAS</Text>
          <Text style={[styles.heroSubtitle, isSmall && { fontSize: 12 }]}>Reserva clases, edita tu perfil y chatea</Text>
          {authChecked && !isAuthed && (
            <View style={[styles.heroActions, isSmall && { flexWrap: 'wrap' }]}>
              <TouchableOpacity
                style={[styles.heroBtn, isSmall && { paddingVertical: 10, paddingHorizontal: 12 }]}
                onPress={() => router.push("/login")}
              >
                <Text style={styles.heroBtnText}>Iniciar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/signup")}
                style={[styles.ctaGradientBtn, isSmall && { marginTop: 8 }]}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#34D399", "#10B981"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.ctaGradientBg, isSmall && { paddingVertical: 10, paddingHorizontal: 12 }]}
                >
                  <Text style={styles.ctaGradientText}>Registrarme</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Lista de materias */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Materias</Text>

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
