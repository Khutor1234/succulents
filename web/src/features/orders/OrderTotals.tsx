import { useTranslation } from 'react-i18next'
import { useLang } from '../../i18n'
import { formatPrice } from '../../lib/format'
import type { Order } from '../../lib/types'

/**
 * Підсумок замовлення: товари, знижка/доплата від продавця, бонуси, до сплати.
 * Проміжні рядки показуються, лише коли є знижка, доплата чи списані бонуси.
 */
export function OrderTotals({ order }: { order: Order }) {
  const { t } = useTranslation()
  const lang = useLang()
  const adjustment = order.adjustment ?? 0
  const bonusUsed = order.bonusUsed ?? 0
  const detailed = adjustment !== 0 || bonusUsed > 0

  return (
    <div className="mt-2 space-y-0.5 border-t-2 border-sand-200 pt-2 text-sm">
      {detailed && (
        <p className="flex justify-between">
          <span>{t('orders.itemsTotal')}</span>
          <span>{formatPrice(order.subtotal ?? order.total, lang)}</span>
        </p>
      )}
      {adjustment !== 0 && (
        <p className={`flex justify-between gap-3 ${adjustment < 0 ? 'text-sunset-600' : ''}`}>
          <span>
            {adjustment < 0 ? t('orders.discount') : t('orders.surcharge')}
            {order.adjustmentNote && <span className="text-sand-700"> · {order.adjustmentNote}</span>}
          </span>
          <span className="whitespace-nowrap">
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
      <p className="flex items-baseline justify-between pt-1 font-bold">
        <span>{t('bonus.toPay')}</span>
        <span className="font-display text-lg font-extrabold text-sunset-600">{formatPrice(order.total, lang)}</span>
      </p>
    </div>
  )
}
