import { Camera, ImagePlus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { imageUrl } from '../../firebase/config'
import { ImageCropper } from '../../shared/ImageCropper'
import { useAuth } from '../auth/authStore'
import { useArticlePhotos, useEditArticlePhotos } from './covers'

/**
 * Блок «Фото» під статтею: власні фото продавчині (приклади, як виглядають рослини в колекції тощо).
 * Покупці бачать галерею (натиснули — фото на весь екран); продавець — ще й кнопки «Додати фото» і «Прибрати».
 * Немає фото й це не продавець — блоку немає.
 */
export function ArticlePhotos({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const isSeller = useAuth((s) => s.role === 'seller')
  const { data: photos = [] } = useArticlePhotos(slug)
  const edit = useEditArticlePhotos(slug)
  const input = useRef<HTMLInputElement>(null)
  // Кілька вибраних фото — по черзі через редактор обрізання
  const [queue, setQueue] = useState<File[]>([])
  const [open, setOpen] = useState<number | null>(null)

  if (photos.length === 0 && !isSeller) return null

  return (
    <section className="mt-10" aria-labelledby="photos-title">
      <h2 id="photos-title" className="flex items-center gap-2 font-display text-2xl font-extrabold text-brand-600">
        <Camera size={22} strokeWidth={2.25} aria-hidden />
        {t('blog.photos')}
      </h2>

      {queue[0] && (
        <ImageCropper
          key={`${queue.length}-${queue[0].name}`}
          file={queue[0]}
          aspect={4 / 3}
          onDone={(file) => {
            setQueue((q) => q.slice(1))
            edit.mutate({ add: file })
          }}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      )}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((url, i) => (
            <li key={url} className="relative">
              <button type="button" onClick={() => setOpen(i)} className="block w-full overflow-hidden rounded-2xl" aria-label={t('gallery.open', { n: i + 1, count: photos.length })}>
                <img src={imageUrl(url)} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.04]" />
              </button>
              {isSeller && (
                <button
                  type="button"
                  onClick={() => window.confirm(t('blog.photoRemoveConfirm')) && edit.mutate({ remove: url })}
                  disabled={edit.isPending}
                  aria-label={t('blog.photoRemove')}
                  className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/90 text-red-700 shadow-sm hover:bg-red-700 hover:text-white"
                >
                  <Trash2 size={18} strokeWidth={2.25} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isSeller && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) setQueue(files)
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={edit.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 hover:bg-brand-700 disabled:opacity-60"
          >
            <ImagePlus size={20} strokeWidth={2.25} aria-hidden />
            {edit.isPending ? t('blog.coverUploading') : t('blog.photoAdd')}
          </button>
          <span className="text-sm text-sand-700">{t('blog.photosHint')}</span>
          {edit.isError && <p className="w-full text-sm text-red-700">{t('admin.uploadError')}</p>}
        </div>
      )}

      {open !== null && photos[open] && <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}

/** Фото на весь екран: стрілки, свайп, Esc — закрити. */
function PhotoViewer({ photos, index, onIndex, onClose }: { photos: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const touchX = useRef<number | null>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length)
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink/85"
    >
      <div
        className="flex h-dvh w-dvw items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (photos.length > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        }}
      >
        <img src={imageUrl(photos[index])} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
        <button type="button" onClick={onClose} aria-label={t('gallery.close')} className="absolute top-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand-50/90 text-ink">
          <X size={22} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </dialog>
  )
}
