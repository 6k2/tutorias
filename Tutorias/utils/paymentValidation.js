export const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

export const formatCardNumber = (value = '') =>
  digitsOnly(value)
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();

export const formatExpiry = (value = '') => {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const isFutureExpiry = (value = '') => {
  const [monthRaw, yearRaw] = String(value).split('/');
  const month = Number(monthRaw);
  const year = Number(`20${yearRaw}`);
  if (!monthRaw || !yearRaw || month < 1 || month > 12 || yearRaw.length !== 2) return false;
  const now = new Date();
  const expiryLimit = new Date(year, month, 0, 23, 59, 59, 999);
  return expiryLimit >= now;
};

export const validatePaymentForm = (form = {}) => {
  const errors = {};
  const cardDigits = digitsOnly(form.cardNumber);
  const cvvDigits = digitsOnly(form.cvv);
  const postcodeDigits = digitsOnly(form.postcode);

  if (!String(form.cardholder || '').trim()) {
    errors.cardholder = 'Ingresa el nombre del titular.';
  } else if (String(form.cardholder).trim().length < 3) {
    errors.cardholder = 'El nombre debe tener al menos 3 caracteres.';
  }

  if (!cardDigits) {
    errors.cardNumber = 'Ingresa el número de tarjeta.';
  } else if (cardDigits.length < 13 || cardDigits.length > 19) {
    errors.cardNumber = 'El número debe tener entre 13 y 19 dígitos.';
  }

  if (!String(form.expiry || '').trim()) {
    errors.expiry = 'Ingresa la fecha de expiración.';
  } else if (!/^\d{2}\/\d{2}$/.test(String(form.expiry)) || !isFutureExpiry(form.expiry)) {
    errors.expiry = 'Usa una fecha válida en formato MM/YY.';
  }

  if (!cvvDigits) {
    errors.cvv = 'Ingresa el CVV.';
  } else if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.cvv = 'El CVV debe tener 3 o 4 dígitos.';
  }

  if (!postcodeDigits) {
    errors.postcode = 'Ingresa tu código postal.';
  } else if (postcodeDigits.length < 4 || postcodeDigits.length > 10) {
    errors.postcode = 'El código postal debe tener entre 4 y 10 números.';
  }

  return errors;
};

export const isPaymentFormValid = (form) => Object.keys(validatePaymentForm(form)).length === 0;
