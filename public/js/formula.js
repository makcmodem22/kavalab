/**
 * «Формула» напою: з вибору в конструкторі рахує шари для келиха — що налито і скільки мілілітрів.
 * Чисті функції без DOM, тому перевіряються юніт-тестами (tests/formula.test.js).
 */
const SYRUP_ML = 15;
const SHOT_ML = 30;
const STEP_ML = 5;
const MAX_FILL = 0.92; // найбільший напій займає 92% висоти келиха
const MIN_FILL = 0.14; // щоб еспресо на 40 мл було видно

/** Порядок шарів знизу вгору та їхні підписи й кольори. */
const INGREDIENTS = [
  { id: 'coffee', label: 'Еспресо', color: '#3b2014' },
  { id: 'water', label: 'Гаряча вода', color: '#b9cdd3' },
  { id: 'milk', label: 'Молоко', color: '#f3e4cf' },
  { id: 'foam', label: 'Молочна піна', color: '#fffaf0' },
];
const TOPPINGS = ['cream', 'marshmallow', 'chocolate', 'cinnamon'];

const roundToStep = (value) => Math.round(value / STEP_ML) * STEP_ML;

/**
 * @param {object} config    розділ builder з data.json
 * @param {object} selection нормалізований вибір (base, size, milk, syrups, extras)
 * @returns {{ layers: {id: string, label: string, ml: number, color: string}[], volume: number, fill: number, toppings: string[] }}
 */
export function buildLayers(config, selection) {
  const base = config.bases.find((item) => item.id === selection.base);
  const size = config.sizes.find((item) => item.id === selection.size);
  if (!base || !size) return { layers: [], volume: 0, fill: 0, toppings: [] };

  const milk = config.milks.find((item) => item.id === selection.milk);
  const hasMilk = Boolean(milk?.color);
  const extras = selection.extras ?? [];

  const syrups = (selection.syrups ?? [])
    .map((id) => config.syrups.find((item) => item.id === id))
    .filter(Boolean)
    .map((syrup, index) => ({
      id: `syrup-${index + 1}`,
      label: `Сироп: ${syrup.name.toLowerCase()}`,
      ml: SYRUP_ML,
      color: syrup.color,
    }));

  // Обʼєм напою: в еспресо він свій (40–80 мл), у решти — обʼєм обраного розміру
  const extraShot = extras.includes('shot') ? SHOT_ML : 0;
  const volume = base.volumes ? base.volumes[size.id] + extraShot : size.volume;

  // Частки рецепта. Без молока шари «молоко» й «піна» зникають, а їхнє місце ділять інші.
  const parts = INGREDIENTS
    .filter((item) => base.recipe[item.id] && (hasMilk || (item.id !== 'milk' && item.id !== 'foam')))
    .map((item) => ({ ...item, share: base.recipe[item.id] }));
  const totalShare = parts.reduce((sum, part) => sum + part.share, 0);
  const liquid = volume - syrups.length * SYRUP_ML - extraShot;

  const main = parts.map((part) => ({
    id: part.id,
    label: part.id === 'milk' ? `Молоко: ${milk.name.toLowerCase()}` : part.label,
    ml: roundToStep((liquid * part.share) / totalShare) + (part.id === 'coffee' ? extraShot : 0),
    color: part.id === 'milk' ? milk.color : part.color,
  }));

  // Після округлення до 5 мл сума може не зійтися з обʼємом — різницю віддаємо найбільшому шару
  const layers = [...syrups, ...main];
  const difference = volume - layers.reduce((sum, layer) => sum + layer.ml, 0);
  if (difference !== 0 && main.length > 0) {
    main.reduce((largest, layer) => (layer.ml > largest.ml ? layer : largest)).ml += difference;
  }

  const maxVolume = Math.max(...config.sizes.map((item) => item.volume));
  return {
    layers,
    volume,
    fill: Math.max(MIN_FILL, (volume / maxVolume) * MAX_FILL),
    toppings: TOPPINGS.filter((id) => extras.includes(id)),
  };
}
