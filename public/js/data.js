/**
 * Асинхронне завантаження mock-даних з data/data.json (fetch + async/await).
 * Результат кешується, щоб кілька модулів на сторінці не робили повторних запитів.
 */
let cache = null;

export async function loadData() {
  if (cache) return cache;
  cache = (async () => {
    const response = await fetch('data/data.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Сервер відповів ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.menu) || !data.builder) throw new Error('Некоректна структура даних');
    return data;
  })();
  try {
    return await cache;
  } catch (error) {
    cache = null; // дозволяємо повторити спробу
    throw error;
  }
}

/** Повідомлення про помилку з кнопкою «Спробувати ще», яке вставляється замість контенту. */
export function renderLoadError(container, onRetry) {
  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'card col-span-full p-6 text-center';
  box.setAttribute('role', 'alert');
  box.innerHTML = `
    <p class="font-display text-xl font-semibold">Не вдалося завантажити дані</p>
    <p class="mt-2 text-espresso/80 dark:text-latte/80">Перевірте інтернет-зʼєднання та спробуйте ще раз.</p>`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-primary mt-4';
  button.textContent = 'Спробувати ще';
  button.addEventListener('click', onRetry);
  box.append(button);
  container.append(box);
}

/** Екранує текст перед вставкою в innerHTML (захист від XSS, якщо дані колись прийдуть з API). */
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
