/**
 * Ілюстрації до позицій меню. Замість десятків окремих картинок — один генератор SVG:
 * тип (чашка, склянка, десерт) і кольори приходять з data.json (поле art).
 * Стиль плакатний: плоскі заливки й товстий контур кольору тексту (currentColor),
 * тому ілюстрації однаково добре виглядають у світлій і темній темах.
 */
const HEX = /^#[0-9a-f]{6}$/i;
const safeColor = (color, fallback) => (HEX.test(color ?? '') ? color : fallback);

const LINE = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
const THIN = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"';
const VESSEL_FILL = '#fffdf6';

const steam = `<path d="M88 46c-7-9 7-15 0-24M112 42c-7-9 7-15 0-24" ${LINE} opacity=".4"/>`;

let clipCount = 0; // унікальні id для clipPath, коли на сторінці багато ілюстрацій

/**
 * Посудина у розрізі з двома шарами: напій і піна над ним.
 * @param {string} shape  контур посудини (атрибут d)
 * @param {number} surface висота верхнього краю піни
 * @param {number} split   висота межі між піною та напоєм
 */
function vessel(shape, surface, split, liquid, foam) {
  const id = `art-clip-${++clipCount}`;
  return `
    <clipPath id="${id}"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="${VESSEL_FILL}"/>
    <g clip-path="url(#${id})">
      <rect y="${split}" width="200" height="200" fill="${liquid}"/>
      <rect y="${surface}" width="200" height="${split - surface}" fill="${foam}"/>
      <path d="M0 ${surface}h200M0 ${split}h200" ${THIN}/>
    </g>
    <path d="${shape}" ${LINE}/>`;
}

const plate = `<path d="M30 164h140" ${LINE}/>`;

/** Кожен тип — функція, що повертає вміст SVG. liquid — основний колір, foam — другий. */
const DRAW = {
  cup: (liquid, foam) => `
    ${steam}
    <path d="M152 98c30-3 30 36-8 40" ${LINE}/>
    ${vessel('M44 82h112c0 46-20 80-56 80S44 128 44 82z', 82, 102, liquid, foam)}
    <path d="M34 176h132" ${LINE}/>`,

  'cup-small': (liquid, foam) => `
    ${steam}
    <path d="M134 110c20-2 20 26-6 28" ${LINE}/>
    ${vessel('M62 98h76c0 32-13 58-38 58s-38-26-38-58z', 98, 110, liquid, foam)}
    <path d="M48 170h104" ${LINE}/>`,

  glass: (liquid, foam) => `
    ${steam}
    ${vessel('M60 56h80l-9 116H69z', 70, 98, liquid, foam)}`,

  iced: (liquid, foam) => `
    <path d="M126 14 108 150" fill="none" stroke="#e5432a" stroke-width="7" stroke-linecap="round"/>
    ${vessel('M58 42h84l-10 130H68z', 60, 74, liquid, foam)}
    <g fill="${VESSEL_FILL}" fill-opacity=".75" stroke="currentColor" stroke-width="3" stroke-linejoin="round">
      <rect x="76" y="84" width="24" height="24" transform="rotate(-10 88 96)"/>
      <rect x="102" y="104" width="22" height="22" transform="rotate(12 113 115)"/>
      <rect x="80" y="126" width="22" height="22" transform="rotate(-4 91 137)"/>
    </g>`,

  croissant: (liquid, foam) => `
    <path d="M36 150c4-44 34-76 64-76s60 32 64 76c-20-16-38-24-64-24s-44 8-64 24z" fill="${liquid}" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M74 84 62 132M100 76v50M126 84l12 48" fill="none" stroke="${foam}" stroke-width="5" stroke-linecap="round"/>
    ${plate}`,

  slice: (liquid, foam) => `
    <path d="M42 152h116V92L42 118z" fill="${foam}" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M42 118 158 92V76L42 102z" fill="${liquid}" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    ${plate}`,

  brownie: (liquid, foam) => `
    <path d="M56 88h88v64H56z" fill="${liquid}" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <path d="M56 88h88v18c-12 8-20-6-32 2s-18-8-30 0-18-4-26 0z" fill="${foam}" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    ${plate}`,
};

/**
 * @param {{type?: string, liquid?: string, foam?: string}} art параметри з data.json
 * @param {string} label назва для скринрідерів
 * @returns {string} розмітка SVG
 */
export function drinkArt({ type, liquid, foam } = {}, label = '') {
  const draw = DRAW[type] ?? DRAW.cup;
  const title = label ? `<title>${label.replace(/[<>&"]/g, '')}</title>` : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" class="h-full w-full">${title}${draw(safeColor(liquid, '#6b3e26'), safeColor(foam, '#f3e4cf'))}</svg>`;
}
