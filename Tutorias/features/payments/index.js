import {
  doc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../app/config/firebase';
import { OFFERS_COLLECTION, RESERVATIONS_COLLECTION, RESERVATION_STATUS } from '../../constants/firestore';

export const PAYMENT_METHODS = {
  CARD: 'card',
  PAYPAL: 'paypal',
};

export const onlyDigits = (value = '') => String(value || '').replace(/\D/g, '');

export function detectCardBrand(value = '') {
  const digits = onlyDigits(value);
  const firstTwo = Number(digits.slice(0, 2));
  const firstFour = Number(digits.slice(0, 4));
  if (digits.startsWith('4')) return { key: 'visa', label: 'Visa', icon: 'credit-card' };
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return { key: 'mastercard', label: 'Mastercard', icon: 'credit-card' };
  }
  if (digits.startsWith('34') || digits.startsWith('37')) return { key: 'amex', label: 'American Express', icon: 'credit-card' };
  if (digits.startsWith('6011') || digits.startsWith('65')) return { key: 'discover', label: 'Discover', icon: 'credit-card' };
  return { key: 'card', label: 'Tarjeta', icon: 'credit-card' };
}

export function formatCardNumber(value = '') {
  const digits = onlyDigits(value).slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(value = '') {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function luhnValid(value = '') {
  const digits = onlyDigits(value);
  if (digits.length < 13) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function fullNameValid(value = '') {
  const trimmed = String(value || '').trim();
  if (/\d/.test(trimmed)) return false;
  return trimmed.split(/\s+/).filter(Boolean).length >= 2 && /^[A-Za-zÀ-ÿ' -]+$/.test(trimmed);
}

function emailValid(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function expiryValid(value = '') {
  const [monthRaw, yearRaw] = String(value || '').split('/');
  const month = Number(monthRaw);
  const year = Number(yearRaw?.length === 2 ? `20${yearRaw}` : yearRaw);
  if (!month || month < 1 || month > 12 || !year) return false;
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  return endOfMonth >= new Date();
}

export function validateCardPayment(form = {}) {
  const errors = {};
  const cardNumber = onlyDigits(form.cardNumber);
  const brand = detectCardBrand(cardNumber);
  if (!fullNameValid(form.cardholderName)) errors.cardholderName = 'Escribe nombre y apellido sin numeros.';
  if (!emailValid(form.email)) errors.email = 'Escribe un correo valido.';
  if (!luhnValid(cardNumber)) errors.cardNumber = 'Numero de tarjeta invalido.';
  if (!expiryValid(form.expiry)) errors.expiry = 'Fecha de vencimiento invalida.';
  const cvvLength = brand.key === 'amex' ? 4 : 3;
  if (onlyDigits(form.cvv).length !== cvvLength) errors.cvv = `CVV de ${cvvLength} digitos.`;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    brand,
    sanitized: {
      method: PAYMENT_METHODS.CARD,
      brand: brand.key,
      last4: cardNumber.slice(-4),
      payerEmail: String(form.email || '').trim(),
      payerName: String(form.cardholderName || '').trim(),
    },
  };
}

export function validatePaypalPayment(form = {}) {
  const errors = {};
  if (!emailValid(form.email)) errors.email = 'Escribe el correo de PayPal.';
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      method: PAYMENT_METHODS.PAYPAL,
      brand: 'paypal',
      last4: 'mail',
      payerEmail: String(form.email || '').trim(),
      payerName: 'PayPal checkout',
    },
  };
}

export function buildPaymentReference(method = PAYMENT_METHODS.CARD) {
  return `SIM-${method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createPaidReservation({
  offerId,
  subjectKey,
  subjectName,
  slot,
  user,
  payment,
}) {
  if (!offerId || !slot || !user?.uid || !payment?.method) {
    throw new Error('Faltan datos para crear la reserva.');
  }

  const reservationId = `${offerId}_${user.uid}`;
  const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
  const userRef = doc(db, 'users', user.uid);

  const reservation = await runTransaction(db, async (transaction) => {
    const offerRef = doc(db, OFFERS_COLLECTION, offerId);
    const offerSnap = await transaction.get(offerRef);
    if (!offerSnap.exists()) throw new Error('Oferta no disponible');

    const existingReservation = await transaction.get(reservationRef);
    if (existingReservation.exists()) {
      const status = existingReservation.data()?.status;
      if ([RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED].includes(status)) {
        throw new Error('Ya tienes una reserva activa para esta tutoría.');
      }
    }

    const offer = offerSnap.data() || {};
    if (offer.uid === user.uid) throw new Error('No puedes reservar tu propia tutoría.');
    const max = Number(offer.maxStudents || 0);
    const enrolled = Number(offer.enrolledCount || 0);
    const pending = Number(offer.pendingCount || 0);
    if (max !== 0 && enrolled + pending >= max) throw new Error('No hay cupos disponibles');

    const price = Number(offer.price || 0);
    const reference = buildPaymentReference(payment.method);
    const data = {
      offerId,
      subjectKey,
      subjectName: offer.subjectName || subjectName || '',
      teacherId: offer.uid,
      studentId: user.uid,
      status: RESERVATION_STATUS.PENDING,
      slot,
      price,
      studentDisplayName: user.displayName || user.email || '',
      teacherDisplayName: offer.username || offer.teacherDisplayName || '',
      paymentStatus: 'paid',
      paymentMethod: payment.method,
      paymentBrand: payment.brand,
      paymentLast4: payment.last4,
      paymentAmount: price,
      paymentCurrency: 'USD',
      paymentReference: reference,
      paidAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.update(offerRef, {
      pendingCount: pending + 1,
      updatedAt: serverTimestamp(),
    });
    transaction.set(reservationRef, data);
    transaction.set(userRef, {
      uid: user.uid,
      email: user.email || payment.payerEmail || '',
      hasPaid: true,
      lastPaymentAt: serverTimestamp(),
      lastPaymentReference: reference,
    }, { merge: true });

    return { id: reservationId, ...data, paymentReference: reference };
  });

  return reservation;
}

export function paymentTotals(reservations = []) {
  return reservations.reduce(
    (totals, reservation) => {
      if (reservation.paymentStatus !== 'paid') return totals;
      const amount = Number(reservation.paymentAmount ?? reservation.price ?? 0);
      if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
        totals.confirmed += amount;
      } else if (reservation.status === RESERVATION_STATUS.PENDING) {
        totals.pending += amount;
      }
      totals.count += 1;
      return totals;
    },
    { confirmed: 0, pending: 0, count: 0 }
  );
}

export function formatMoney(value = 0, currency = 'USD') {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toFixed(2)}`;
  }
}
