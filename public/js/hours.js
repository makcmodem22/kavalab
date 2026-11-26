/**
 * Години роботи: чи відчинена кав'ярня просто зараз.
 * Розклад береться з розмітки футера (data-атрибути), тож години записані лише в одному місці.
 * Чисті функції без DOM перевіряються тестами (tests/hours.test.js).
 */
const KYIV = 'Europe/Kyiv';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "08:30" → 510 хвилин від початку доби. */
export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Поточний день тижня (0 — неділя) і час у Львові, хоч би де був відвідувач. */
export function kyivNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KYIV, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return { day: WEEKDAYS.indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/**
 * @param {{days: number[], open: number, close: number}[]} schedule
 * @param {{day: number, minutes: number}} now
 * @returns {{open: boolean, text: string}}
 */
export function openStatus(schedule, { day, minutes }) {
  const rowFor = (weekday) => schedule.find((row) => row.days.includes(weekday));
  const today = rowFor(day);

  if (today && minutes >= today.open && minutes < today.close) {
    return { open: true, text: `Зараз відчинено · до ${toTime(today.close)}` };
  }
  if (today && minutes < today.open) {
    return { open: false, text: `Зараз зачинено · відчинимося о ${toTime(today.open)}` };
  }
  const tomorrow = rowFor((day + 1) % 7);
  return {
    open: false,
    text: tomorrow ? `Зараз зачинено · відчинимося завтра о ${toTime(tomorrow.open)}` : 'Зараз зачинено',
  };
}

/** Читає розклад із розмітки: <div data-days="1 2 3" data-open="08:00" data-close="21:00">. */
export function readSchedule(container) {
  return [...container.querySelectorAll('[data-days]')].map((row) => ({
    days: row.dataset.days.split(' ').map(Number),
    open: toMinutes(row.dataset.open),
    close: toMinutes(row.dataset.close),
  }));
}
