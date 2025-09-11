import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTopAlert } from "../components/TopAlert";
import { auth } from "./config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const unsub = onAuthStateChanged(require('./config/firebase').auth, (u) => {
      if (u) router.replace('/');
    });
    return () => unsub();
  }, [router]);

  React.useEffect(() => {
    const dest = params?.dest || 'esta sección';
    const should = params?.alert === 'needAuth';
    let t;
    if (should) {
      t = setTimeout(() => {
        topAlert.show(`Debes iniciar sesión/Registrarme para acceder a: ${dest}`, 'info');
      }, 1200);
    }
    return () => clearTimeout(t);
  }, [params]);

  const onLogin = async () => {
    try {
      setError(null);
      if (!email.trim()) {
        setError("Ingresa un email válido");
        return;
      }
      if (!password) {
        setError("Ingresa tu contraseña");
        return;
      }
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/");
    } catch (e) {
      let msg = "No se pudo iniciar sesión";
      if (e?.code === "auth/invalid-credential") msg = "Credenciales inválidas";
      if (e?.code === "auth/user-not-found") msg = "Usuario no encontrado";
      if (e?.code === "auth/wrong-password") msg = "Contraseña incorrecta";
      if (e?.code === "auth/too-many-requests") msg = "Demasiados intentos, inténtalo más tarde";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, { paddingRight: 44 }]}
          placeholder="Password"
          placeholderTextColor="#aaa"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onPress={() => setShowPassword((v) => !v)}
          style={styles.eyeIcon}
        >
          <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={22} color="#bbb" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="dangerous" size={20} color="#b71c1c" style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.signupBtn, loading && { opacity: 0.7 }]} onPress={onLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signupText}>LOGIN</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>
        Don’t have an account?{' '}
        <Text style={styles.loginLink} onPress={() => router.push("/signup")}>
          Sign up here
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1B1E36",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: { display: 'none' },
  input: {
    width: "100%",
    backgroundColor: "#2C2F48",
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    color: "#fff",
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  signupBtn: {
    backgroundColor: "#FF8E53",
    width: "100%",
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 20,
  },
  signupText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  footer: {
    marginTop: 20,
    color: "#aaa",
  },
  loginLink: {
    color: "#FF8E53",
    fontWeight: "bold",
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderColor: '#f5c2c7',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 10,
    width: '100%',
  },
  errorText: {
    color: '#b71c1c',
    flexShrink: 1,
    fontSize: 14,
  },
});

