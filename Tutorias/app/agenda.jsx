import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function AgendaScreen() {
  const router = useRouter();
  const { user, ready } = useAuthGuard({ dest: 'Agenda', delayMs: 400 });
  const insets = useSafeAreaInsets();

  if (!ready) return null;
  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={{ alignSelf: 'stretch', paddingHorizontal: 20, paddingTop: (insets?.top ?? 0) + 16, marginBottom: 12, zIndex: 10, position: 'relative' }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color="#1B1E36" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Agenda</Text>
      <Text style={styles.subtitle}>Pantalla pendiente por implementar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1E36',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#C7C9D9' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD580',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  backText: { color: '#1B1E36', fontWeight: '800' },
});
