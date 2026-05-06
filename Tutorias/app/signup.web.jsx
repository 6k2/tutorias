import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthShell, WebButton, WebInput, webTokens } from '../components/web/WebUI';
import { auth, db } from './config/firebase';

export default function SignupWebScreen() {
  const router = useRouter();
  const [role, setRole] = useState('Student');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignup = async () => {
    setError('');
    const cleanName = username.trim();
    const cleanEmail = email.trim();
    if (!cleanName) {
      setError('Ingresa un nombre de usuario.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cleanEmail,
        username: cleanName,
        role,
        createdAt: serverTimestamp(),
      });
      router.replace('/');
    } catch (e) {
      let message = 'No se pudo crear la cuenta.';
      if (e?.code === 'auth/email-already-in-use') message = 'Ese correo ya está en uso.';
      if (e?.code === 'auth/invalid-email') message = 'El correo no es válido.';
      if (e?.code === 'auth/weak-password') message = 'La contraseña es débil.';
      if (e?.code === 'auth/operation-not-allowed') message = 'Email/Password no está habilitado en Firebase Auth.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Selecciona tu rol y deja listo tu perfil para el flujo web."
      sideTitle="Arranca con claridad"
      sideText="Estudiantes reservan clases; docentes publican cupos, horarios y materiales."
    >
      <View style={styles.roles}>
        {[
          ['Student', 'Estudiante', 'school'],
          ['Teacher', 'Docente', 'workspace-premium'],
        ].map(([value, label, icon]) => {
          const selected = role === value;
          return (
            <Pressable key={value} style={[styles.role, selected && styles.roleSelected]} onPress={() => setRole(value)}>
              <MaterialIcons name={icon} size={24} color={selected ? '#FFFFFF' : webTokens.color.brand} />
              <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <WebInput label="Usuario" value={username} onChangeText={setUsername} placeholder="Tu nombre visible" />
      <WebInput label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="tu@email.com" />
      <WebInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        placeholder="Mínimo 6 caracteres"
        right={
          <Pressable style={styles.eye} onPress={() => setShowPassword((value) => !value)}>
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={webTokens.color.muted} />
          </Pressable>
        }
      />
      <WebInput label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} placeholder="Repite tu contraseña" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <WebButton label="Crear cuenta" icon="person-add" onPress={onSignup} loading={loading} style={styles.submit} />
      <Pressable onPress={() => router.push('/login')} style={styles.loginLink}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  roles: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  role: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  roleSelected: {
    backgroundColor: webTokens.color.brand,
    borderColor: webTokens.color.brand,
    ...webTokens.shadow.lift,
  },
  roleText: {
    color: webTokens.color.ink,
    fontWeight: '900',
  },
  roleTextSelected: {
    color: '#FFFFFF',
  },
  eye: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: 22,
  },
  loginLink: {
    alignSelf: 'center',
    marginTop: 16,
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
