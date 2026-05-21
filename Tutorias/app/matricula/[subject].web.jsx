import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import {
  LoadingState,
  WebBadge,
  WebButton,
  WebCard,
  WebInput,
  WebShell,
  decodeParam,
  getProfileRole,
  roleIsTeacher,
  webTokens,
} from '../../components/web/WebUI';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useConnectivity } from '../../tools/offline';

const hours = [6, 8, 10, 12, 14, 16, 18, 20];
const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function MatriculaWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const connectivity = useConnectivity();
  const subjectKey = decodeParam(params.subject);
  const subjectName = decodeParam(params.name) || subjectKey;
  const { user, ready } = useAuthGuard({ dest: 'Matrícula', delayMs: 400 });
  const [role, setRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [maxStudents, setMaxStudents] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadRole() {
      if (!user?.uid) {
        setRoleLoaded(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (alive) setRole(getProfileRole(snap.data()));
      } finally {
        if (alive) setRoleLoaded(true);
      }
    }
    loadRole();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const isTeacher = roleIsTeacher(role);

  useEffect(() => {
    let alive = true;
    async function checkDuplicate() {
      if (!ready || !user?.uid || !isTeacher || !subjectKey) return;
      const id = `${user.uid}_${subjectKey}`;
      const snap1 = await getDoc(doc(db, 'offers', id));
      const snap2 = await getDoc(doc(db, 'users', user.uid, 'offers', subjectKey));
      if (alive && (snap1.exists() || snap2.exists())) {
        setHasExisting(true);
        topAlert.show('Ya tienes una tutoría creada para esta materia.', 'info');
      }
    }
    checkDuplicate().catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, user?.uid, isTeacher, subjectKey, topAlert]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  const toggle = (dayIndex, hour) => {
    const key = `${dayIndex}-${hour}`;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
      quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImages([result.assets[0].uri]);
    }
  };

  const buildSchedule = () => {
    const byDay = {};
    Object.entries(selected).forEach(([key, value]) => {
      if (!value) return;
      const [dayIndex, hour] = key.split('-').map(Number);
      if (!byDay[dayIndex]) byDay[dayIndex] = [];
      byDay[dayIndex].push(hour);
    });
    const blocks = [];
    Object.entries(byDay).forEach(([dayIndex, dayHours]) => {
      dayHours.sort((a, b) => a - b).forEach((hour) => {
        blocks.push({ day: days[Number(dayIndex)], hourStart: hour, hourEnd: hour + 2 });
      });
    });
    return blocks;
  };

  const save = async () => {
    if (!user?.uid || hasExisting) return;
    if (!isTeacher) {
      topAlert.show('Solo docentes pueden publicar tutorías.', 'error');
      return;
    }
    const schedule = buildSchedule();
    if (schedule.length === 0) {
      topAlert.show('Selecciona al menos un horario.', 'info');
      return;
    }
    setSaving(true);
    try {
      const id = `${user.uid}_${subjectKey}`;
      const mainRef = doc(db, 'offers', id);
      const snap = await getDoc(mainRef);
      if (snap.exists()) {
        topAlert.show('Ya tienes una tutoría creada para esta materia.', 'error');
        setHasExisting(true);
        return;
      }
      await setDoc(mainRef, {
        uid: user.uid,
        username: user.displayName || (user.email || 'Docente').split('@')[0],
        subject: subjectKey,
        subjectName,
        maxStudents: parseInt(maxStudents || '0', 10) || 0,
        price: parseFloat(price || '0') || 0,
        images,
        schedule,
        enrolledCount: 0,
        pendingCount: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      topAlert.show('Oferta guardada.', 'success');
      router.back();
    } catch {
      topAlert.show('No se pudo guardar la oferta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !roleLoaded) {
    return <WebShell title="Publicar tutoría" active="/"><LoadingState label="Validando docente..." /></WebShell>;
  }

  return (
    <WebShell
      title={`Publicar ${subjectName}`}
      subtitle="Define cupos, precio, imagen y disponibilidad para que estudiantes puedan solicitar una reserva."
      active="/"
      actions={<WebButton label="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} />}
    >
      {!isTeacher ? <WebBadge tone="red" icon="lock">Solo docentes pueden publicar tutorías</WebBadge> : null}
      {hasExisting ? <WebBadge tone="amber" icon="info">Ya existe una tutoría tuya para esta materia</WebBadge> : null}
      {connectivity.isOffline ? <WebBadge tone="amber" icon="cloud-off">Conéctate para guardar la publicación</WebBadge> : null}
      <View style={styles.layout}>
        <WebCard style={styles.formCard}>
          <Text style={styles.blockTitle}>Detalles de la oferta</Text>
          <View style={styles.twoCols}>
            <WebInput label="Máximo de alumnos" value={maxStudents} onChangeText={(text) => setMaxStudents(text.replace(/[^0-9]/g, ''))} placeholder="0 = sin límite" keyboardType="numeric" />
            <WebInput label="Precio (USD)" value={price} onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))} placeholder="Ej: 25" keyboardType="numeric" />
          </View>
          <Text style={styles.label}>Imagen de la tutoría</Text>
          <View style={styles.imageRow}>
            {images[0] ? <Image source={{ uri: images[0] }} style={styles.preview} /> : <View style={[styles.preview, styles.placeholder]}><MaterialIcons name="image" size={34} color={webTokens.color.brand} /></View>}
            <WebButton label={images[0] ? 'Reemplazar imagen' : 'Agregar imagen'} icon="add-photo-alternate" variant="secondary" onPress={pickImage} />
          </View>
        </WebCard>

        <WebCard style={styles.summaryCard}>
          <Text style={styles.blockTitle}>Resumen</Text>
          <Metric label="Horarios" value={selectedCount} />
          <Metric label="Cupos" value={maxStudents || 'Sin límite'} />
          <Metric label="Precio" value={price ? `$${price}` : '$0'} />
        </WebCard>
      </View>

      <WebCard>
        <Text style={styles.blockTitle}>Horarios disponibles</Text>
        <Text style={styles.muted}>Cada bloque representa dos horas. Puedes seleccionar varios días y franjas.</Text>
        <View style={styles.schedule}>
          <View style={styles.dayHeader}>
            {days.map((day) => <Text key={day} style={styles.dayText}>{day}</Text>)}
          </View>
          {hours.map((hour) => (
            <View key={hour} style={styles.hourRow}>
              {days.map((day, dayIndex) => {
                const key = `${dayIndex}-${hour}`;
                const active = !!selected[key];
                return (
                  <Pressable key={key} style={[styles.slot, active && styles.slotActive]} onPress={() => toggle(dayIndex, hour)}>
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>{hour}:00 - {hour + 2}:00</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <WebButton label="Guardar oferta" icon="save" onPress={save} loading={saving} disabled={!isTeacher || hasExisting || connectivity.isOffline} style={styles.save} />
      </WebCard>
    </WebShell>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 },
  formCard: { gap: 14 },
  summaryCard: { alignSelf: 'start', gap: 12 },
  blockTitle: { color: webTokens.color.ink, fontSize: 22, fontWeight: '900' },
  twoCols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  label: { color: webTokens.color.ink, fontWeight: '900', marginTop: 14 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  preview: { width: 130, height: 92, borderRadius: 16, backgroundColor: webTokens.color.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  metric: { backgroundColor: webTokens.color.surfaceAlt, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: webTokens.color.line },
  metricValue: { color: webTokens.color.ink, fontSize: 24, fontWeight: '900' },
  metricLabel: { color: webTokens.color.muted, fontWeight: '800', marginTop: 3 },
  muted: { color: webTokens.color.muted, marginTop: 6 },
  schedule: { gap: 8, marginTop: 18 },
  dayHeader: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(112px, 1fr))', gap: 8 },
  dayText: { color: webTokens.color.ink, fontWeight: '900', textAlign: 'center' },
  hourRow: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(112px, 1fr))', gap: 8 },
  slot: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: webTokens.color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: webTokens.color.elevated, padding: 8 },
  slotActive: { backgroundColor: webTokens.color.brand, borderColor: webTokens.color.brand, ...webTokens.shadow.lift },
  slotText: { color: webTokens.color.muted, fontWeight: '800', textAlign: 'center' },
  slotTextActive: { color: webTokens.color.onBrand },
  save: { marginTop: 20, alignSelf: 'flex-end' },
});
