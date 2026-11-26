/**
 * Конструктор напою — головний інтерактивний віджет сайту.
 * 1) Опції (основа, розмір, молоко, сиропи, топінги) приходять з data.json.
 * 2) На кожну зміну форми перераховується ціна (логіка — у pricing.js) і перемальовується чашка.
 * 3) Готовий напій можна додати в замовлення або зберегти в «Мої напої» (localStorage).
 */
import { loadData, renderLoadError, escapeHTML } from './data.js';
import { calculatePrice, describeDrink, formatUAH, applyPromo } from './pricing.js';

const ORDER_KEY = 'kavalab-order';
const FAVORITES_KEY = 'kavalab-favorites';
const MAX_FAVORITES = 6;
const MAX_ORDER_LINES = 20;

const form = document.getElementById('builder');
const $ = (id) => document.getElementById(id);
const el = {
  bases: $('opt-bases'), sizes: $('opt-sizes'), milks: $('opt-milks'), syrups: $('opt-syrups'), extras: $('opt-extras'),
  syrupHint: $('syrup-hint'), sugarOut: $('sugar-out'),
  quantity: $('quantity'), quantityError: $('quantity-error'),
  promo: $('promo'), promoError: $('promo-error'), promoOk: $('promo-ok'),
  cup: $('cup-visual'), drinkName: $('drink-name'), lines: $('price-lines'), warnings: $('warnings'),
  unit: $('price-unit'), subtotal: $('price-subtotal'), discountRow: $('discount-row'), discount: $('price-discount'), total: $('price-total'),
  addBtn: $('add-to-order'), favBtn: $('save-favorite'), status: $('builder-status'),
  orderList: $('order-list'), orderEmpty: $('order-empty'), orderTotal: $('order-total'), orderFooter: $('order-footer'),
  favList: $('favorites-list'), favEmpty: $('favorites-empty'),
  checkoutDialog: $('checkout-dialog'), checkoutSummary: $('checkout-summary'),
};

let config = null;
let appliedPromo = '';
let lastResult = null;

/* ---------- localStorage з перевіркою даних ---------- */
function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    announce('Не вдалося зберегти: сховище браузера недоступне.');
    return false;
  }
}

function announce(message) {
  el.status.textContent = message;
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => { el.status.textContent = ''; }, 4000);
}

/* ---------- рендер опцій ---------- */
const priceTag = (n) => (n > 0 ? `+${formatUAH(n)}` : 'безкоштовно');

function optionCard({ type, name, value, title, sub, checked }) {
  return `
    <label class="option-card">
      <input class="sr-only" type="${type}" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
      <span class="font-semibold">${escapeHTML(title)}</span>
      <span class="text-sm text-espresso/70 dark:text-latte/70">${sub}</span>
    </label>`;
}

function renderOptions(preselectBase) {
  const baseId = config.bases.some((b) => b.id === preselectBase) ? preselectBase : 'latte';
  el.bases.innerHTML = config.bases.map((b) => optionCard({
    type: 'radio', name: 'base', value: b.id, title: b.name, sub: `від ${formatUAH(b.price)} · ${escapeHTML(b.hint)}`, checked: b.id === baseId,
  })).join('');
  el.sizes.innerHTML = config.sizes.map((s, i) => optionCard({
    type: 'radio', name: 'size', value: s.id, title: `${s.name} · ${s.volume} мл`, sub: s.multiplier === 1 ? 'базова ціна' : `×${s.multiplier} до основи`, checked: i === 0,
  })).join('');
  el.milks.innerHTML = config.milks.map((m) => optionCard({
    type: 'radio', name: 'milk', value: m.id, title: m.name, sub: priceTag(m.price), checked: m.id === 'cow',
  })).join('');
  el.syrups.innerHTML = config.syrups.map((s) => optionCard({
    type: 'checkbox', name: 'syrups', value: s.id, title: s.name, sub: priceTag(s.price),
  })).join('');
  el.extras.innerHTML = config.extras.map((x) => optionCard({
    type: 'checkbox', name: 'extras', value: x.id, title: x.name, sub: priceTag(x.price),
  })).join('');
  el.syrupHint.textContent = `До ${config.limits.maxSyrups} сиропів`;
}

/* ---------- читання і застосування стану форми ---------- */
function readSelection() {
  const fd = new FormData(form);
  return {
    base: fd.get('base'),
    size: fd.get('size'),
    milk: fd.get('milk'),
    syrups: fd.getAll('syrups'),
    extras: fd.getAll('extras'),
    sugar: fd.get('sugar'),
    quantity: el.quantity.value,
    promo: appliedPromo,
  };
}

/** Синхронізує форму з нормалізованим вибором (наприклад, вимикає молоко для еспресо). */
function syncForm(selection) {
  const base = config.bases.find((b) => b.id === selection.base);
  form.querySelectorAll('input[name="milk"]').forEach((input) => {
    input.checked = input.value === selection.milk;
    input.disabled = (base.milk === false && input.value !== 'none') || (base.milk === true && input.value === 'none');
  });
  const maxReached = selection.syrups.length >= config.limits.maxSyrups;
  form.querySelectorAll('input[name="syrups"]').forEach((input) => {
    input.checked = selection.syrups.includes(input.value);
    input.disabled = maxReached && !input.checked;
  });
  el.syrupHint.textContent = maxReached
    ? `Обрано максимум — ${config.limits.maxSyrups} сиропи`
    : `До ${config.limits.maxSyrups} сиропів · обрано ${selection.syrups.length}`;
}

function setFieldError(input, errorEl, message) {
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorEl.textContent = message;
}

/* ---------- візуалізація чашки ---------- */
function mix(hexA, hexB, t) {
  const a = hexA.match(/\w\w/g).map((h) => parseInt(h, 16));
  const b = hexB.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function renderCup(selection) {
  const base = config.bases.find((b) => b.id === selection.base);
  const milk = config.milks.find((m) => m.id === selection.milk);
  const size = config.sizes.findIndex((s) => s.id === selection.size);
  const has = (id) => selection.extras.includes(id);

  const fill = [0.55, 0.7, 0.85][size] ?? 0.55;
  const top = 40, bottom = 230;
  const level = Math.round(bottom - (bottom - top) * fill);
  let coffee = base.color;
  if (has('shot')) coffee = mix(coffee, '#2b1a12', 0.25);
  const liquid = milk.color ? mix(coffee, milk.color, 0.15) : coffee;
  const foamH = milk.color && base.milk ? 22 : 0;

  const drops = selection.syrups.map((_, i) => `<circle cx="${92 + i * 18}" cy="${bottom - 16}" r="5" fill="#e0a15e" opacity=".85"/>`).join('');
  const cream = has('cream') ? `<path d="M60 ${level - foamH + 4}c0-22 22-30 50-30s50 8 50 30z" fill="#fffaf2"/><circle cx="110" cy="${level - foamH - 28}" r="14" fill="#fffaf2"/>` : '';
  const choco = has('chocolate') ? [0, 1, 2, 3, 4].map((i) => `<rect x="${78 + i * 15}" y="${level - foamH - 6 - (i % 2) * 6}" width="6" height="3" rx="1.5" fill="#4a2a18"/>`).join('') : '';
  const cinnamon = has('cinnamon') ? [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${80 + i * 12}" cy="${level - foamH + 6 + (i % 3) * 3}" r="1.6" fill="#8a4b22"/>`).join('') : '';
  const marsh = has('marshmallow') ? `<rect x="78" y="${level - foamH - 12}" width="16" height="14" rx="4" fill="#fde7ee"/><rect x="118" y="${level - foamH - 14}" width="16" height="14" rx="4" fill="#fff"/>` : '';

  el.cup.innerHTML = `
    <defs><clipPath id="glass"><path d="M46 30h128l-14 210H60z"/></clipPath></defs>
    <ellipse cx="110" cy="248" rx="70" ry="9" fill="currentColor" opacity=".12"/>
    <path d="M46 30h128l-14 210H60z" fill="#ffffff" opacity=".35"/>
    <g clip-path="url(#glass)">
      <rect x="40" y="${level}" width="140" height="${bottom - level + 20}" fill="${liquid}" style="transition:y .3s, fill .3s"/>
      ${foamH ? `<rect x="40" y="${level - foamH}" width="140" height="${foamH}" fill="${milk.color}"/>` : ''}
      ${drops}
    </g>
    ${cream}${choco}${cinnamon}${marsh}
    <path d="M46 30h128l-14 210H60z" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="3"/>
    <text x="110" y="${bottom - 40}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff8ee" opacity=".9">${config.sizes[size]?.name ?? ''}</text>`;
}

/* ---------- головний цикл: перерахунок ---------- */
function update() {
  const result = calculatePrice(config, readSelection());
  lastResult = result;
  syncForm(result.selection);
  renderCup(result.selection);

  el.drinkName.textContent = describeDrink(config, result.selection);
  el.lines.innerHTML = result.lines.map((l) => `<li class="flex justify-between gap-4"><span>${escapeHTML(l.label)}</span><span class="shrink-0 tabular-nums">${l.amount ? formatUAH(l.amount) : '0 ₴'}</span></li>`).join('');
  el.warnings.textContent = result.warnings.join(' ');
  el.unit.textContent = formatUAH(result.unitPrice);
  el.subtotal.textContent = result.quantity ? `${formatUAH(result.subtotal)} (${result.quantity} шт.)` : '—';
  el.discountRow.hidden = result.discount === 0;
  el.discount.textContent = `−${formatUAH(result.discount)}`;
  el.total.textContent = result.quantity ? formatUAH(result.total) : '—';
  $('mobile-total').textContent = el.total.textContent;
  el.sugarOut.textContent = result.selection.sugar ? `${result.selection.sugar} ч. л.` : 'без цукру';

  setFieldError(el.quantity, el.quantityError, result.errors.quantity ?? '');
  el.addBtn.disabled = !result.isValid;
}

/* ---------- кількість і промокод ---------- */
function stepQuantity(delta) {
  const { minQuantity, maxQuantity } = config.limits;
  const current = Number.parseInt(el.quantity.value, 10);
  const next = Number.isNaN(current) ? minQuantity : Math.min(maxQuantity, Math.max(minQuantity, current + delta));
  el.quantity.value = String(next);
  update();
}

function applyPromoFromField() {
  const raw = el.promo.value;
  const subtotal = lastResult?.subtotal ?? 0;
  const { promo, error } = applyPromo(raw, config.promoCodes, subtotal);
  setFieldError(el.promo, el.promoError, error);
  appliedPromo = error ? '' : raw;
  el.promoOk.textContent = promo ? `Застосовано: ${promo.label}` : '';
  update();
}

/* ---------- замовлення ---------- */
function renderOrder() {
  const order = readList(ORDER_KEY);
  el.orderEmpty.hidden = order.length > 0;
  el.orderFooter.hidden = order.length === 0;
  el.orderList.innerHTML = order.map((line, i) => `
    <li class="flex items-start justify-between gap-4 py-3">
      <div><p class="font-semibold">${escapeHTML(line.title)}</p><p class="text-sm text-espresso/70 dark:text-latte/70">${line.quantity} × ${formatUAH(line.unitPrice)}${line.discount ? ` · знижка ${formatUAH(line.discount)}` : ''}</p></div>
      <div class="flex shrink-0 items-center gap-2"><span class="font-bold tabular-nums">${formatUAH(line.total)}</span>
        <button type="button" class="rounded-full p-2 hover:bg-espresso/10 dark:hover:bg-latte/10" data-remove-line="${i}" aria-label="Видалити: ${escapeHTML(line.title)}">✕</button></div>
    </li>`).join('');
  const sum = order.reduce((s, l) => s + (Number(l.total) || 0), 0);
  el.orderTotal.textContent = formatUAH(sum);
}

function addToOrder() {
  if (!lastResult?.isValid) return;
  const order = readList(ORDER_KEY);
  if (order.length >= MAX_ORDER_LINES) {
    announce(`У замовленні вже ${MAX_ORDER_LINES} позицій — оформіть або очистіть його.`);
    return;
  }
  order.push({
    title: describeDrink(config, lastResult.selection),
    quantity: lastResult.quantity,
    unitPrice: lastResult.unitPrice,
    discount: lastResult.discount,
    total: lastResult.total,
  });
  if (writeList(ORDER_KEY, order)) {
    renderOrder();
    announce('Напій додано до замовлення.');
  }
}

/* ---------- «Мої напої» ---------- */
function renderFavorites() {
  const favs = readList(FAVORITES_KEY);
  el.favEmpty.hidden = favs.length > 0;
  el.favList.innerHTML = favs.map((f, i) => `
    <li class="flex flex-wrap items-center justify-between gap-3 py-3">
      <span class="min-w-0 flex-1">${escapeHTML(describeDrink(config, calculatePrice(config, f).selection))}</span>
      <span class="flex gap-2">
        <button type="button" class="chip py-1.5" data-use-fav="${i}">Повторити</button>
        <button type="button" class="chip py-1.5" data-del-fav="${i}" aria-label="Видалити напій ${i + 1}">Видалити</button>
      </span>
    </li>`).join('');
}

function saveFavorite() {
  const favs = readList(FAVORITES_KEY);
  const sel = lastResult.selection;
  const key = JSON.stringify(sel);
  if (favs.some((f) => JSON.stringify(calculatePrice(config, f).selection) === key)) {
    announce('Такий напій уже є у «Моїх напоях».');
    return;
  }
  favs.unshift(sel);
  if (writeList(FAVORITES_KEY, favs.slice(0, MAX_FAVORITES))) {
    renderFavorites();
    announce('Збережено в «Мої напої».');
  }
}

function useFavorite(index) {
  const fav = readList(FAVORITES_KEY)[index];
  if (!fav) return;
  const { selection } = calculatePrice(config, fav);
  const set = (name, value) => {
    form.querySelectorAll(`input[name="${name}"]`).forEach((i) => { i.checked = i.value === value; });
  };
  set('base', selection.base);
  set('size', selection.size);
  set('milk', selection.milk);
  form.querySelectorAll('input[name="syrups"]').forEach((i) => { i.disabled = false; i.checked = selection.syrups.includes(i.value); });
  form.querySelectorAll('input[name="extras"]').forEach((i) => { i.checked = selection.extras.includes(i.value); });
  form.elements.sugar.value = String(selection.sugar);
  update();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  announce('Напій відновлено в конструкторі.');
}

/* ---------- події ---------- */
function bindEvents() {
  form.addEventListener('change', update);
  form.addEventListener('input', (e) => { if (e.target === el.quantity || e.target.name === 'sugar') update(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); addToOrder(); });
  $('qty-minus').addEventListener('click', () => stepQuantity(-1));
  $('qty-plus').addEventListener('click', () => stepQuantity(1));
  $('promo-apply').addEventListener('click', applyPromoFromField);
  el.promo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromoFromField(); } });
  el.promo.addEventListener('input', () => {
    if (appliedPromo) { appliedPromo = ''; el.promoOk.textContent = ''; update(); }
    setFieldError(el.promo, el.promoError, '');
  });
  el.favBtn.addEventListener('click', saveFavorite);

  el.orderList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-line]');
    if (!btn) return;
    const order = readList(ORDER_KEY);
    order.splice(Number(btn.dataset.removeLine), 1);
    writeList(ORDER_KEY, order);
    renderOrder();
    announce('Позицію видалено.');
  });
  $('order-clear').addEventListener('click', () => { writeList(ORDER_KEY, []); renderOrder(); announce('Замовлення очищено.'); });
  $('order-checkout').addEventListener('click', () => {
    const order = readList(ORDER_KEY);
    el.checkoutSummary.textContent = `${order.length} поз. на суму ${el.orderTotal.textContent}`;
    el.checkoutDialog.showModal();
  });
  el.checkoutDialog.addEventListener('close', () => {
    if (el.checkoutDialog.returnValue === 'confirm') {
      writeList(ORDER_KEY, []);
      renderOrder();
      announce('Дякуємо! Це демо — замовлення не надсилається, але бариста вже уявив вашу каву.');
    }
  });

  el.favList.addEventListener('click', (e) => {
    const use = e.target.closest('[data-use-fav]');
    const del = e.target.closest('[data-del-fav]');
    if (use) useFavorite(Number(use.dataset.useFav));
    if (del) {
      const favs = readList(FAVORITES_KEY);
      favs.splice(Number(del.dataset.delFav), 1);
      writeList(FAVORITES_KEY, favs);
      renderFavorites();
    }
  });
}

async function init() {
  try {
    config = (await loadData()).builder;
  } catch (error) {
    console.warn('Не вдалося завантажити конструктор:', error);
    form.hidden = true;
    renderLoadError($('builder-error'), () => location.reload());
    return;
  }
  renderOptions(new URLSearchParams(location.search).get('base'));
  bindEvents();
  update();
  renderOrder();
  renderFavorites();
}

init();
