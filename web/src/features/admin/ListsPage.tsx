import { Check, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { withCuttingMark } from '../../lib/plantName'
import type { Product } from '../../lib/types'
import { SmallImage, SucculentIcon } from '../../shared/ui'
import { useAllProducts } from './api'
import { useClearDone, useCreateList, useDeleteList, useRenameList, useSellerLists, useToggleDone, useToggleInList, type SellerList } from './lists'

/**
 * «Товари → Списки» (?tab=lists): робочі списки продавця. Зверху — плашки зі списками (скільки ще не зроблено),
 * під ними — рослини вибраного списку: відмітити «зроблено», прибрати зі списку, відкрити рослину.
 * Рослини додають у список кнопкою на картці (у магазині, у списку товарів, на сторінці товару, у формі).
 */
export function ListsPage() {
  const { t } = useTranslation()
  const { data: lists = [], isLoading } = useSellerLists()
  const create = useCreateList()
  const [picked, setPicked] = useState('')
  const [newName, setNewName] = useState('')
  const current = lists.find((l) => l.id === picked) ?? lists[0]

  async function createList() {
    const n = newName.trim()
    if (!n) return
    const list = await create.mutateAsync({ name: n })
    setNewName('')
    setPicked(list.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {lists.map((l) => {
          const on = l.id === current?.id
          const left = l.items.filter((x) => !l.done.includes(x)).length
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setPicked(l.id)}
              aria-pressed={on}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border-2 py-1.5 pr-1.5 pl-4 text-sm font-bold transition-colors ${
                on ? 'border-lavender-700 bg-lavender-700 text-sand-50' : 'border-sand-200 bg-sand-50 text-ink hover:border-lavender-700'
              }`}
            >
              {l.name}
              <span
                className={`inline-flex h-6 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-sand-50/25' : 'bg-sand-200 text-sand-700'}`}
              >
                {left}
              </span>
            </button>
          )
        })}
        {/* Новий список */}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            createList()
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('admin.lists.newPlaceholder')}
            aria-label={t('admin.lists.new')}
            className="w-52 min-w-0 rounded-full border-2 border-sand-200 bg-sand-50 px-4 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim() || create.isPending}
            aria-label={t('admin.lists.create')}
            title={t('admin.lists.create')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sand-50 hover:bg-brand-700 disabled:opacity-40"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden />
          </button>
        </form>
      </div>

      {isLoading && <p className="text-sand-700">{t('loading')}</p>}
      {!isLoading && lists.length === 0 && (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-sand-300 p-4 text-sm text-sand-700">
          <ListChecks size={18} className="mt-0.5 shrink-0" aria-hidden />
          {t('admin.lists.emptyAll')}
        </p>
      )}
      {current && <ListView key={current.id} list={current} />}
    </div>
  )
}

function ListView({ list }: { list: SellerList }) {
  const { t } = useTranslation()
  const { data: products } = useAllProducts()
  const toggleDone = useToggleDone()
  const toggleIn = useToggleInList()
  const clearDone = useClearDone()
  const rename = useRenameList()
  const remove = useDeleteList()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(list.name)
  const byId = new Map((products ?? []).map((p) => [p.id, p]))
  // Спершу те, що ще треба зробити (у порядку додавання), зроблене — внизу
  const ids = [...list.items.filter((x) => !list.done.includes(x)), ...list.items.filter((x) => list.done.includes(x))]

  return (
    <section className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <form
            className="flex min-w-0 flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) rename.mutate({ listId: list.id, name })
              setEditing(false)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t('admin.lists.rename')}
              className="min-w-0 flex-1 rounded-xl border-2 border-brand-500 bg-sand-50 px-3 py-1.5 font-display text-lg font-extrabold focus:outline-none"
            />
            <button type="submit" aria-label={t('admin.save')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sand-50">
              <Check size={18} strokeWidth={2.5} aria-hidden />
            </button>
          </form>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 font-display text-xl font-extrabold break-words text-lavender-700">{list.name}</h2>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t('admin.lists.rename')}
              title={t('admin.lists.rename')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-sand-300 text-sand-700 hover:border-brand-600"
            >
              <Pencil size={16} strokeWidth={2.25} aria-hidden />
            </button>
          </>
        )}
        {list.done.length > 0 && (
          <button
            type="button"
            onClick={() => clearDone.mutate(list)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border-2 border-sand-300 px-3 text-sm font-bold text-sand-700 hover:border-brand-600"
          >
            <Check size={16} strokeWidth={2.5} aria-hidden />
            {t('admin.lists.clearDone', { count: list.done.length })}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.confirm(t('admin.lists.deleteConfirm', { name: list.name })) && remove.mutate(list.id)}
          aria-label={t('admin.lists.delete')}
          title={t('admin.lists.delete')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-700 text-red-700 hover:bg-red-700 hover:text-sand-50"
        >
          <Trash2 size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      {ids.length === 0 ? (
        <p className="text-sm text-sand-700">{t('admin.lists.emptyList')}</p>
      ) : (
        <ul className="divide-y-2 divide-sand-200">
          {ids.map((id) => (
            <Item
              key={id}
              product={byId.get(id)}
              done={list.done.includes(id)}
              onDone={(done) => toggleDone.mutate({ listId: list.id, productId: id, done })}
              onRemove={() => toggleIn.mutate({ listId: list.id, productId: id, on: false })}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Рядок списку: велика галочка «зроблено» (зручно пальцем у теплиці), фото, назва, скільки на складі, прибрати. */
function Item({ product, done, onDone, onRemove }: { product?: Product; done: boolean; onDone: (done: boolean) => void; onRemove: () => void }) {
  const { t } = useTranslation()
  const name = product ? withCuttingMark(product.name.uk, product.tags?.includes('cutting'), t('product.cuttingMark')) : t('admin.lists.deleted')
  return (
    <li className={`flex items-center gap-3 py-2 ${done ? 'opacity-55' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t('admin.lists.done')}
        onClick={() => onDone(!done)}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
          done ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-300 text-transparent hover:border-brand-600'
        }`}
      >
        <Check size={18} strokeWidth={3} aria-hidden />
      </button>
      {product?.images[0] ? (
        <SmallImage src={product.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sand-200 text-brand-600">
          <SucculentIcon className="w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {product ? (
          <Link to={`/product/${product.slug}`} className={`block font-bold break-words hover:text-brand-600 ${done ? 'line-through' : ''}`}>
            {name}
          </Link>
        ) : (
          <span className="block text-sand-700 italic">{name}</span>
        )}
        {product && <span className="text-xs text-sand-700">{t('admin.lists.stock', { count: product.stock })}</span>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('admin.lists.remove')}
        title={t('admin.lists.remove')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sand-700 hover:bg-sand-200"
      >
        <X size={18} strokeWidth={2.25} aria-hidden />
      </button>
    </li>
  )
}
