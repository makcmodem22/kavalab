/** Головна: хіти меню та карусель відгуків (дані з data.json, карусель — Swiper з CDN). */
import { loadData, renderLoadError, escapeHTML } from './data.js';
import { drinkArt } from './art.js';
import { formatUAH } from './pricing.js';

const hitsEl = document.getElementById('hits');
const reviewsEl = document.getElementById('reviews-track');

function renderHits(menu) {
  const hits = menu.filter((item) => item.tags.includes('hit')).slice(0, 3);
  hitsEl.innerHTML = hits.map((item) => `
    <li class="card flex flex-col overflow-hidden">
      <div class="aspect-[5/4] bg-latte/60 p-6 text-espresso dark:bg-roast-3 dark:text-latte">${drinkArt(item.art, item.name)}</div>
      <div class="flex flex-1 flex-col gap-2 p-6">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="text-xl font-semibold">${escapeHTML(item.name)}</h3>
          <p class="shrink-0 font-bold">${formatUAH(item.price)}</p>
        </div>
        <p class="text-espresso/80 dark:text-latte/80">${escapeHTML(item.description)}</p>
      </div>
    </li>`).join('');
}

const stars = (n) => `<span aria-label="Оцінка ${n} з 5" role="img">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

function renderReviews(reviews) {
  reviewsEl.innerHTML = reviews.map((r) => `
    <div class="swiper-slide !h-auto">
      <figure class="card flex h-full flex-col gap-4 p-6">
        <p class="text-lg text-caramel dark:text-caramel-light">${stars(r.rating)}</p>
        <blockquote class="flex-1 text-lg leading-relaxed">«${escapeHTML(r.text)}»</blockquote>
        <figcaption><span class="font-bold">${escapeHTML(r.name)}</span><span class="block text-sm text-espresso/70 dark:text-latte/70">${escapeHTML(r.role)}</span></figcaption>
      </figure>
    </div>`).join('');

  // Swiper підключено з CDN. Якщо скрипт не завантажився — відгуки лишаються горизонтальним списком зі скролом.
  if (typeof window.Swiper === 'function') {
    new window.Swiper('#reviews', {
      slidesPerView: 1.1,
      spaceBetween: 16,
      grabCursor: true,
      a11y: { prevSlideMessage: 'Попередній відгук', nextSlideMessage: 'Наступний відгук', paginationBulletMessage: 'Перейти до відгуку {{index}}' },
      keyboard: { enabled: true },
      pagination: { el: '#reviews .swiper-pagination', clickable: true },
      navigation: { nextEl: '[data-reviews-next]', prevEl: '[data-reviews-prev]' },
      breakpoints: { 640: { slidesPerView: 2, spaceBetween: 20 }, 1024: { slidesPerView: 3, spaceBetween: 24 } },
    });
  } else {
    reviewsEl.classList.add('flex', 'gap-4', 'overflow-x-auto', 'snap-x');
    reviewsEl.querySelectorAll('.swiper-slide').forEach((s) => s.classList.add('w-80', 'shrink-0', 'snap-start'));
    document.querySelectorAll('[data-reviews-next],[data-reviews-prev]').forEach((b) => { b.hidden = true; });
  }
}

async function init() {
  try {
    const data = await loadData();
    renderHits(data.menu);
    renderReviews(data.reviews);
  } catch (error) {
    console.warn('Не вдалося завантажити дані:', error);
    renderLoadError(hitsEl, init);
  }
}

init();
