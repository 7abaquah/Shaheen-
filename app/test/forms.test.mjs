import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, validateSubscribe, validatePlanRequest, validateInvestor } from '../src/forms.js';

test('normalizePhone converts Saudi local and Arabic digits to E.164', () => {
  assert.equal(normalizePhone('0551234567'), '+966551234567');
  assert.equal(normalizePhone('966551234567'), '+966551234567');
  assert.equal(normalizePhone('00971501234567'), '+971501234567');
  assert.equal(normalizePhone('٠٥٥١٢٣٤٥٦٧'), '+966551234567');
  assert.equal(normalizePhone('+966 55 123 4567'), '+966551234567');
  assert.equal(normalizePhone('\u202A+966 50 123 4567\u202C'), '+966501234567');
  assert.equal(normalizePhone('\u200E0501234567'), '+966501234567');
  assert.equal(normalizePhone('۰۵۰۱۲۳۴۵۶۷'), '+966501234567');
  assert.equal(normalizePhone('501234567'), '+966501234567');
});

const sub = { name: 'عبدالله', email: 'a@b.sa', phone: '', interests: ['app'], consent: true };
test('subscribe: valid passes, each rule fails', () => {
  assert.deepEqual(validateSubscribe(sub), {});
  assert.ok(validateSubscribe({ ...sub, name: 'a' }).name);
  assert.ok(validateSubscribe({ ...sub, email: 'nope' }).email);
  assert.ok(validateSubscribe({ ...sub, phone: '12345' }).phone);
  assert.ok(validateSubscribe({ ...sub, interests: [] }).interests);
  assert.ok(validateSubscribe({ ...sub, consent: false }).consent);
  assert.deepEqual(validateSubscribe({ ...sub, name: '😀'.repeat(41) }), {}); // 41 code points < 80
  assert.ok(validateSubscribe({ ...sub, name: '😀'.repeat(81) }).name);
});

const plan = { planId: 'pro-fleet', organization: 'شركة', contactName: 'سالم', email: 'x@y.com', phone: '0551234567', paymentMethod: 'usdt', seats: '', notes: '', consent: true };
test('plan request: plan ids, seats range, payment method', () => {
  const ids = ['pro-fleet', 'node-partner', 'enterprise'];
  assert.deepEqual(validatePlanRequest(plan, ids), {});
  assert.ok(validatePlanRequest({ ...plan, planId: 'x' }, ids).planId);
  assert.ok(validatePlanRequest({ ...plan, seats: '0' }, ids).seats);
  assert.ok(validatePlanRequest({ ...plan, seats: '2.5' }, ids).seats);
  assert.deepEqual(validatePlanRequest({ ...plan, seats: '500' }, ids), {});
  assert.ok(validatePlanRequest({ ...plan, paymentMethod: 'cash' }, ids).paymentMethod);
  assert.ok(validatePlanRequest({ ...plan, notes: 'x'.repeat(1001) }, ids).notes);
});

const inv = { fullName: 'مستثمر', email: 'i@v.com', phone: '+971501234567', country: 'AE', countryOther: '', investorType: 'individual', organization: '', ticketRange: '10k-50k', qualifiedDeclaration: false, message: '', consent: true };
test('investor: institution needs organization, country codes, ticket', () => {
  assert.deepEqual(validateInvestor(inv), {});
  assert.ok(validateInvestor({ ...inv, investorType: 'institution' }).organization);
  assert.deepEqual(validateInvestor({ ...inv, investorType: 'institution', organization: 'صندوق' }), {});
  assert.ok(validateInvestor({ ...inv, country: 'OTHER', countryOther: 'N' }).country);
  assert.deepEqual(validateInvestor({ ...inv, country: 'OTHER', countryOther: 'ng' }), {});
  assert.ok(validateInvestor({ ...inv, ticketRange: '' }).ticketRange);
  assert.ok(validateInvestor({ ...inv, message: 'x'.repeat(1501) }).message);
});
