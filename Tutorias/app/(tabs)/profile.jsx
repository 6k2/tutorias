// Profile screen where users show their best self, xd
// You can change avatar, bio, pick specialties, and logout.
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useTopAlert } from '../../components/TopAlert';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  // Redirects to login if not authenticated (gentle nudge, xd)
  const { user, ready } = useAuthGuard({ dest: 'Perfil', delayMs: 400 });
  const topAlert = useTopAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [photoURL, setPhotoURL] = useState('');
  const [description, setDescription] = useState('');
  const [specialties, setSpecialties] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveringPhoto, setHoveringPhoto] = useState(false);
  const hoverLock = useRef(false);
  const [infoHover, setInfoHover] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  const allSubjects = useMemo(() => [
    'Cálculo',
    'Software',
    'Biología',
    'Álgebra',
    'Inglés',
  ], []);

  const [initialData, setInitialData] = useState({ photoURL: '', description: '', specialties: [], username: '', email: '', role: '' });
  // Auth guard centralizado via useAuthGuard

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() || {};
      setPhotoURL(d.photoURL || '');
      setDescription(d.description || '');
      setSpecialties(Array.isArray(d.specialties) ? d.specialties : []);
      setUsername(d.username || '');
      setEmail(d.email || '');
      setRole(d.role || '');
      setInitialData({
        photoURL: d.photoURL || '',
        description: d.description || '',
        specialties: Array.isArray(d.specialties) ? d.specialties : [],
        username: d.username || '',
        email: d.email || '',
        role: d.role || '',
      });
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const hasChanges = (
    photoURL !== initialData.photoURL ||
    description !== initialData.description ||
    JSON.stringify([...specialties].sort()) !== JSON.stringify([...initialData.specialties].sort())
  );

  // Let the user choose a profile picture from their gallery
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      topAlert.show('Permiso requerido: habilita acceso a galería', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setPhotoURL(res.assets[0].uri);
    }
  };

  // Add/remove a subject from selected specialties
  const toggleSubject = (name) => {
    setSpecialties((prev) => prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]);
  };

  // Save only the editable fields (photo, description, specialties)
  const saveProfile = async () => {
    try {
      if (!user) return;
      await setDoc(doc(db, 'users', user.uid), {
        photoURL: photoURL || '',
        description: description.trim(),
        specialties,
      }, { merge: true });
      setInitialData({ photoURL, description: description.trim(), specialties });
      topAlert.show('Cambios guardados :)', 'success');
    } catch (_error) {
      console.error('Profile: save failed', _error);
      topAlert.show('No se pudieron guardar los cambios', 'error');
    }
  };

  // Bye! Clear session and head home
  const doLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (_error) {
      topAlert.show('No se pudo cerrar sesión', 'error');
    }
  };

  if (!ready || loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.info}>Cargando perfil...</Text>
      </View>
    );
  }
  if (!user) return null; // redirigido por el guard

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets?.top ?? 0) + 12 }}
    >
      {/* Header + AGENDA */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity onPress={() => { try { /* screen pending */ } finally { router.push('/agenda'); } }} activeOpacity={0.9}>
          <LinearGradient colors={["#FFA500", "#FF6A00"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.agendaBtn}>
            <MaterialIcons name="add" size={20} color="#1B1E36" />
            <Text style={styles.agendaText}>AGENDA</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarRow}>
        <View
          style={styles.avatarWrap}
          onMouseEnter={() => { setHoveringPhoto(true); }}
          onMouseLeave={() => { setHoveringPhoto(false); hoverLock.current = false; }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={pickPhoto}
            style={{ position: 'relative' }}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={[styles.avatar, hoveringPhoto && styles.avatarHover]} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, hoveringPhoto && styles.avatarHover]}>
                <MaterialIcons name="person" size={42} color="#8C8FA5" />
              </View>
            )}
            {hoveringPhoto && (
              <View style={styles.hoverOverlay}>
                <MaterialIcons name="add" size={28} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.changePhoto, hoveringPhoto && styles.changePhotoHover]}
            onPress={pickPhoto}
            onMouseEnter={() => setHoveringPhoto(true)}
            onMouseLeave={() => setHoveringPhoto(false)}
          >
            <MaterialIcons name="photo-camera" size={18} color="#fff" />
            <Text style={styles.changePhotoText}>Cambiar foto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Descripción */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={styles.inputArea}
        placeholder="Cuenta algo sobre ti"
        placeholderTextColor="#9aa3b2"
        multiline
        value={description}
        onChangeText={(t) => {
          const v = t || '';
          if (v.length > 255) {
            topAlert.show('Límite de 255 caracteres alcanzado.', 'info');
            return;
          }
          setDescription(v);
        }}
      />

      {/* Tus datos (no editable) */}
      <Text style={styles.label}>Tus datos</Text>
      <View
        style={[styles.infoBox, infoHover && styles.infoBoxHover]}
        onMouseEnter={() => setInfoHover(true)}
        onMouseLeave={() => setInfoHover(false)}
      >
        {(() => {
          const displayEmail = email || user?.email || '';
          const displayUsername = username || (displayEmail ? String(displayEmail).split('@')[0] : '');
          const displayRole = role || '';
          return (
            <View style={{ gap: 6 }}>
              <Text style={styles.infoRow}><Text style={styles.infoKey}>Username:</Text> {displayUsername || 'Sin definir'}</Text>
              <Text style={styles.infoRow}><Text style={styles.infoKey}>Gmail:</Text> {displayEmail || 'Sin definir'}</Text>
              <Text style={styles.infoRow}><Text style={styles.infoKey}>Rol:</Text> {displayRole || 'Sin definir'}</Text>
            </View>
          );
        })()}
        {infoHover && (
          <View style={styles.infoOverlay}> 
            <MaterialIcons name="block" size={28} color="#ff6b6b" />
          </View>
        )}
      </View>

      {/* Especialidades */}
      <Text style={styles.label}>Especialidades</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.selectorBox, specialties.length > 0 && styles.selectorBoxActive]}
        onPress={() => setPickerOpen(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialIcons name="school" color="#C7C9D9" size={18} />
          <Text style={styles.selectorText}>
            {specialties.length > 0 ? specialties.join(', ') : 'Agregar especialidades'}
          </Text>
        </View>
        {specialties.length > 0 && <MaterialIcons name="check-circle" color="#34D399" size={20} />}
      </TouchableOpacity>

      {hasChanges && (
        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
          <Text style={styles.saveBtnText}>Guardar cambios</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={doLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* Modal selector */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Elige tus especialidades</Text>
            <View style={styles.chipsWrap}>
              {allSubjects.map((s) => {
                const selected = specialties.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleSubject(s)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>Guardar selección</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#1B1E36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { color: '#fff' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  agendaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 16px rgba(255,106,0,0.35)' }
      : { shadowColor: '#FF6A00', shadowOpacity: 0.7, shadowRadius: 10, elevation: 6 }),
  },
  agendaText: {
    color: '#1B1E36',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarWrap: { alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#2C2F48' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  changePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#2C2F48',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  changePhotoText: { color: '#fff', fontWeight: '600' },
  hoverOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
  },
  avatarHover: { opacity: 0.85 },
  changePhotoHover: { backgroundColor: '#3A3D5A' },
  infoBox: {
    position: 'relative',
    backgroundColor: '#2C2F48',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    cursor: 'not-allowed',
  },
  infoBoxHover: { backgroundColor: '#3A3D5A' },
  infoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { color: '#fff' },
  infoKey: { color: '#C7C9D9' },
  label: { color: '#C7C9D9', marginBottom: 6, marginTop: 10 },
  inputArea: {
    backgroundColor: '#2C2F48',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  selectorBox: {
    backgroundColor: '#2C2F48',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorBoxActive: { backgroundColor: '#3A3D5A' },
  selectorText: { color: '#fff', marginLeft: 10 },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#FF8E53',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  logoutBtn: {
    marginTop: 10,
    backgroundColor: '#2C2F48',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1B1E36',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2C2F48',
  },
  chipSelected: { backgroundColor: '#34D399' },
  chipText: { color: '#fff', fontWeight: '600' },
  chipTextSelected: { color: '#1B1E36' },
  modalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2C2F48',
  },
  modalCloseText: { color: '#fff', fontWeight: '600' },
  modalSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FF8E53',
  },
  modalSaveText: { color: '#fff', fontWeight: '800' },
});








