/**
 * Келих-«формула»: показує шари напою. Розмітка створюється один раз, далі змінюються лише
 * частки шарів (flex-grow = мілілітри) та кольори, а плавність дає CSS-перехід (.glass-layer в input.css).
 * Використовується в герої головної сторінки та в конструкторі.
 */
import { escapeHTML } from './data.js';

/** Місця під шари знизу вгору. Порожній шар має частку 0 і просто не займає місця. */
const SLOTS = ['syrup-1', 'syrup-2', 'syrup-3', 'coffee', 'water', 'milk', 'foam'];

const TOPPINGS_SVG = `
  <svg class="glass-toppings" viewBox="0 0 100 40" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <g data-topping="cream" class="hidden" stroke="#16130f" stroke-width="1.6" stroke-linejoin="round">
      <path d="M10 40c0-13 15-22 40-22s40 9 40 22z" fill="#fffdf6"/>
      <path d="M36 19c2-9 8-13 14-14 6 1 12 5 14 14" fill="#fffdf6"/>
    </g>
    <g data-topping="marshmallow" class="hidden" stroke="#16130f" stroke-width="1.6">
      <rect x="22" y="27" width="14" height="13" fill="#fbdfe6" transform="rotate(-8 29 33)"/>
      <rect x="62" y="26" width="14" height="13" fill="#fffdf6" transform="rotate(10 69 32)"/>
    </g>
    <g data-topping="chocolate" class="hidden" fill="#3b2014">
      <rect x="30" y="33" width="9" height="3" transform="rotate(-20 34 34)"/>
      <rect x="46" y="30" width="9" height="3" transform="rotate(14 50 31)"/>
      <rect x="60" y="34" width="9" height="3" transform="rotate(-8 64 35)"/>
    </g>
    <g data-topping="cinnamon" class="hidden" fill="#8a4b22">
      <circle cx="26" cy="37" r="1.4"/><circle cx="40" cy="35" r="1.4"/><circle cx="54" cy="37" r="1.4"/>
      <circle cx="68" cy="35" r="1.4"/><circle cx="78" cy="37.5" r="1.4"/><circle cx="47" cy="38" r="1.4"/>
    </g>
  </svg>`;

/**
 * Створює келих усередині root і повертає функцію оновлення.
 * @param {HTMLElement} root елемент із класом .glass
 * @returns {(formula: {layers: object[], fill: number, toppings: string[]}) => void}
 */
export function createGlass(root) {
  root.innerHTML = `
    <div class="glass-body">
      <div class="glass-fill" style="height: 0">
        ${SLOTS.map((id) => `<div class="glass-layer" data-layer="${id}"></div>`).join('')}
        ${TOPPINGS_SVG}
      </div>
    </div>
    <svg class="glass-outline" viewBox="0 0 100 125" preserveAspectRatio="none" aria-hidden="true">
      <path d="M6 0h88L82 125H18z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>`;

  const fill = root.querySelector('.glass-fill');
  const slots = new Map(SLOTS.map((id) => [id, root.querySelector(`[data-layer="${id}"]`)]));
  const toppingNodes = root.querySelectorAll('[data-topping]');

  return function update({ layers, fill: level, toppings }) {
    fill.style.height = `${(level * 100).toFixed(1)}%`;
    for (const [id, node] of slots) {
      const layer = layers.find((item) => item.id === id);
      node.style.flexGrow = layer ? String(layer.ml) : '0';
      if (layer) node.style.backgroundColor = layer.color;
    }
    toppingNodes.forEach((node) => node.classList.toggle('hidden', !toppings.includes(node.dataset.topping)));
  };
}

/** Легенда до келиха: шари згори донизу з кольором і обʼємом. */
export function legendHTML(layers) {
  return [...layers].reverse().map((layer) => `
    <li class="flex items-baseline gap-3">
      <span class="h-3 w-3 shrink-0 translate-y-0.5 border border-current" style="background: ${layer.color}"></span>
      <span>${escapeHTML(layer.label)}</span>
      <span class="min-w-4 flex-1 border-b border-dotted border-current opacity-40"></span>
      <span class="font-mono text-sm whitespace-nowrap">${layer.ml} мл</span>
    </li>`).join('');
}
