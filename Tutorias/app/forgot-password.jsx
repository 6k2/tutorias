import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTopAlert } from '../components/TopAlert';
import { Colors } from '../constants/Colors';
import { auth } from './config/firebase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      topAlert.show('Ingresa un email valido', 'error');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      topAlert.show('Si la cuenta existe, enviamos instrucciones a tu correo', 'success');
      setEmail('');
      router.replace('/login');
    } catch (error) {
      console.warn('reset password error', error);
      let message = 'No se pudo enviar el correo de recuperacion';
      if (error?.code === 'auth/invalid-email') message = 'El correo no es valido';
      if (error?.code === 'auth/user-not-found') message = 'No encontramos cuenta con ese correo';
      topAlert.show(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar contrasena</Text>
        <Text style={styles.subtitle}>
          Escribe el correo con el que registraste tu cuenta. Te enviaremos un enlace para restablecer tu contrasena.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electronico"
          placeholderTextColor="#9aa3b2"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />

        <TouchableOpacity style={[styles.submitButton, loading && { opacity: 0.8 }]} onPress={onSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar instrucciones</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/login')}>
          <Text style={styles.backText}>Volver al login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161a23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#262b3a',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#353c52',
    gap: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e6e9f2',
  },
  subtitle: {
    color: '#9aa3b2',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1f2330',
    borderColor: '#353c52',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#e6e9f2',
    fontSize: 16,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  submitText: {
    color: '#161a23',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    color: Colors.light.tint,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
