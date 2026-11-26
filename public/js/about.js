/** Про нас: галерея інтер'єру — карусель Swiper + перегляд у збільшеному форматі через GLightbox (обидві з CDN). */
if (typeof window.Swiper === 'function') {
  new window.Swiper('#gallery', {
    slidesPerView: 1.15,
    spaceBetween: 16,
    keyboard: { enabled: true },
    a11y: { prevSlideMessage: 'Попереднє фото', nextSlideMessage: 'Наступне фото', paginationBulletMessage: 'Перейти до фото {{index}}' },
    pagination: { el: '#gallery .swiper-pagination', clickable: true },
    navigation: { nextEl: '[data-gallery-next]', prevEl: '[data-gallery-prev]' },
    breakpoints: { 768: { slidesPerView: 2.2, spaceBetween: 24 } },
  });
} else {
  document.querySelectorAll('[data-gallery-next],[data-gallery-prev]').forEach((b) => { b.hidden = true; });
  document.querySelector('#gallery .swiper-wrapper')?.classList.add('grid', 'gap-4', 'sm:grid-cols-2');
}

// Без GLightbox посилання просто відкриють зображення в новій вкладці
if (typeof window.GLightbox === 'function') {
  window.GLightbox({ selector: '.glightbox', touchNavigation: true, loop: true });
}
