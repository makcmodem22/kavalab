import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateField, validateForm, formatPhone } from '../public/js/validation.js';

test("ім'я: приймає українські та латинські імена", () => {
  for (const ok of ['Анна', "Ольга-Марія", "Мар'яна", 'Іван Ґудзь', 'John Smith', 'Їжак']) {
    assert.equal(validateField('name', ok), '', ok);
  }
  for (const bad of ['', 'A', 'Ann4', 'Ім<b>я', 'x'.repeat(41)]) {
    assert.notEqual(validateField('name', bad), '', bad);
  }
});

test('email', () => {
  for (const ok of ['name@example.com', 'a.b+tag@mail.co.ua', 'x_1@sub-domain.org']) {
    assert.equal(validateField('email', ok), '', ok);
  }
  for (const bad of ['', 'name', 'name@', '@mail.com', 'na me@mail.com', 'a..b@mail.com', 'a@mail', 'a@-mail.com']) {
    assert.notEqual(validateField('email', bad), '', bad);
  }
});

test('маска телефону', () => {
  assert.equal(formatPhone('0671234567'), '+38 (067) 123-45-67');
  assert.equal(formatPhone('+380671234567'), '+38 (067) 123-45-67');
  assert.equal(formatPhone('671234567'), '+38 (067) 123-45-67');
  assert.equal(formatPhone('067'), '+38 (067)');
  assert.equal(formatPhone('abc'), '');
});

test('телефон необовʼязковий, але має бути повним', () => {
  assert.equal(validateField('phone', ''), '');
  assert.equal(validateField('phone', '+38 (067) 123-45-67'), '');
  assert.notEqual(validateField('phone', '+38 (067) 123-45'), '');
});

test('повідомлення: довжина та заборона HTML', () => {
  assert.notEqual(validateField('message', 'коротко'), '');
  assert.notEqual(validateField('message', '<img src=x onerror=alert(1)> привіт усім'), '');
  assert.notEqual(validateField('message', 'а'.repeat(501)), '');
  assert.equal(validateField('message', 'Хочу забронювати столик на шістьох.'), '');
});

test('validateForm збирає всі помилки', () => {
  const { valid, errors } = validateForm({ name: '', email: 'bad', phone: '', topic: 'x', message: '', consent: false });
  assert.equal(valid, false);
  assert.deepEqual(Object.keys(errors).sort(), ['consent', 'email', 'message', 'name', 'topic']);

  const good = validateForm({ name: 'Олена', email: 'olena@example.com', phone: '+38 (050) 000-00-00', topic: 'booking', message: 'Столик на суботу о 10:00', consent: true });
  assert.equal(good.valid, true);
});
