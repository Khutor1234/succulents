import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/https'
import sharp from 'sharp'
import { withLogging } from './observability.js'

/** Має збігатися з THUMB_SIDE у web/src/lib/thumbs.ts. */
const THUMB_SIDE = 480
/** Скільки фото обробляємо одночасно — щоб не забрати всю пам’ять функції. */
const PARALLEL = 4

/**
 * Мініатюри для фото товарів, завантажених раніше (нові сайт робить сам): для кожного `products/<id>.webp`
 * без пари створює `products/thumbs/<id>.webp`. Можна запускати скільки завгодно разів — готові пропускає.
 * Лише для продавця (кнопка «Мініатюри фото» в адмінці).
 */
export const makeThumbs = onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  withLogging('makeThumbs', async (request) => {
    if (request.auth?.token.role !== 'seller') throw new HttpsError('permission-denied', 'Sellers only')

    const bucket = getStorage().bucket()
    const [files] = await bucket.getFiles({ prefix: 'products/' })
    const names = new Set(files.map((f) => f.name))
    const todo = files.filter(
      (f) => !f.name.startsWith('products/thumbs/') && !names.has(f.name.replace(/^products\//, 'products/thumbs/')),
    )

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
              .webp({ quality: 80 })
              .toBuffer()
            await bucket.file(file.name.replace(/^products\//, 'products/thumbs/')).save(thumb, {
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
    // Скільки всього фото товарів (без самих мініатюр) — щоб показати «готово для N фото»
    const photos = files.filter((f) => !f.name.startsWith('products/thumbs/')).length
    return { made, failed, photos }
  }, (r) => r),
)
