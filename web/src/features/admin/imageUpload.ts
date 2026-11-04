import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { app, emulatorHost, useEmulators } from '../../firebase/config'
import { THUMB_SIDE, thumbPath } from '../../lib/thumbs'

// Сховище фото потрібне лише адмінці — тому створюємо його тут, а не в загальному коді сайту.
const storage = getStorage(app)
if (useEmulators) connectStorageEmulator(storage, emulatorHost, 9199)

const MAX_SIDE = 1200
const UPLOAD_META = { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }

/** Зменшує фото до `side` px по довшій стороні і конвертує у WebP — так сторінки вантажаться швидше. */
async function resizeToWebp(bitmap: ImageBitmap, side: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('toBlob failed')
  return blob
}

export function uploadProductImage(file: File): Promise<string> {
  return uploadImage(file, 'products')
}

/** Заставка статті блогу — у власній теці сховища. */
export function uploadBlogCover(file: File): Promise<string> {
  return uploadImage(file, 'blog')
}

async function uploadImage(file: File, folder: 'products' | 'blog'): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const path = `${folder}/${crypto.randomUUID()}.webp`
    const fileRef = ref(storage, path)
    await uploadBytes(fileRef, await resizeToWebp(bitmap, MAX_SIDE, 0.85), UPLOAD_META)
    // Фото товару — ще й маленька копія для карток (картка не вантажить велике фото)
    if (folder === 'products') await uploadBytes(ref(storage, thumbPath(path)), await resizeToWebp(bitmap, THUMB_SIDE, 0.8), UPLOAD_META)
    return getDownloadURL(fileRef)
  } finally {
    bitmap.close()
  }
}
