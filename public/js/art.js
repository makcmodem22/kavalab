/**
 * Генерує SVG-ілюстрацію напою з параметрів у data.json (тип посуду та кольори).
 * Так не потрібні десятки окремих картинок: одна функція малює чашку, склянку, лід чи тарілку.
 */
const HEX = /^#[0-9a-f]{6}$/i;
const safe = (color, fallback) => (HEX.test(color ?? '') ? color : fallback);

export function drinkArt({ type = 'cup', liquid, foam } = {}, label = '') {
  const l = safe(liquid, '#6b3e26');
  const f = safe(foam, '#f3e4cf');
  const title = label ? `<title>${label.replace(/[<>&"]/g, '')}</title>` : '';
  const open = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" class="h-full w-full">${title}`;
  const steam = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".25"><path d="M85 34c-8-10 8-16 0-26"/><path d="M105 30c-8-10 8-16 0-26"/></g>`;

  switch (type) {
    case 'cup-small':
      return `${open}${steam}<ellipse cx="100" cy="132" rx="62" ry="12" fill="#000" opacity=".08"/><ellipse cx="100" cy="126" rx="56" ry="12" fill="#fffaf2"/><path d="M128 88c18 0 18 26 0 26" fill="none" stroke="#f2e6d6" stroke-width="8"/><path d="M68 70h64c0 34-10 52-32 52s-32-18-32-52z" fill="#fffaf2"/><ellipse cx="100" cy="70" rx="32" ry="8" fill="${f}"/><ellipse cx="100" cy="71" rx="26" ry="5" fill="${l}"/></svg>`;
    case 'glass':
      return `${open}${steam}<ellipse cx="100" cy="142" rx="44" ry="8" fill="#000" opacity=".08"/><path d="M70 40h60l-6 98H76z" fill="#ffffff" opacity=".55"/><path d="M73 78h54l-3 60H76z" fill="${l}"/><path d="M71.5 52h57l-1.5 26H73z" fill="${f}"/><path d="M70 40h60l-6 98H76z" fill="none" stroke="#d9c6ad" stroke-width="3"/></svg>`;
    case 'iced':
      return `${open}<ellipse cx="100" cy="142" rx="44" ry="8" fill="#000" opacity=".08"/><path d="M66 36h68l-8 102H74z" fill="#ffffff" opacity=".5"/><path d="M69 60h62l-6 78H75z" fill="${l}"/><path d="M69 60h62l-1 12H70z" fill="${f}" opacity=".9"/><g fill="#ffffff" opacity=".6"><rect x="80" y="66" width="18" height="16" rx="4" transform="rotate(-12 89 74)"/><rect x="102" y="80" width="18" height="16" rx="4" transform="rotate(10 111 88)"/><rect x="84" y="96" width="16" height="14" rx="4"/></g><rect x="112" y="18" width="6" height="70" rx="3" fill="#b86b2a" transform="rotate(12 115 50)"/><path d="M66 36h68l-8 102H74z" fill="none" stroke="#d9c6ad" stroke-width="3"/></svg>`;
    case 'plate':
      return `${open}<ellipse cx="100" cy="122" rx="78" ry="18" fill="#000" opacity=".08"/><ellipse cx="100" cy="116" rx="74" ry="18" fill="#fffaf2"/><ellipse cx="100" cy="114" rx="56" ry="12" fill="#efe1cd"/><path d="M58 108c6-30 30-46 50-44s32 18 34 44c-18-8-66-8-84 0z" fill="${l}"/><path d="M70 96c10-14 26-22 42-18M76 104c12-8 28-10 44-6" fill="none" stroke="${f}" stroke-width="5" stroke-linecap="round"/></svg>`;
    default:
      return `${open}${steam}<ellipse cx="100" cy="136" rx="74" ry="14" fill="#000" opacity=".08"/><ellipse cx="100" cy="130" rx="68" ry="14" fill="#fffaf2"/><path d="M140 70c24 0 24 36 0 36" fill="none" stroke="#f2e6d6" stroke-width="9"/><path d="M54 58h92c0 48-14 70-46 70S54 106 54 58z" fill="#fffaf2"/><ellipse cx="100" cy="58" rx="46" ry="11" fill="#fffaf2"/><ellipse cx="100" cy="59" rx="40" ry="8" fill="${l}"/><path d="M100 66c-10-5-14-9-13-12 1-4 8-4 13 1 5-5 12-5 13-1 1 3-3 7-13 12z" fill="${f}"/></svg>`;
  }
}
