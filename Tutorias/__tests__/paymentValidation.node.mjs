import assert from 'node:assert/strict';
import { validatePaymentForm, formatCardNumber, formatExpiry } from '../utils/paymentValidation.js';

const futureYear = String(new Date().getFullYear() + 2).slice(-2);

assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
assert.equal(formatExpiry('1229'), '12/29');

const validErrors = validatePaymentForm({
  cardholder: 'Maria Perez',
  cardNumber: '4242 4242 4242 4242',
  expiry: `12/${futureYear}`,
  cvv: '123',
  postcode: '11001',
});
assert.deepEqual(validErrors, {});

const invalidErrors = validatePaymentForm({
  cardholder: '',
  cardNumber: '1234',
  expiry: '01/20',
  cvv: 'HOLA',
  postcode: 'HOLA',
});
assert.ok(invalidErrors.cardholder);
assert.ok(invalidErrors.cardNumber);
assert.ok(invalidErrors.expiry);
assert.ok(invalidErrors.cvv);
assert.ok(invalidErrors.postcode);

console.log('payment validation tests passed');
