import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { OFFERS_COLLECTION } from '../../constants/firestore';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useTopAlert } from '../../components/TopAlert';
import {
  createPaidReservation,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  formatMoney,
  onlyDigits,
  validateCardPayment,
  validatePaypalPayment,
} from '../../features/payments';

const dayLabels = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun', Lun: 'Lun', Mar: 'Mar', Mie: 'Mié', Jue: 'Jue', Vie: 'Vie', Sab: 'Sáb', Dom: 'Dom' };
const hour = (value) => `${String(Number(value || 0)).padStart(2, '0')}:00`;
const formatSlot = (slot) => slot ? `${dayLabels[slot.day] || slot.day} · ${hour(slot.hourStart)} - ${hour(slot.hourEnd)}` : 'Horario por definir';

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Checkout', delayMs: 400 });
  const offerId = decodeURIComponent(params.offerId || '');
  const subjectKey = decodeURIComponent(params.subject || '');
  const subjectNameParam = decodeURIComponent(params.name || subjectKey);
  const slot = useMemo(() => parseSlot(params.slot), [params.slot]);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('card');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [cardForm, setCardForm] = useState({ cardholderName: '', email: user?.email || '', cardNumber: '', expiry: '', cvv: '' });
  const [paypalForm, setPaypalForm] = useState({ email: user?.email || '' });
  const brand = detectCardBrand(cardForm.cardNumber);
  const amount = Number(offer?.price || 0);
  const subjectName = offer?.subjectName || subjectNameParam;

  useEffect(() => {
    setCardForm((prev) => ({ ...prev, email: prev.email || user?.email || '' }));
    setPaypalForm((prev) => ({ ...prev, email: prev.email || user?.email || '' }));
  }, [user?.email]);

  useEffect(() => {
    let active = true;
    async function loadOffer() {
      if (!offerId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, OFFERS_COLLECTION, offerId));
        if (active) setOffer(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOffer();
    return () => {
      active = false;
    };
  }, [offerId]);

  const pay = async () => {
    if (!user?.uid || !offer || !slot) return;
    const validation = method === 'card' ? validateCardPayment(cardForm) : validatePaypalPayment(paypalForm);
    setErrors(validation.errors);
    if (!validation.valid) return;
    setSubmitting(true);
    try {
      await createPaidReservation({ offerId, subjectKey, subjectName, slot, user, payment: validation.sanitized });
      topAlert.show('Pago aprobado. Reserva enviada al docente.', 'success');
      router.replace('/agenda?tab=pending');
    } catch (error) {
      topAlert.show(error?.message || 'No se pudo completar el pago.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return (
      <View style={[styles.center, { paddingTop: (insets.top || 0) + 30 }]}>
        <ActivityIndicator color="#FFD580" />
        <Text style={styles.muted}>Preparando pasarela...</Text>
      </View>
    );
  }

  if (!user || !offer || !slot) {
    return (
      <View style={[styles.center, { paddingTop: (insets.top || 0) + 30 }]}>
        <Text style={styles.title}>No pudimos abrir el checkout</Text>
        <Text style={styles.muted}>Vuelve a seleccionar un horario para reservar.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 32, paddingTop: (insets.top || 0) + 12 }}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>
      <Text style={styles.kicker}>Pasarela simulada</Text>
      <Text style={styles.title}>Checkout</Text>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{subjectName}</Text>
        <Text style={styles.muted}>Docente: {offer.username || offer.teacherDisplayName || 'Docente'}</Text>
        <Text style={styles.slot}>{formatSlot(slot)}</Text>
        <Text style={styles.total}>{formatMoney(amount)}</Text>
      </View>

      <View style={styles.tabs}>
        <MethodTab active={method === 'card'} label="Tarjeta" icon="credit-card" onPress={() => setMethod('card')} />
        <MethodTab active={method === 'paypal'} label="PayPal" icon="account-balance-wallet" onPress={() => setMethod('paypal')} />
      </View>

      {method === 'card' ? (
        <View style={styles.card}>
          <Field label="Nombre en la tarjeta" value={cardForm.cardholderName} error={errors.cardholderName} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cardholderName: value }))} />
          <Field label="Correo de recibo" value={cardForm.email} error={errors.email} onChangeText={(value) => setCardForm((prev) => ({ ...prev, email: value }))} />
          <Field label={`Numero de tarjeta · ${brand.label}`} value={formatCardNumber(cardForm.cardNumber)} error={errors.cardNumber} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cardNumber: onlyDigits(value) }))} keyboardType="numeric" />
          <View style={styles.row}>
            <Field label="Vence" value={cardForm.expiry} error={errors.expiry} onChangeText={(value) => setCardForm((prev) => ({ ...prev, expiry: formatExpiry(value) }))} keyboardType="numeric" style={{ flex: 1 }} />
            <Field label="CVV" value={cardForm.cvv} error={errors.cvv} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cvv: onlyDigits(value).slice(0, brand.key === 'amex' ? 4 : 3) }))} keyboardType="numeric" secureTextEntry style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.paypalBox}>
            <MaterialIcons name="account-balance-wallet" size={30} color="#FFD580" />
            <Text style={styles.cardTitle}>PayPal Checkout</Text>
            <Text style={styles.muted}>Aprobacion simulada con correo valido.</Text>
          </View>
          <Field label="Correo PayPal" value={paypalForm.email} error={errors.email} onChangeText={(email) => setPaypalForm({ email })} />
        </View>
      )}

      <TouchableOpacity style={[styles.payBtn, submitting && styles.disabled]} onPress={pay} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#1B1E36" /> : <Text style={styles.payText}>Pagar {formatMoney(amount)}</Text>}
      </TouchableOpacity>
      <Text style={styles.disclaimer}>No se realizara ningun cobro real. Solo se guardara el estado de pago simulado.</Text>
    </ScrollView>
  );
}

function parseSlot(value) {
  try {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw ? JSON.parse(decodeURIComponent(raw)) : null;
  } catch {
    return null;
  }
}

function MethodTab({ active, icon, label, onPress }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <MaterialIcons name={icon} size={18} color={active ? '#1B1E36' : '#FFD580'} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, error, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8F94AF" style={[styles.input, error && styles.inputError]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B1E36' },
  center: { flex: 1, backgroundColor: '#1B1E36', alignItems: 'center', justifyContent: 'center', padding: 20 },
  backBtn: { alignSelf: 'flex-start', backgroundColor: '#FFD580', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 14 },
  backText: { color: '#1B1E36', fontWeight: '900' },
  kicker: { color: '#FFD580', textTransform: 'uppercase', fontSize: 12, fontWeight: '900' },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  muted: { color: '#C7C9D9', lineHeight: 20 },
  summary: { backgroundColor: '#2C2F48', borderRadius: 18, padding: 16, marginTop: 16, gap: 7 },
  summaryTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  slot: { color: '#FFD580', fontWeight: '800' },
  total: { color: '#FF8E53', fontSize: 24, fontWeight: '900', marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16, backgroundColor: '#2C2F48', borderRadius: 16, padding: 6 },
  tab: { flex: 1, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  tabActive: { backgroundColor: '#FFD580' },
  tabText: { color: '#FFD580', fontWeight: '900' },
  tabTextActive: { color: '#1B1E36' },
  card: { backgroundColor: '#2C2F48', borderRadius: 18, padding: 16, marginTop: 14, gap: 12 },
  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 18 },
  field: { gap: 6 },
  label: { color: '#fff', fontWeight: '800' },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#4B516D', color: '#fff', paddingHorizontal: 12, backgroundColor: '#20243C' },
  inputError: { borderColor: '#F87171' },
  error: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  paypalBox: { gap: 7, marginBottom: 2 },
  payBtn: { marginTop: 18, minHeight: 52, borderRadius: 16, backgroundColor: '#FFD580', alignItems: 'center', justifyContent: 'center' },
  payText: { color: '#1B1E36', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  disclaimer: { color: '#8F94AF', fontSize: 12, lineHeight: 18, marginTop: 10 },
});
