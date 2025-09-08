import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { signUpWithEmail } from '../../services/authService';
import routes from '../../app/routes';

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const onSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    try {
      await signUpWithEmail({ email, password, role });
      navigation.replace(routes.EDIT_PROFILE);
    } catch (e) {
      Alert.alert('Signup error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign up</Text>
      <Text style={styles.subtitle}>WHO YOU ARE?</Text>
      <View style={styles.roles}>
        <TouchableOpacity onPress={() => setRole('student')}>
          <Image source={{ uri: 'https://img.icons8.com/ios-filled/100/ffffff/user-female.png' }} style={[styles.roleIcon, role === 'student' && styles.selectedRole]} />
          <Text style={styles.roleText}>Student</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole('tutor')}>
          <Image source={{ uri: 'https://img.icons8.com/ios-filled/100/ffffff/teacher.png' }} style={[styles.roleIcon, role === 'tutor' && styles.selectedRole]} />
          <Text style={styles.roleText}>TEACHER</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#aaa" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#aaa" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#aaa" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#aaa" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      <TouchableOpacity style={styles.signupBtn} onPress={onSignUp}>
        <Text style={styles.signupText}>SIGNUP</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>
        Already have an account?{' '}
        <Text style={styles.loginLink} onPress={() => navigation.navigate(routes.LOGIN)}>Login here</Text>
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
