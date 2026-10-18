import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { db } from '../../firebase/config'
import { ICON } from '../../shared/icon'
import { Button } from '../../shared/ui'
import { useAllProducts } from './api'
import { BackLink } from './BackLink'
import { parseSheet, planImport, type ImportPlan } from './sheetImport'

/** Firestore приймає до 500 записів за раз — ділимо з запасом. */
const CHUNK = 400

function useApplyImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plan: ImportPlan) => {
      const writes = [
        ...plan.renames.map((r) => (batch: ReturnType<typeof writeBatch>) =>
          batch.update(doc(db, 'products', r.id), { 'name.uk': r.to, ...(r.tags ? { tags: r.tags } : {}), updatedAt: serverTimestamp() }),
        ),
        ...plan.creates.map((c) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(doc(db, 'products', c.id), { ...c.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        ),
      ]
      for (let i = 0; i < writes.length; i += CHUNK) {
        const batch = writeBatch(db)
        writes.slice(i, i + CHUNK).forEach((w) => w(batch))
        await batch.commit()
      }
      return { renamed: plan.renames.length, created: plan.creates.length }
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
  const hasChanges = !!plan && plan.renames.length + plan.creates.length > 0

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

          <p className="text-sand-700">{t('admin.import.unchanged', { count: plan.unchanged })}</p>

          <Section title={t('admin.import.notInSheet', { count: plan.notInSheet.length })}>
            {plan.notInSheet.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </Section>

          {apply.isSuccess ? (
            <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.import.done', apply.data)}</p>
          ) : hasChanges ? (
            <Button onClick={() => apply.mutate(plan)} disabled={apply.isPending}>
              {apply.isPending ? t('admin.import.applying') : t('admin.import.apply')}
            </Button>
          ) : (
            <p className="font-bold text-brand-700">{t('admin.import.nothing')}</p>
          )}
          {apply.isError && <p className="text-red-700">{String(apply.error)}</p>}
        </div>
      )}

      {/* Окремий інструмент: після імпорту нові варієгати часто мають батьків гібрида — їх можна виправити одним махом */}
      <Link
        to="/admin/forms"
        className="group mt-8 flex items-center gap-4 rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 transition-colors hover:border-brand-500"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sunset-100 text-sunset-700">
          <Sparkles size={22} strokeWidth={2.25} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold group-hover:text-brand-600">{t('admin.formFixes.title')}</span>
          <span className="mt-0.5 block text-sm text-sand-700">{t('admin.formFixes.cardHint')}</span>
        </span>
        <ChevronRight {...ICON} className="shrink-0 text-sand-700 transition-transform group-hover:translate-x-1" />
      </Link>
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
