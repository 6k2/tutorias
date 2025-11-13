// Matricula screen: teachers create their class offer (seats, price, image, schedule), xd
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useTopAlert } from '../../components/TopAlert';
import { useConnectivity } from '../../tools/offline';

const offlinePlaceholder = require('../../assets/offline/subject-placeholder.png');
const draftKeyFor = (uid, subject) => `offline:matricula:${uid}:${subject}`;

export default function MatriculaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topAlert = useTopAlert();
  const connectivity = useConnectivity();
  const { subject, name } = useLocalSearchParams();
  const subjectKey = decodeURIComponent(subject || '');
  const subjectName = decodeURIComponent(name || subjectKey);
  const { user, ready } = useAuthGuard({ dest: 'Matricula', delayMs: 400 });

  const [role, setRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const [maxStudents, setMaxStudents] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [pendingCountDraft, setPendingCountDraft] = useState(0);
  const [selected, setSelected] = useState({}); // key: `${d}-${h}`
  const MAX_IMAGES = 1;
  const MAX_BYTES = 8 * 1024 * 1024; // 8MB

  const hours = useMemo(() => [6, 8, 10, 12, 14, 16, 18, 20], []);
  const days = useMemo(() => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], []);

  const draftKey = user?.uid ? draftKeyFor(user.uid, subjectKey) : null;

  // Load role
  useEffect(() => {
    (async () => {
      if (!user) {
        setRole('');
        setRoleLoaded(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setRole((snap.data() || {}).role || '');
      } catch {
        setRole('');
      } finally {
        setRoleLoaded(true);
      }
    })();
  }, [user]);

  const isTeacher = (role || '').toLowerCase() === 'teacher';

  // Restore local draft so docentes keep their disponibilidad when offline
  useEffect(() => {
    if (!draftKey) return;
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (!raw || !alive) return;
        const draft = JSON.parse(raw);
        if (typeof draft.maxStudents === 'string') setMaxStudents(draft.maxStudents);
        if (typeof draft.price === 'string') setPrice(draft.price);
        if (Array.isArray(draft.images)) setImages(draft.images);
        if (draft.selected && typeof draft.selected === 'object') setSelected(draft.selected);
        if (typeof draft.pendingCount === 'number') setPendingCountDraft(draft.pendingCount);
      } catch (error) {
        console.warn('matricula: failed to load draft', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draftKey]);

  // Persist draft on every change (solo pequeños objetos, así queda listo para reanudar sin internet)
  useEffect(() => {
    if (!draftKey) return;
    const payload = {
      maxStudents,
      price,
      images,
      selected,
      pendingCount: pendingCountDraft,
    };
    AsyncStorage.setItem(draftKey, JSON.stringify(payload)).catch((error) => {
      console.warn('matricula: failed to persist draft', error);
    });
  }, [draftKey, maxStudents, price, images, selected, pendingCountDraft]);

  // Early duplicate-offer check
  useEffect(() => {
    (async () => {
      if (!ready || !user || !isTeacher || !subjectKey) return;
      try {
        const id = `${user.uid}_${subjectKey}`;
        const snap1 = await getDoc(doc(db, 'offers', id));
        const snap2 = await getDoc(doc(db, 'users', user.uid, 'offers', subjectKey));
        if (snap1.exists() || snap2.exists()) {
          setHasExisting(true);
          topAlert.show('Ya tienes una tutoría creada para esta materia', 'info');
          setTimeout(() => router.back(), 900);
        }
      } catch (error) {
        console.warn('matricula: duplicate check failed', error);
      }
    })();
  }, [ready, user, isTeacher, subjectKey, topAlert, router]);

  // Kick non-teachers
  useEffect(() => {
    if (ready && user && roleLoaded && !isTeacher) {
      topAlert.show('Solo docentes pueden matricular tutorías', 'error');
      router.replace('/');
    }
  }, [ready, user, roleLoaded, isTeacher, topAlert, router]);

  const toggle = (d, h) => {
    const k = `${d}-${h}`;
    setSelected((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  // Pick one image (we keep it lightweight and capped at 8MB)
  const pickImage = async () => {
    const opts = { quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images' };
    const res = await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    let size = asset.fileSize || asset.size;
    try {
      if (!size && typeof fetch === 'function') {
        const r = await fetch(asset.uri);
        const b = await r.blob();
        size = b.size;
      }
    } catch {}
    if (size && size > MAX_BYTES) {
      topAlert.show('Imagen demasiado grande (máx 8MB)', 'error');
      return;
    }
    setImages((arr) => (arr.length >= MAX_IMAGES ? [asset.uri] : [...arr, asset.uri]));
  };

  const removeImage = (idx) => setImages((arr) => arr.filter((_, i) => i !== idx));

  // Validate and save the offer. We compress continuous hours into clean blocks.
  const save = async () => {
    let payload;
    try {
      if (!user) return;
      // Build schedule blocks; if an entire day is selected, compress into a single wide block
      const chosen = Object.entries(selected).filter(([, v]) => v);
      const byDay = {};
      for (const [k] of chosen) {
        const [d, h] = k.split('-').map(Number);
        if (!byDay[d]) byDay[d] = new Set();
        byDay[d].add(h);
      }
      const blocks = [];
      Object.keys(byDay).forEach((dKey) => {
        const d = Number(dKey);
        const hs = Array.from(byDay[d]).sort((a, b) => a - b);
        if (hs.length === hours.length) {
          blocks.push({ day: days[d], hourStart: hs[0], hourEnd: hs[hs.length - 1] + 2 });
        } else {
          hs.forEach((h) => blocks.push({ day: days[d], hourStart: h, hourEnd: h + 2 }));
        }
      });

      const maxVal = parseInt(maxStudents || '0', 10) || 0;
      const priceVal = parseFloat(price || '0') || 0;
      const usernameSafe = (() => {
        if (!user) return 'Docente';
        const nameMaybe = user.displayName || '';
        if (nameMaybe.trim()) return nameMaybe.trim();
        return (user.email || 'Docente').split('@')[0];
      })();

      payload = {
        uid: user.uid,
        username: usernameSafe,
        subject: subjectKey,
        subjectName,
        maxStudents: maxVal,
        price: priceVal,
        images: Array.isArray(images) ? images : [],
        schedule: blocks,
        enrolledCount: 0,
        pendingCount: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Prevent duplicate offers for the same subject and teacher
      const id = `${user.uid}_${subjectKey}`;
      const mainRef = doc(db, 'offers', id);
      const snap = await getDoc(mainRef);
      if (snap.exists()) {
        topAlert.show('Ya tienes una tutoría creada para esta materia', 'error');
        return;
      }
      await setDoc(mainRef, payload, { merge: false });
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      topAlert.show('Oferta guardada', 'success');
      router.back();
    } catch (e) {
      try {
        if (e && e.message) topAlert.show(`Error: ${e.message}`, 'error');
      } catch {}
      // fallback if rules solo permiten subcolección del usuario
      try {
        const id2 = `${subjectKey}`;
        await setDoc(doc(db, 'users', user.uid, 'offers', id2), payload, { merge: false });
        if (draftKey) await AsyncStorage.removeItem(draftKey);
        topAlert.show('Oferta guardada', 'success');
        router.back();
      } catch (_errorPersist) {
        topAlert.show('No se pudo guardar la oferta', 'error');
      }
    }
  };

  if (!ready || !user || hasExisting || (roleLoaded && !isTeacher)) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#1B1E36' }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets?.top ?? 0) + 16 }}
    >
      <View style={{ alignSelf: 'stretch', marginBottom: 8, zIndex: 10 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Matricular: {subjectName}</Text>

      {connectivity.isOffline && (
        <Text style={styles.offlineHint}>
          Sin conexión: guardamos un borrador local (incluye horarios y pendientes) para reanudar luego.
        </Text>
      )}

      <Text style={styles.label}>Máximo de alumnos</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={maxStudents}
        onChangeText={(t) => setMaxStudents(t.replace(/[^0-9]/g, ''))}
        placeholder="Ej: 10"
        placeholderTextColor="#9aa3b2"
      />

      <Text style={styles.label}>Precio (USD)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={price}
        onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
        placeholder="Ej: 25"
        placeholderTextColor="#9aa3b2"
      />

      <Text style={styles.label}>Imagen (1)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {images.map((uri, idx) => (
          <TouchableOpacity key={`${uri}-${idx}`} onPress={() => removeImage(idx)}>
            <Image
              source={connectivity.isOffline ? offlinePlaceholder : { uri }}
              style={styles.preview}
            />
          </TouchableOpacity>
        ))}
        {images.length === 0 && connectivity.isOffline && (
          <Image source={offlinePlaceholder} style={styles.preview} />
        )}
        <TouchableOpacity style={styles.addImg} onPress={pickImage}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>
            {images.length === 0 ? '+ Agregar' : 'Reemplazar'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Horarios (bloques de 2h)</Text>
      <View style={styles.grid}>
        <View style={styles.headerRow}>
          {days.map((d) => (
            <Text key={d} style={styles.dayHead}>
              {d}
            </Text>
          ))}
        </View>
        {hours.map((h) => (
          <View key={h} style={styles.gridRow}>
            {days.map((d, di) => {
              const k = `${di}-${h}`;
              const sel = !!selected[k];
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => toggle(di, h)}
                  style={[styles.cell, sel && styles.cellSel]}
                >
                  <Text style={sel ? styles.cellSelText : styles.cellText}>
                    {h}:00 - {h + 2}:00
                  </Text>
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
  addImg: { backgroundColor: '#2C2F48', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
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
  offlineHint: { color: '#fcd34d', marginBottom: 12 },
});

