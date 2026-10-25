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

/** Що саме записати — лише рядки, на яких лишилась галочка. */
interface ChosenImport {
  renames: ImportPlan['renames']
  creates: ImportPlan['creates']
  updates: ProductUpdate[]
}

function useApplyImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ renames, creates, updates }: ChosenImport) => {
      const writes = [
        ...renames.map((r) => (batch: ReturnType<typeof writeBatch>) =>
          batch.update(doc(db, 'products', r.id), { 'name.uk': r.to, ...(r.tags ? { tags: r.tags } : {}), updatedAt: serverTimestamp() }),
        ),
        ...creates.map((c) => (batch: ReturnType<typeof writeBatch>) =>
          batch.set(doc(db, 'products', c.id), { ...c.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        ),
        ...updates.map((u) => (batch: ReturnType<typeof writeBatch>) => batch.update(doc(db, 'products', u.id), { ...u.patch, updatedAt: serverTimestamp() })),
      ]
      for (let i = 0; i < writes.length; i += CHUNK) {
        const batch = writeBatch(db)
        writes.slice(i, i + CHUNK).forEach((w) => w(batch))
        await batch.commit()
      }
      return { renamed: renames.length, created: creates.length, updated: updates.length }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

// Ключі галочок: розділ + id товару (той самий товар може бути і в «Нових назвах», і в «Оновити дані»)
const renameKey = (id: string) => `rename:${id}`
const createKey = (id: string) => `create:${id}`
const updateKey = (id: string) => `update:${id}`

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
  // Усе вибране, доки продавчиня не зніме галочку; нова вставка таблиці — знову все вибране
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const setAll = (keys: string[], on: boolean) =>
    setSkipped((s) => {
      const next = new Set(s)
      keys.forEach((k) => (on ? next.delete(k) : next.add(k)))
      return next
    })

  const chosen: ChosenImport = {
    renames: plan?.renames.filter((r) => !skipped.has(renameKey(r.id))) ?? [],
    creates: plan?.creates.filter((c) => !skipped.has(createKey(c.id))) ?? [],
    updates: plan?.updates.filter((u) => !skipped.has(updateKey(u.id))) ?? [],
  }
  const hasChanges = chosen.renames.length + chosen.creates.length + chosen.updates.length > 0
  const fieldValue = (field: string, value: string) => (field === 'origin' && value ? t(`admin.fields.origins.${value}`) : value)

  return (
    <div className="max-w-4xl">
      <BackLink />
      <h1 className="mb-4 font-display text-3xl font-extrabold text-brand-600">{t('admin.import.title')}</h1>
      <p className="mb-3 text-sand-800">{t('admin.import.hint')}</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSkipped(new Set())
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
          <p className="text-sm text-sand-700">{t('admin.import.choiceHint')}</p>

          <ChoiceSection
            title={t('admin.import.renames', { count: plan.renames.length })}
            items={plan.renames.map((r) => ({
              key: renameKey(r.id),
              content: <WasWill was={r.from} will={r.to} />,
            }))}
            skipped={skipped}
            onToggle={toggle}
            onAll={setAll}
          />

          <ChoiceSection
            title={t('admin.import.creates', { count: plan.creates.length })}
            items={plan.creates.map((c) => ({
              key: createKey(c.id),
              content: (
                <>
                  <span className="block text-base font-bold">{c.data.name.uk}</span>
                  <span className="text-sand-700">
                    {c.data.price / 100} ₴ · {t('admin.import.row', { rows: c.rows.join(', ') })}
                  </span>
                </>
              ),
            }))}
            skipped={skipped}
            onToggle={toggle}
            onAll={setAll}
          />

          {/* Наявні рослини, у яких у таблиці інші дані: для кожного поля — що було і що стане */}
          <ChoiceSection
            title={t('admin.import.updates', { count: plan.updates.length })}
            hint={t('admin.import.updatesHint')}
            items={plan.updates.map((u) => ({
              key: updateKey(u.id),
              content: (
                <>
                  <span className="block text-base font-bold">{u.name}</span>
                  {u.changes.map((c) => (
                    <span key={c.field} className="mt-2 block">
                      <span className="block font-bold text-sand-800">{t(`admin.import.fields.${c.field}`)}</span>
                      <WasWill was={fieldValue(c.field, c.from)} will={fieldValue(c.field, c.to)} />
                    </span>
                  ))}
                </>
              ),
            }))}
            skipped={skipped}
            onToggle={toggle}
            onAll={setAll}
          />

          <p className="text-sand-700">{t('admin.import.unchanged', { count: plan.unchanged })}</p>

          <Section title={t('admin.import.notInSheet', { count: plan.notInSheet.length })}>
            {plan.notInSheet.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </Section>

          {apply.isSuccess ? (
            <p className="rounded-xl bg-brand-100 p-3 font-bold text-brand-700">{t('admin.import.done', apply.data)}</p>
          ) : hasChanges ? (
            <Button onClick={() => apply.mutate(chosen)} disabled={apply.isPending}>
              {apply.isPending ? t('admin.import.applying') : t('admin.import.applyChosen', { count: chosen.renames.length + chosen.creates.length + chosen.updates.length })}
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

/** «Було» (закреслене, або «порожньо») і «Стане» — двома рядками, щоб одразу видно, що змінюється. */
function WasWill({ was, will }: { was: string; will: string }) {
  const { t } = useTranslation()
  return (
    <span className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      <span className="text-sand-700">{t('admin.import.was')}</span>
      {was ? <span className="text-sand-700 line-through">{was}</span> : <span className="text-sand-700 italic">{t('admin.import.empty')}</span>}
      <span className="font-bold text-brand-700">{t('admin.import.will')}</span>
      <span className="font-bold text-brand-700">{will}</span>
    </span>
  )
}

/** Розділ зі списком змін, кожну можна застосувати (галочка) чи пропустити; «Вибрати всі / Зняти всі» — для розділу. */
function ChoiceSection({
  title,
  hint,
  items,
  skipped,
  onToggle,
  onAll,
}: {
  title: string
  hint?: string
  items: { key: string; content: ReactNode }[]
  skipped: Set<string>
  onToggle: (key: string) => void
  onAll: (keys: string[], on: boolean) => void
}) {
  const { t } = useTranslation()
  if (!items.length) return null
  const keys = items.map((i) => i.key)
  const chosen = keys.filter((k) => !skipped.has(k)).length
  return (
    <details open className="rounded-xl bg-sand-100 p-3">
      <summary className="cursor-pointer font-bold">
        {title} <span className="font-normal text-sand-700">· {t('admin.import.chosen', { chosen, total: items.length })}</span>
      </summary>
      {hint && <p className="mt-1 text-sm text-sand-700">{hint}</p>}
      <div className="mt-2 flex gap-3 text-sm font-bold">
        <button type="button" className="text-brand-600 underline" onClick={() => onAll(keys, true)}>
          {t('admin.formFixes.selectAll')}
        </button>
        <button type="button" className="text-brand-600 underline" onClick={() => onAll(keys, false)}>
          {t('admin.formFixes.selectNone')}
        </button>
      </div>
      <ul className="mt-2 max-h-[32rem] space-y-2 overflow-y-auto">
        {items.map(({ key, content }) => {
          const on = !skipped.has(key)
          return (
            <li key={key}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-sand-50 p-3 transition-colors ${on ? 'border-brand-500/50' : 'border-sand-200 opacity-60'}`}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(key)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                <span className="min-w-0 flex-1 text-sm">{content}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </details>
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
