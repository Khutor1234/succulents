import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import { useCartChanges } from './useCartSync'

/** Повідомлення «у кошику дещо змінилось»: нова ціна, менше в наявності, товару вже немає. */
export function CartChanges() {
  const { t } = useTranslation()
  const lang = useLang()
  const { changes, dismiss } = useCartChanges()
  if (changes.length === 0) return null
  return (
    <div role="status" className="mb-5 rounded-2xl border-2 border-sunset-500 bg-sunset-100/60 p-4 text-sm">
      <div className="flex items-start gap-2">
        <p className="flex flex-1 items-center gap-2 font-bold">
          <AlertTriangle size={18} strokeWidth={2.25} className="shrink-0 text-sunset-700" aria-hidden />
          {t('cart.changed.title')}
        </p>
        <button type="button" onClick={dismiss} aria-label={t('cart.changed.dismiss')} className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-sand-200">
          <X size={16} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {changes.map((c, i) => (
          <li key={i}>
            {c.kind === 'price' && t('cart.changed.price', { name: c.name, from: formatPrice(c.from, lang), to: formatPrice(c.to, lang) })}
            {c.kind === 'less' && t('cart.changed.less', { name: c.name, count: c.left })}
            {c.kind === 'gone' && t('cart.changed.gone', { name: c.name })}
          </li>
        ))}
      </ul>
    </div>
  )
}
