import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../config/firebase';
import { EmptyState, LoadingState, WebBadge, WebButton, WebCard, WebShell, decodeParam, formatSlot, webTokens } from '../../components/web/WebUI';
import { useTopAlert } from '../../components/TopAlert';
import { OFFERS_COLLECTION } from '../../constants/firestore';
import { useAuthGuard } from '../../hooks/useAuthGuard';
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

export default function CheckoutWebScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const topAlert = useTopAlert();
  const { user, ready } = useAuthGuard({ dest: 'Checkout', delayMs: 400 });
  const offerId = decodeParam(params.offerId);
  const subjectKey = decodeParam(params.subject);
  const subjectNameParam = decodeParam(params.name);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('card');
  const [submitting, setSubmitting] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardholderName: '',
    email: user?.email || '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });
  const [paypalForm, setPaypalForm] = useState({ email: user?.email || '' });
  const [errors, setErrors] = useState({});

  const slot = useMemo(() => parseSlot(params.slot), [params.slot]);
  const subjectName = offer?.subjectName || subjectNameParam || subjectKey;
  const brand = detectCardBrand(cardForm.cardNumber);
  const amount = Number(offer?.price || 0);

  useEffect(() => {
    setCardForm((prev) => ({ ...prev, email: prev.email || user?.email || '' }));
    setPaypalForm((prev) => ({ ...prev, email: prev.email || user?.email || '' }));
  }, [user?.email]);

  useEffect(() => {
    let alive = true;
    async function loadOffer() {
      if (!offerId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, OFFERS_COLLECTION, offerId));
        if (alive) setOffer(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadOffer();
    return () => {
      alive = false;
    };
  }, [offerId]);

  const pay = async () => {
    if (!user?.uid || !offer || !slot) return;
    const validation = method === 'card'
      ? validateCardPayment(cardForm)
      : validatePaypalPayment(paypalForm);
    setErrors(validation.errors);
    if (!validation.valid) return;

    setSubmitting(true);
    try {
      await createPaidReservation({
        offerId,
        subjectKey,
        subjectName,
        slot,
        user,
        payment: validation.sanitized,
      });
      topAlert.show('Pago aprobado. Reserva enviada al docente.', 'success');
      router.replace('/agenda?tab=pending');
    } catch (error) {
      topAlert.show(error?.message || 'No se pudo completar el pago.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return <WebShell title="Checkout" active="/"><LoadingState label="Preparando pasarela..." /></WebShell>;
  }

  if (!user || !offer || !slot) {
    return (
      <WebShell title="Checkout" active="/" actions={<WebButton label="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} />}>
        <EmptyState icon="payments" title="No pudimos abrir el checkout" text="Vuelve a seleccionar un horario para reservar." />
      </WebShell>
    );
  }

  return (
    <WebShell
      title="Checkout"
      subtitle="Pasarela segura de simulacion para confirmar tu solicitud."
      active="/"
      actions={<WebButton label="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} />}
    >
      <View style={styles.layout}>
        <WebCard style={styles.formCard}>
          <View style={styles.methodTabs}>
            <PaymentTab active={method === 'card'} icon="credit-card" label="Tarjeta" onPress={() => setMethod('card')} />
            <PaymentTab active={method === 'paypal'} icon="account-balance-wallet" label="PayPal" onPress={() => setMethod('paypal')} />
          </View>

          {method === 'card' ? (
            <View style={styles.form}>
              <Field label="Nombre en la tarjeta" value={cardForm.cardholderName} error={errors.cardholderName} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cardholderName: value }))} placeholder="Nombre Apellido" />
              <Field label="Correo de recibo" value={cardForm.email} error={errors.email} onChangeText={(value) => setCardForm((prev) => ({ ...prev, email: value }))} placeholder="correo@email.com" />
              <View style={styles.cardInputWrap}>
                <Field label="Numero de tarjeta" value={formatCardNumber(cardForm.cardNumber)} error={errors.cardNumber} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cardNumber: onlyDigits(value) }))} placeholder="4242 4242 4242 4242" />
                <View style={styles.brandBadge}>
                  <MaterialIcons name={brand.icon} size={18} color={webTokens.color.brand} />
                  <Text style={styles.brandText}>{brand.label}</Text>
                </View>
              </View>
              <View style={styles.twoCols}>
                <Field label="Vence" value={cardForm.expiry} error={errors.expiry} onChangeText={(value) => setCardForm((prev) => ({ ...prev, expiry: formatExpiry(value) }))} placeholder="MM/AA" />
                <Field label="CVV" value={cardForm.cvv} error={errors.cvv} onChangeText={(value) => setCardForm((prev) => ({ ...prev, cvv: onlyDigits(value).slice(0, brand.key === 'amex' ? 4 : 3) }))} placeholder={brand.key === 'amex' ? '1234' : '123'} secureTextEntry />
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.paypalBox}>
                <MaterialIcons name="account-balance-wallet" size={32} color={webTokens.color.brand} />
                <Text style={styles.paypalTitle}>PayPal Checkout</Text>
                <Text style={styles.muted}>Simularemos la aprobacion de PayPal con un correo valido.</Text>
              </View>
              <Field label="Correo PayPal" value={paypalForm.email} error={errors.email} onChangeText={(value) => setPaypalForm({ email: value })} placeholder="paypal@email.com" />
            </View>
          )}

          <WebButton label={`Pagar ${formatMoney(amount)}`} icon="lock" loading={submitting} onPress={pay} style={styles.payButton} />
        </WebCard>

        <WebCard style={styles.summaryCard}>
          <WebBadge tone="green" icon="verified">Pago simulado seguro</WebBadge>
          <Text style={styles.summaryTitle}>{subjectName}</Text>
          <Text style={styles.muted}>Docente: {offer.username || offer.teacherDisplayName || 'Docente'}</Text>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Horario</Text><Text style={styles.summaryValue}>{formatSlot(slot)}</Text></View>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Metodo</Text><Text style={styles.summaryValue}>{method === 'card' ? brand.label : 'PayPal'}</Text></View>
          <View style={styles.totalLine}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{formatMoney(amount)}</Text></View>
          <Text style={styles.disclaimer}>No se realizara ningun cobro real. Solo guardamos estado de pago simulado en Firebase.</Text>
        </WebCard>
      </View>
    </WebShell>
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

function PaymentTab({ active, icon, label, onPress }) {
  return (
    <Pressable style={[styles.methodTab, active && styles.methodTabActive]} onPress={onPress}>
      <MaterialIcons name={icon} size={19} color={active ? '#fff' : webTokens.color.brand} />
      <Text style={[styles.methodText, active && styles.methodTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, error, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={webTokens.color.muted} style={[styles.input, error && styles.inputError]} {...props} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18 },
  formCard: { gap: 18 },
  methodTabs: { flexDirection: 'row', gap: 10, backgroundColor: webTokens.color.surfaceAlt, padding: 6, borderRadius: 16 },
  methodTab: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  methodTabActive: { backgroundColor: webTokens.color.brand },
  methodText: { color: webTokens.color.brand, fontWeight: '900' },
  methodTextActive: { color: '#fff' },
  form: { gap: 14 },
  field: { gap: 7 },
  label: { color: webTokens.color.ink, fontWeight: '900' },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: webTokens.color.line, backgroundColor: webTokens.color.input, color: webTokens.color.ink, paddingHorizontal: 14, outlineStyle: 'none' },
  inputError: { borderColor: webTokens.color.bad },
  error: { color: webTokens.color.bad, fontSize: 12, fontWeight: '800' },
  cardInputWrap: { position: 'relative' },
  brandBadge: { position: 'absolute', right: 10, top: 31, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: webTokens.color.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  brandText: { color: webTokens.color.brand, fontWeight: '900', fontSize: 12 },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  paypalBox: { borderRadius: 18, borderWidth: 1, borderColor: webTokens.color.line, backgroundColor: webTokens.color.surfaceAlt, padding: 18, gap: 8 },
  paypalTitle: { color: webTokens.color.ink, fontSize: 20, fontWeight: '900' },
  muted: { color: webTokens.color.muted, lineHeight: 21 },
  payButton: { alignSelf: 'flex-start' },
  summaryCard: { alignSelf: 'start', gap: 14 },
  summaryTitle: { color: webTokens.color.ink, fontSize: 26, fontWeight: '900' },
  summaryLine: { borderTopWidth: 1, borderTopColor: webTokens.color.line, paddingTop: 12, gap: 4 },
  summaryLabel: { color: webTokens.color.muted, fontWeight: '800' },
  summaryValue: { color: webTokens.color.ink, fontWeight: '900' },
  totalLine: { borderTopWidth: 1, borderTopColor: webTokens.color.line, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: webTokens.color.ink, fontWeight: '900', fontSize: 18 },
  totalValue: { color: webTokens.color.brand, fontWeight: '900', fontSize: 24 },
  disclaimer: { color: webTokens.color.muted, fontSize: 12, lineHeight: 18 },
});
