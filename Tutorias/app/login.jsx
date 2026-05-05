import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from './config/firebase';
import { useTopAlert } from '../components/TopAlert';
import { Button, Card, Field } from '../components/ui/Primitives';
import { tokens } from '../components/ui/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => onAuthStateChanged(auth, (u) => { if (u) router.replace('/'); }), [router]);
  React.useEffect(() => {
    if (params?.alert === 'needAuth') {
      const t = setTimeout(() => topAlert.show(`Inicia sesión para acceder a ${params?.dest || 'esta sección'}.`, 'info'), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [params, topAlert]);

  const onLogin = async () => {
    setError(null);
    if (!email.trim()) return setError('Ingresa un email válido.');
    if (!password) return setError('Ingresa tu contraseña.');
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (e) {
      let msg = 'No se pudo iniciar sesión.';
      if (e?.code === 'auth/invalid-credential') msg = 'Credenciales inválidas.';
      if (e?.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Inténtalo más tarde.';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.page}>
      <View style={[styles.shell, !isDesktop && styles.shellMobile]}>
        {isDesktop && <View style={styles.story}><Text style={styles.brand}>Tutorias</Text><Text style={styles.storyTitle}>Tu plataforma de aprendizaje, ahora con experiencia web premium.</Text><Text style={styles.storyText}>Gestiona reservas, pagos mock, chats y materiales desde un workspace claro y profesional.</Text></View>}
        <Card style={styles.formCard}>
          <Text style={styles.kicker}>Bienvenido de vuelta</Text>
          <Text style={styles.title}>Inicia sesión</Text>
          <Text style={styles.subtitle}>Accede a tus clases, reservas y mensajes.</Text>
          <Field label="Email" icon="mail" placeholder="tu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <View style={{ position: 'relative' }}>
            <Field label="Contraseña" icon="lock" placeholder="••••••••" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((v) => !v)}><MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={tokens.color.muted} /></TouchableOpacity>
          </View>
          {error ? <View style={styles.errorBox}><MaterialIcons name="error" size={18} color="#B91C1C" /><Text style={styles.errorText}>{error}</Text></View> : null}
          <Button loading={loading} onPress={onLogin}>Entrar al workspace</Button>
          <Text style={styles.footer}>¿No tienes cuenta? <Text style={styles.link} onPress={() => router.push('/signup')}>Crear cuenta</Text></Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', padding: 24 }, shell: { width: '100%', maxWidth: 1120, minHeight: 640, flexDirection: 'row', gap: 24 }, shellMobile: { maxWidth: 520, minHeight: 0 },
  story: { flex: 1.1, borderRadius: 34, backgroundColor: tokens.color.dark, padding: 38, justifyContent: 'flex-end' }, brand: { color: '#A5B4FC', fontWeight: '900', fontSize: 20, marginBottom: 90 }, storyTitle: { color: '#fff', fontWeight: '900', fontSize: 48, lineHeight: 52 }, storyText: { color: '#CBD5E1', fontSize: 17, lineHeight: 27, marginTop: 18 },
  formCard: { flex: 0.9, justifyContent: 'center', gap: 16, padding: 34 }, kicker: { color: tokens.color.brand, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, title: { color: tokens.color.ink, fontSize: 38, fontWeight: '900' }, subtitle: { color: tokens.color.muted, lineHeight: 22, marginBottom: 8 }, eye: { position: 'absolute', right: 14, bottom: 14 }, errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 12, borderRadius: 14 }, errorText: { color: '#B91C1C', fontWeight: '700', flex: 1 }, footer: { color: tokens.color.muted, textAlign: 'center', fontWeight: '700' }, link: { color: tokens.color.brand, fontWeight: '900' },
});
