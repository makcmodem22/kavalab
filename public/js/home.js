/**
 * Головна сторінка. Усі дані — з data.json (fetch у data.js):
 *  1) «формула» в герої — келих із шарами, приклади перемикаються кнопками;
 *  2) хіти меню — список із попереднім переглядом ілюстрації;
 *  3) приклад чека — рахує та сама функція calculatePrice, що й у конструкторі;
 *  4) відгуки — стос карток на Swiper (бібліотека з CDN);
 *  5) маніфест — слова проявляються під час прокручування.
 */
import { loadData, renderLoadError, escapeHTML } from './data.js';
import { drinkArt } from './art.js';
import { calculatePrice, formatUAH } from './pricing.js';
import { buildLayers } from './formula.js';
import { createGlass, legendHTML } from './glass.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Приклади напоїв для героя та чека: звичайний вибір у форматі конструктора. */
const PRESETS = [
  { base: 'latte', size: 'm', milk: 'oat', syrups: ['lavender'], extras: ['cinnamon'] },
  { base: 'cappuccino', size: 's', milk: 'cow', syrups: [], extras: ['chocolate'] },
  { base: 'raf', size: 'l', milk: 'cow', syrups: ['vanilla', 'caramel'], extras: ['cream'] },
  { base: 'americano', size: 'm', milk: 'none', syrups: [], extras: [] },
];
const RECEIPT_PRESET = PRESETS[0];

/** Рахує ціну прикладу так само, як конструктор (одна чашка, без промокоду). */
const priceOf = (builder, preset) => calculatePrice(builder, { ...preset, sugar: 0, quantity: '1', promo: '' });

/* ---------- 1. Формула в герої ---------- */
function initFormula(builder) {
  const updateGlass = createGlass($('formula-glass'));
  const presetsEl = $('formula-presets');
  const baseName = (preset) => builder.bases.find((base) => base.id === preset.base).name;

  presetsEl.innerHTML = PRESETS.map((preset, index) => `
    <button type="button" class="tab text-2xl!" data-preset="${index}" aria-pressed="false">${escapeHTML(baseName(preset))}</button>`).join('');

  function show(index) {
    const preset = PRESETS[index];
    const result = priceOf(builder, preset);
    const formula = buildLayers(builder, result.selection);
    const size = builder.sizes.find((item) => item.id === preset.size);

    updateGlass(formula);
    $('formula-name').textContent = `${baseName(preset)} ${size.name}`;
    $('formula-volume').textContent = `${formula.volume} мл`;
    $('formula-legend').innerHTML = legendHTML(formula.layers);
    $('formula-price').textContent = formatUAH(result.total);
    presetsEl.querySelectorAll('[data-preset]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === index));
    });
  }

  presetsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preset]');
    if (button) show(Number(button.dataset.preset));
  });

  // Кадр затримки: келих спершу малюється порожнім, тож шари «наливаються» з анімацією
  requestAnimationFrame(() => requestAnimationFrame(() => show(0)));
}

/* ---------- 2. Хіти меню ---------- */
function initHits(menu) {
  const list = $('hits');
  const preview = $('hits-preview');
  const hits = menu.filter((item) => item.tags.includes('hit'));

  list.innerHTML = hits.map((item, index) => `
    <li>
      <a href="menu.html?cat=${encodeURIComponent(item.category)}" class="hit-row" data-hit="${escapeHTML(item.id)}">
        <span class="spec opacity-70">${String(index + 1).padStart(2, '0')}</span>
        <span class="min-w-0">
          <span class="display-3 block">${escapeHTML(item.name)}</span>
          <span class="mt-1 block opacity-75">${escapeHTML(item.description)}</span>
        </span>
        <span class="font-mono text-lg whitespace-nowrap">${formatUAH(item.price)}</span>
      </a>
    </li>`).join('');

  const showPreview = (id) => {
    const item = hits.find((hit) => hit.id === id);
    if (item && preview.dataset.current !== id) {
      preview.dataset.current = id;
      preview.innerHTML = drinkArt(item.art);
    }
  };
  const onPoint = (event) => {
    const row = event.target.closest('[data-hit]');
    if (row) showPreview(row.dataset.hit);
  };
  list.addEventListener('pointerover', onPoint);
  list.addEventListener('focusin', onPoint);
  if (hits.length > 0) showPreview(hits[0].id);
}

/* ---------- 3. Приклад чека ---------- */
function initReceipt(builder) {
  const result = priceOf(builder, RECEIPT_PRESET);
  $('receipt-lines').innerHTML = result.lines.map((line) => `
    <li class="flex justify-between gap-4">
      <span>${escapeHTML(line.label)}</span>
      <span class="whitespace-nowrap">${formatUAH(line.amount)}</span>
    </li>`).join('');
  $('receipt-total').textContent = formatUAH(result.total);
}

/* ---------- 4. Відгуки ---------- */
const stars = (rating) => `<span role="img" aria-label="Оцінка ${rating} з 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`;

function initReviews(reviews) {
  const track = $('reviews-track');
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  $('reviews-summary').textContent = `Середня оцінка ${average.toFixed(1).replace('.', ',')} з 5 — за ${reviews.length} відгуками.`;

  track.innerHTML = reviews.map((review) => `
    <div class="swiper-slide">
      <figure class="review-card">
        <p class="text-xl tracking-widest text-signal-deep">${stars(review.rating)}</p>
        <blockquote class="mt-5 flex-1 text-[1.375rem] leading-snug font-semibold">«${escapeHTML(review.text)}»</blockquote>
        <figcaption class="mt-6 border-t-2 border-ink pt-4">
          <span class="display-3 block">${escapeHTML(review.name)}</span>
          <span class="spec mt-1 block">${escapeHTML(review.role)}</span>
        </figcaption>
      </figure>
    </div>`).join('');

  const controls = document.querySelectorAll('[data-reviews-prev], [data-reviews-next]');

  // Якщо Swiper не завантажився з CDN, відгуки лишаються стрічкою з горизонтальним прокручуванням
  if (typeof window.Swiper !== 'function') {
    track.classList.add('flex', 'snap-x', 'gap-4', 'overflow-x-auto');
    track.querySelectorAll('.swiper-slide').forEach((slide) => slide.classList.add('w-80', 'shrink-0', 'snap-start'));
    controls.forEach((button) => { button.hidden = true; });
    return;
  }

  const swiper = new window.Swiper('#reviews', {
    effect: 'cards',
    cardsEffect: { perSlideOffset: 9, perSlideRotate: 3, slideShadows: false },
    grabCursor: true,
    rewind: true,
    keyboard: { enabled: true },
    autoplay: reducedMotion ? false : { delay: 4500, pauseOnMouseEnter: true, disableOnInteraction: false },
    navigation: { nextEl: '[data-reviews-next]', prevEl: '[data-reviews-prev]' },
    a11y: { prevSlideMessage: 'Попередній відгук', nextSlideMessage: 'Наступний відгук' },
  });

  // Рух, що триває довше 5 секунд, має зупинятися кнопкою (вимога доступності)
  const pause = document.querySelector('[data-reviews-pause]');
  if (!reducedMotion) {
    pause.hidden = false;
    pause.addEventListener('click', () => {
      const paused = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? 'Далі' : 'Пауза';
      if (paused) swiper.autoplay.stop();
      else swiper.autoplay.start();
    });
  }
}

/* ---------- 5. Маніфест ---------- */
function initManifest() {
  const text = $('manifest');
  if (reducedMotion || !text) return;

  const words = text.textContent.trim().split(/\s+/);
  text.innerHTML = words.map((word) => `<span class="reveal-word">${escapeHTML(word)}</span>`).join(' ');
  const spans = [...text.children];

  // Частка «проявлених» слів залежить від того, наскільки абзац піднявся екраном
  const update = () => {
    const rect = text.getBoundingClientRect();
    const start = window.innerHeight * 0.9;
    const end = window.innerHeight * 0.35;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height * 0.6)));
    const visible = Math.round(progress * spans.length);
    spans.forEach((span, index) => span.classList.toggle('is-on', index < visible));
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

async function init() {
  initManifest();
  try {
    const data = await loadData();
    initFormula(data.builder);
    initHits(data.menu);
    initReceipt(data.builder);
    initReviews(data.reviews);
  } catch (error) {
    console.warn('Не вдалося завантажити дані:', error);
    renderLoadError($('hits'), () => location.reload());
  }
}

init();
