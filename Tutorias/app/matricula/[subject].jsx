import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../config/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useTopAlert } from '../../components/TopAlert';

export default function MatriculaScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const insets = useSafeAreaInsets();
  const { subject, name } = useLocalSearchParams();
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const { user, ready } = useAuthGuard({ dest: 'Matricula', delayMs: 400 });
  const [role, setRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [maxStudents, setMaxStudents] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const hours = useMemo(() => [6,8,10,12,14,16,18,20], []);
  const days = useMemo(() => ['Lun','Mar','Mié','Jue','Vie','Sáb'], []);
  const [selected, setSelected] = useState({}); // key: `${d}-${h}`

  useEffect(() => {
    (async () => {
      if (!user) { setRole(''); setRoleLoaded(false); return; }
      try {
        const snap = await getDoc(doc(db,'users', user.uid));
        setRole((snap.data()||{}).role || '');
      } catch {
        setRole('');
      } finally {
        setRoleLoaded(true);
      }
    })();
  }, [user]);

  const isTeacher = (role || '').toLowerCase() === 'teacher';
  useEffect(() => {
    if (ready && user && roleLoaded && !isTeacher) {
      topAlert.show('Solo docentes pueden matricular tutorías', 'error');
      router.replace('/');
    }
  }, [ready, user, roleLoaded, isTeacher]);

  const toggle = (d, h) => {
    const k = `${d}-${h}`;
    setSelected((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const pickImage = async () => {
    const opts = { quality: 0.7 };
    try {
      if (ImagePicker?.MediaType?.Images) {
        opts.mediaTypes = [ImagePicker.MediaType.Images];
      } else if (ImagePicker?.MediaTypeOptions?.Images) {
        // backward compatibility
        opts.mediaTypes = ImagePicker.MediaTypeOptions.Images;
      } else {
        opts.mediaTypes = ["images"];
      }
    } catch {}
    const res = await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return;

    const asset = res.assets[0];
    const uri = asset.uri;

    // Determine size when possible
    let size = asset.fileSize || asset.size;
    try {
      if (!size && typeof fetch === 'function') {
        const r = await fetch(uri);
        const b = await r.blob();
        size = b.size;
      }
    } catch {}

    if (size && size > MAX_BYTES) {
      topAlert.show('Imagen demasiado grande (máx 8MB)', 'error');
      return;
    }

    setImages((arr) => (arr.length >= MAX_IMAGES ? [uri] : [...arr, uri]));
  };

  const removeImage = (idx) => setImages((arr) => arr.filter((_, i) => i !== idx));

  const save = async () => {
    try {
      if (!user) return;
      const blocks = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => {
          const [d, h] = k.split('-').map(Number);
          return { day: days[d], hourStart: h, hourEnd: h + 2 };
        });
      // Evitar valores undefined: usa string vacía como fallback
      const usernameSafe = (user.displayName || (user.email ? String(user.email).split('@')[0] : ''));
      const payload = {
        uid: user.uid,
        username: usernameSafe,
        subject: subjectKey,
        subjectName,
        maxStudents: Number(maxStudents) || 0,
        price: Number(price) || 0,
        images: Array.isArray(images) ? images : [],
        schedule: blocks,
        enrolledCount: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      const id = `${user.uid}_${subjectKey}`;
      await setDoc(doc(db, 'offers', id), payload, { merge: true });
      topAlert.show('Oferta guardada', 'success');
      router.back();
    } catch (e) {
      console.error('Offer save failed', e);
      let msg = 'No se pudo guardar la oferta';
      const code = e?.code || '';
      const m = String(e?.message || '');
      if (m.includes('ERR_BLOCKED_BY_CLIENT') || m.toLowerCase().includes('blocked by client')) {
        msg = 'Bloqueado por extensión (AdBlock/Privacy). Permite googleapis.com o desactiva bloqueadores.';
      } else if (!navigator.onLine) {
        msg = 'Sin conexión. Verifica tu red.';
      } else if (code === 'permission-denied' || code === 'unauthenticated') {
        // Fallback: intenta guardar en subcolección del usuario por si las reglas lo requieren
        try {
          const id2 = `${subjectKey}`;
          await setDoc(doc(db, 'users', user.uid, 'offers', id2), payload, { merge: true });
          topAlert.show('Oferta guardada', 'success');
          router.back();
          return;
        } catch (e2) {
          console.error('Fallback save failed', e2);
          msg = 'No autorizado. Revisa reglas de Firestore o inicia sesión nuevamente.';
        }
      } else if (code === 'unavailable') {
        msg = 'Firestore no disponible temporalmente. Intenta más tarde.';
      }
      topAlert.show(msg, 'error');
    }
  };

  if (!ready || !user) return null;
  if (roleLoaded && !isTeacher) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets?.top ?? 0) + 12 }}
    >
      <View style={{ alignSelf: 'stretch', marginBottom: 8 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Matricular: {subjectName}</Text>
      <Text style={styles.label}>Máximo de alumnos</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={maxStudents} onChangeText={setMaxStudents} placeholder="Ej: 10" placeholderTextColor="#9aa3b2" />
      <Text style={styles.label}>Precio (USD)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="Ej: 25" placeholderTextColor="#9aa3b2" />

      <Text style={styles.label}>Imágenes (1-3)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {images.map((uri, idx) => (
          <TouchableOpacity key={uri} onPress={() => removeImage(idx)}>
            <Image source={{ uri }} style={styles.preview} />
          </TouchableOpacity>
        ))}
        {images.length < MAX_IMAGES && (
          <TouchableOpacity style={styles.addImg} onPress={pickImage}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>+ Agregar</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>Horarios (bloques de 2h)</Text>
      <View style={styles.grid}>
        <View style={styles.headerRow}>
          {days.map((d, di) => (
            <Text key={d} style={styles.dayHead}>{d}</Text>
          ))}
        </View>
        {hours.map((h) => (
          <View key={h} style={styles.gridRow}>
            {days.map((d, di) => {
              const k = `${di}-${h}`;
              const sel = !!selected[k];
              return (
                <TouchableOpacity key={k} onPress={() => toggle(di, h)} style={[styles.cell, sel && styles.cellSel]}>
                  <Text style={sel ? styles.cellSelText : styles.cellText}>{h}:00 - {h+2}:00</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>Guardar oferta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  label: { color: '#C7C9D9', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#2C2F48', color: '#fff', borderRadius: 12, padding: 12 },
  addImg: { backgroundColor: '#2C2F48', padding: 12, borderRadius: 10 },
  preview: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#2C2F48' },
  grid: { marginTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHead: { color: '#fff', width: '16%', textAlign: 'center', fontWeight: '700' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cell: { width: '16%', backgroundColor: '#2C2F48', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  cellSel: { backgroundColor: '#ef4444' },
  cellText: { color: '#C7C9D9', fontSize: 10, textAlign: 'center' },
  cellSelText: { color: '#1B1E36', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  saveBtn: { marginTop: 16, backgroundColor: '#FF8E53', padding: 14, borderRadius: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800' },
  backBtn: { alignSelf: 'flex-start', backgroundColor: '#FFD580', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  backText: { color: '#1B1E36', fontWeight: '800' },
});
