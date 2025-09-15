
// Signup screen: pick your vibe (Student/Teacher), set username/email, and go, xd

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { auth, db } from "./config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function SignUpScreen() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const unsub = onAuthStateChanged(require('./config/firebase').auth, (u) => {
      if (u) router.replace('/');
    });
    return () => unsub();
  }, [router]);


  // Create the account and store a basic user profile in Firestore

  const onSignup = async () => {
    try {
      setError(null);
      if (!role) {
        setError("Selecciona un rol");
        return;
      }
      if (!username.trim()) {
        setError("Ingresa un nombre de usuario");
        return;
      }
      if (!email.trim()) {
        setError("Ingresa un email válido");
        return;
      }
      if (password.length < 6) {
        setError("Contraseña débil (mínimo 6 caracteres)");
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }

      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        email,
        username: username.trim(),
        role,
        createdAt: serverTimestamp(),
      });

      router.replace("/");
    } catch (e) {
      let msg = "No se pudo crear la cuenta";
      if (e?.code === "auth/email-already-in-use") msg = "El email ya está en uso";
      if (e?.code === "auth/invalid-email") msg = "Email inválido";
      if (e?.code === "auth/weak-password") msg = "Contraseña débil";
      if (e?.code === "auth/operation-not-allowed") msg = "Habilita Email/Password en Firebase Auth";
      if (e?.code === "auth/network-request-failed") msg = "Sin red o bloqueado por CORS";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign up</Text>

      <Text style={styles.subtitle}>TELL US ABOUT YOU :D</Text>


      {/* Choose your role. This decides what features you get later */}

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
        placeholder="Username"
        placeholderTextColor="#aaa"
        value={username}
        onChangeText={setUsername}
      />

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

      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, { paddingRight: 44 }]}
          placeholder="Confirm Password"
          placeholderTextColor="#aaa"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onPress={() => setShowConfirmPassword((v) => !v)}
          style={styles.eyeIcon}
        >
          <MaterialIcons name={showConfirmPassword ? 'visibility' : 'visibility-off'} size={22} color="#bbb" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="dangerous" size={20} color="#b71c1c" style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.signupBtn, loading && { opacity: 0.7 }]} onPress={onSignup} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signupText}>SIGNUP</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>
        Already have an account?{' '}
        <Text
          style={styles.loginLink}
          onPress={() => router.push("/login")}
        >
          Login here
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

