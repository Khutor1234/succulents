/**
 * Мініатюри фото товарів: поруч із кожним фото `products/<id>.webp` лежить маленька копія `products/thumbs/<id>.webp`
 * (нові робить сайт при завантаженні, для старих — кнопка «Мініатюри фото» в адмінці).
 * Картки й списки показують мініатюру — у кілька разів легшу за фото 1200 px.
 */
export const THUMB_SIDE = 480

export const thumbPath = (path: string) => path.replace(/^products\//, 'products/thumbs/')

/**
 * Адреса мініатюри за адресою фото зі сховища Firebase. Мініатюри читаються всім (storage.rules),
 * тож ключ доступу (token) не потрібен. Фото не зі сховища (напр. тестові) — без змін.
 */
export function thumbUrl(url: string): string {
  const m = url.match(/^(.*\/o\/)products%2F([^/?%]+\.webp)\?/)
  return m ? `${m[1]}products%2Fthumbs%2F${m[2]}?alt=media` : url
}
