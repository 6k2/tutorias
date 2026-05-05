import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useTopAlert } from '../../components/TopAlert';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../../constants/firestore';
import { digitsOnly, formatCardNumber, formatExpiry, validatePaymentForm } from '../../utils/paymentValidation';

const dayLabels = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun', Lun: 'Lun', Mar: 'Mar', Mie: 'Mié', Jue: 'Jue', Vie: 'Vie', Sab: 'Sáb', Dom: 'Dom' };
const hoursToLabel = (value) => `${Number(value || 0).toString().padStart(2, '0')}:00`;
const formatSlot = (slot) => !slot ? 'Horario por definir' : `${dayLabels[slot.day] || slot.day} · ${hoursToLabel(slot.hourStart)} - ${hoursToLabel(slot.hourEnd)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function MockPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Pago mock', delayMs: 200 });
  const offerId = decodeURIComponent(params.offerId || '');
  const subjectKey = decodeURIComponent(params.subject || '');
  const subjectName = decodeURIComponent(params.name || subjectKey || 'Tutoría');

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ cardholder: '', cardNumber: '', expiry: '', cvv: '', postcode: '' });

  const selectedSlot = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(params.slot || ''));
    } catch {
      return null;
    }
  }, [params.slot]);

  useEffect(() => {
    let active = true;
    async function loadOffer() {
      try {
        const snap = await getDoc(doc(db, OFFERS_COLLECTION, offerId));
        if (active) setOffer(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (error) {
        console.error('payment: load offer failed', error);
        topAlert.show('No se pudo cargar el resumen de pago', 'error');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (offerId) loadOffer();
    return () => { active = false; };
  }, [offerId, topAlert]);

  const priceValue = Number(offer?.price || 0);
  const priceLabel = priceValue > 0 ? `$${priceValue.toFixed(2)}` : 'Gratis';
  const teacherName = offer?.username || offer?.teacherDisplayName || 'Docente';

  const updateField = (field, value) => {
    const formatters = {
      cardNumber: formatCardNumber,
      expiry: formatExpiry,
      cvv: (next) => digitsOnly(next).slice(0, 4),
      postcode: (next) => digitsOnly(next).slice(0, 10),
      cardholder: (next) => next,
    };
    const nextForm = { ...form, [field]: formatters[field](value) };
    setForm(nextForm);
    setErrors(validatePaymentForm(nextForm));
  };

  const handlePay = async () => {
    const nextErrors = validatePaymentForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!user || !offer) {
      topAlert.show('Tu sesión u oferta ya no está disponible.', 'error');
      return;
    }

    setProcessing(true);
    try {
      await sleep(900);
      const offerSnapshot = await runTransaction(db, async (transaction) => {
        const offerRef = doc(db, OFFERS_COLLECTION, offerId);
        const snap = await transaction.get(offerRef);
        if (!snap.exists()) throw new Error('Oferta no disponible');
        const data = snap.data() || {};
        if (data.uid === user.uid) throw new Error('No puedes reservar tu propia tutoría');
        const max = Number(data.maxStudents || 0);
        const enrolled = Number(data.enrolledCount || 0);
        const pending = Number(data.pendingCount || 0);
        if (max !== 0 && enrolled + pending >= max) throw new Error('No hay cupos disponibles');
        transaction.update(offerRef, { pendingCount: pending + 1, updatedAt: serverTimestamp() });
        return data;
      });

      const cardDigits = digitsOnly(form.cardNumber);
      await addDoc(collection(db, RESERVATIONS_COLLECTION), {
        offerId,
        subjectKey,
        subjectName: offerSnapshot.subjectName || subjectName,
        teacherId: offerSnapshot.uid,
        studentId: user.uid,
        status: RESERVATION_STATUS.PENDING,
        paymentStatus: 'paid_mock',
        paymentProvider: 'mock',
        mockPayment: {
          last4: cardDigits.slice(-4),
          amount: priceValue,
          currency: 'USD',
          paidAt: Date.now(),
        },
        slot: selectedSlot,
        price: offerSnapshot.price || null,
        studentDisplayName: user.displayName || user.email || '',
        teacherDisplayName: offerSnapshot.username || offerSnapshot.teacherDisplayName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      topAlert.show('Pago mock aprobado. Tu solicitud fue enviada.', 'success');
      await sleep(700);
      router.replace({ pathname: '/agenda', params: { tab: 'pending', paid: '1' } });
    } catch (error) {
      console.error('payment: submit failed', error);
      topAlert.show(error?.message || 'No se pudo completar el pago mock', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (!ready || loading) {
    return <View style={[styles.center, { paddingTop: insets.top + 24 }]}><ActivityIndicator color="#FF8E53" /><Text style={styles.muted}>Preparando pago seguro...</Text></View>;
  }

  if (!offer) {
    return <View style={[styles.center, { paddingTop: insets.top + 24 }]}><Text style={styles.title}>Oferta no encontrada</Text><TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryText}>Volver</Text></TouchableOpacity></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 80, paddingHorizontal: 24, paddingLeft: isDesktop ? 284 : 24, maxWidth: isDesktop ? 1420 : undefined, alignSelf: 'center', width: '100%' }}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backText}>Volver</Text></TouchableOpacity>
      <View style={styles.hero}>
        <View style={styles.secureBadge}><MaterialIcons name="lock" size={16} color="#064E3B" /><Text style={styles.secureText}>Pago mock protegido · no guardamos tu tarjeta</Text></View>
        <Text style={styles.title}>Completa tu reserva</Text>
        <Text style={styles.subtitle}>Simula el pago y envía tu solicitud al docente en un solo flujo.</Text>
      </View>

      <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
        <View style={styles.formCard}>
          {success && <View style={styles.successBox}><MaterialIcons name="check-circle" size={22} color="#16A34A" /><Text style={styles.successText}>Pago aprobado. Redirigiendo...</Text></View>}
          <PaymentInput label="Nombre del titular" value={form.cardholder} onChangeText={(value) => updateField('cardholder', value)} error={errors.cardholder} placeholder="María Pérez" autoCapitalize="words" />
          <PaymentInput label="Número de tarjeta" value={form.cardNumber} onChangeText={(value) => updateField('cardNumber', value)} error={errors.cardNumber} placeholder="4242 4242 4242 4242" keyboardType="number-pad" icon="credit-card" />
          <View style={styles.row}>
            <PaymentInput style={styles.rowInput} label="Expira" value={form.expiry} onChangeText={(value) => updateField('expiry', value)} error={errors.expiry} placeholder="MM/YY" keyboardType="number-pad" />
            <PaymentInput style={styles.rowInput} label="CVV" value={form.cvv} onChangeText={(value) => updateField('cvv', value)} error={errors.cvv} placeholder="123" keyboardType="number-pad" secureTextEntry />
          </View>
          <PaymentInput label="Código postal" value={form.postcode} onChangeText={(value) => updateField('postcode', value)} error={errors.postcode} placeholder="11001" keyboardType="number-pad" />
          <TouchableOpacity style={[styles.payButton, processing && styles.disabled]} onPress={handlePay} disabled={processing}>
            {processing ? <ActivityIndicator color="#1B1E36" /> : <Text style={styles.payText}>Pagar {priceLabel}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryKicker}>Resumen</Text>
          <Text style={styles.summaryTitle}>{subjectName}</Text>
          <SummaryLine label="Docente" value={teacherName} />
          <SummaryLine label="Horario" value={formatSlot(selectedSlot)} />
          <SummaryLine label="Precio" value={priceLabel} strong />
          <View style={styles.note}><MaterialIcons name="info" size={18} color="#F59E0B" /><Text style={styles.noteText}>El pago es simulado. Solo se guardan el estado del pago y los últimos 4 dígitos.</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

function PaymentInput({ label, error, icon, style, ...props }) {
  return <View style={[styles.inputGroup, style]}><Text style={styles.label}>{label}</Text><View style={[styles.inputShell, error && styles.inputError]}>{icon && <MaterialIcons name={icon} size={18} color="#94A3B8" />}<TextInput style={styles.input} placeholderTextColor="#94A3B8" {...props} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

function SummaryLine({ label, value, strong }) {
  return <View style={styles.summaryLine}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 20 },
  muted: { color: '#CBD5E1', marginTop: 12 },
  backBtn: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, marginBottom: 14 },
  backText: { color: '#1E293B', fontWeight: '800' },
  hero: { backgroundColor: '#111827', borderRadius: 28, padding: 22, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  secureBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginBottom: 12 },
  secureText: { color: '#064E3B', fontSize: 12, fontWeight: '800' },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#CBD5E1', marginTop: 8, lineHeight: 21 },
  grid: { gap: 16 },
  gridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  formCard: { flex: 1.1, backgroundColor: '#F8FAFC', borderRadius: 24, padding: 18, gap: 12 },
  summaryCard: { flex: 0.8, backgroundColor: '#1E293B', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#334155' },
  inputGroup: { gap: 7, marginBottom: 4 },
  label: { color: '#334155', fontWeight: '800' },
  inputShell: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  input: { flex: 1, color: '#0F172A', fontWeight: '700' },
  error: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  rowInput: { flex: 1 },
  payButton: { marginTop: 8, backgroundColor: '#FBBF24', borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  payText: { color: '#1B1E36', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.65 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 14, padding: 12 },
  successText: { color: '#166534', fontWeight: '800' },
  summaryKicker: { color: '#FBBF24', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  summaryTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 8, marginBottom: 14 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  summaryLabel: { color: '#CBD5E1' },
  summaryValue: { color: '#F8FAFC', fontWeight: '800', flex: 1, textAlign: 'right' },
  summaryStrong: { color: '#FBBF24', fontSize: 18 },
  note: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#451A03', padding: 12, borderRadius: 14 },
  noteText: { color: '#FEF3C7', flex: 1, lineHeight: 18 },
  secondaryButton: { marginTop: 14, backgroundColor: '#FBBF24', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: '#1B1E36', fontWeight: '900' },
});
