/**
 * Чиста логіка розрахунку ціни для конструктора напою.
 * Модуль не торкається DOM, тому його можна тестувати в Node (див. tests/pricing.test.js).
 */

const QUANTITY_PATTERN = /^\d{1,2}$/;
const PROMO_PATTERN = /^[A-Z0-9]{4,12}$/;

/** Форматує суму у гривнях: 1250 → «1 250 ₴». */
export function formatUAH(amount) {
  const rounded = Math.round(Number(amount) || 0);
  return `${rounded.toLocaleString('uk-UA').replace(/ /g, ' ')} ₴`;
}

/**
 * Перевіряє кількість чашок, введену користувачем.
 * Приймає рядок або число; повертає { value, error }.
 */
export function parseQuantity(raw, limits) {
  const { minQuantity = 1, maxQuantity = 10 } = limits ?? {};
  const text = String(raw ?? '').trim();

  if (text === '') return { value: null, error: 'Вкажіть кількість чашок.' };
  if (!QUANTITY_PATTERN.test(text)) {
    return { value: null, error: 'Кількість — це ціле число без літер і знаків.' };
  }
  const value = Number(text);
  if (value < minQuantity || value > maxQuantity) {
    return { value: null, error: `Можна замовити від ${minQuantity} до ${maxQuantity} чашок.` };
  }
  return { value, error: '' };
}

/** Нормалізує промокод: прибирає пробіли, переводить у верхній регістр. */
export function normalizePromo(raw) {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Застосовує промокод до суми.
 * Порожній код — не помилка (знижки просто немає).
 */
export function applyPromo(raw, promoCodes, subtotal) {
  const code = normalizePromo(raw);
  if (code === '') return { discount: 0, promo: null, error: '' };
  if (!PROMO_PATTERN.test(code)) {
    return { discount: 0, promo: null, error: 'Промокод складається з 4–12 латинських літер або цифр.' };
  }
  const promo = (promoCodes ?? []).find((p) => p.code === code);
  if (!promo) return { discount: 0, promo: null, error: 'Такого промокоду не існує.' };

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const discount = promo.type === 'percent'
    ? Math.round((safeSubtotal * promo.value) / 100)
    : Math.min(promo.value, safeSubtotal);

  return { discount, promo, error: '' };
}

const byId = (list, id) => (list ?? []).find((item) => item.id === id);

/**
 * Приводить вибір користувача до допустимого стану:
 * - для еспресо молоко прибирається;
 * - для напоїв на молоці «без молока» замінюється коров'ячим;
 * - сиропів не більше за ліміт, невідомі id відкидаються.
 * Повертає новий обʼєкт і список попереджень, які варто показати користувачу.
 */
export function normalizeSelection(config, selection) {
  const warnings = [];
  const base = byId(config.bases, selection.base) ?? config.bases[0];
  const size = byId(config.sizes, selection.size) ?? config.sizes[0];
  let milk = byId(config.milks, selection.milk) ?? config.milks[0];

  if (base.milk === false && milk.id !== 'none') {
    milk = byId(config.milks, 'none');
    warnings.push(`${base.name} готується без молока.`);
  }
  if (base.milk === true && milk.id === 'none') {
    milk = byId(config.milks, 'cow');
    warnings.push(`${base.name} не буває без молока — обрали коров'яче.`);
  }

  const maxSyrups = config.limits?.maxSyrups ?? 3;
  const knownSyrups = [...new Set(selection.syrups ?? [])].filter((id) => byId(config.syrups, id));
  if (knownSyrups.length > maxSyrups) warnings.push(`Максимум ${maxSyrups} сиропи в одному напої.`);
  const syrups = knownSyrups.slice(0, maxSyrups);

  const extras = [...new Set(selection.extras ?? [])].filter((id) => byId(config.extras, id));

  const maxSugar = config.limits?.maxSugar ?? 3;
  const sugarNumber = Number.parseInt(selection.sugar, 10);
  const sugar = Number.isNaN(sugarNumber) ? 0 : Math.min(Math.max(sugarNumber, 0), maxSugar);

  return {
    selection: { base: base.id, size: size.id, milk: milk.id, syrups, extras, sugar },
    warnings,
  };
}

/**
 * Головна функція: рахує ціну однієї чашки, підсумок, знижку і загальну суму.
 * Ціна основи й молока масштабується розміром чашки, сиропи й топінги — фіксовані.
 */
export function calculatePrice(config, rawSelection) {
  const { selection, warnings } = normalizeSelection(config, rawSelection);
  const base = byId(config.bases, selection.base);
  const size = byId(config.sizes, selection.size);
  const milk = byId(config.milks, selection.milk);

  const lines = [];
  const basePrice = Math.round(base.price * size.multiplier);
  // В еспресо обʼєм свій (40–80 мл), у решти напоїв — обʼєм обраного розміру
  const volume = base.volumes?.[size.id] ?? size.volume;
  lines.push({ label: `${base.name}, ${size.name} · ${volume} мл`, amount: basePrice });

  if (milk.id !== 'none') {
    lines.push({ label: `Молоко: ${milk.name.toLowerCase()}`, amount: Math.round(milk.price * size.multiplier) });
  }
  for (const id of selection.syrups) {
    const syrup = byId(config.syrups, id);
    lines.push({ label: `Сироп: ${syrup.name.toLowerCase()}`, amount: syrup.price });
  }
  for (const id of selection.extras) {
    const extra = byId(config.extras, id);
    lines.push({ label: extra.name, amount: extra.price });
  }

  const unitPrice = lines.reduce((sum, line) => sum + line.amount, 0);
  const quantity = parseQuantity(rawSelection.quantity ?? 1, config.limits);
  const subtotal = quantity.value ? unitPrice * quantity.value : 0;
  const promo = applyPromo(rawSelection.promo, config.promoCodes, subtotal);
  const total = Math.max(0, subtotal - promo.discount);

  const errors = {};
  if (quantity.error) errors.quantity = quantity.error;
  if (promo.error) errors.promo = promo.error;

  return {
    selection,
    lines,
    unitPrice,
    quantity: quantity.value,
    subtotal,
    discount: promo.discount,
    promo: promo.promo,
    total,
    warnings,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

/** Короткий текстовий опис напою для списку «Мої напої». */
export function describeDrink(config, selection) {
  const base = byId(config.bases, selection.base);
  const size = byId(config.sizes, selection.size);
  const milk = byId(config.milks, selection.milk);
  const parts = [`${base.name} ${size.name}`];
  if (milk && milk.id !== 'none') parts.push(milk.name.toLowerCase());
  for (const id of selection.syrups) parts.push(byId(config.syrups, id).name.toLowerCase());
  for (const id of selection.extras) parts.push(byId(config.extras, id).name.toLowerCase());
  if (selection.sugar > 0) parts.push(`цукор ×${selection.sugar}`);
  return parts.join(', ');
}
