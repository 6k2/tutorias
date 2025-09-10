<<<<<<< Updated upstream
import React from "react";
=======
// Home screen aka vibes central xd
// Shows hero banner, subject cards, and quick actions.
// Teachers can go to Matricular from here to post their offer.
import React, { useEffect, useMemo, useRef, useState } from "react";
>>>>>>> Stashed changes
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function App() {
  const router = useRouter();

<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pantalla Home</Text>

      {/* ================= LOGIN ================= */}
      <TouchableOpacity
        style={[styles.button, styles.signupButton]}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      {/* ================= SIGNUP ================= */}
      <TouchableOpacity
        style={[styles.button, styles.signupButton]}
        onPress={() => router.push("/signup")}
      >
        <Text style={styles.buttonText}>Signup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#4CAF50", // color sólido
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    color: "#fff",
    marginBottom: 40,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 25,
    marginVertical: 10,
  },
  signupButton: {
    backgroundColor: "#eee",
  },
  buttonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "600",
  },
});
