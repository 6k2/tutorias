import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import {
  EmptyState,
  LoadingState,
  WebBadge,
  WebButton,
  WebCard,
  WebInput,
  WebShell,
  formatSlot,
  getProfileRole,
  roleIsStudent,
  roleIsTeacher,
  signOutWeb,
  webTokens,
} from '../../components/web/WebUI';
import { useConfirmedEnrollments } from '../../features/materials/hooks/useConfirmedEnrollments';
import { useMaterialDownloadQueue } from '../../features/materials/hooks/useMaterialDownloadQueue';
import { useMaterialsByReservation } from '../../features/materials/hooks/useMaterialsByReservation';
import { useMaterialsInbox } from '../../features/materials/hooks/useMaterialsInbox';
import { useMaterialViews } from '../../features/materials/hooks/useMaterialViews';
import { useOfflineMaterial } from '../../features/materials/hooks/useOfflineMaterial';
import { formatMoney, paymentTotals } from '../../features/payments';
import { resolveProfileAvatar, syncChatProfileForUser } from '../../features/profile/avatar';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useReservations } from '../../hooks/useReservations';

const allSubjects = ['Cálculo', 'Software', 'Biología', 'Álgebra', 'Inglés'];

export default function ProfileWebScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Perfil', delayMs: 400 });
  const [loading, setLoading] = useState(true);
  const [photoURL, setPhotoURL] = useState('');
  const [savedPhotoURL, setSavedPhotoURL] = useState('');
  const [description, setDescription] = useState('');
  const [specialties, setSpecialties] = useState([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [materialsModalVisible, setMaterialsModalVisible] = useState(false);
  const [activeReservation, setActiveReservation] = useState(null);

  const isStudent = roleIsStudent(role);
  const isTeacher = roleIsTeacher(role);
  const confirmedEnrollments = useConfirmedEnrollments(isStudent ? user?.uid : null, role, { disabled: !isStudent });
  const materialsInbox = useMaterialsInbox(isStudent ? user?.uid : null, { disabled: !isStudent });
  const teacherReservations = useReservations(role, isTeacher ? user?.uid : null, { disabled: !isTeacher });
  const { markMaterialViewed, materialViews } = useMaterialViews(isStudent ? user?.uid : null);
  useMaterialDownloadQueue(isStudent ? user?.uid : null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return undefined;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data() || {};
      setPhotoURL(data.photoURL || '');
      setSavedPhotoURL(data.photoURL || '');
      setDescription(data.description || '');
      setSpecialties(Array.isArray(data.specialties) ? data.specialties : []);
      setUsername(data.username || '');
      setEmail(data.email || user.email || '');
      setRole(getProfileRole(data));
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [user]);

  const studentCards = useMemo(() => {
    const reservations = confirmedEnrollments.reservations || [];
    const byReservation = materialsInbox.byReservation;
    const views = materialViews || {};
    return reservations.map((reservation) => {
      const materials = byReservation?.get?.(reservation.id) || [];
      const unseen = materials.filter((material) => !views[material.id]).length;
      return { reservation, materials, unseen };
    });
  }, [confirmedEnrollments.reservations, materialsInbox.byReservation, materialViews]);
  const teacherPaymentTotals = useMemo(
    () => paymentTotals(teacherReservations.reservations || []),
    [teacherReservations.reservations]
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images', quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoURL(result.assets[0].uri);
  };

  const saveProfile = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const avatar = await resolveProfileAvatar({
        uid: user.uid,
        uri: photoURL,
        fallbackURL: savedPhotoURL,
      });
      const remotePhotoURL = avatar.photoURL;
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email || user.email,
        username,
        photoURL: remotePhotoURL,
        description,
        specialties,
        role,
      }, { merge: true });
      setPhotoURL(remotePhotoURL);
      try {
        await syncChatProfileForUser({
          uid: user.uid,
          displayName: username || email || user.email || user.uid,
          photoURL: remotePhotoURL,
          role,
        });
      } catch (syncError) {
        console.warn('ProfileWeb: chat profile sync failed', syncError);
      }
      topAlert.show(
        avatar.uploadFailed ? 'Perfil guardado, pero no se pudo subir la foto.' : 'Perfil actualizado.',
        avatar.uploadFailed ? 'error' : 'success'
      );
    } catch (error) {
      console.error('ProfileWeb: save failed', error);
      topAlert.show('No se pudo guardar el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (subject) => {
    setSpecialties((prev) => prev.includes(subject) ? prev.filter((item) => item !== subject) : [...prev, subject]);
  };

  const openMaterials = useCallback((reservation) => {
    setActiveReservation(reservation);
    setMaterialsModalVisible(true);
  }, []);

  if (!ready || loading) {
    return <WebShell title="Perfil" active="/profile"><LoadingState label="Cargando perfil..." /></WebShell>;
  }

  return (
    <WebShell
      title="Perfil"
      subtitle="Actualiza tu identidad, revisa tus accesos rápidos y consulta materiales vinculados a tus reservas."
      active="/profile"
      actions={<WebButton label="Cerrar sesión" icon="logout" variant="danger" onPress={() => signOutWeb(router)} />}
    >
      <View style={styles.layout}>
        <WebCard style={styles.profileCard}>
          <View style={styles.profileTop}>
            {photoURL ? <Image source={{ uri: photoURL }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{(username || email || '?')[0].toUpperCase()}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{username || 'Usuario'}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.badges}>
                <WebBadge tone={isTeacher ? 'green' : 'blue'} icon={isTeacher ? 'workspace-premium' : 'school'}>{isTeacher ? 'Docente' : 'Estudiante'}</WebBadge>
                {materialsInbox.newCount ? <WebBadge tone="amber" icon="notifications">{materialsInbox.newCount} materiales nuevos</WebBadge> : null}
              </View>
            </View>
            <WebButton label="Cambiar foto" icon="photo-camera" variant="secondary" onPress={pickImage} />
          </View>

          <View style={styles.formGrid}>
            <WebInput label="Usuario" value={username} onChangeText={setUsername} placeholder="Nombre visible" />
            <WebInput label="Correo" value={email} onChangeText={setEmail} placeholder="correo@email.com" editable={false} />
          </View>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Cuéntanos sobre tu estilo, objetivos o experiencia."
            placeholderTextColor="#98A2B3"
            style={styles.textArea}
          />
          {isTeacher ? (
            <>
              <Text style={styles.label}>Especialidades</Text>
              <View style={styles.specialties}>
                {allSubjects.map((subject) => {
                  const selected = specialties.includes(subject);
                  return (
                    <Pressable key={subject} style={[styles.specialty, selected && styles.specialtyActive]} onPress={() => toggleSpecialty(subject)}>
                      <Text style={[styles.specialtyText, selected && styles.specialtyTextActive]}>{subject}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <WebButton label="Guardar cambios" icon="save" onPress={saveProfile} loading={saving} style={styles.save} />
        </WebCard>

        <View style={styles.side}>
          {isTeacher ? (
            <WebCard style={styles.quickCard}>
              <Text style={styles.blockTitle}>Recaudo</Text>
              <Text style={styles.metricMoney}>{formatMoney(teacherPaymentTotals.confirmed)}</Text>
              <Text style={styles.muted}>Recaudado confirmado</Text>
              <Text style={styles.metricMoneySmall}>{formatMoney(teacherPaymentTotals.pending)}</Text>
              <Text style={styles.muted}>Pagado pendiente de confirmar</Text>
            </WebCard>
          ) : null}
          <WebCard style={styles.quickCard}>
            <Text style={styles.blockTitle}>Accesos rápidos</Text>
            <WebButton label="Agenda" icon="calendar-month" variant="secondary" onPress={() => router.push('/agenda')} />
            <WebButton label="Chats" icon="forum" variant="secondary" onPress={() => router.push('/chats')} />
            <WebButton label="Ver materias" icon="dashboard" variant="secondary" onPress={() => router.push('/')} />
          </WebCard>
        </View>
      </View>

      {isStudent ? (
        <WebCard>
          <Text style={styles.blockTitle}>Materiales de mis clases</Text>
          {studentCards.length === 0 ? (
            <EmptyState icon="folder-open" title="Sin materiales todavía" text="Cuando un docente suba archivos para una reserva confirmada aparecerán aquí." />
          ) : (
            <View style={styles.materialGrid}>
              {studentCards.map(({ reservation, materials, unseen }) => (
                <View key={reservation.id} style={styles.materialCard}>
                  <Text style={styles.cardTitle}>{reservation.subjectName || 'Tutoría'}</Text>
                  <Text style={styles.muted}>Docente: {reservation.teacherDisplayName || reservation.teacherId}</Text>
                  <Text style={styles.muted}>{formatSlot(reservation.slot)}</Text>
                  <View style={styles.badges}>
                    <WebBadge tone={unseen ? 'amber' : 'green'}>{unseen ? `${unseen} nuevo(s)` : 'Al día'}</WebBadge>
                    <WebBadge tone="gray">{materials.length} archivo(s)</WebBadge>
                  </View>
                  <WebButton label="Ver materiales" icon="folder" variant="secondary" onPress={() => openMaterials(reservation)} />
                </View>
              ))}
            </View>
          )}
        </WebCard>
      ) : null}

      <MaterialsModal
        visible={materialsModalVisible}
        reservation={activeReservation}
        userId={user?.uid}
        markMaterialViewed={markMaterialViewed}
        topAlert={topAlert}
        onClose={() => setMaterialsModalVisible(false)}
      />
    </WebShell>
  );
}

function MaterialsModal({ visible, reservation, onClose, userId, markMaterialViewed, topAlert }) {
  const reservationId = reservation?.id || null;
  const { materials, loading } = useMaterialsByReservation(reservationId, { disabled: !visible || !reservationId });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.blockTitle}>Materiales</Text>
              <Text style={styles.muted}>{reservation?.subjectName || 'Tutoría'}</Text>
            </View>
            <WebButton label="Cerrar" icon="close" variant="secondary" onPress={onClose} small />
          </View>
          {loading ? <LoadingState label="Cargando materiales..." /> : null}
          {!loading && materials.length === 0 ? <Text style={styles.muted}>Aún no hay materiales publicados.</Text> : null}
          <View style={styles.materialRows}>
            {materials.map((material) => (
              <MaterialRow key={material.id} material={material} userId={userId} topAlert={topAlert} markMaterialViewed={markMaterialViewed} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MaterialRow({ material, userId, topAlert, markMaterialViewed }) {
  const offline = useOfflineMaterial({ uid: userId, material });
  const open = async () => {
    try {
      await offline.open();
      if (markMaterialViewed) markMaterialViewed(material.id);
    } catch {
      topAlert.show('No se pudo abrir el material.', 'error');
    }
  };
  const download = async () => {
    try {
      await offline.download();
      topAlert.show('Material guardado.', 'success');
    } catch {
      topAlert.show('No se pudo descargar el material.', 'error');
    }
  };
  return (
    <View style={styles.materialRow}>
      <MaterialIcons name="description" size={24} color={webTokens.color.brand} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{material.title || material.fileName || 'Material'}</Text>
        <Text style={styles.muted}>{material.fileName || material.contentType || 'Archivo'}</Text>
      </View>
      <WebButton label="Descargar" icon="download" variant="secondary" onPress={download} small />
      <WebButton label="Abrir" icon="open-in-new" onPress={open} small />
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 },
  profileCard: { gap: 16 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap' },
  avatar: { width: 112, height: 112, borderRadius: 32, backgroundColor: webTokens.color.surfaceAlt },
  avatarFallback: { width: 112, height: 112, borderRadius: 32, backgroundColor: webTokens.color.chip, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: webTokens.color.brand, fontSize: 42, fontWeight: '900' },
  name: { color: webTokens.color.ink, fontSize: 30, fontWeight: '900' },
  email: { color: webTokens.color.muted, marginTop: 4, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  label: { color: webTokens.color.ink, fontWeight: '900', marginTop: 6 },
  textArea: { minHeight: 118, borderRadius: 16, borderWidth: 1, borderColor: webTokens.color.line, padding: 14, color: webTokens.color.ink, outlineStyle: 'none' },
  specialties: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  specialty: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: webTokens.color.line, backgroundColor: webTokens.color.elevated },
  specialtyActive: { backgroundColor: webTokens.color.brand, borderColor: webTokens.color.brand },
  specialtyText: { color: webTokens.color.muted, fontWeight: '900' },
  specialtyTextActive: { color: webTokens.color.onBrand },
  save: { alignSelf: 'flex-end', marginTop: 8 },
  side: { gap: 18 },
  quickCard: { gap: 12 },
  metricMoney: { color: webTokens.color.good, fontSize: 30, fontWeight: '900' },
  metricMoneySmall: { color: webTokens.color.warn, fontSize: 24, fontWeight: '900', marginTop: 6 },
  blockTitle: { color: webTokens.color.ink, fontSize: 22, fontWeight: '900' },
  muted: { color: webTokens.color.muted, lineHeight: 21 },
  materialGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, marginTop: 14 },
  materialCard: { gap: 10, borderRadius: 18, padding: 16, backgroundColor: webTokens.color.surfaceAlt, borderWidth: 1, borderColor: webTokens.color.line },
  cardTitle: { color: webTokens.color.ink, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: webTokens.color.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { maxWidth: 780, width: '100%', alignSelf: 'center', backgroundColor: webTokens.color.elevated, borderRadius: 24, padding: 22, gap: 14, ...webTokens.shadow.lift },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  materialRows: { gap: 10 },
  materialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: webTokens.color.line, borderRadius: 16, padding: 12, flexWrap: 'wrap' },
});
