/**
 * Правила перевірки форми зворотного зв'язку (регулярні вирази).
 * Без DOM — модуль тестується в Node (tests/validation.test.js).
 * Увага: це клієнтська перевірка для зручності, вона не замінює серверну.
 */

export const PATTERNS = {
  // Літери українського та латинського алфавітів, апостроф, дефіс і пробіл; 2–40 символів
  name: /^[A-Za-zА-ЩЬЮЯҐЄІЇа-щьюяґєії'’ʼ\- ]{2,40}$/u,
  // Ім'я користувача @ домен . зона з 2+ літер; без пробілів і подвійних крапок
  email: /^(?!.*\.\.)[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/,
  // Український номер у форматі маски: +38 (0XX) XXX-XX-XX
  phone: /^\+38 \(0\d{2}\) \d{3}-\d{2}-\d{2}$/,
  // Будь-який HTML-тег у тексті
  htmlTag: /<[^>]*>/,
};

export const MESSAGE_LIMITS = { min: 10, max: 500 };

export const TOPICS = ['feedback', 'booking', 'catering', 'job', 'other'];

/**
 * Форматує довільне введення в маску +38 (0XX) XXX-XX-XX.
 * Використовується як резервний варіант, якщо бібліотека IMask не завантажилась з CDN.
 */
export function formatPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('380')) digits = digits.slice(2);
  else if (digits.startsWith('38')) digits = digits.slice(2);
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  digits = digits.slice(0, 10);
  if (!digits) return '';

  let out = '+38 (' + digits.slice(0, 3);
  if (digits.length >= 3) out += ')';
  if (digits.length > 3) out += ' ' + digits.slice(3, 6);
  if (digits.length > 6) out += '-' + digits.slice(6, 8);
  if (digits.length > 8) out += '-' + digits.slice(8, 10);
  return out;
}

/** Повертає текст помилки для одного поля або порожній рядок, якщо поле коректне. */
export function validateField(field, rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

  switch (field) {
    case 'name':
      if (!value) return "Вкажіть, як до вас звертатися.";
      if (value.length < 2) return "Ім'я має містити щонайменше 2 літери.";
      if (!PATTERNS.name.test(value)) return "Лише літери, пробіл, дефіс або апостроф (до 40 символів).";
      return '';
    case 'email':
      if (!value) return 'Вкажіть електронну пошту — на неї надішлемо відповідь.';
      if (!PATTERNS.email.test(value)) return 'Перевірте формат пошти, наприклад: name@example.com.';
      return '';
    case 'phone':
      // Телефон необов'язковий, але якщо введений — має бути повним
      if (!value || value === '+38 (') return '';
      if (!PATTERNS.phone.test(value)) return 'Номер має бути повним: +38 (0XX) XXX-XX-XX.';
      return '';
    case 'topic':
      if (!TOPICS.includes(value)) return 'Оберіть тему звернення.';
      return '';
    case 'message':
      if (!value) return 'Напишіть повідомлення.';
      if (PATTERNS.htmlTag.test(value)) return 'Будь ласка, без HTML-тегів.';
      if (value.length < MESSAGE_LIMITS.min) return `Щонайменше ${MESSAGE_LIMITS.min} символів — так ми краще зрозуміємо запит.`;
      if (value.length > MESSAGE_LIMITS.max) return `Не більше ${MESSAGE_LIMITS.max} символів.`;
      return '';
    case 'consent':
      return value === true ? '' : 'Потрібна згода на обробку даних, щоб ми могли відповісти.';
    default:
      return '';
  }
}

/** Перевіряє всю форму. Повертає { valid, errors } де errors — обʼєкт «поле → помилка». */
export function validateForm(data) {
  const errors = {};
  for (const field of ['name', 'email', 'phone', 'topic', 'message', 'consent']) {
    const error = validateField(field, data[field]);
    if (error) errors[field] = error;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
