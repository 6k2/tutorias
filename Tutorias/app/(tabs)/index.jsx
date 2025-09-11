import React, { useEffect, useMemo, useRef, useState } from "react";
// Home screen aka vibes central xd
// Shows hero banner, subject cards, and quick actions.
// Teachers can go to Matricular from here to post their offer.
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
import { auth, db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useTopAlert } from "../../components/TopAlert";

export default function HomeScreen() {
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState("");
  const [uid, setUid] = useState("");
  const topAlert = useTopAlert();

  useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const unsub = onAuthStateChanged(require('../config/firebase').auth, async (u) => {
      setIsAuthed(!!u);
      setUid(u?.uid || "");
      if (u) {
        try {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          const d = snap.data() || {};
          setRole(d.role || "");
        } catch {}
      } else {
        setRole("");
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

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
      {
        key: "ciencia",
        title: "Ciencia",
        image:
          "https://images.unsplash.com/photo-1559757175-570b6c9dff64?q=80&w=1600&auto=format&fit=crop",
      },
    ],
    []
  );

  const cardAnims = useRef(subjects.map(() => new Animated.Value(0))).current;
  const cardYs = useRef(Array(subjects.length).fill(undefined)).current;
  const cardShown = useRef(Array(subjects.length).fill(false)).current;

  // Animate cards when they enter the viewport (fade/slide in). Smooth, xd
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const viewportBottom = y + windowHeight;
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
  };
  const isSmall = windowHeight < 680 || windowWidth < 360;
  return (
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

          {subjects.map((s, i) => {
            const anim = cardAnims[i];
            return (
              <Animated.View
                key={s.key}
                style={[
                  styles.card,
                  {
                    opacity: anim,
                    transform: [
                      {
                        translateY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [16, 0],
                        }),
                      },
                    ],
                  },
                ]}
                onLayout={(e) => {
                  const y = e.nativeEvent.layout.y;
                  cardYs[i] = y;
                }}
              >
                <Image source={{ uri: s.image }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.inspectBtn}
                      onPress={() => router.push(`/inspect/${encodeURIComponent(s.key)}?name=${encodeURIComponent(s.title)}`)}
                    >
                      <Text style={styles.inspectText}>INSPECCIONAR</Text>
                    </TouchableOpacity>
{(role || '').toLowerCase() === 'teacher' && (
                      <TouchableOpacity
                        style={styles.matricularBtn}
                        onPress={async () => {
                          try {
                            if (!uid) {
                              topAlert.show('Debes iniciar sesión para acceder a: Matricula', 'info');
                              return;
                            }
                            const id = `${uid}_${s.key}`;
                            const snap1 = await getDoc(doc(db, 'offers', id));
                            const snap2 = await getDoc(doc(db, 'users', uid, 'offers', s.key));
                            if (snap1.exists() || snap2.exists()) {
                              topAlert.show('Ya tienes una tutoría creada para esta materia', 'info');
                              return;
                            }
                            router.push(`/matricula/${encodeURIComponent(s.key)}?name=${encodeURIComponent(s.title)}`);
                          } catch {
                            router.push(`/matricula/${encodeURIComponent(s.key)}?name=${encodeURIComponent(s.title)}`);
                          }
                        }}
                      >
                        <LinearGradient colors={["#34D399", "#10B981"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.matricularBg}>
                          <Text style={styles.inspectText}>MATRICULAR</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1B1E36",
  },
  hero: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 2,
  },
  heroSubtitle: {
    color: "#f0f0f0",
    marginTop: 8,
    fontSize: 14,
  },
  heroActions: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  heroBtn: {
    backgroundColor: "#2C2F48",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  heroBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FF8E53",
  },
  heroBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  ctaGradientBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradientBg: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  ctaGradientText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 28,
    gap: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#2C2F48",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#1B1E36",
  },
  cardBody: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  inspectBtn: {
    backgroundColor: "#FF8E53",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  inspectText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  matricularBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  matricularBg: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
});

