import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <Text style={styles.subtitle}>WHO YOU ARE?</Text>

      <View style={styles.roles}>
        <TouchableOpacity onPress={() => setRole("Student")}>
          <Image
            source={{ uri: "https://img.icons8.com/ios-filled/100/ffffff/user-female.png" }}
            style={[styles.roleIcon, role === "Student" && styles.selectedRole]}
          />
          <Text style={styles.roleText}>Student</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setRole("Teacher")}>
          <Image
            source={{ uri: "https://img.icons8.com/ios-filled/100/ffffff/teacher.png" }}
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
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={styles.signupBtn}
        onPress={() => {
          // TODO: agregar lógica de autenticación (Firebase, validaciones, etc.)
          console.log("Login pressed", { role, email });
        }}
      >
        <Text style={styles.signupText}>LOGIN</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Don’t have an account?{" "}
        <Text
          style={styles.loginLink}
          onPress={() => router.push("/signup")}
        >
          Sign up here
        </Text>
      </Text>
    </View>
  );
}

/* estilos compartidos (los que me pasaste) */
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
    tintColor: "#fff",
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
    backgroundColor: "#FF8E53", // si después quieres gradiente usa expo-linear-gradient
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
});
