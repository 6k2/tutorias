import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onLogin = async () => {
    try {
      setError(null);
      if (!email.trim()) {
        console.warn("Login: validation failed -> email missing");
        setError("Ingresa un email válido");
        return;
      }
      if (!password) {
        console.warn("Login: validation failed -> password missing");
        setError("Ingresa tu contraseña");
        return;
      }
      setLoading(true);
      console.log("Login: signing in", { email });
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Login: success");
      router.replace("/");
    } catch (e) {
      console.error("Login error", e);
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

      <Text style={styles.subtitle}>WHO YOU ARE?</Text>

      <View style={styles.roles}>
        <TouchableOpacity onPress={() => setRole("Student")}>
          <Image
            source={{ uri: "https://img.icons8.com/ios-filled/100/ffffff/user-female.png" }}
            tintColor="#fff"
            style={[styles.roleIcon, role === "Student" && styles.selectedRole]}
          />
          <Text style={styles.roleText}>Student</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setRole("Teacher")}>
          <Image
            source={{ uri: "https://img.icons8.com/ios-filled/100/ffffff/teacher.png" }}
            tintColor="#fff"
            style={[styles.roleIcon, role === "Teacher" && styles.selectedRole]}
          />
          <Text style={styles.roleText}>Teacher</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

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
        Don’t have an account?{" "}
        <Text style={styles.loginLink} onPress={() => router.push("/signup")}>
          Sign up here
        </Text>
      </Text>
    </View>
  );
}

/* estilos compartidos */
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
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 20,
  },
  roles: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  roleIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
    alignSelf: "center",
  },
  selectedRole: {
    borderWidth: 2,
    borderColor: "#FF7F50",
  },
  roleText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "#2C2F48",
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    color: "#fff",
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

