import React from "react";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function App() {
    const router = useRouter();
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
