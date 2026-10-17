import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { CreditCard, Truck, User } from 'lucide-react'
import { reportError, track } from '../../lib/monitoring'
import { ICON } from '../../shared/icon'
import { BONUS_RATE, useBonusBalance } from '../account/api'
import { useDeliveryProfile, useSaveDeliveryProfile } from '../account/profile'
import { functions } from '../../firebase/config'
import { useLang } from '../../i18n'
import { formatPrice, pick } from '../../lib/format'
import { Button, Input, PageTitle, Section } from '../../shared/ui'
import { useAuth } from '../auth/authStore'
import { CartChanges } from '../cart/CartChanges'
import { selectTotal, useCart } from '../cart/cartStore'
import { useCartChanges, useCartSync } from '../cart/useCartSync'
import { MIN_ORDER } from '../../lib/shop'
import { checkoutSchema, type CheckoutData, type CheckoutInput } from './schema'

interface CreateOrderRequest {
  items: { productId: string; qty: number }[]
  customer: CheckoutData
  lang: string
  useBonuses: boolean
}
interface CreateOrderResponse {
  orderId: string
  number: string
  total: number
  bonusUsed: number
  bonusEarned: number
}

/**
 * Контакти й доставка з останнього замовлення на цьому пристрої — щоб наступного разу не вводити знову
 * (особливо для гостей, у яких немає кабінету). Лише в браузері покупця; помилки сховища просто ігноруємо.
 */
const LAST_DELIVERY_KEY = 'succulents.lastDelivery'
const DELIVERY_KEYS = ['fullName', 'phone', 'email', 'city', 'warehouse'] as const
type SavedDelivery = Partial<Record<(typeof DELIVERY_KEYS)[number], string>>

function loadLastDelivery(): SavedDelivery | null {
  try {
    const raw = localStorage.getItem(LAST_DELIVERY_KEY)
    return raw ? (JSON.parse(raw) as SavedDelivery) : null
  } catch {
    return null
  }
}

function saveLastDelivery(customer: CheckoutData) {
  try {
    const data = Object.fromEntries(DELIVERY_KEYS.map((k) => [k, customer[k] ?? '']))
    localStorage.setItem(LAST_DELIVERY_KEY, JSON.stringify(data))
  } catch {
    // Приватний режим чи заблоковане сховище — нічого страшного.
  }
}

const createOrder = httpsCallable<CreateOrderRequest, CreateOrderResponse>(functions, 'createOrder')

export function CheckoutPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const { items, clear } = useCart()
  const subtotal = useCart(selectTotal)
  const user = useAuth((s) => s.user)
  const { balance } = useBonusBalance()
  const [applyBonuses, setApplyBonuses] = useState(true)
  const [submitError, setSubmitError] = useState<'generic' | 'min' | 'changed' | null>(null)
  const [placed, setPlaced] = useState<CreateOrderResponse | null>(null)
  // Перед оформленням звіряємо кошик (ціни й наявність могли змінитися, поки людина вибирала)
  const { sync: syncCart } = useCartSync()
  const [lastDelivery] = useState(loadLastDelivery)
  const filledFromDevice = !!lastDelivery

  // Лише попередній розрахунок для показу — точну суму рахує сервер.
  const bonusUsed = user && applyBonuses ? Math.min(balance, subtotal) : 0
  const toPay = subtotal - bonusUsed
  const willEarn = Math.floor(toPay * BONUS_RATE)

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutData>({
    resolver: zodResolver(checkoutSchema),
    // Дані з минулого замовлення на цьому пристрої; залогіненому email — завжди з акаунта.
    defaultValues: { ...lastDelivery, email: user?.email ?? lastDelivery?.email ?? '', paymentMethod: 'card_transfer' },
  })

  // Firebase може повідомити про залогіненого користувача вже після першого рендера форми.
  useEffect(() => {
    // Залогіненому — завжди email акаунта (навіть якщо з минулого гостьового замовлення підставився інший)
    if (user?.email && getValues('email') !== user.email) setValue('email', user.email)
  }, [user, getValues, setValue])

  // Збережені в кабінеті дані доставки підставляємо в порожні поля (те, що покупець уже ввів, не чіпаємо).
  const { data: profile } = useDeliveryProfile()
  const saveProfile = useSaveDeliveryProfile()
  const [rememberProfile, setRememberProfile] = useState(true)
  const filledFromProfile = !!profile && Object.values(profile).some(Boolean)
  useEffect(() => {
    if (!profile) return
    for (const key of ['fullName', 'phone', 'city', 'warehouse'] as const) {
      if (profile[key] && !getValues(key)) setValue(key, profile[key])
    }
  }, [profile, getValues, setValue])

  // Перевіряємо раніше за порожній кошик: після clear() кошик порожній, але треба йти на сторінку успіху.
  if (placed) {
    return <Navigate to={`/order/success/${placed.number}`} state={{ bonusEarned: placed.bonusEarned }} replace />
  }
  if (items.length === 0) return <Navigate to="/cart" replace />
  // Сума менша за мінімальну — назад у кошик, там видно, скільки ще додати.
  if (subtotal < MIN_ORDER) return <Navigate to="/cart" replace />

  const err = (key?: string) => (key ? t(key) : undefined)

  async function onSubmit(customer: CheckoutData) {
    setSubmitError(null)
    track('checkout_submit', { items: items.length, subtotal, useBonuses: bonusUsed > 0 })
    try {
      const { data } = await createOrder({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        customer,
        lang,
        useBonuses: bonusUsed > 0,
      })
      saveLastDelivery(customer)
      if (user && rememberProfile) {
        // Не блокуємо успіх замовлення, якщо збереження профілю раптом не вдасться.
        const { fullName, phone, city, warehouse } = customer
        saveProfile.mutate({ fullName, phone, city, warehouse })
      }
      track('order_placed', { orderId: data.orderId, number: data.number, total: data.total, bonusUsed: data.bonusUsed })
      setPlaced(data)
      clear()
      useCartChanges.getState().dismiss()
      void queryClient.invalidateQueries({ queryKey: ['bonuses'] })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] })
    } catch (e) {
      // Невдале замовлення — найважливіша помилка магазину: шлемо в Sentry з кошиком (без особистих даних).
      const details = (e as { details?: { reason?: string; productId?: string } }).details
      if (details?.reason === 'min-order') {
        setSubmitError('min')
        return
      }
      // Товар розкупили, приховали чи змінили — це не збій: звіряємо кошик, пояснюємо, що змінилось.
      if (details?.productId) {
        track('checkout_cart_outdated', { productId: details.productId })
        await syncCart()
        setSubmitError('changed')
        return
      }
      reportError(e, {
        action: 'create_order',
        code: (e as { code?: string }).code,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        subtotal,
        useBonuses: bonusUsed > 0,
        guest: !user,
      })
      setSubmitError('generic')
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <PageTitle>{t('checkout.title')}</PageTitle>
          <CartChanges />
          {!user && <p className="-mt-3 text-sand-700">{t(filledFromDevice ? 'checkout.filledFromDevice' : 'checkout.guestHint')}</p>}
          {user && filledFromProfile && <p className="-mt-3 text-brand-600">{t('profile.filledFromProfile')}</p>}
        </div>

        <Section title={t('checkout.contacts')} icon={<User {...ICON} />}>
          <Input label={t('checkout.fullName')} autoComplete="name" {...register('fullName')} error={err(errors.fullName?.message)} />
          <Input label={t('checkout.phone')} type="tel" autoComplete="tel" placeholder="+380 67 123 45 67" {...register('phone')} error={err(errors.phone?.message)} />
          {/* Залогіненому email не редагується: замовлення прив'язане до акаунта, і сервер однаково бере email з нього. */}
          <Input
            label={t('checkout.email')}
            type="email"
            autoComplete="email"
            readOnly={!!user?.email}
            aria-describedby={user?.email ? 'email-hint' : undefined}
            className={user?.email ? '[&_input]:cursor-not-allowed [&_input]:bg-sand-200 [&_input]:text-sand-700' : ''}
            {...register('email')}
            error={err(errors.email?.message)}
          />
          {user?.email && (
            <p id="email-hint" className="-mt-2 text-sm text-sand-700">
              {t('checkout.emailFromAccount')}
            </p>
          )}
        </Section>

        <Section title={t('checkout.delivery')} icon={<Truck {...ICON} />}>
          <Input label={t('checkout.city')} autoComplete="address-level2" {...register('city')} error={err(errors.city?.message)} />
          <Input label={t('checkout.warehouse')} placeholder="№ 12" {...register('warehouse')} error={err(errors.warehouse?.message)} />
          <Input label={t('checkout.comment')} {...register('comment')} />
          {user && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={rememberProfile}
                onChange={(e) => setRememberProfile(e.target.checked)}
                className="h-5 w-5 accent-brand-600"
              />
              {t('profile.remember')}
            </label>
          )}
        </Section>

        <Section title={t('checkout.payment')} icon={<CreditCard {...ICON} />}>
          {/* Єдиний спосіб — передоплата; поле лишається прихованим, щоб формат замовлення не змінювався. */}
          <input type="hidden" value="card_transfer" {...register('paymentMethod')} />
          <div className="rounded-xl border-2 border-brand-500 bg-brand-50 px-4 py-3">
            <p className="font-bold">{t('checkout.prepaymentTitle')}</p>
            <p className="mt-1 text-sm text-sand-700">{t('checkout.prepaymentText')}</p>
          </div>
        </Section>

        {submitError && (
          <p className="text-red-700">
            {submitError === 'min'
              ? t('checkout.errorMinOrder', { amount: formatPrice(MIN_ORDER, lang) })
              : submitError === 'changed'
                ? t('checkout.errorCartChanged')
                : t('checkout.error')}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t('checkout.submitting') : t('checkout.submit')}
        </Button>
      </form>

      <aside className="h-fit rounded-3xl bg-brand-600 p-5 text-sand-100 md:sticky md:top-32">
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span>
                {pick(i.name, lang)} × {i.qty}
              </span>
              <span className="shrink-0">{formatPrice(i.price * i.qty, lang)}</span>
            </li>
          ))}
        </ul>
        {bonusUsed > 0 && (
          <div className="mt-4 space-y-1 border-t border-brand-500 pt-4 text-sm">
            <p className="flex justify-between">
              <span>{t('cart.total')}</span>
              <span>{formatPrice(subtotal, lang)}</span>
            </p>
            <p className="flex justify-between text-sand-300">
              <span>{t('bonus.discount')}</span>
              <span>−{formatPrice(bonusUsed, lang)}</span>
            </p>
          </div>
        )}
        <p className="mt-4 flex items-baseline justify-between border-t border-brand-500 pt-4 font-bold text-sand-50">
          <span>{t('bonus.toPay')}</span>
          <span className="font-display text-2xl font-extrabold">{formatPrice(toPay, lang)}</span>
        </p>

        {user && balance > 0 && (
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-brand-700 px-3 py-2.5">
            <input
              type="checkbox"
              checked={applyBonuses}
              onChange={(e) => setApplyBonuses(e.target.checked)}
              className="h-5 w-5 accent-sunset-500"
            />
            <span>
              <span className="block font-bold text-sand-50">
                {t('bonus.useBalance', { amount: formatPrice(Math.min(balance, subtotal), lang) })}
              </span>
              <span className="text-xs">{t('bonus.available', { amount: formatPrice(balance, lang) })}</span>
            </span>
          </label>
        )}
        <p className="mt-4 rounded-xl bg-sand-50 px-3 py-2.5 text-sm text-ink">
          {user ? (
            t('bonus.willEarn', { amount: formatPrice(willEarn, lang) })
          ) : (
            <>
              {t('bonus.guestHint', { amount: formatPrice(willEarn, lang) })}{' '}
              <Link to="/login" className="font-bold text-brand-600 underline">
                {t('bonus.signIn')}
              </Link>
            </>
          )}
        </p>
      </aside>
    </div>
  )
}
