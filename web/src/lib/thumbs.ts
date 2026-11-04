/**
 * Мініатюри фото товарів: поруч із кожним фото `products/<id>.webp` лежить менша копія `products/small/<id>.webp`
 * (нові робить сайт при завантаженні, для старих — кнопка «Мініатюри фото» в адмінці).
 * Картки й списки показують мініатюру — у кілька разів легшу за фото 1200 px.
 * 720 px — щоб на телефоні й чіткому екрані картка була така ж різка, як фото (480 px було видно розмитим).
 * Перші мініатюри (480 px) лежали в `products/thumbs/` — нова тека, щоб браузери не тримали в пам'яті старі.
 */
export const THUMB_SIDE = 720
/** Якість WebP мініатюри (0…1). Має збігатися з functions/src/makeThumbs.ts. */
export const THUMB_QUALITY = 0.86

export const thumbPath = (path: string) => path.replace(/^products\//, 'products/small/')

/**
 * Адреса мініатюри за адресою фото зі сховища Firebase. Мініатюри читаються всім (storage.rules),
 * тож ключ доступу (token) не потрібен. Фото не зі сховища (напр. тестові) — без змін.
 */
export function thumbUrl(url: string): string {
  const m = url.match(/^(.*\/o\/)products%2F([^/?%]+\.webp)\?/)
  return m ? `${m[1]}products%2Fsmall%2F${m[2]}?alt=media` : url
}
