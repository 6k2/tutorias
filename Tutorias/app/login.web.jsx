import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTopAlert } from '../components/TopAlert';
import { AuthShell, WebButton, WebInput, webTokens } from '../components/web/WebUI';
import { auth } from './config/firebase';

export default function LoginWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params?.alert === 'needAuth') {
      const dest = params?.dest || 'esta sección';
      const timer = setTimeout(() => {
        topAlert.show(`Debes iniciar sesión para acceder a: ${dest}`, 'info');
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [params?.alert, params?.dest, topAlert]);

  const onLogin = async () => {
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (!password) {
      setError('Ingresa tu contraseña.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      router.replace('/');
    } catch (e) {
      let message = 'No se pudo iniciar sesión.';
      if (e?.code === 'auth/invalid-credential') message = 'Credenciales inválidas.';
      if (e?.code === 'auth/user-not-found') message = 'No encontramos una cuenta con ese correo.';
      if (e?.code === 'auth/wrong-password') message = 'La contraseña no coincide.';
      if (e?.code === 'auth/too-many-requests') message = 'Demasiados intentos. Inténtalo más tarde.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Inicia sesión"
      subtitle="Entra a tu cuenta para reservar, publicar tutorías, chatear y revisar tu agenda."
      sideTitle="Tu panel académico"
      sideText="Todo el flujo de tutorías se siente más claro en escritorio: materias, reservas, agenda y conversaciones."
    >
      <WebInput label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="tu@email.com" />
      <WebInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        placeholder="Tu contraseña"
        right={
          <Pressable style={styles.eye} onPress={() => setShowPassword((value) => !value)} accessibilityRole="button">
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={webTokens.color.muted} />
          </Pressable>
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <WebButton label="Entrar" icon="login" onPress={onLogin} loading={loading} style={styles.submit} />
      <View style={styles.links}>
        <Pressable onPress={() => router.push('/signup')}><Text style={styles.link}>Crear cuenta</Text></Pressable>
        <Pressable onPress={() => router.push('/forgot-password')}><Text style={styles.link}>Olvidé mi contraseña</Text></Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  eye: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: 22,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  link: {
    color: webTokens.color.brand,
    fontWeight: '900',
  },
  error: {
    color: webTokens.color.bad,
    fontWeight: '800',
    marginTop: 12,
  },
});
