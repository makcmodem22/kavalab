/**
 * Меню: каталог з data.json, фільтрація за категорією, ціною, пошуком і «веган»,
 * сортування, синхронізація фільтрів з адресою сторінки та модальне вікно з деталями.
 */
import { loadData, renderLoadError, escapeHTML } from './data.js';
import { drinkArt } from './art.js';
import { formatUAH } from './pricing.js';

const form = document.getElementById('menu-filters');
const grid = document.getElementById('menu-grid');
const countEl = document.getElementById('menu-count');
const categoriesEl = document.getElementById('menu-categories');
const priceInput = document.getElementById('f-price');
const priceOut = document.getElementById('f-price-out');
const dialog = document.getElementById('item-dialog');

const TAG_LABELS = { hit: 'Хіт', new: 'Новинка' };
const state = { category: 'all', query: '', maxPrice: 200, vegan: false, sort: 'popular' };
let data = null;

function readStateFromURL() {
  const params = new URLSearchParams(location.search);
  const cat = params.get('cat');
  if (cat && data.categories.some((c) => c.id === cat)) state.category = cat;
}

function syncURL() {
  const url = new URL(location.href);
  if (state.category === 'all') url.searchParams.delete('cat');
  else url.searchParams.set('cat', state.category);
  history.replaceState(null, '', url);
}

function renderCategories() {
  const all = [{ id: 'all', name: 'Усе меню' }, ...data.categories];
  categoriesEl.innerHTML = all.map((c) => `
    <button type="button" class="tab" data-cat="${c.id}" aria-pressed="${state.category === c.id}">${escapeHTML(c.name)}</button>`).join('');
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  const list = data.menu.filter((item) =>
    (state.category === 'all' || item.category === state.category)
    && item.price <= state.maxPrice
    && (!state.vegan || item.vegan)
    && (!q || `${item.name} ${item.description}`.toLowerCase().includes(q)));

  const sorters = {
    popular: (a, b) => Number(b.tags.includes('hit')) - Number(a.tags.includes('hit')),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name, 'uk'),
  };
  return list.sort(sorters[state.sort] ?? sorters.popular);
}

const TAG_CLASSES = { hit: 'tag tag-hit', new: 'tag tag-new' };

function card(item) {
  const tags = [
    ...item.tags.map((tag) => `<span class="${TAG_CLASSES[tag] ?? 'tag'}">${TAG_LABELS[tag]}</span>`),
    item.vegan ? '<span class="tag">Веган</span>' : '',
  ].join('');
  return `
    <li class="menu-card">
      <div class="art-box relative aspect-[4/3] overflow-hidden p-6">
        ${drinkArt(item.art, item.name)}
        <div class="absolute top-4 left-4 flex flex-wrap gap-1.5">${tags}</div>
      </div>
      <div class="flex flex-1 flex-col p-5 sm:p-6">
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="display-3">${escapeHTML(item.name)}</h2>
          <p class="shrink-0 font-mono text-lg font-bold">${formatUAH(item.price)}</p>
        </div>
        <p class="spec muted mt-2">${escapeHTML(item.volume)}</p>
        <p class="muted mt-3 line-clamp-2 flex-1">${escapeHTML(item.description)}</p>
        <button type="button" class="link mt-5 self-start" data-details="${item.id}">
          Детальніше<span class="sr-only"> про ${escapeHTML(item.name)}</span> <span class="arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </li>`;
}

function render() {
  const items = filtered();
  grid.innerHTML = items.length
    ? items.map(card).join('')
    : `<li class="menu-card col-span-full items-start p-8">
        <p class="display-3">Нічого не знайшли</p>
        <p class="muted mt-2">Спробуйте змінити фільтри.</p>
        <button type="button" class="btn-primary mt-5" data-reset>Скинути фільтри</button>
      </li>`;
  countEl.textContent = `Знайдено позицій: ${items.length}`;
  categoriesEl.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.category)));
  priceOut.textContent = formatUAH(state.maxPrice);
  syncURL();
}

function resetFilters() {
  Object.assign(state, { category: 'all', query: '', maxPrice: Number(priceInput.max), vegan: false, sort: 'popular' });
  form.reset();
  priceInput.value = priceInput.max;
  render();
}

function openDetails(id) {
  const item = data.menu.find((m) => m.id === id);
  if (!item) return;
  const canBuild = data.builder.bases.some((b) => b.id === item.id);
  dialog.querySelector('[data-dialog-art]').innerHTML = drinkArt(item.art, item.name);
  dialog.querySelector('[data-dialog-title]').textContent = item.name;
  dialog.querySelector('[data-dialog-meta]').textContent = `${item.volume} · ${formatUAH(item.price)}${item.vegan ? ' · веган' : ''}`;
  dialog.querySelector('[data-dialog-text]').textContent = item.description;
  const link = dialog.querySelector('[data-dialog-build]');
  link.hidden = !canBuild;
  link.href = `constructor.html?base=${encodeURIComponent(item.id)}`;
  dialog.showModal();
}

function bindEvents() {
  categoriesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.category = btn.dataset.cat;
    render();
  });
  form.addEventListener('input', () => {
    state.query = form.elements.q.value;
    state.maxPrice = Number(priceInput.value);
    state.vegan = form.elements.vegan.checked;
    state.sort = form.elements.sort.value;
    render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) resetFilters();
    const details = e.target.closest('[data-details]');
    if (details) openDetails(details.dataset.details);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-dialog-close]')) dialog.close();
  });
}

async function init() {
  try {
    data = await loadData();
  } catch (error) {
    console.warn('Не вдалося завантажити меню:', error);
    countEl.textContent = '';
    renderLoadError(grid, init);
    return;
  }
  const max = Math.max(...data.menu.map((m) => m.price));
  priceInput.max = String(max);
  priceInput.value = String(max);
  state.maxPrice = max;
  readStateFromURL();
  renderCategories();
  render();
}

bindEvents();
init();
