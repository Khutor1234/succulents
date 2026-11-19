import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { FileSpreadsheet, SearchCheck, Sparkles, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router'
import { db } from '../../firebase/config'
import { Button, SmallImage } from '../../shared/ui'
import { useAllProducts, useOriginChecks } from './api'
import { FixesTab } from './FixesTab'
import { useFixPlan } from './allFixes'
import { ImportPage } from './ImportPage'
import { TabBar, useTab } from './TabBar'
import { OriginsTab } from './OriginCheckPage'
import { planOriginFixes, rowFromCells } from './originCheck'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

/** Записує зміни пачками; `patch` — що змінити в товарі. */
export function useApplyFixes<T extends { id: string }>(patch: (fix: T) => Record<string, unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fixes: T[]) => {
      for (let i = 0; i < fixes.length; i += CHUNK) {
        const batch = writeBatch(db)
        for (const f of fixes.slice(i, i + CHUNK)) batch.update(doc(db, 'products', f.id), { ...patch(f), updatedAt: serverTimestamp() })
        await batch.commit()
      }
      return fixes.length
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

const TABS = ['import', 'fixes', 'origins'] as const
/** Колишні вкладки, тепер — одна «Виправлення» */
const OLD_TABS = ['forms', 'names', 'cultivars']
type Tab = (typeof TABS)[number]
const TAB_ICONS = { import: FileSpreadsheet, fixes: Wand2, origins: SearchCheck }

/**
 * /admin/tools — «Інструменти»: зміни одразу в багатьох товарах, вкладки (?tab=…):
 * - «Імпорт з таблиці» (ImportPage.tsx) — перша, без параметра;
 * - «Виправлення» (fixes, FixesTab.tsx): усі правила разом — форми, селекціонер, інші назви, назви батьків, походження,
 *   культивари й лапки (колишні вкладки forms / names / cultivars ведуть сюди);
 * - «Перевірка походження» (origins, OriginCheckPage.tsx) — звірка з довідковими сайтами.
 * Спершу список «було → стане», кожен рядок можна зняти галочкою; записується лише після «Застосувати».
 */
export function FormFixesPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const [tab, setTab] = useTab(TABS)
  const { data: products, isLoading } = useAllProducts()
  const { data: checks } = useOriginChecks()
  const fixPlan = useFixPlan(products)
  // Скільки рослин можна виправити на кожній вкладці — у дужках біля назви вкладки
  const counts = useMemo(
    (): Partial<Record<Tab, number>> =>
      products
        ? {
            fixes: fixPlan.active.length,
            origins: planOriginFixes(products, (checks ?? []).map((c) => rowFromCells(c.cells))).fixes.length,
          }
        : {},
    [products, checks, fixPlan],
  )

  // Стара адреса (?tab=forms / names / cultivars) — на нову спільну вкладку
  if (OLD_TABS.includes(params.get('tab') ?? '')) return <Navigate to="/admin/tools?tab=fixes" replace />

  return (
    <div className="max-w-4xl">
      <h1 className="sr-only">{t('admin.home.tools')}</h1>
      <div className="mb-4">
        <TabBar
          label={t('admin.home.tools')}
          active={tab}
          onChange={setTab}
          tabs={TABS.map((id) => ({ id, label: t(`admin.fixes.tabs.${id}`), short: t(`admin.fixes.tabsShort.${id}`), Icon: TAB_ICONS[id], count: counts[id] }))}
        />
      </div>

      {/* key: при перемиканні вкладок галочки й повідомлення «Готово» починаються заново */}
      {tab === 'import' ? (
        <ImportPage key="import" />
      ) : tab === 'origins' ? (
        <OriginsTab key="origins" />
      ) : (
        <>
          {isLoading && <p className="text-sand-700">{t('loading')}</p>}
          {products && <FixesTab key="fixes" products={products} />}
        </>
      )}
    </div>
  )
}

export function Hint({ children }: { children: string }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl bg-sand-100 p-4 text-sm leading-relaxed text-sand-800">
      <Sparkles size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-sunset-600" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/**
 * Спільна частина обох вкладок: «Знайдено N», «Вибрати / зняти всі», рядки з галочками й кнопка «Застосувати».
 * Спершу нічого не вибрано: продавець сам ставить галочки на тих, кого виправити.
 * Після «Застосувати» список перераховується — у ньому лишаються невибрані рядки, а галочки знову зняті.
 */
export function FixList<T extends { id: string; slug: string; name: string; image?: string }>({
  fixes,
  apply,
  row,
  aside,
  selection,
  selectable,
  alsoChosen,
  onApplied,
}: {
  fixes: T[]
  apply: ReturnType<typeof useApplyFixes<T>>
  /** Вміст рядка; chosen — чи стоїть галочка на цій рослині */
  row: (fix: T, chosen: boolean) => React.ReactNode
  /** Кнопка праворуч у рядку (напр. «Видалити правку») — натискання не ставить галочку */
  aside?: (fix: T) => React.ReactNode
  /** Галочки рядків ззовні (коли сторінці треба знати, що вибрано) */
  selection?: [Set<string>, (s: Set<string>) => void]
  /** Чи є в рядку що вибирати галочкою рядка (немає — галочки немає) */
  selectable?: (fix: T) => boolean
  /** Рядок треба застосувати й без галочки рядка (напр. вибрано лише опис) */
  alsoChosen?: (fix: T) => boolean
  /** Після «Застосувати» — напр. зняти й інші галочки сторінки */
  onApplied?: () => void
}) {
  const { t } = useTranslation()
  // Вибрані галочками (за замовчуванням — жодного)
  const own = useState<Set<string>>(new Set())
  const [selected, setSelected] = selection ?? own
  const canSelect = (f: T) => selectable?.(f) ?? true
  const chosen = fixes.filter((f) => selected.has(f.id) || alsoChosen?.(f))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const pickable = fixes.filter(canSelect)
  const allChosen = pickable.length > 0 && pickable.every((f) => selected.has(f.id))
  return (
    <>
      {apply.isSuccess && <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.formFixes.done', { count: apply.data })}</p>}
      {fixes.length === 0 ? (
        <p className="font-bold text-brand-700">{t('admin.formFixes.nothing')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">{t('admin.formFixes.found', { count: fixes.length })}</p>
            <button
              type="button"
              onClick={() => setSelected(allChosen ? new Set() : new Set(pickable.map((f) => f.id)))}
              className="text-sm font-bold text-brand-600 underline"
            >
              {allChosen ? t('admin.formFixes.selectNone') : t('admin.formFixes.selectAll')}
            </button>
          </div>
          <ul className="space-y-2">
            {fixes.map((f) => (
              <li key={f.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-colors ${
                    selected.has(f.id) || alsoChosen?.(f) ? 'border-brand-600 bg-brand-100/40' : 'border-sand-200 bg-sand-50 hover:border-brand-500/40'
                  }`}
                >
                  {canSelect(f) ? (
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                  ) : (
                    <span className="w-5 shrink-0" aria-hidden />
                  )}
                  {/* Мале фото — щоб одразу було видно, про яку рослину правка */}
                  {f.image && (
                    <Link to={`/product/${f.slug}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <SmallImage src={f.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    </Link>
                  )}
                  <span className="min-w-0 flex-1">
                    {/* Назва — на сторінку самої рослини (там є й «Редагувати») */}
                    <Link to={`/product/${f.slug}`} className="font-bold hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                      {f.name}
                    </Link>
                    {row(f, selected.has(f.id))}
                  </span>
                  {aside?.(f)}
                </label>
              </li>
            ))}
          </ul>
          {/* Кнопка «Застосувати» завжди під рукою: телефон — смуга над нижнім меню, комп'ютер — плаваюча внизу екрана */}
          <div className="sticky bottom-[var(--bottom-nav-h,0px)] z-30 -mx-4 border-t-2 border-sand-200 bg-sand-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:bottom-4 sm:mr-0 sm:ml-auto sm:w-fit sm:rounded-2xl sm:border-2 sm:bg-sand-50/95 sm:p-2 sm:shadow-lg">
            <Button onClick={() => apply.mutate(chosen, {
                onSuccess: () => {
                  setSelected(new Set())
                  onApplied?.()
                },
              })} disabled={apply.isPending || chosen.length === 0}>
              {apply.isPending
                ? t('admin.import.applying')
                : chosen.length === 0
                  ? t('admin.formFixes.chooseFirst')
                  : t('admin.formFixes.apply', { count: chosen.length })}
            </Button>
          </div>
        </>
      )}
      {apply.isError && <p className="text-red-700">{t('admin.saveError')}</p>}
    </>
  )
}
