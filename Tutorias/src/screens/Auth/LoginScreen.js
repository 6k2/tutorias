import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { signInWithEmail } from '../../services/authService';
import { getCurrentUserDoc } from '../../services/userService';
import routes from '../../app/routes';

export default function LoginScreen({ navigation }) {
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    try {
      const cred = await signInWithEmail({ email, password });
      const userDoc = await getCurrentUserDoc(cred.user.uid);
      if (!userDoc || !userDoc.displayName) {
        navigation.replace(routes.EDIT_PROFILE);
      } else {
        navigation.replace(routes.TUTORS_LIST);
      }
    } catch (e) {
      Alert.alert('Login error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>WHO YOU ARE?</Text>
      <View style={styles.roles}>
        <TouchableOpacity onPress={() => setRole('student')}>
          <Image source={{ uri: 'https://img.icons8.com/ios-filled/100/ffffff/user-female.png' }} style={[styles.roleIcon, role === 'student' && styles.selectedRole]} />
          <Text style={styles.roleText}>Student</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole('tutor')}>
          <Image source={{ uri: 'https://img.icons8.com/ios-filled/100/ffffff/teacher.png' }} style={[styles.roleIcon, role === 'tutor' && styles.selectedRole]} />
          <Text style={styles.roleText}>Teacher</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#aaa" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#aaa" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.signupBtn} onPress={onLogin}>
        <Text style={styles.signupText}>LOGIN</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>
        Don’t have an account?{' '}
        <Text style={styles.loginLink} onPress={() => navigation.navigate(routes.REGISTER)}>Sign up here</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1E36',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 20,
  },
  roles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  roleIcon: {
    width: 60,
    height: 60,
    tintColor: '#fff',
    borderRadius: 30,
    marginBottom: 5,
    alignSelf: 'center',
  },
  selectedRole: {
    borderWidth: 2,
    borderColor: '#FF7F50',
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#2C2F48',
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    color: '#fff',
  },
  signupBtn: {
    backgroundColor: '#FF8E53',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    marginTop: 20,
    color: '#aaa',
  },
  loginLink: {
    color: '#FF8E53',
    fontWeight: 'bold',
  },
});
