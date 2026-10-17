import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { slugify } from '../../lib/slug'
import { Button } from '../../shared/ui'
import { useCategories, useSaveCategories, type CategorySetting } from '../catalog/categories'
import { useAllProducts } from './api'

/** Новий id з назви; якщо такий уже є (напр. після видалення й повторного додавання) — додаємо -2, -3… */
function uniqueId(name: string, taken: string[]): string {
  const base = slugify(name) || 'category'
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

export function CategoriesPage() {
  const { t } = useTranslation()
  const { all, isLoading } = useCategories()
  const { data: products } = useAllProducts()
  const save = useSaveCategories()
  // Чернетка: зміни застосовуються тільки після «Зберегти». null — ще нічого не змінювали.
  const [draft, setDraft] = useState<CategorySetting[] | null>(null)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const items = draft ?? all

  const countBy = (id: string) => products?.filter((p) => p.category === id).length ?? 0
  const noneVisible = items.every((c) => !c.visible)
  const hasEmptyName = items.some((c) => !c.name.trim())
  const update = (next: CategorySetting[]) => setDraft(next)

  function move(index: number, delta: number) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    update(next)
  }

  function patch(index: number, change: Partial<CategorySetting>) {
    update(items.map((c, i) => (i === index ? { ...c, ...change } : c)))
  }

  function remove(index: number) {
    const c = items[index]
    if (countBy(c.id) > 0) return
    if (!window.confirm(t('admin.deleteCategoryConfirm', { name: c.name }))) return
    update(items.filter((_, i) => i !== index))
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (items.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
      setAddError(t('admin.categoryExists'))
      return
    }
    update([...items, { id: uniqueId(name, items.map((c) => c.id)), name, visible: true }])
    setNewName('')
    setAddError(null)
  }

  async function onSave() {
    await save.mutateAsync(items.map((c) => ({ ...c, name: c.name.trim() })))
    setDraft(null)
  }

  if (isLoading) return <p className="text-sand-700">{t('loading')}</p>

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-brand-600">{t('admin.categories')}</h1>
      <p className="mt-2 mb-6 text-sand-700">{t('admin.categoriesHint')}</p>

      <ul className="space-y-2">
        {items.map((c, i) => {
          const count = countBy(c.id)
          return (
            <li
              key={c.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 ${c.visible ? 'border-sand-200 bg-sand-50' : 'border-dashed border-sand-300 bg-sand-100'}`}
            >
              <input
                type="checkbox"
                checked={c.visible}
                onChange={() => patch(i, { visible: !c.visible })}
                className="h-5 w-5 shrink-0 accent-brand-600"
                aria-label={`${t('admin.categoryShown')}: ${c.name}`}
              />
              <input
                value={c.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                aria-label={t('admin.categoryName')}
                className={`min-h-11 min-w-0 flex-1 rounded-xl border-2 border-transparent bg-transparent px-2 font-bold hover:border-sand-200 focus:border-brand-500 focus:bg-sand-50 focus:outline-none ${c.visible ? '' : 'text-sand-700'}`}
              />
              <span className="text-sm whitespace-nowrap text-sand-700">{t('admin.productsCount', { count })}</span>
              <div className="flex gap-1">
                <IconButton label={`${t('admin.moveUp')}: ${c.name}`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </IconButton>
                <IconButton
                  label={`${t('admin.moveDown')}: ${c.name}`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </IconButton>
                <IconButton
                  label={`${t('admin.deleteCategory')}: ${c.name}`}
                  title={count > 0 ? t('admin.cannotDeleteCategory') : t('admin.deleteCategory')}
                  disabled={count > 0}
                  onClick={() => remove(i)}
                  danger
                >
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-sm text-sand-700">{t('admin.deleteHint')}</p>

      <form onSubmit={add} className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-dashed border-sand-300 p-3">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-medium text-sand-700">{t('admin.newCategory')}</span>
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setAddError(null)
            }}
            placeholder={t('admin.newCategoryPlaceholder')}
            className="w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2.5 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={!newName.trim()}>
          + {t('admin.addCategory')}
        </Button>
        {addError && <p className="w-full text-sm text-red-700">{addError}</p>}
      </form>

      {noneVisible && <p className="mt-4 text-red-700">{t('admin.allHiddenWarning')}</p>}
      {hasEmptyName && <p className="mt-4 text-red-700">{t('admin.emptyNameWarning')}</p>}
      {save.isError && <p className="mt-4 text-red-700">{t('admin.saveError')}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => void onSave()} disabled={!draft || noneVisible || hasEmptyName || save.isPending}>
          {save.isPending ? t('admin.saving') : t('admin.save')}
        </Button>
        {draft && (
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              {t('admin.cancel')}
            </Button>
            <span className="text-sm font-medium text-sunset-600">{t('admin.unsavedChanges')}</span>
          </>
        )}
        {!draft && save.isSuccess && <span className="font-medium text-brand-600">{t('admin.saved')}</span>}
      </div>
    </div>
  )
}

interface IconButtonProps {
  label: string
  title?: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}

function IconButton({ label, title, disabled, danger, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl disabled:opacity-30 ${danger ? 'text-red-700 hover:bg-red-50' : 'hover:bg-sand-200'}`}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}
