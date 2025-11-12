// Profile screen where users show their best self, xd
// You can change avatar, bio, pick specialties, and logout.
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
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
import { Colors } from '../../constants/Colors';
import { useConfirmedEnrollments } from '../../features/materials/hooks/useConfirmedEnrollments';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { useMaterialDownloadQueue } from '../../features/materials/hooks/useMaterialDownloadQueue';
import { useMaterialsByReservation } from '../../features/materials/hooks/useMaterialsByReservation';
import { useOfflineMaterial } from '../../features/materials/hooks/useOfflineMaterial';
import { toMillis } from '../../features/materials/utils/dates';

const TAB_BAR_OVERLAY = 110;

export default function ProfileScreen() {
  const router = useRouter();
  // Redirects to login if not authenticated (gentle nudge, xd)
  const { user, ready } = useAuthGuard({ dest: 'Perfil', delayMs: 400 });
  const topAlert = useTopAlert();
  const insets = useSafeAreaInsets();
  const bottomSpacing = (insets?.bottom ?? 0) + TAB_BAR_OVERLAY;
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
  const [materialsModalVisible, setMaterialsModalVisible] = useState(false);
  const [activeReservation, setActiveReservation] = useState(null);
  const normalizedRole = String(role || '').toLowerCase();
  const isStudent = normalizedRole === 'student';
  const studentEnrollments = useConfirmedEnrollments(
    isStudent ? user?.uid : null,
    'student',
    { disabled: !isStudent }
  );
  const materialsInbox = useMaterialsInbox(isStudent ? user?.uid : null, {
    disabled: !isStudent,
  });
  useMaterialDownloadQueue(isStudent ? user?.uid : null);
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

  const confirmedReservations = isStudent ? studentEnrollments.reservations || [] : [];
  const materialsByReservation = materialsInbox.byReservation || new Map();
  const materialViews = materialsInbox.views || {};
  const totalNewMaterials = materialsInbox.newCount || 0;

  const getMaterialsForReservation = useCallback(
    (reservationId) => {
      if (!reservationId) return [];
      if (materialsByReservation instanceof Map) {
        return materialsByReservation.get(reservationId) || [];
      }
      if (typeof materialsByReservation === 'object' && materialsByReservation !== null) {
        return materialsByReservation[reservationId] || [];
      }
      return [];
    },
    [materialsByReservation]
  );

  const studentMaterialCards = useMemo(() => {
    if (!isStudent || !confirmedReservations.length) return [];
    return confirmedReservations.map((reservation) => {
      const materialsForReservation = getMaterialsForReservation(reservation.id);
      const hasNew = materialsForReservation.some((material) => {
        const viewedAt = toMillis(materialViews?.[material.id]?.lastViewedAt);
        const updatedAt = toMillis(material.updatedAt) || toMillis(material.createdAt);
        return !viewedAt || updatedAt > viewedAt;
      });
      return {
        reservation,
        total: materialsForReservation.length,
        hasNew,
      };
    });
  }, [confirmedReservations, getMaterialsForReservation, materialViews, isStudent]);

  const hasAnyMaterial = studentMaterialCards.some((card) => card.total > 0);

  const markMaterialViewed = materialsInbox.markMaterialViewed || (() => Promise.resolve());

  const handleOpenMaterials = useCallback(
    (reservation) => {
      if (!reservation) return;
      setActiveReservation(reservation);
      setMaterialsModalVisible(true);
      const materialsForReservation = getMaterialsForReservation(reservation.id);
      if (materialsForReservation.length) {
        markMaterialViewed(materialsForReservation.map((material) => material.id), reservation.id).catch(() => {});
      }
    },
    [getMaterialsForReservation, markMaterialViewed]
  );

  const handleCloseMaterials = useCallback(() => {
    setMaterialsModalVisible(false);
    setActiveReservation(null);
  }, []);

  const handleContactTutor = useCallback(() => {
    router.push('/(tabs)/chats');
  }, [router]);

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
      contentContainerStyle={{
        flexGrow: 1,
        padding: 16,
        paddingTop: (insets?.top ?? 0) + 12,
        paddingBottom: bottomSpacing,
      }}
      keyboardShouldPersistTaps="handled"
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

      {isStudent && (
        <View style={styles.materialsSection}>
          <View style={styles.materialsHeader}>
            <View style={styles.materialsHeaderLeft}>
              <MaterialIcons name="folder-open" size={20} color="#fff" />
              <Text style={styles.sectionTitle}>Material de estudio</Text>
            </View>
            {totalNewMaterials > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>Nuevo {totalNewMaterials}</Text>
              </View>
            )}
          </View>

          {studentMaterialCards.length === 0 && (
            <View style={styles.materialsEmpty}>
              <MaterialIcons name="cloud-download" size={32} color="#8C8FA5" />
              <Text style={styles.materialsEmptyText}>
                Cuando confirmes una tutoría, verás aquí los archivos que comparta tu docente.
              </Text>
              <TouchableOpacity style={styles.chatCtaBtn} onPress={handleContactTutor}>
                <MaterialIcons name="chat" size={18} color="#1B1E36" />
                <Text style={styles.chatCtaText}>Ir a chats</Text>
              </TouchableOpacity>
            </View>
          )}

          {studentMaterialCards.map((card) => (
            <View key={card.reservation.id} style={styles.materialCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.materialTitle}>{card.reservation.subjectName || 'Tutoría'}</Text>
                <Text style={styles.materialMeta}>
                  Tutor: {card.reservation.teacherDisplayName || card.reservation.teacherId}
                </Text>
                <Text style={styles.materialMeta}>Archivos: {card.total}</Text>
              </View>
              <View style={styles.materialActionsColumn}>
                {card.hasNew && (
                  <View style={styles.newPill}>
                    <Text style={styles.newPillText}>Nuevo</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.materialButton,
                    card.total === 0 && styles.materialButtonDisabled,
                  ]}
                  onPress={() => handleOpenMaterials(card.reservation)}
                  disabled={card.total === 0}
                >
                  <MaterialIcons name="cloud-download" size={18} color="#1B1E36" />
                  <Text style={styles.materialButtonText}>Ver material</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {studentMaterialCards.length > 0 && !hasAnyMaterial && (
            <View style={styles.materialsEmpty}>
              <MaterialIcons name="hourglass-empty" size={26} color="#8C8FA5" />
              <Text style={styles.materialsEmptyText}>
                Tus tutores aún no suben archivos. Escríbeles si necesitas algo puntual.
              </Text>
              <TouchableOpacity style={styles.chatCtaBtn} onPress={handleContactTutor}>
                <MaterialIcons name="chat" size={18} color="#1B1E36" />
                <Text style={styles.chatCtaText}>Abrir chats</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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

      <MaterialsModal
        visible={materialsModalVisible}
        reservation={activeReservation}
        onClose={handleCloseMaterials}
        userId={user?.uid}
        markMaterialViewed={markMaterialViewed}
        topAlert={topAlert}
      />
    </ScrollView>
  );
}

function MaterialsModal({ visible, reservation, onClose, userId, markMaterialViewed, topAlert }) {
  const reservationId = reservation?.id || null;
  const { materials, loading } = useMaterialsByReservation(reservationId, {
    disabled: !visible || !reservationId,
  });

  useEffect(() => {
    if (!visible || !reservationId || !materials.length) return;
    if (typeof markMaterialViewed === 'function') {
      markMaterialViewed(materials.map((material) => material.id), reservationId).catch(() => {});
    }
  }, [visible, reservationId, materials, markMaterialViewed]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.materialModalBackdrop}>
        <View style={styles.materialModalCard}>
          <View style={styles.materialModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.materialModalTitle}>{reservation?.subjectName || 'Material de estudio'}</Text>
              {reservation?.teacherDisplayName && (
                <Text style={styles.materialModalSubtitle}>
                  Tutor: {reservation.teacherDisplayName}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <MaterialIcons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={Colors.dark.tint} />
              <Text style={styles.modalLoadingText}>Cargando archivos...</Text>
            </View>
          ) : materials.length === 0 ? (
            <View style={styles.modalEmpty}>
              <MaterialIcons name="cloud-off" size={30} color="#8C8FA5" />
              <Text style={styles.modalEmptyText}>Aún no hay materiales para esta tutoría.</Text>
            </View>
          ) : (
            materials.map((material) => (
              <MaterialRow key={material.id} material={material} userId={userId} topAlert={topAlert} />
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

function MaterialRow({ material, userId, topAlert }) {
  const offline = useOfflineMaterial({ uid: userId, material });

  const handleDownload = useCallback(async () => {
    try {
      await offline.download();
      topAlert?.show?.('Descarga lista', 'success');
    } catch (error) {
      if (error?.message) {
        topAlert?.show?.(error.message, 'error');
      }
    }
  }, [offline, topAlert]);

  const handleOpen = useCallback(async () => {
    try {
      await offline.open();
    } catch (error) {
      if (error?.message) {
        topAlert?.show?.(error.message, 'error');
      }
    }
  }, [offline, topAlert]);

  const sizeLabel = formatBytes(material.sizeBytes);
  const updatedLabel = formatMaterialDate(material.updatedAt || material.createdAt);
  const statusIcon =
    offline.status === 'ready'
      ? 'cloud-done'
      : offline.status === 'queued'
      ? 'cloud-queue'
      : offline.status === 'downloading'
      ? 'downloading'
      : 'cloud-download';

  return (
    <View style={styles.materialRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.materialRowTitle}>{material.title || material.fileName || 'Material'}</Text>
        <Text style={styles.materialRowMeta}>
          {sizeLabel} · {updatedLabel}
        </Text>
        {material.description ? (
          <Text style={styles.materialRowDescription}>{material.description}</Text>
        ) : null}
      </View>
      <View style={styles.materialRowActions}>
        <TouchableOpacity
          onPress={handleDownload}
          style={styles.materialSmallBtn}
          disabled={offline.status === 'downloading'}
        >
          <MaterialIcons name={statusIcon} size={18} color="#1B1E36" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOpen} style={styles.materialSmallBtn}>
          <MaterialIcons name="open-in-new" size={18} color="#1B1E36" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return 'Tamaño desconocido';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMaterialDate = (value) => {
  const ms = toMillis(value);
  if (!ms) return 'Sin fecha';
  const date = new Date(ms);
  return date.toLocaleDateString();
};

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
  materialsSection: {
    marginTop: 20,
    backgroundColor: '#2C2F48',
    borderRadius: 14,
    padding: 14,
  },
  materialsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  materialsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  newBadge: {
    backgroundColor: '#FF8E53',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  newBadgeText: { color: '#1B1E36', fontWeight: '800' },
  materialsEmpty: {
    marginTop: 10,
    backgroundColor: '#232647',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  materialsEmptyText: { color: '#C7C9D9', textAlign: 'center' },
  chatCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD580',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chatCtaText: { color: '#1B1E36', fontWeight: '800' },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#232647',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  materialTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  materialMeta: { color: '#C7C9D9', fontSize: 12, marginTop: 2 },
  materialActionsColumn: { alignItems: 'flex-end', gap: 6 },
  newPill: {
    backgroundColor: '#34D399',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newPillText: { color: '#053B2B', fontWeight: '800', fontSize: 12 },
  materialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD580',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  materialButtonDisabled: { opacity: 0.4 },
  materialButtonText: { color: '#1B1E36', fontWeight: '800' },
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
  materialModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  materialModalCard: {
    backgroundColor: '#1B1E36',
    borderRadius: 18,
    padding: 16,
    maxHeight: '80%',
  },
  materialModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  materialModalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  materialModalSubtitle: { color: '#C7C9D9', fontSize: 13, marginTop: 2 },
  closeModalBtn: { padding: 6, borderRadius: 12, backgroundColor: '#2C2F48' },
  modalLoading: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  modalLoadingText: { color: '#C7C9D9' },
  modalEmpty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  modalEmptyText: { color: '#C7C9D9', textAlign: 'center' },
  materialRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#2C2F48',
    gap: 12,
  },
  materialRowTitle: { color: '#fff', fontWeight: '700' },
  materialRowMeta: { color: '#C7C9D9', fontSize: 12, marginTop: 2 },
  materialRowDescription: { color: '#9AA3B2', fontSize: 12, marginTop: 4 },
  materialRowActions: { flexDirection: 'row', gap: 8 },
  materialSmallBtn: {
    backgroundColor: '#FFD580',
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});








