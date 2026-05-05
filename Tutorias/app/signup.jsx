import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from './config/firebase';
import { Button, Card, Field } from '../components/ui/Primitives';
import { tokens } from '../components/ui/tokens';

const roles = [{ key: 'Student', label: 'Estudiante', icon: 'school', text: 'Reserva tutorías y descarga materiales.' }, { key: 'Teacher', label: 'Docente', icon: 'workspace-premium', text: 'Publica clases y gestiona solicitudes.' }];

export default function SignUpScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => onAuthStateChanged(auth, (u) => { if (u) router.replace('/'); }), [router]);

  const onSignup = async () => {
    setError(null);
    if (!role) return setError('Selecciona un tipo de cuenta.');
    if (!username.trim()) return setError('Ingresa tu nombre.');
    if (!email.trim()) return setError('Ingresa un email válido.');
    if (password.length < 6) return setError('La contraseña debe tener mínimo 6 caracteres.');
    if (password !== confirmPassword) return setError('Las contraseñas no coinciden.');
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, email, username: username.trim(), role, createdAt: serverTimestamp() });
      router.replace('/');
    } catch (e) {
      let msg = 'No se pudo crear la cuenta.';
      if (e?.code === 'auth/email-already-in-use') msg = 'El email ya está en uso.';
      if (e?.code === 'auth/invalid-email') msg = 'Email inválido.';
      if (e?.code === 'auth/weak-password') msg = 'Contraseña débil.';
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.page}>
      <View style={[styles.shell, !isDesktop && styles.shellMobile]}>
        <Card style={styles.formCard}>
          <Text style={styles.kicker}>Nueva cuenta</Text><Text style={styles.title}>Crea tu workspace</Text><Text style={styles.subtitle}>Elige tu perfil y empieza con una experiencia enfocada en web.</Text>
          <View style={styles.roleGrid}>{roles.map((item) => <TouchableOpacity key={item.key} onPress={() => setRole(item.key)} style={[styles.roleCard, role === item.key && styles.roleActive]}><MaterialIcons name={item.icon} size={24} color={role === item.key ? '#fff' : tokens.color.brand} /><Text style={[styles.roleTitle, role === item.key && styles.roleActiveText]}>{item.label}</Text><Text style={[styles.roleText, role === item.key && styles.roleActiveText]}>{item.text}</Text></TouchableOpacity>)}</View>
          <Field label="Nombre" icon="person" placeholder="María Pérez" value={username} onChangeText={setUsername} />
          <Field label="Email" icon="mail" placeholder="tu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <View style={styles.twoCols}><Field style={{ flex: 1 }} label="Contraseña" icon="lock" placeholder="Mín. 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} /><Field style={{ flex: 1 }} label="Confirmar" icon="lock-outline" placeholder="Repite contraseña" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} /></View>
          {error ? <View style={styles.errorBox}><MaterialIcons name="error" size={18} color="#B91C1C" /><Text style={styles.errorText}>{error}</Text></View> : null}
          <Button loading={loading} onPress={onSignup}>Crear cuenta</Button>
          <Text style={styles.footer}>¿Ya tienes cuenta? <Text style={styles.link} onPress={() => router.push('/login')}>Inicia sesión</Text></Text>
        </Card>
        {isDesktop && <View style={styles.aside}><Text style={styles.asideTitle}>Diseñado para aprender, enseñar y coordinar mejor.</Text><Text style={styles.asideText}>Publica clases, revisa cupos, paga de forma mock y continúa con chat o materiales sin perder contexto.</Text></View>}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 }, shell: { width: '100%', maxWidth: 1180, flexDirection: 'row', gap: 24 }, shellMobile: { maxWidth: 560 }, formCard: { flex: 1.1, gap: 15, padding: 32 }, aside: { flex: .9, borderRadius: 34, backgroundColor: '#111827', padding: 38, justifyContent: 'flex-end' }, asideTitle: { color: '#fff', fontSize: 46, lineHeight: 50, fontWeight: '900' }, asideText: { color: '#CBD5E1', marginTop: 18, fontSize: 17, lineHeight: 27 }, kicker: { color: tokens.color.brand, fontWeight: '900', textTransform: 'uppercase' }, title: { color: tokens.color.ink, fontSize: 38, fontWeight: '900' }, subtitle: { color: tokens.color.muted, lineHeight: 22 }, roleGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, roleCard: { flex: 1, minWidth: 190, borderWidth: 1, borderColor: tokens.color.line, borderRadius: 18, padding: 16, gap: 7, backgroundColor: '#fff' }, roleActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand }, roleTitle: { color: tokens.color.ink, fontWeight: '900', fontSize: 16 }, roleText: { color: tokens.color.muted, lineHeight: 19 }, roleActiveText: { color: '#fff' }, twoCols: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }, errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 12, borderRadius: 14 }, errorText: { color: '#B91C1C', fontWeight: '700', flex: 1 }, footer: { color: tokens.color.muted, textAlign: 'center', fontWeight: '700' }, link: { color: tokens.color.brand, fontWeight: '900' } });
