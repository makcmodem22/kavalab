/**
 * Спільна логіка для всіх сторінок: мобільне меню, перемикач теми, рік у футері.
 * Тема зберігається в localStorage, а клас .dark ставиться ще в <head> (без «блимання»).
 */
const THEME_KEY = 'kavalab-theme';
const root = document.documentElement;

function currentTheme() {
  return root.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему');
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17110d' : '#f6efe6');
}

function initTheme() {
  applyTheme(currentTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
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

function initMobileNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    nav.hidden = !open;
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

initTheme();
initMobileNav();
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

/*
 * Vercel Web Analytics: скрипт підключається лише на опублікованому сайті,
 * щоб під час локальної розробки не було помилки 404 у консолі.
 */
if (location.hostname.endsWith('.vercel.app')) {
  window.va = window.va || function va(...args) { (window.vaq = window.vaq || []).push(args); };
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.append(script);
}
