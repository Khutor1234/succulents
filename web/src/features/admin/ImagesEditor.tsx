import { Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { imageUrl } from '../../firebase/config'
import { ImageCropper } from '../../shared/ImageCropper'
import { uploadProductImage } from './imageUpload'

/** Кругла кнопка-іконка в куті фото. */
const ICON_BTN = 'absolute top-1 left-1 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-colors'

interface Props {
  images: string[]
  onChange: (images: string[]) => void
  onUploadingChange: (uploading: boolean) => void
}

export function ImagesEditor({ images, onChange, onUploadingChange }: Props) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(false)
  /** Індекс фото, відкритого на весь екран; null — переглядач закритий. */
  const [viewing, setViewing] = useState<number | null>(null)

  // Вибрані фото по черзі відкриваються в редакторі обрізання; кожне обрізане одразу завантажується
  const [queue, setQueue] = useState<File[]>([])
  const [total, setTotal] = useState(0)

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setError(false)
    setQueue(files)
    setTotal(files.length)
  }

  async function onCropped(file: File) {
    setQueue((q) => q.slice(1))
    setUploading(true)
    onUploadingChange(true)
    try {
      const url = await uploadProductImage(file)
      // Беремо найсвіжіший список: поки фото вантажилось, могли обрізати наступне
      latest.current = [...latest.current, url]
      onChange(latest.current)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }
  const latest = useRef(images)
  useEffect(() => {
    latest.current = images
  }, [images])

  const makeMain = (url: string) => onChange([url, ...images.filter((u) => u !== url)])
  const remove = (url: string) => onChange(images.filter((u) => u !== url))

  return (
    <div>
      {/* Фото товару квадратні (як у картках магазину) — тож і рамка квадратна */}
      {queue[0] && (
        <ImageCropper
          key={`${total - queue.length}-${queue[0].name}`}
          file={queue[0]}
          aspect={1}
          title={total > 1 ? t('cropper.titleOf', { n: total - queue.length + 1, count: total }) : undefined}
          onDone={onCropped}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      )}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((url, i) => (
          <div key={url} className="group relative">
            <button
              type="button"
              onClick={() => setViewing(i)}
              aria-label={t('admin.fields.viewPhoto', { n: i + 1 })}
              className="block w-full overflow-hidden rounded-lg focus-visible:ring-4 focus-visible:ring-brand-500"
            >
              <img src={imageUrl(url)} alt="" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
              {/* Лупа при наведенні — підказка, що фото можна відкрити */}
              <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-sand-50 opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-5-5M11 8v6M8 11h6" />
                </svg>
              </span>
            </button>
            {/* Іконки замість дрібного тексту: зірка — головне фото (зафарбована, якщо вже головне), кошик — видалити */}
            {i === 0 ? (
              <span
                className={`${ICON_BTN} pointer-events-none bg-brand-600 text-sand-50`}
                title={t('admin.fields.mainPhoto')}
                aria-label={t('admin.fields.mainPhoto')}
              >
                <Star size={18} strokeWidth={2.25} fill="currentColor" aria-hidden />
              </span>
            ) : (
              <button
                type="button"
                className={`${ICON_BTN} bg-sand-50/90 text-brand-700 hover:bg-sand-50`}
                onClick={() => makeMain(url)}
                title={t('admin.fields.makeMain')}
                aria-label={t('admin.fields.makeMain')}
              >
                <Star size={18} strokeWidth={2.25} aria-hidden />
              </button>
            )}
            <button
              type="button"
              className={`${ICON_BTN} right-1 left-auto bg-sand-50/90 text-red-700 hover:bg-sand-50`}
              onClick={() => remove(url)}
              title={t('admin.fields.removePhoto')}
              aria-label={t('admin.fields.removePhoto')}
            >
              <Trash2 size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-sand-300 p-2 text-center text-sm text-sand-700 hover:border-brand-500">
          {uploading ? t('admin.fields.uploading') : t('admin.fields.addPhoto')}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={onFiles} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{t('admin.uploadError')}</p>}

      {viewing !== null && images[viewing] && (
        <PhotoViewer
          images={images}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onMakeMain={(url) => {
            makeMain(url)
            setViewing(0)
          }}
          onRemove={(url) => {
            const next = images.filter((u) => u !== url)
            remove(url)
            setViewing(next.length ? Math.min(viewing, next.length - 1) : null)
          }}
        />
      )}
    </div>
  )
}

interface ViewerProps {
  images: string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onMakeMain: (url: string) => void
  onRemove: (url: string) => void
}

/** Перегляд фото на весь екран. <dialog> сам закривається клавішею Esc і тримає фокус усередині. */
function PhotoViewer({ images, index, onIndex, onClose, onMakeMain, onRemove }: ViewerProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const url = images[index]
  const count = images.length

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const go = (delta: number) => onIndex((index + delta + count) % count)
  const navBtn = 'flex h-12 w-12 items-center justify-center rounded-full bg-sand-50/90 text-ink hover:bg-sand-50'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      // Клік по темному фону навколо фото — закрити
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={t('admin.fields.viewPhoto', { n: index + 1 })}
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink/85"
    >
      <div className="flex h-[100dvh] w-screen flex-col items-center justify-center gap-4 p-4">
        <div className="flex w-full max-w-5xl items-center justify-between text-sand-50">
          <span className="font-bold">
            {index + 1} / {count}
            {index === 0 && <span className="ml-3 rounded bg-brand-600 px-2 py-0.5 text-xs">{t('admin.fields.mainPhoto')}</span>}
          </span>
          <button type="button" onClick={() => ref.current?.close()} aria-label={t('cart.closeToast')} className={navBtn}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="relative flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
          <img src={imageUrl(url)} alt="" className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t('admin.fields.prevPhoto')} className={`${navBtn} absolute left-2`}>
                ‹
              </button>
              <button type="button" onClick={() => go(1)} aria-label={t('admin.fields.nextPhoto')} className={`${navBtn} absolute right-2`}>
                ›
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {index !== 0 && (
            <button type="button" onClick={() => onMakeMain(url)} className="min-h-11 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 hover:bg-brand-700">
              {t('admin.fields.makeMain')}
            </button>
          )}
          <button type="button" onClick={() => onRemove(url)} className="min-h-11 rounded-xl bg-red-700 px-4 font-bold text-white hover:bg-red-800">
            {t('admin.fields.removePhoto')}
          </button>
        </div>

        {count > 1 && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {images.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={t('admin.fields.viewPhoto', { n: i + 1 })}
                aria-current={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-sunset-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={imageUrl(u)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  )
}
