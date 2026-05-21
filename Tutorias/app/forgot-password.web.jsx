import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTopAlert } from '../components/TopAlert';
import { AuthShell, WebButton, WebInput, webTokens } from '../components/web/WebUI';
import { auth } from './config/firebase';

export default function ForgotPasswordWebScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      topAlert.show('Ingresa un correo válido', 'error');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      topAlert.show('Si la cuenta existe, enviamos instrucciones a tu correo', 'success');
      router.replace('/login');
    } catch (e) {
      let message = 'No se pudo enviar el correo de recuperación.';
      if (e?.code === 'auth/invalid-email') message = 'El correo no es válido.';
      if (e?.code === 'auth/user-not-found') message = 'No encontramos una cuenta con ese correo.';
      topAlert.show(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Escribe el correo con el que creaste tu cuenta. Te enviaremos un enlace de recuperación."
      sideTitle="Vuelve rápido"
      sideText="La web mantiene tu flujo de reservas, clases y conversaciones apenas recuperes acceso."
    >
      <WebInput label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="tu@email.com" />
      <WebButton label="Enviar instrucciones" icon="mark-email-read" onPress={onSend} loading={loading} style={styles.submit} />
      <Pressable onPress={() => router.replace('/login')} style={styles.back}>
        <Text style={styles.link}>Volver al inicio de sesión</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  submit: {
    marginTop: 22,
  },
  back: {
    alignSelf: 'center',
    marginTop: 16,
  },
  link: {
    color: webTokens.color.brand,
    fontWeight: '900',
  },
});
