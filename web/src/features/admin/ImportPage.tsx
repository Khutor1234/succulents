import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../../firebase/config'
import { Button } from '../../shared/ui'
import { useAllProducts } from './api'
import { BackLink } from './BackLink'
import { parseSheet, planImport, type ImportPlan, type ProductUpdate } from './sheetImport'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

function useApplyImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ plan, updates }: { plan: ImportPlan; updates: ProductUpdate[] }) => {
      const writes = [
        ...plan.renames.map((r) => (batch: ReturnType<typeof writeBatch>) =>
          batch.update(doc(db, 'products', r.id), { 'name.uk': r.to, ...(r.tags ? { tags: r.tags } : {}), updatedAt: serverTimestamp() }),
        ),
        ...plan.creates.map((c) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(doc(db, 'products', c.id), { ...c.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        ),
        // Оновлення даних наявних рослин — лише вибрані галочками
        ...updates.map((u) => (batch: ReturnType<typeof writeBatch>) => batch.update(doc(db, 'products', u.id), { ...u.patch, updatedAt: serverTimestamp() })),
      ]
      for (let i = 0; i < writes.length; i += CHUNK) {
        const batch = writeBatch(db)
        writes.slice(i, i + CHUNK).forEach((w) => w(batch))
        await batch.commit()
      }
      return { renamed: plan.renames.length, created: plan.creates.length, updated: updates.length }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function ImportPage() {
  const { t } = useTranslation()
  const { data: products, isLoading } = useAllProducts()
  const apply = useApplyImport()
  const [text, setText] = useState('')

  const plants = useMemo(() => (text.trim() ? parseSheet(text) : []), [text])
  const plan = useMemo(
    () => (products && plants.length ? planImport(plants, products, new Date().toISOString().slice(0, 10)) : null),
    [plants, products],
  )
  // Оновлення даних: усі вибрані, доки продавчиня не зніме галочку
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const chosenUpdates = plan?.updates.filter((u) => !skipped.has(u.id)) ?? []
  const toggleUpdate = (id: string) =>
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const hasChanges = !!plan && plan.renames.length + plan.creates.length + chosenUpdates.length > 0

  return (
    <div className="max-w-4xl">
      <BackLink />
      <h1 className="mb-4 font-display text-3xl font-extrabold text-brand-600">{t('admin.import.title')}</h1>
      <p className="mb-3 text-sand-800">{t('admin.import.hint')}</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          apply.reset()
        }}
        placeholder={t('admin.import.paste')}
        rows={6}
        className="w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2.5 font-mono text-base focus:border-brand-500 md:text-sm focus:outline-none"
      />

      {isLoading && <p className="mt-3 text-sand-700">…</p>}

      {plan && (
        <div className="mt-4 space-y-3">
          <p className="font-bold">{t('admin.import.rows', { count: plants.length })}</p>

          <Section title={t('admin.import.renames', { count: plan.renames.length })} open>
            {plan.renames.map((r) => (
              <li key={r.id}>
                <span className="text-sand-700 line-through">{r.from}</span> → <span className="font-bold">{r.to}</span>
              </li>
            ))}
          </Section>

          <Section title={t('admin.import.creates', { count: plan.creates.length })} open>
            {plan.creates.map((c) => (
              <li key={c.id}>
                <span className="font-bold">{c.data.name.uk}</span>{' '}
                <span className="text-sand-700">
                  · {c.data.price / 100} ₴ · {t('admin.import.row', { rows: c.rows.join(', ') })}
                </span>
              </li>
            ))}
          </Section>

          {/* Наявні рослини, у яких у таблиці інші дані: кожну можна застосувати чи пропустити */}
          {plan.updates.length > 0 && (
            <details open className="rounded-xl bg-sand-100 p-3">
              <summary className="cursor-pointer font-bold">{t('admin.import.updates', { count: plan.updates.length })}</summary>
              <p className="mt-1 text-sm text-sand-700">{t('admin.import.updatesHint')}</p>
              <div className="mt-2 flex gap-3 text-sm font-bold">
                <button type="button" className="text-brand-600 underline" onClick={() => setSkipped(new Set())}>{t('admin.formFixes.selectAll')}</button>
                <button type="button" className="text-brand-600 underline" onClick={() => setSkipped(new Set(plan.updates.map((u) => u.id)))}>{t('admin.formFixes.selectNone')}</button>
              </div>
              <ul className="mt-2 max-h-[32rem] space-y-2 overflow-y-auto">
                {plan.updates.map((u) => {
                  const on = !skipped.has(u.id)
                  return (
                    <li key={u.id}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-sand-50 p-3 transition-colors ${on ? 'border-brand-500/50' : 'border-sand-200 opacity-60'}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleUpdate(u.id)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="block text-base font-bold">{u.name}</span>
                          {u.changes.map((c) => (
                            <span key={c.field} className="mt-1 block">
                              <span className="font-bold text-sand-700">{t(`admin.import.fields.${c.field}`)}: </span>
                              {c.from && <span className="text-sand-700 line-through">{c.field === 'origin' ? t(`admin.fields.origins.${c.from}`) : c.from}</span>}
                              {c.from && ' → '}
                              <span className="font-bold text-brand-700">{c.field === 'origin' ? t(`admin.fields.origins.${c.to}`) : c.to}</span>
                            </span>
                          ))}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}

          <p className="text-sand-700">{t('admin.import.unchanged', { count: plan.unchanged })}</p>

          <Section title={t('admin.import.notInSheet', { count: plan.notInSheet.length })}>
            {plan.notInSheet.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </Section>

          {apply.isSuccess ? (
            <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.import.done', apply.data)}</p>
          ) : hasChanges ? (
            <Button onClick={() => apply.mutate({ plan, updates: chosenUpdates })} disabled={apply.isPending}>
              {apply.isPending ? t('admin.import.applying') : t('admin.import.apply')}
            </Button>
          ) : (
            <p className="font-bold text-brand-700">{t('admin.import.nothing')}</p>
          )}
          {apply.isError && <p className="text-red-700">{String(apply.error)}</p>}
        </div>
      )}

    </div>
  )
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="rounded-xl bg-sand-100 p-3">
      <summary className="cursor-pointer font-bold">{title}</summary>
      <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-sm">{children}</ul>
    </details>
  )
}
