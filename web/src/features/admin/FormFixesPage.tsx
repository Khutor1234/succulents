import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import { Button } from '../../shared/ui'
import { useAllProducts } from './api'
import { BackLink } from './BackLink'
import { planFormFixes, type FormFix } from './formFixes'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

function useApplyFixes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fixes: FormFix[]) => {
      for (let i = 0; i < fixes.length; i += CHUNK) {
        const batch = writeBatch(db)
        // Як збереження форми з «Відбір або мутація»: одна рослина-джерело, без ареалу. Селекціонера не чіпаємо.
        for (const f of fixes.slice(i, i + CHUNK))
          batch.update(doc(db, 'products', f.id), { origin: 'cultivar', parents: [f.source], habitat: '', updatedAt: serverTimestamp() })
        await batch.commit()
      }
      return fixes.length
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * /admin/forms — «Виправити форми»: варієгати, кристати й монстрози стають «Відбір або мутація» від звичайної версії.
 * Спершу список «було → стане», кожен рядок можна зняти галочкою; записується лише після «Застосувати».
 */
export function FormFixesPage() {
  const { t } = useTranslation()
  const { data: products, isLoading } = useAllProducts()
  const apply = useApplyFixes()
  const plan = useMemo(() => (products ? planFormFixes(products) : null), [products])
  // Зняті галочки (за замовчуванням вибрано все)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const chosen = plan?.fixes.filter((f) => !skipped.has(f.id)) ?? []

  const toggle = (id: string) => {
    const next = new Set(skipped)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSkipped(next)
  }
  const before = (f: FormFix) =>
    [f.before.origin ? t(`admin.fields.origins.${f.before.origin}`) : t('admin.formFixes.noOrigin'), f.before.parents.join(' × ')]
      .filter(Boolean)
      .join(': ')

  return (
    <div className="max-w-4xl">
      <BackLink fallback="/admin/import" />
      <h1 className="mb-4 font-display text-3xl font-extrabold text-brand-600">{t('admin.formFixes.title')}</h1>
      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sand-100 p-4 text-sm leading-relaxed text-sand-800">
        <Sparkles size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
        <span>{t('admin.formFixes.hint')}</span>
      </p>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}

      {plan && (
        <div className="space-y-4">
          {/* Після «Застосувати» список перераховується — у ньому лишаються рядки, з яких зняли галочку */}
          {apply.isSuccess && <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.formFixes.done', { count: apply.data })}</p>}
          {plan.fixes.length === 0 ? (
            <p className="font-bold text-brand-700">{t('admin.formFixes.nothing')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">{t('admin.formFixes.found', { count: plan.fixes.length })}</p>
                <button
                  type="button"
                  onClick={() => setSkipped(skipped.size ? new Set() : new Set(plan.fixes.map((f) => f.id)))}
                  className="text-sm font-bold text-brand-600 underline"
                >
                  {skipped.size ? t('admin.formFixes.selectAll') : t('admin.formFixes.selectNone')}
                </button>
              </div>
              <ul className="space-y-2">
                {plan.fixes.map((f) => (
                  <li key={f.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-colors ${
                        skipped.has(f.id) ? 'border-sand-200 bg-sand-50 opacity-60' : 'border-brand-500/40 bg-sand-50'
                      }`}
                    >
                      <input type="checkbox" checked={!skipped.has(f.id)} onChange={() => toggle(f.id)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        <Link to={`/admin/products/${f.id}`} state={{ from: '/admin/forms' }} className="font-bold hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                          {f.name}
                        </Link>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="text-sand-700 line-through">{before(f)}</span>
                          <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-sand-700" aria-hidden />
                          <span className="font-bold text-brand-700">{t('admin.formFixes.after', { name: f.source })}</span>
                        </span>
                        {!f.sourceInShop && <span className="mt-1 block text-xs text-sand-700">{t('admin.formFixes.notInShop')}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="sticky bottom-[var(--bottom-nav-h,0px)] z-30 -mx-4 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <Button onClick={() => apply.mutate(chosen)} disabled={apply.isPending || chosen.length === 0}>
                  {apply.isPending ? t('admin.import.applying') : t('admin.formFixes.apply', { count: chosen.length })}
                </Button>
              </div>
            </>
          )}
          {apply.isError && <p className="text-red-700">{t('admin.saveError')}</p>}

          {plan.ok > 0 && <p className="text-sm text-sand-700">{t('admin.formFixes.ok', { count: plan.ok })}</p>}
        </div>
      )}
    </div>
  )
}
