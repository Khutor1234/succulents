import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { imageUrl } from '../../firebase/config'
import { ProductImage } from '../../shared/ui'

/** На скільки наближати фото під курсором і в перегляді. */
const ZOOM = 2.2

/**
 * Фото на сторінці товару:
 * - на комп'ютері фото наближається під курсором (лупа ведеться за мишкою);
 * - натиснули — фото відкривається на весь екран: гортання стрілками, свайпом чи клавішами, мініатюри внизу;
 * - кілька фото — мініатюри під основним фото.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const { t } = useTranslation()
  const [active, setActive] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)

  if (images.length === 0) {
    return (
      <div className="rounded-[32px] bg-sand-50 p-3">
        <ProductImage alt={alt} tint="bg-sand-300/60" />
      </div>
    )
  }

  const current = Math.min(active, images.length - 1)

  // Лупа: точка під курсором стає центром наближення. Лише для мишки — на телефоні тапом відкривається перегляд.
  function onMove(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }

  return (
    <div className="rounded-[32px] bg-sand-50 p-3">
      <button
        type="button"
        onClick={() => setViewing(current)}
        onMouseMove={onMove}
        onMouseLeave={() => setOrigin(null)}
        aria-label={t('gallery.open', { n: current + 1, count: images.length })}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl"
      >
        <img
          src={imageUrl(images[current])}
          alt={alt}
          className="aspect-square w-full object-cover transition-transform duration-200 ease-out"
          style={origin ? { transform: `scale(${ZOOM})`, transformOrigin: origin } : undefined}
        />
        <span className="pointer-events-none absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/85 text-ink opacity-80 shadow transition-opacity group-hover:opacity-0">
          <ZoomIn size={18} strokeWidth={2.25} aria-hidden />
        </span>
      </button>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t('gallery.show', { n: i + 1 })}
              aria-current={i === current}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-opacity ${
                i === current ? 'border-brand-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={imageUrl(url)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {viewing !== null && (
        <Lightbox
          images={images}
          alt={alt}
          index={viewing}
          onIndex={(i) => {
            setViewing(i)
            setActive(i)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/** Перегляд на весь екран. <dialog> сам закривається Esc і тримає фокус усередині. */
function Lightbox({
  images,
  alt,
  index,
  onIndex,
  onClose,
}: {
  images: string[]
  alt: string
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const touchX = useRef<number | null>(null)
  // Натиснули на фото — наближення в цьому місці; ще раз — назад.
  const [zoomAt, setZoomAt] = useState<string | null>(null)
  const count = images.length

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const go = (delta: number) => {
    setZoomAt(null)
    onIndex((index + delta + count) % count)
  }
  const btn = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand-50/90 text-ink shadow hover:bg-sand-50'

  function onImageClick(e: MouseEvent<HTMLImageElement>) {
    if (zoomAt) return setZoomAt(null)
    const r = e.currentTarget.getBoundingClientRect()
    setZoomAt(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }
  function onImageMove(e: MouseEvent<HTMLImageElement>) {
    if (!zoomAt) return
    const r = e.currentTarget.getBoundingClientRect()
    setZoomAt(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }
  // Свайп вліво/вправо на телефоні — наступне/попереднє фото
  const onTouchStart = (e: TouchEvent) => (touchX.current = e.touches[0].clientX)
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null || zoomAt) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (count > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={t('gallery.open', { n: index + 1, count })}
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink/90"
    >
      <div className="flex h-[100dvh] w-screen flex-col items-center gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-5xl items-center justify-between text-sand-50">
          <span className="font-bold tabular-nums">{count > 1 ? `${index + 1} / ${count}` : ''}</span>
          <button type="button" onClick={() => ref.current?.close()} aria-label={t('gallery.close')} className={btn}>
            <X size={22} strokeWidth={2.4} aria-hidden />
          </button>
        </div>

        <div
          className="relative flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            key={images[index]}
            src={imageUrl(images[index])}
            alt={alt}
            onClick={onImageClick}
            onMouseMove={onImageMove}
            className={`max-h-full max-w-full animate-page-in rounded-xl object-contain shadow-2xl transition-transform duration-200 ${
              zoomAt ? 'cursor-zoom-out' : 'cursor-zoom-in'
            }`}
            style={zoomAt ? { transform: `scale(${ZOOM})`, transformOrigin: zoomAt } : undefined}
          />
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t('gallery.prev')} className={`${btn} absolute left-1 sm:left-2`}>
                <ChevronLeft size={24} strokeWidth={2.4} aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} aria-label={t('gallery.next')} className={`${btn} absolute right-1 sm:right-2`}>
                <ChevronRight size={24} strokeWidth={2.4} aria-hidden />
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-sand-300">{t('gallery.hint')}</p>

        {count > 1 && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => {
                  setZoomAt(null)
                  onIndex(i)
                }}
                aria-label={t('gallery.show', { n: i + 1 })}
                aria-current={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-sunset-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={imageUrl(url)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  )
}
