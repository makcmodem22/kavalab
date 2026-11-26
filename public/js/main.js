/**
 * Спільна логіка для всіх сторінок: перемикач теми, мобільне меню,
 * статус «відчинено / зачинено» у футері, рік і аналітика.
 */
import { kyivNow, openStatus, readSchedule } from './hours.js';

const THEME_KEY = 'kavalab-theme';
const THEME_COLORS = { light: '#f4f1ea', dark: '#16130f' };
const root = document.documentElement;

/* ---------- Тема ---------- */
// Клас .dark ставиться ще в <head> (без «блимання»), тут — лише перемикання і збереження вибору.
const currentTheme = () => (root.classList.contains('dark') ? 'dark' : 'light');

function applyTheme(theme) {
  const dark = theme === 'dark';
  root.classList.toggle('dark', dark);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему');
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function initTheme() {
  applyTheme(currentTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* приватний режим: тема просто не запамʼятається */
      }
    });
  });
}

/* ---------- Мобільне меню ---------- */
function initMobileNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    nav.hidden = !open;
    root.classList.toggle('overflow-hidden', open); // сторінка під меню не прокручується
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  // На широкому екрані меню ховається саме, тож і стан треба скинути
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => event.matches && setOpen(false));
}

/* ---------- Статус у футері ---------- */
function initOpenStatus() {
  const hours = document.querySelector('[data-hours]');
  const status = document.querySelector('[data-open-status]');
  if (!hours || !status) return;
  status.textContent = openStatus(readSchedule(hours), kyivNow()).text;
}

/* ---------- Vercel Web Analytics ---------- */
// Скрипт підключається лише на опублікованому сайті, щоб локально не було помилки 404 у консолі.
function initAnalytics() {
  if (!location.hostname.endsWith('.vercel.app')) return;
  window.va = window.va || function va(...args) { (window.vaq = window.vaq || []).push(args); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.append(script);
}

initTheme();
initMobileNav();
initOpenStatus();
initAnalytics();
document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
