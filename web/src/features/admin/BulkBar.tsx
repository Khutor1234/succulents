import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { CheckSquare, Eye, EyeOff, Minus, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../../firebase/config'
import { parseForms, withForms } from '../../lib/plantName'
import { PLANT_CATEGORY, PLANT_TAGS, STATE_TAGS, type PlantTag } from '../../lib/plants'
import type { Product } from '../../lib/types'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

type Action = { kind: 'tag'; tag: PlantTag; add: boolean } | { kind: 'show' } | { kind: 'hide' } | { kind: 'delete' }

/**
 * Що змінити в товарі. Форми (variegata, cristata, monstrose) — частина назви рослини за правилами таблиці
 * («Echeveria Lola» + variegata = «Echeveria Lola variegata»), тож разом із тегом оновлюємо й назву.
 * Показати / приховати — лише видимість для покупців; залишок на складі не змінюється.
 */
function changesFor(p: Product, action: Action): Record<string, unknown> | null {
  if (action.kind === 'show') return p.isActive ? null : { isActive: true }
  if (action.kind === 'hide') return p.isActive ? { isActive: false } : null
  if (action.kind !== 'tag') return null
  const tags = p.tags ?? []
  if (action.add === tags.includes(action.tag)) return null
  const next = action.add ? [...tags, action.tag] : tags.filter((t) => t !== action.tag)
  const out: Record<string, unknown> = { tags: next }
  if (p.category === PLANT_CATEGORY && STATE_TAGS.includes(action.tag)) {
    const { base } = parseForms(p.name.uk)
    out['name.uk'] = withForms(base, next)
  }
  return out
}

function useBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ products, action }: { products: Product[]; action: Action }) => {
      let done = 0
      for (let i = 0; i < products.length; i += CHUNK) {
        const batch = writeBatch(db)
        for (const p of products.slice(i, i + CHUNK)) {
          const ref = doc(db, 'products', p.id)
          if (action.kind === 'delete') {
            batch.delete(ref)
            done++
            continue
          }
          const changes = changesFor(p, action)
          if (!changes) continue
          batch.update(ref, { ...changes, updatedAt: serverTimestamp() })
          done++
        }
        await batch.commit()
      }
      return done
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * Панель дій над кількома вибраними товарами (знизу екрана, над нижнім меню):
 * додати чи прибрати тег, показати, приховати, видалити.
 */
export function BulkBar({
  selected,
  total,
  onSelectAll,
  onClear,
  onClose,
}: {
  selected: Product[]
  total: number
  onSelectAll: () => void
  onClear: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const bulk = useBulk()
  const [tagMenu, setTagMenu] = useState<'add' | 'remove' | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const n = selected.length

  function run(action: Action) {
    setTagMenu(null)
    if (action.kind === 'delete' && !window.confirm(t('admin.bulk.deleteConfirm', { count: n }))) return
    bulk.mutate(
      { products: selected, action },
      {
        onSuccess: (count) => {
          setDone(t('admin.bulk.done', { count }))
          onClear()
        },
      },
    )
  }

  // Усі кнопки дій однакові на вигляд; вибрана (відкрита) — зафарбована, щоб було видно, що зараз обрано
  const action = (on: boolean, danger = false) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors disabled:opacity-40 ${
      on
        ? 'border-brand-600 bg-brand-600 text-sand-50'
        : danger
          ? 'border-sand-300 bg-sand-50 text-red-700 hover:border-red-700'
          : 'border-sand-300 bg-sand-50 text-ink hover:border-brand-600'
    }`
  const disabled = !n || bulk.isPending

  return (
    <div className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.5rem)] z-30 mt-4 rounded-3xl border-2 border-brand-600 bg-sand-50/95 p-3 shadow-[0_-12px_30px_-12px_rgba(43,33,24,0.35)] backdrop-blur-md">
      {/* 1. Скільки вибрано (або підказка, що робити) */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto" aria-live="polite">
          <span className="block font-display text-lg leading-tight font-extrabold text-brand-600">{t('admin.bulk.selected', { count: n })}</span>
          <span className="text-xs text-sand-700">{n ? t('admin.bulk.stepAction') : t('admin.bulk.stepPick')}</span>
        </p>
        <button type="button" onClick={n === total ? onClear : onSelectAll} className={action(false)}>
          <CheckSquare size={16} strokeWidth={2.4} aria-hidden />
          {n === total ? t('admin.bulk.none') : t('admin.bulk.all', { count: total })}
        </button>
        <button type="button" onClick={onClose} aria-label={t('admin.bulk.close')} className={`${action(false)} px-2.5`}>
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      {/* 2. Що зробити з вибраними */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <button type="button" disabled={disabled} aria-pressed={tagMenu === 'add'} onClick={() => setTagMenu(tagMenu === 'add' ? null : 'add')} className={action(tagMenu === 'add')}>
          <Plus size={16} strokeWidth={2.4} aria-hidden />
          {t('admin.bulk.addTag')}
        </button>
        <button type="button" disabled={disabled} aria-pressed={tagMenu === 'remove'} onClick={() => setTagMenu(tagMenu === 'remove' ? null : 'remove')} className={action(tagMenu === 'remove')}>
          <Minus size={16} strokeWidth={2.4} aria-hidden />
          {t('admin.bulk.removeTag')}
        </button>
        <button type="button" disabled={disabled} onClick={() => run({ kind: 'show' })} className={action(false)}>
          <Eye size={16} strokeWidth={2.4} aria-hidden />
          {t('admin.show')}
        </button>
        <button type="button" disabled={disabled} onClick={() => run({ kind: 'hide' })} className={action(false)}>
          <EyeOff size={16} strokeWidth={2.4} aria-hidden />
          {t('admin.hide')}
        </button>
        <button type="button" disabled={disabled} onClick={() => run({ kind: 'delete' })} className={action(false, true)}>
          <Trash2 size={16} strokeWidth={2.4} aria-hidden />
          {t('admin.bulk.delete')}
        </button>
      </div>

      {/* 3. Для тегу — який саме (окремим рядком під вибраною дією) */}
      {tagMenu && (
        <div className="mt-2 rounded-2xl bg-brand-50 p-2.5">
          <p className="mb-2 text-sm font-bold text-brand-700">{t(tagMenu === 'add' ? 'admin.bulk.addWhich' : 'admin.bulk.removeWhich')}</p>
          <div className="flex flex-wrap gap-2">
            {PLANT_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => run({ kind: 'tag', tag, add: tagMenu === 'add' })} className={action(false)}>
                {tagMenu === 'add' ? <Plus size={14} strokeWidth={2.6} aria-hidden /> : <Minus size={14} strokeWidth={2.6} aria-hidden />}
                {t(`tags.${tag}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Результат */}
      {bulk.isPending && <p className="mt-2 rounded-xl bg-sand-200 px-3 py-2 text-sm font-bold">{t('admin.saving')}</p>}
      {done && !bulk.isPending && !n && <p className="mt-2 rounded-xl bg-brand-100 px-3 py-2 text-sm font-bold text-brand-700">{done}</p>}
      {bulk.isError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{t('admin.saveError')}</p>}
    </div>
  )
}
