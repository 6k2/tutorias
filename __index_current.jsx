import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Animated,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const unsub = onAuthStateChanged(require('../config/firebase').auth, (u) => {
      setIsAuthed(!!u);
    });
    return () => unsub();
  }, []);

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
          "https://images.unsplash.com/photo-1529101091764-c3526daf38fe?q=80&w=1600&auto=format&fit=crop",
      },
      {
        key: "algebra",
        title: "Álgebra",
        image:
          "https://images.unsplash.com/photo-1509223197845-458d87318791?q=80&w=1600&auto=format&fit=crop",
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
          useNativeDriver: true,
        }).start();
      }
    });
  };

  const openInspect = (name) => {
    Alert.alert("No disponible", `${name} aún no está disponible`);
  };

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
          <Text style={styles.heroTitle}>TUTORIAS</Text>
          <Text style={styles.heroSubtitle}>Reserva clases, edita tu perfil y chatea</Text>
          {!isAuthed && (
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => router.push("/login")}
              >
                <Text style={styles.heroBtnText}>Iniciar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/signup")}
                style={styles.ctaGradientBtn}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#34D399", "#10B981"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradientBg}
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
                  <TouchableOpacity
                    style={styles.inspectBtn}
                    onPress={() => openInspect(s.title)}
                  >
                    <Text style={styles.inspectText}>INSPECCIONAR</Text>
                  </TouchableOpacity>
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
    paddingTop: 24,
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
});

