import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, openStatus, kyivNow } from '../public/js/hours.js';

// Той самий розклад, що у футері: будні з 08:00, вихідні з 09:00, до 21:00
const schedule = [
  { days: [1, 2, 3, 4, 5], open: toMinutes('08:00'), close: toMinutes('21:00') },
  { days: [6, 0], open: toMinutes('09:00'), close: toMinutes('21:00') },
];
const at = (day, time) => ({ day, minutes: toMinutes(time) });

test('toMinutes переводить час у хвилини й відкидає сміття', () => {
  assert.equal(toMinutes('08:30'), 510);
  assert.equal(toMinutes('21:00'), 1260);
  assert.ok(Number.isNaN(toMinutes('ранок')));
});

test('у робочий час — відчинено до години закриття', () => {
  assert.deepEqual(openStatus(schedule, at(3, '12:15')), { open: true, text: 'Зараз відчинено · до 21:00' });
});

test('межі: о 08:00 уже відчинено, о 21:00 уже зачинено', () => {
  assert.equal(openStatus(schedule, at(1, '08:00')).open, true);
  assert.equal(openStatus(schedule, at(1, '21:00')).open, false);
});

test('до відкриття показуємо сьогоднішню годину', () => {
  assert.equal(openStatus(schedule, at(2, '06:40')).text, 'Зараз зачинено · відчинимося о 08:00');
});

test('після закриття в пʼятницю — завтра за суботнім розкладом', () => {
  assert.equal(openStatus(schedule, at(5, '22:10')).text, 'Зараз зачинено · відчинимося завтра о 09:00');
});

test('у неділю ввечері — завтра за буднім розкладом', () => {
  assert.equal(openStatus(schedule, at(0, '23:00')).text, 'Зараз зачинено · відчинимося завтра о 08:00');
});

test('kyivNow повертає час у Львові незалежно від часового поясу відвідувача', () => {
  // 1 липня 2026, 10:00 UTC — у Києві літній час (UTC+3): середа, 13:00
  assert.deepEqual(kyivNow(new Date('2026-07-01T10:00:00Z')), { day: 3, minutes: 13 * 60 });
});
