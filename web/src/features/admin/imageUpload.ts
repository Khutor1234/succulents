import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../firebase/config'

const MAX_SIDE = 1200

/** Зменшує фото до 1200px по довшій стороні і конвертує у WebP — так сторінки вантажаться швидше. */
async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/webp', 0.85),
  )
}

export async function uploadProductImage(file: File): Promise<string> {
  const blob = await resizeToWebp(file)
  const path = `products/${crypto.randomUUID()}.webp`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, blob, {
    contentType: 'image/webp',
    cacheControl: 'public, max-age=31536000, immutable',
  })
  return getDownloadURL(fileRef)
}
