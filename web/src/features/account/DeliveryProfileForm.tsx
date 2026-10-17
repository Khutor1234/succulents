import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { ICON } from '../../shared/icon'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '../../shared/ui'
import {
  deliveryProfileSchema,
  useDeliveryProfile,
  useSaveDeliveryProfile,
  type DeliveryProfile,
  type DeliveryProfileInput,
} from './profile'

export function DeliveryProfileSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useDeliveryProfile()

  return (
    <section className="rounded-[32px] border-2 border-sand-200 bg-sand-50 p-6">
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-brand-600">
        <MapPin {...ICON} />
        {t('profile.title')}
      </h2>
      <p className="mt-1 mb-5 text-sand-700">{t('profile.hint')}</p>
      {isLoading || !data ? (
        <p className="text-sand-700">{t('loading')}</p>
      ) : (
        // key: форма створюється з уже завантаженими даними як значеннями за замовчуванням
        <ProfileForm key={JSON.stringify(data)} initial={data} />
      )}
    </section>
  )
}

function ProfileForm({ initial }: { initial: DeliveryProfile }) {
  const { t } = useTranslation()
  const save = useSaveDeliveryProfile()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<DeliveryProfileInput, unknown, DeliveryProfile>({
    resolver: zodResolver(deliveryProfileSchema),
    defaultValues: initial,
  })
  const err = (key?: string) => (key ? t(key) : undefined)

  return (
    <form onSubmit={handleSubmit((d) => save.mutateAsync(d))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('checkout.fullName')} autoComplete="name" {...register('fullName')} error={err(errors.fullName?.message)} />
        <Input
          label={t('checkout.phone')}
          type="tel"
          autoComplete="tel"
          placeholder="+380 67 123 45 67"
          {...register('phone')}
          error={err(errors.phone?.message)}
        />
        <Input label={t('checkout.city')} autoComplete="address-level2" {...register('city')} error={err(errors.city?.message)} />
        <Input label={t('checkout.warehouse')} placeholder="№ 12" {...register('warehouse')} error={err(errors.warehouse?.message)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? t('admin.saving') : t('admin.save')}
        </Button>
        {save.isSuccess && !isDirty && <span className="font-medium text-brand-600">{t('admin.saved')}</span>}
        {save.isError && <span className="text-red-700">{t('admin.saveError')}</span>}
      </div>
    </form>
  )
}
