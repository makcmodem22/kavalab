/**
 * Збирає сторінки сайту: src/pages/*.html + спільний шаблон src/layout.html → public/*.html.
 *
 * Навіщо: шапка, футер і <head> однакові на всіх сторінках. Щоб не копіювати їх шість разів,
 * вони лежать в одному шаблоні, а в src/pages — лише унікальний вміст кожної сторінки.
 *
 * Кожна сторінка починається з коментаря з параметрами («ключ: значення»):
 *   title, description — для <title> і метатегів;
 *   libs    — бібліотеки з CDN через пробіл (swiper, glightbox);
 *   script  — JS-модуль сторінки;
 *   robots  — необовʼязково, напр. noindex для 404.
 *
 * Запуск: node scripts/build-pages.mjs  (або --watch, щоб перезбирати після змін)
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { watch } from 'node:fs';

const SITE_URL = 'https://kavalab-lviv.vercel.app/';
const SRC = new URL('../src/', import.meta.url);
const OUT = new URL('../public/', import.meta.url);

/** Сторонні бібліотеки з CDN (jsDelivr): стилі й скрипти. */
const CDN = {
  swiper: {
    css: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    js: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
  },
  glightbox: {
    css: 'https://cdn.jsdelivr.net/npm/glightbox@3.3.1/dist/css/glightbox.min.css',
    js: 'https://cdn.jsdelivr.net/npm/glightbox@3.3.1/dist/js/glightbox.min.js',
  },
};

/** Розділяє файл сторінки на параметри (коментар на початку) і розмітку. */
function parsePage(source) {
  const match = source.match(/^<!--\n([\s\S]*?)\n-->\n/);
  if (!match) throw new Error('Сторінка має починатися з коментаря з параметрами');
  const meta = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { meta, content: source.slice(match[0].length).trim() };
}

const indent = (html, spaces) => html.split('\n').map((line) => (line ? ' '.repeat(spaces) + line : line)).join('\n');

/* CSS бібліотек вантажимо без блокування рендеру: media="print" → "all" після завантаження */
const lazyStyle = (href) => `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`;

function renderPage(layout, fileName, { meta, content }) {
  const libs = (meta.libs ?? '').split(' ').filter(Boolean).map((name) => {
    if (!CDN[name]) throw new Error(`${fileName}: невідома бібліотека «${name}»`);
    return CDN[name];
  });
  const scripts = [
    ...libs.map((lib) => `<script src="${lib.js}" defer></script>`),
    meta.script ? `<script type="module" src="${meta.script}"></script>` : '',
  ].filter(Boolean);

  const values = {
    title: meta.title,
    description: meta.description,
    url: SITE_URL + (fileName === 'index.html' ? '' : fileName),
    robots: meta.robots ? `<meta name="robots" content="${meta.robots}">` : '',
    styles: libs.map((lib) => lazyStyle(lib.css)).join('\n  '),
    noscript: libs.map((lib) => `<link rel="stylesheet" href="${lib.css}">`).join(''),
    content: indent(content, 2).trimStart(),
    scripts: scripts.join('\n  '),
  };
  for (const key of ['title', 'description']) {
    if (!values[key]) throw new Error(`${fileName}: не вказано «${key}»`);
  }

  return layout
    .replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')
    // Рядки, що лишилися порожніми від необовʼязкових вставок (robots, стилі бібліотек, скрипти)
    .replace(/\n[ \t]+(?=\n)/g, '')
    // Пункт меню поточної сторінки позначаємо для скринрідерів і стилів
    .replaceAll(`-link" href="${fileName}"`, `-link" href="${fileName}" aria-current="page"`);
}

async function build() {
  const layout = await readFile(new URL('layout.html', SRC), 'utf8');
  const files = (await readdir(new URL('pages/', SRC))).filter((name) => name.endsWith('.html'));
  for (const fileName of files) {
    const source = await readFile(new URL(`pages/${fileName}`, SRC), 'utf8');
    await writeFile(new URL(fileName, OUT), renderPage(layout, fileName, parsePage(source)));
  }
  console.log(`Зібрано сторінок: ${files.length}`);
}

await build();

if (process.argv.includes('--watch')) {
  console.log('Стежу за змінами в src/…');
  let timer = null;
  watch(SRC, { recursive: true }, (_event, name) => {
    if (!name?.endsWith('.html')) return;
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((error) => console.error(error.message)), 100);
  });
}
