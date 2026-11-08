import { randomUUID } from 'node:crypto'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/https'
import sharp from 'sharp'
import { z } from 'zod'
import { withLogging } from './observability.js'

/** Мають збігатися з web/src/lib/thumbs.ts і imageUpload.ts. */
const THUMB_SIDE = 720
const THUMB_QUALITY = 86
const PHOTO_QUALITY = 85
const SAVE_META = { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }

const input = z.object({ url: z.string().url(), dir: z.union([z.literal(1), z.literal(-1)]) })

/**
 * Повертає вже завантажене фото товару на 90° (вправо: dir 1, вліво: −1) — кнопки в перегляді фото в адмінці.
 * Повертає сервер: браузер не може прочитати фото зі сховища (сховище не дозволяє іншим сайтам).
 * Повернуте фото — новий файл (стара адреса закешована «назавжди»), разом із мініатюрою; старий файл не чіпаємо,
 * бо товар посилається на нього, поки продавець не натисне «Зберегти». Віддає адресу нового фото.
 */
export const rotatePhoto = onCall(
  { memory: '512MiB' },
  withLogging('rotatePhoto', async (request) => {
    if (request.auth?.token.role !== 'seller') throw new HttpsError('permission-denied', 'Sellers only')
    const parsed = input.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad input')
    const { url, dir } = parsed.data

    // Адреса фото: …/o/products%2F<id>.webp?alt=media&token=…
    const path = decodeURIComponent(new URL(url).pathname.split('/o/')[1] ?? '')
    if (!/^products\/[\w-]+\.webp$/.test(path)) throw new HttpsError('invalid-argument', 'Not a product photo')

    const bucket = getStorage().bucket()
    const [original] = await bucket
      .file(path)
      .download()
      .catch(() => {
        throw new HttpsError('not-found', 'Photo not found')
      })
    const turned = await sharp(original).rotate(dir * 90).webp({ quality: PHOTO_QUALITY }).toBuffer()
    const thumb = await sharp(turned)
      .resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer()

    const id = randomUUID()
    const newPath = `products/${id}.webp`
    const token = randomUUID()
    await bucket.file(newPath).save(turned, { contentType: SAVE_META.contentType, metadata: { cacheControl: SAVE_META.cacheControl, metadata: { firebaseStorageDownloadTokens: token } } })
    await bucket.file(`products/small/${id}.webp`).save(thumb, { contentType: SAVE_META.contentType, metadata: { cacheControl: SAVE_META.cacheControl } })

    // Така сама адреса, як дає getDownloadURL на сайті (в емуляторі — адреса емулятора)
    const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST
    const origin = emulator ? `http://${emulator.replace(/^https?:\/\//, '')}` : 'https://firebasestorage.googleapis.com'
    return { url: `${origin}/v0/b/${bucket.name}/o/${encodeURIComponent(newPath)}?alt=media&token=${token}` }
  }, (r) => r),
)
