import { useMutation, useQueryClient } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { Minus, Plus, Search, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { functions } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import type { Localized, Order } from '../../lib/types'
import { ICON } from '../../shared/icon'
import { Button, ProductImage } from '../../shared/ui'
import { useAllProducts } from './api'

interface AdjustRequest {
  orderId: string
  items: { productId: string; qty: number; price: number }[]
  adjustment: number
  adjustmentNote: string
}
const adjustOrder = httpsCallable<AdjustRequest, unknown>(functions, 'adjustOrder')

/** Рядок редактора: позиція замовлення або щойно доданий товар. Ціна — у копійках. */
interface Row {
  productId: string
  name: Localized
  image?: string
  price: number
  qty: number
  /** Скільки замовив покупець (0 — товар додав продавець). */
  ordered: number
  added: boolean
}

const toUah = (kopecks: number) => String(kopecks / 100)
const toKopecks = (uah: string) => Math.max(0, Math.round((Number(uah.replace(',', '.')) || 0) * 100))

/**
 * Редагування прийнятого замовлення: кількість (більше чи менше), ціна позиції, прибрати чи додати товар,
 * знижка або доплата до суми. Остаточно все рахує сервер (adjustOrder) — тут лише попередній розрахунок.
 */
export function OrderItemsEditor({ order, onDone }: { order: Order; onDone: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Row[]>(() =>
    order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      image: i.image,
      price: i.price,
      qty: i.qty,
      ordered: i.added ? 0 : (i.originalQty ?? i.qty),
      added: !!i.added,
    })),
  )
  // Ціни редагуємо як текст у гривнях — щоб можна було стерти й ввести нову.
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((i) => [i.productId, toUah(i.price)])),
  )
  const initialAdjustment = order.adjustment ?? 0
  const [sign, setSign] = useState<-1 | 1>(initialAdjustment > 0 ? 1 : -1)
  const [adjustmentText, setAdjustmentText] = useState(initialAdjustment ? toUah(Math.abs(initialAdjustment)) : '')
  const [note, setNote] = useState(order.adjustmentNote ?? '')
  const [picking, setPicking] = useState(false)

  const adjustment = sign * toKopecks(adjustmentText)

  const save = useMutation({
    mutationFn: () =>
      adjustOrder({
        orderId: order.id,
        items: rows.map((r) => ({ productId: r.productId, qty: r.qty, price: r.price })),
        adjustment,
        adjustmentNote: adjustment ? note.trim() : '',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      onDone()
    },
  })
  const errorDetails = (save.error as { details?: { reason?: string; productId?: string; available?: number } } | null)?.details

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.productId === id ? { ...r, ...patch } : r)))
  const setPrice = (id: string, text: string) => {
    setPrices((p) => ({ ...p, [id]: text }))
    update(id, { price: toKopecks(text) })
  }
  const remove = (row: Row) =>
    // Щойно доданий товар просто зникає; замовлений покупцем лишається закресленим, щоб його можна було повернути.
    row.added && !order.items.some((i) => i.productId === row.productId)
      ? setRows((rs) => rs.filter((r) => r.productId !== row.productId))
      : update(row.productId, { qty: 0 })

  function addProduct(p: { id: string; name: Localized; price: number; images: string[] }) {
    setRows((rs) => [...rs, { productId: p.id, name: p.name, image: p.images[0], price: p.price, qty: 1, ordered: 0, added: true }])
    setPrices((pr) => ({ ...pr, [p.id]: toUah(p.price) }))
    setPicking(false)
  }

  // Попередній розрахунок — так само, як у adjustOrder на сервері.
  const subtotal = rows.reduce((sum, r) => sum + r.price * r.qty, 0)
  const gross = subtotal + adjustment
  const bonusUsed = Math.min(order.bonusUsed ?? 0, Math.max(0, gross))
  const nothingLeft = rows.every((r) => r.qty === 0)
  const negative = gross < 0
  const changed =
    rows.length !== order.items.length ||
    rows.some((r) => {
      const item = order.items.find((i) => i.productId === r.productId)
      return !item || item.qty !== r.qty || item.price !== r.price
    }) ||
    adjustment !== initialAdjustment ||
    (adjustment !== 0 && note.trim() !== (order.adjustmentNote ?? ''))

  const step = 'flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sand-200 disabled:opacity-30'

  return (
    <div className="space-y-3 rounded-2xl border-2 border-sunset-500 bg-sand-50 p-3">
      <p className="text-sand-700">{t('orders.editHint')}</p>

      <ul className="divide-y-2 divide-sand-200">
        {rows.map((row) => {
          const off = row.qty === 0
          const name = pick(row.name, lang)
          return (
            <li key={row.productId} className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-2 py-3">
              <div className={`row-span-2 ${off ? 'opacity-50' : ''}`}>
                <ProductImage src={row.image} alt="" />
              </div>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`leading-snug font-bold ${off ? 'text-sand-700 line-through' : ''}`}>{name}</p>
                  <p className="text-xs text-sand-700">
                    {row.added ? (
                      <span className="font-bold text-brand-600">{t('orders.addedBySeller')}</span>
                    ) : (
                      t('admin.order.ordered', { count: row.ordered })
                    )}
                  </p>
                </div>
                {off ? (
                  <button
                    onClick={() => update(row.productId, { qty: row.ordered || 1 })}
                    className="flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 font-bold text-brand-600 hover:bg-brand-50"
                  >
                    <Undo2 size={16} strokeWidth={2.25} aria-hidden />
                    {t('orders.restore')}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(row)}
                    aria-label={`${t('cart.remove')}: ${name}`}
                    title={t('cart.remove')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                )}
              </div>
              {!off && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-xl border-2 border-sand-200 bg-sand-50" role="group" aria-label={t('cart.quantity')}>
                    <button className={step} onClick={() => update(row.productId, { qty: row.qty - 1 })} disabled={row.qty <= 1} aria-label={t('cart.decrease')}>
                      <Minus size={16} strokeWidth={2.5} aria-hidden />
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums">{row.qty}</span>
                    <button className={step} onClick={() => update(row.productId, { qty: row.qty + 1 })} disabled={row.qty >= 99} aria-label={t('cart.increase')}>
                      <Plus size={16} strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                  <span className="text-sand-700">×</span>
                  <label className="flex h-11 items-center gap-1 rounded-xl border-2 border-sand-200 bg-sand-50 px-3 focus-within:border-brand-500">
                    <span className="sr-only">{t('orders.price')}</span>
                    <input
                      inputMode="decimal"
                      value={prices[row.productId] ?? ''}
                      onChange={(e) => setPrice(row.productId, e.target.value)}
                      className="w-16 bg-transparent text-right font-bold outline-none"
                    />
                    <span className="text-sand-700">грн</span>
                  </label>
                  <span className="ml-auto font-display font-extrabold whitespace-nowrap">{formatPrice(row.price * row.qty, lang)}</span>
                </div>
              )}
              {errorDetails?.reason === 'stock' && errorDetails.productId === row.productId && (
                <p className="col-start-2 text-sm text-red-700">{t('orders.notEnoughStock', { count: errorDetails.available ?? 0 })}</p>
              )}
            </li>
          )
        })}
      </ul>

      {picking ? (
        <ProductPicker exclude={rows.map((r) => r.productId)} onPick={addProduct} onClose={() => setPicking(false)} />
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-500 font-bold text-brand-600 hover:bg-brand-50"
        >
          <Plus {...ICON} />
          {t('orders.addItem')}
        </button>
      )}

      {/* Знижка чи доплата до всієї суми: напр. «−50 грн за пошкоджений листок» або «+80 грн за термопакет» */}
      <fieldset className="rounded-xl border-2 border-sand-200 p-3">
        <legend className="px-1 text-sm font-bold text-sand-700">{t('orders.adjustment')}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-sand-200 p-1" role="radiogroup" aria-label={t('orders.adjustment')}>
            {([-1, 1] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={sign === s}
                onClick={() => setSign(s)}
                className={`min-h-9 rounded-lg px-3 text-sm font-bold transition-colors ${sign === s ? 'bg-sand-50 text-ink shadow-sm' : 'text-sand-700'}`}
              >
                {s < 0 ? t('orders.discount') : t('orders.surcharge')}
              </button>
            ))}
          </div>
          <label className="flex h-11 items-center gap-1 rounded-xl border-2 border-sand-200 bg-sand-50 px-3 focus-within:border-brand-500">
            <span className="font-bold text-sand-700">{sign < 0 ? '−' : '+'}</span>
            <span className="sr-only">{t('orders.adjustmentAmount')}</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={adjustmentText}
              onChange={(e) => setAdjustmentText(e.target.value)}
              className="w-20 bg-transparent text-right font-bold outline-none"
            />
            <span className="text-sand-700">грн</span>
          </label>
          {adjustmentText && (
            <button onClick={() => setAdjustmentText('')} aria-label={t('orders.clearAdjustment')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sand-200">
              <X size={16} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
        {adjustment !== 0 && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder={t('orders.adjustmentNotePlaceholder')}
            aria-label={t('orders.adjustmentNote')}
            className="mt-2 h-11 w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3 outline-none focus:border-brand-500"
          />
        )}
      </fieldset>

      <div className="space-y-1 border-t-2 border-sand-200 pt-3">
        <p className="flex justify-between">
          <span>{t('orders.itemsTotal')}</span>
          <span>{formatPrice(subtotal, lang)}</span>
        </p>
        {adjustment !== 0 && (
          <p className={`flex justify-between ${adjustment < 0 ? 'text-sunset-600' : ''}`}>
            <span>{adjustment < 0 ? t('orders.discount') : t('orders.surcharge')}</span>
            <span>
              {adjustment < 0 ? '−' : '+'}
              {formatPrice(Math.abs(adjustment), lang)}
            </span>
          </p>
        )}
        {bonusUsed > 0 && (
          <p className="flex justify-between text-sunset-600">
            <span>{t('bonus.discount')}</span>
            <span>−{formatPrice(bonusUsed, lang)}</span>
          </p>
        )}
        <p className="flex items-baseline justify-between font-bold">
          <span>{t('bonus.toPay')}</span>
          <span className="font-display text-lg font-extrabold text-sunset-600">{formatPrice(Math.max(0, gross - bonusUsed), lang)}</span>
        </p>
      </div>

      {nothingLeft && <p className="text-red-700">{t('orders.nothingLeft')}</p>}
      {negative && <p className="text-red-700">{t('orders.negativeTotal')}</p>}
      {save.isError && errorDetails?.reason !== 'stock' && <p className="text-red-700">{t('admin.saveError')}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={!changed || nothingLeft || negative || save.isPending} className="flex-1 sm:flex-none">
          {save.isPending ? t('admin.saving') : t('orders.save')}
        </Button>
        <Button variant="secondary" onClick={onDone} className="flex-1 sm:flex-none">
          {t('admin.cancel')}
        </Button>
      </div>
    </div>
  )
}

/** Пошук товару з каталогу, щоб додати в замовлення. Показує ціну й залишок на складі. */
function ProductPicker({
  exclude,
  onPick,
  onClose,
}: {
  exclude: string[]
  onPick: (p: { id: string; name: Localized; price: number; images: string[] }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const { data: products, isLoading } = useAllProducts()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const found = (products ?? [])
    .filter((p) => !exclude.includes(p.id) && (!q || pick(p.name, lang).toLowerCase().includes(q)))
    // Спершу те, що є в наявності.
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
    .slice(0, 30)

  return (
    <div className="animate-menu-in rounded-xl border-2 border-brand-500 bg-sand-50 p-2">
      <div className="flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-lg bg-sand-100 px-3">
          <Search size={16} strokeWidth={2.25} className="text-sand-700" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('orders.searchProduct')}
            aria-label={t('orders.searchProduct')}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <button onClick={onClose} aria-label={t('admin.cancel')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand-200">
          <X size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <ul className="mt-2 max-h-72 overflow-y-auto">
        {isLoading && <li className="p-3 text-sand-700">{t('loading')}</li>}
        {!isLoading && found.length === 0 && <li className="p-3 text-sand-700">{t('orders.noProductsFound')}</li>}
        {found.map((p) => {
          const out = p.stock <= 0
          return (
            <li key={p.id}>
              <button
                onClick={() => onPick(p)}
                disabled={out}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sand-200 disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <div className="w-10 shrink-0">
                  <ProductImage src={p.images[0]} alt="" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{pick(p.name, lang)}</span>
                  <span className="text-xs text-sand-700">{out ? t('orders.outOfStock') : t('orders.inStock', { count: p.stock })}</span>
                </span>
                <span className="font-bold whitespace-nowrap text-sunset-600">{formatPrice(p.price, lang)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
