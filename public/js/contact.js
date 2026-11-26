/**
 * Форма зворотного зв'язку: маска телефону (власна функція formatPhone),
 * перевірка полів регулярними виразами під час введення та перед надсиланням.
 * Серверної частини немає — форма демонстраційна, дані нікуди не передаються.
 */
import { validateField, validateForm, formatPhone, MESSAGE_LIMITS } from './validation.js';

const form = document.getElementById('contact-form');
const phone = form.elements.phone;
const message = form.elements.message;
const counter = document.getElementById('message-counter');
const summary = document.getElementById('form-summary');
const success = document.getElementById('form-success');
const touched = new Set();

const LABELS = { name: "Ім'я", email: 'Email', phone: 'Телефон', topic: 'Тема', message: 'Повідомлення', consent: 'Згода' };

function initPhoneMask() {
  // Маска форматує цифри «на льоту»: 0671234567 → +38 (067) 123-45-67.
  // Під час видалення (Backspace) маску не застосовуємо, щоб курсор не «стрибав».
  phone.addEventListener('input', (e) => {
    if (e.inputType?.startsWith('delete')) return;
    phone.value = formatPhone(phone.value);
  });
  phone.addEventListener('blur', () => { phone.value = formatPhone(phone.value); });
}

function valueOf(field) {
  const input = form.elements[field];
  return input.type === 'checkbox' ? input.checked : input.value;
}

function showError(field, error) {
  const input = form.elements[field];
  const errorEl = document.getElementById(`${field}-error`);
  input.setAttribute('aria-invalid', error ? 'true' : 'false');
  errorEl.textContent = error;
}

function checkField(field) {
  const error = validateField(field, valueOf(field));
  showError(field, error);
  return error;
}

function updateCounter() {
  const length = message.value.trim().length;
  counter.textContent = `${length} / ${MESSAGE_LIMITS.max}`;
  counter.classList.toggle('text-red-700', length > MESSAGE_LIMITS.max);
}

form.addEventListener('focusout', (e) => {
  const field = e.target.name;
  if (!field || !(field in LABELS)) return;
  touched.add(field);
  checkField(field);
});

form.addEventListener('input', (e) => {
  const field = e.target.name;
  if (field === 'message') updateCounter();
  // Після першої перевірки поля помилка оновлюється одразу під час введення
  if (touched.has(field)) checkField(field);
});

form.addEventListener('change', (e) => {
  if (e.target.name === 'consent' || e.target.name === 'topic') { touched.add(e.target.name); checkField(e.target.name); }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  success.hidden = true;

  // Honeypot: приховане поле заповнюють лише боти
  if (form.elements.website.value) return;

  const data = Object.fromEntries(Object.keys(LABELS).map((f) => [f, valueOf(f)]));
  const { valid, errors } = validateForm(data);
  Object.keys(LABELS).forEach((f) => { touched.add(f); showError(f, errors[f] ?? ''); });

  if (!valid) {
    const fields = Object.keys(errors);
    summary.hidden = false;
    summary.querySelector('ul').innerHTML = fields
      .map((f) => `<li><a class="underline" href="#${form.elements[f].id}">${LABELS[f]}: ${errors[f]}</a></li>`).join('');
    summary.focus();
    return;
  }

  summary.hidden = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Надсилаємо…';

  // Імітація запиту до сервера (у прототипі даних не надсилаємо і не зберігаємо)
  setTimeout(() => {
    const firstName = data.name.trim().split(' ')[0];
    success.querySelector('[data-success-name]').textContent = firstName;
    success.hidden = false;
    success.focus();
    form.reset();
    touched.clear();
    Object.keys(LABELS).forEach((f) => showError(f, ''));
    updateCounter();
    button.disabled = false;
    button.textContent = 'Надіслати повідомлення';
  }, 700);
});

initPhoneMask();
updateCounter();
