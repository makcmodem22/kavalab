import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculatePrice, parseQuantity, applyPromo, normalizePromo, formatUAH, describeDrink,
} from '../public/js/pricing.js';

const { builder } = JSON.parse(readFileSync(new URL('../public/data/data.json', import.meta.url), 'utf8'));

const drink = (over = {}) => ({
  base: 'latte', size: 's', milk: 'cow', syrups: [], extras: [], sugar: 0, quantity: '1', promo: '', ...over,
});

test('базова ціна лате S на коров\'ячому молоці', () => {
  const r = calculatePrice(builder, drink());
  assert.equal(r.unitPrice, 75);
  assert.equal(r.total, 75);
  assert.equal(r.isValid, true);
});

test('розмір L множить основу і молоко на 1.5, сиропи — фіксовані', () => {
  const r = calculatePrice(builder, drink({ size: 'l', milk: 'oat', syrups: ['vanilla'] }));
  // 75*1.5=112.5→113, вівсяне 20*1.5=30, ваніль 12
  assert.equal(r.unitPrice, 113 + 30 + 12);
});

test('для еспресо молоко автоматично прибирається з попередженням', () => {
  const r = calculatePrice(builder, drink({ base: 'espresso', milk: 'almond' }));
  assert.equal(r.selection.milk, 'none');
  assert.equal(r.unitPrice, 50);
  assert.equal(r.warnings.length, 1);
});

test('для капучино «без молока» замінюється коров\'ячим', () => {
  const r = calculatePrice(builder, drink({ base: 'cappuccino', milk: 'none' }));
  assert.equal(r.selection.milk, 'cow');
});

test('не більше 3 сиропів, дублікати та невідомі id відкидаються', () => {
  const r = calculatePrice(builder, drink({ syrups: ['vanilla', 'vanilla', 'caramel', 'hazelnut', 'lavender', 'hack'] }));
  assert.deepEqual(r.selection.syrups, ['vanilla', 'caramel', 'hazelnut']);
});

test('кількість множить підсумок', () => {
  const r = calculatePrice(builder, drink({ quantity: '3' }));
  assert.equal(r.subtotal, 225);
});

test('некоректна кількість дає помилку і нульову суму', () => {
  for (const bad of ['', 'abc', '2.5', '-1', '0', '11', '1e1', ' 3 a']) {
    const r = parseQuantity(bad, builder.limits);
    assert.equal(r.value, null, `«${bad}» має бути відхилено`);
    assert.ok(r.error);
  }
  const r = calculatePrice(builder, drink({ quantity: 'abc' }));
  assert.equal(r.total, 0);
  assert.equal(r.isValid, false);
});

test('промокоди: відсоток, фіксована сума, регістр і пробіли', () => {
  assert.equal(applyPromo('kava10', builder.promoCodes, 200).discount, 20);
  assert.equal(applyPromo(' stu dent ', builder.promoCodes, 100).discount, 15);
  assert.equal(applyPromo('LAB20', builder.promoCodes, 15).discount, 15, 'знижка не більша за суму');
  assert.equal(normalizePromo(' ka va 10 '), 'KAVA10');
});

test('невідомий або некоректний промокод дає помилку', () => {
  assert.ok(applyPromo('FREE', builder.promoCodes, 100).error);
  assert.ok(applyPromo('<script>', builder.promoCodes, 100).error);
  assert.equal(applyPromo('', builder.promoCodes, 100).error, '');
});

test('загальна сума ніколи не відʼємна', () => {
  const r = calculatePrice(builder, drink({ base: 'espresso', milk: 'none', promo: 'LAB20' }));
  assert.ok(r.total >= 0);
});

test('цукор обмежено діапазоном 0–3', () => {
  assert.equal(calculatePrice(builder, drink({ sugar: 9 })).selection.sugar, 3);
  assert.equal(calculatePrice(builder, drink({ sugar: -2 })).selection.sugar, 0);
});

test('formatUAH і describeDrink', () => {
  assert.equal(formatUAH(1250), '1 250 ₴');
  const { selection } = calculatePrice(builder, drink({ syrups: ['caramel'], sugar: 1 }));
  assert.equal(describeDrink(builder, selection), "Лате S, коров'яче 2,5%, солона карамель, цукор ×1");
});
