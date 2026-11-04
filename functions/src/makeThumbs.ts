import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/https'
import sharp from 'sharp'
import { withLogging } from './observability.js'

/** Мають збігатися з web/src/lib/thumbs.ts. */
const THUMB_SIDE = 720
const THUMB_QUALITY = 86
const THUMB_DIR = 'products/small/'
/** Тут лежали перші мініатюри (480 px, видно розмитими) — прибираємо, коли зроблено нові. */
const OLD_DIR = 'products/thumbs/'
/** Скільки фото обробляємо одночасно — щоб не забрати всю пам’ять функції. */
const PARALLEL = 4

/**
 * Мініатюри для фото товарів, завантажених раніше (нові сайт робить сам): для кожного `products/<id>.webp`
 * без пари створює `products/small/<id>.webp`. Можна запускати скільки завгодно разів — готові пропускає.
 * Самі фото не змінює. Лише для продавця (кнопка «Мініатюри фото» в адмінці).
 */
export const makeThumbs = onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  withLogging('makeThumbs', async (request) => {
    if (request.auth?.token.role !== 'seller') throw new HttpsError('permission-denied', 'Sellers only')

    const bucket = getStorage().bucket()
    const [files] = await bucket.getFiles({ prefix: 'products/' })
    const names = new Set(files.map((f) => f.name))
    // Самі фото — лише ті, що лежать прямо в products/ (не в теках мініатюр)
    const originals = files.filter((f) => /^products\/[^/]+$/.test(f.name))
    const thumbName = (name: string) => name.replace(/^products\//, THUMB_DIR)
    const todo = originals.filter((f) => !names.has(thumbName(f.name)))

    let made = 0
    let failed = 0
    for (let i = 0; i < todo.length; i += PARALLEL) {
      await Promise.all(
        todo.slice(i, i + PARALLEL).map(async (file) => {
          try {
            const [original] = await file.download()
            const thumb = await sharp(original)
              .rotate()
              .resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: THUMB_QUALITY })
              .toBuffer()
            await bucket.file(thumbName(file.name)).save(thumb, {
              contentType: 'image/webp',
              metadata: { cacheControl: 'public, max-age=31536000, immutable' },
            })
            made++
          } catch {
            // Пошкоджений чи не-картинковий файл — пропускаємо, решта мініатюр усе одно буде
            failed++
          }
        }),
      )
    }
    // Старі мініатюри 480 px більше ніхто не показує
    await Promise.all(files.filter((f) => f.name.startsWith(OLD_DIR)).map((f) => f.delete().catch(() => undefined)))
    // Скільки всього фото товарів (без самих мініатюр) — щоб показати «готово для N фото»
    return { made, failed, photos: originals.length }
  }, (r) => r),
)
