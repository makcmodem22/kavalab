/**
 * Конструктор напою — головний інтерактивний віджет сайту.
 * 1) Опції (основа, розмір, молоко, сиропи, топінги) приходять з data.json.
 * 2) На кожну зміну форми перераховується ціна (логіка — у pricing.js) і оновлюються шари в келиху
 *    (формула — у formula.js, сам келих — у glass.js).
 * 3) Готовий напій можна додати в замовлення або зберегти в «Мої напої» (localStorage).
 */
import { loadData, renderLoadError, escapeHTML } from './data.js';
import { calculatePrice, describeDrink, formatUAH, applyPromo } from './pricing.js';
import { buildLayers } from './formula.js';
import { createGlass, legendHTML } from './glass.js';

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
  cup: $('cup-visual'), drinkName: $('drink-name'), drinkVolume: $('drink-volume'),
  legend: $('formula-legend'), lines: $('price-lines'), warnings: $('warnings'),
  unit: $('price-unit'), subtotal: $('price-subtotal'), discountRow: $('discount-row'), discount: $('price-discount'), total: $('price-total'),
  addBtn: $('add-to-order'), favBtn: $('save-favorite'), status: $('builder-status'),
  orderList: $('order-list'), orderEmpty: $('order-empty'), orderTotal: $('order-total'), orderFooter: $('order-footer'),
  favList: $('favorites-list'), favEmpty: $('favorites-empty'),
  checkoutDialog: $('checkout-dialog'), checkoutSummary: $('checkout-summary'),
};

let config = null;
let appliedPromo = '';
let lastResult = null;
let updateGlass = null;

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
      <span class="font-bold">${escapeHTML(title)}</span>
      <span class="option-note">${sub}</span>
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

/* ---------- келих із шарами ---------- */
function renderGlass(selection) {
  const formula = buildLayers(config, selection);
  updateGlass(formula);
  el.legend.innerHTML = legendHTML(formula.layers);
  el.drinkVolume.textContent = `${formula.volume} мл`;
}

/* ---------- головний цикл: перерахунок ---------- */
function update() {
  const result = calculatePrice(config, readSelection());
  lastResult = result;
  syncForm(result.selection);
  renderGlass(result.selection);

  el.drinkName.textContent = describeDrink(config, result.selection);
  el.lines.innerHTML = result.lines.map((l) => `<li class="flex justify-between gap-4"><span>${escapeHTML(l.label)}</span><span class="shrink-0">${formatUAH(l.amount)}</span></li>`).join('');
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
    <li class="rule flex items-start justify-between gap-4 border-b py-4">
      <div>
        <p class="font-bold">${escapeHTML(line.title)}</p>
        <p class="muted font-mono text-sm">${line.quantity} × ${formatUAH(line.unitPrice)}${line.discount ? ` · знижка ${formatUAH(line.discount)}` : ''}</p>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <span class="font-mono font-bold">${formatUAH(line.total)}</span>
        <button type="button" class="btn-icon h-11 w-11 text-base" data-remove-line="${i}" aria-label="Видалити: ${escapeHTML(line.title)}">✕</button>
      </div>
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
    <li class="rule flex flex-wrap items-center justify-between gap-3 border-b py-4">
      <span class="min-w-0 flex-1 font-bold">${escapeHTML(describeDrink(config, calculatePrice(config, f).selection))}</span>
      <span class="flex gap-5">
        <button type="button" class="link" data-use-fav="${i}">Повторити</button>
        <button type="button" class="link muted" data-del-fav="${i}" aria-label="Видалити напій ${i + 1}">Видалити</button>
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
    $('builder-loading').remove();
    renderLoadError($('builder-error'), () => location.reload());
    return;
  }
  updateGlass = createGlass(el.cup);
  renderOptions(new URLSearchParams(location.search).get('base'));
  bindEvents();
  update();
  renderOrder();
  renderFavorites();
  // Форму показуємо вже заповненою — замість блоку «Завантажуємо…»
  $('builder-loading').remove();
  form.hidden = false;
}

init();
