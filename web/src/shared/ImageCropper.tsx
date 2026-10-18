import { Check, Minus, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_ZOOM = 4
// Найбільша сторона готового фото (далі його ще й стискає завантаження)
const OUT_MAX = 1600

/**
 * Обрізання фото перед завантаженням: рамка потрібної форми (квадрат для товару, 16:9 для заставки статті),
 * фото в ній можна рухати пальцем чи мишкою й наближати — повзунком, двома пальцями або коліщатком.
 * «Готово» віддає вирізаний шматок як новий файл.
 */
export function ImageCropper({
  file,
  aspect,
  onDone,
  onCancel,
  title,
}: {
  file: File
  /** Ширина / висота рамки: 1 — квадрат, 16 / 9 — широка. */
  aspect: number
  onDone: (cropped: File) => void
  onCancel: () => void
  title?: string
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  // Тимчасова адреса вибраного файлу — щоб показати його без завантаження
  const url = useMemo(() => URL.createObjectURL(file), [file])
  const [frameW, setFrameW] = useState(320)
  const [zoom, setZoom] = useState(1)
  // Зсув центру фото відносно центру рамки, у пікселях рамки
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    const image = new Image()
    image.onload = () => setImg(image)
    image.src = url
    // Адресу не звільняємо: у режимі розробки React запускає ефект двічі, і фото зникло б. Пам’ять звільниться з перезавантаженням сторінки
  }, [url])

  // Ширина рамки — за шириною вікна (телефон) і не більше 520px
  useEffect(() => {
    const el = frame.current?.parentElement
    if (!el) return
    const update = () => setFrameW(Math.min(520, el.clientWidth))
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const frameH = frameW / aspect
  // Масштаб, за якого фото якраз закриває рамку (як object-cover), помножений на наближення
  const base = img ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) : 1
  const scale = base * zoom
  const shownW = img ? img.naturalWidth * scale : frameW
  const shownH = img ? img.naturalHeight * scale : frameH

  // Фото не можна відсунути так, щоб у рамці з’явилась порожнеча
  const clamp = (o: { x: number; y: number }, w = shownW, h = shownH) => ({
    x: Math.max(-(w - frameW) / 2, Math.min((w - frameW) / 2, o.x)),
    y: Math.max(-(h - frameH) / 2, Math.min((h - frameH) / 2, o.y)),
  })

  function setZoomKeep(next: number) {
    const z = Math.max(1, Math.min(MAX_ZOOM, next))
    if (!img) return setZoom(z)
    // Під час наближення тримаємо той самий центр кадру
    const k = z / zoom
    setZoom(z)
    setOffset((o) => clamp({ x: o.x * k, y: o.y * k }, img.naturalWidth * base * z, img.naturalHeight * base * z))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      // Два пальці — наближення
      const [a, b] = [...pointers.current.values()]
      setZoomKeep(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist))
    } else if (pointers.current.size === 1) {
      setOffset((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }))
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const onWheel = (e: WheelEvent<HTMLDivElement>) => setZoomKeep(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))

  async function done() {
    if (!img) return
    setSaving(true)
    // Яка частина оригіналу видна в рамці (у пікселях оригіналу)
    const sw = frameW / scale
    const sh = frameH / scale
    const sx = img.naturalWidth / 2 - (frameW / 2 + offset.x) / scale
    const sy = img.naturalHeight / 2 - (frameH / 2 + offset.y) / scale
    const outScale = Math.min(1, OUT_MAX / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sw * outScale)
    canvas.height = Math.round(sh * outScale)
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.9))
    setSaving(false)
    if (blob) onDone(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }))
  }

  const btn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand-200 text-ink hover:bg-sand-300 disabled:opacity-40'

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(100vw-1.5rem,560px)] rounded-3xl bg-sand-50 p-4 text-ink shadow-2xl backdrop:bg-ink/60 sm:p-5"
    >
      <p className="mb-1 font-display text-xl font-extrabold text-brand-600">{title ?? t('cropper.title')}</p>
      <p className="mb-3 text-sm text-sand-700">{t('cropper.hint')}</p>
      <div className="flex justify-center">
        <div
          ref={frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{ width: frameW, height: frameH }}
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-sand-200 select-none active:cursor-grabbing"
        >
          {url && img && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              style={{ width: shownW, height: shownH, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
            />
          )}
          {/* Сітка третин — щоб легше поставити рослину по центру */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 [&>*]:border [&>*]:border-sand-50/40">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={btn} onClick={() => setZoomKeep(zoom / 1.2)} disabled={zoom <= 1} aria-label={t('cropper.zoomOut')}>
          <Minus size={18} strokeWidth={2.5} aria-hidden />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoomKeep(Number(e.target.value))}
          aria-label={t('cropper.zoom')}
          className="min-w-0 flex-1 accent-brand-600"
        />
        <button type="button" className={btn} onClick={() => setZoomKeep(zoom * 1.2)} disabled={zoom >= MAX_ZOOM} aria-label={t('cropper.zoomIn')}>
          <Plus size={18} strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sand-200 px-4 font-bold hover:bg-sand-300"
        >
          <X size={18} strokeWidth={2.5} aria-hidden />
          {t('cropper.cancel')}
        </button>
        <button
          type="button"
          onClick={done}
          disabled={!img || saving}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-sand-50 hover:bg-brand-700 disabled:opacity-60"
        >
          <Check size={18} strokeWidth={2.5} aria-hidden />
          {t('cropper.done')}
        </button>
      </div>
    </dialog>
  )
}
