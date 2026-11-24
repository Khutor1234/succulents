import { Check, ListPlus, ListChecks, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '../../lib/types'
import { useCreateList, useSellerLists, useToggleInList } from '../admin/lists'

/**
 * Продавцю: «До списку» — додати рослину в один чи кілька своїх списків («Перевірити кількість», «Пересадити»…)
 * або одразу створити новий. Рослина вже в якомусь списку — іконка зелена й зафарбована.
 * `big` — розмір 44 px (як інші кнопки біля назви у формі товару).
 */
export function ListButton({ product, name, big = false, className = '' }: { product: Product; name: string; big?: boolean; className?: string }) {
  const { t } = useTranslation()
  const { data: lists = [] } = useSellerLists()
  const toggle = useToggleInList()
  const create = useCreateList()
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ up: false, right: false })
  const [newName, setNewName] = useState('')
  const root = useRef<HTMLSpanElement>(null)
  const mine = lists.filter((l) => l.items.includes(product.id))
  const on = mine.length > 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleOpen() {
    // Меню — туди, де є місце: вгору, якщо кнопка внизу екрана; вліво, якщо біля правого краю
    const r = root.current?.getBoundingClientRect()
    if (r) setPlace({ up: r.bottom + 320 > window.innerHeight && r.top > 320, right: r.left + 260 > window.innerWidth })
    setOpen(!open)
  }

  async function createList() {
    const n = newName.trim()
    if (!n) return
    await create.mutateAsync({ name: n, productId: product.id })
    setNewName('')
  }

  const label = on ? t('admin.lists.inLists', { names: mine.map((l) => l.name).join(', ') }) : t('admin.lists.addTo', { name })
  return (
    <span ref={root} className={`relative flex ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          // На картці кнопка може лежати на посиланні — не відкриваємо товар
          e.preventDefault()
          e.stopPropagation()
          toggleOpen()
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${big ? 'h-11 w-11' : 'h-9 w-9'} ${
          on ? 'border-lavender-700 bg-lavender-700 text-sand-50 hover:opacity-90' : 'border-sand-300 text-sand-700 hover:border-lavender-700'
        }`}
      >
        {on ? <ListChecks size={18} strokeWidth={2.25} aria-hidden /> : <ListPlus size={18} strokeWidth={2.25} aria-hidden />}
      </button>
      {open && (
        <div
          className={`absolute z-50 w-60 max-w-[calc(100vw-2rem)] animate-menu-in rounded-2xl border-2 border-sand-200 bg-sand-50 p-1.5 text-left shadow-[0_18px_40px_-12px_rgba(43,33,24,0.35)] ${
            place.up ? 'bottom-[calc(100%+6px)] origin-bottom' : 'top-[calc(100%+6px)] origin-top'
          } ${place.right ? 'right-0' : 'left-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pt-1 pb-1 text-xs font-bold tracking-wide text-sand-700 uppercase">{t('admin.lists.addToShort')}</p>
          <div className="max-h-56 overflow-auto">
            {lists.length === 0 && <p className="px-3 py-2 text-sm text-sand-700">{t('admin.lists.noneYet')}</p>}
            {lists.map((l) => {
              const inList = l.items.includes(product.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  role="checkbox"
                  aria-checked={inList}
                  onClick={() => toggle.mutate({ listId: l.id, productId: product.id, on: !inList })}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-sand-200 ${inList ? 'font-bold text-lavender-700' : 'font-medium text-ink'}`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${inList ? 'border-lavender-700 bg-lavender-700 text-sand-50' : 'border-sand-300'}`}
                  >
                    {inList && <Check size={13} strokeWidth={3.5} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="shrink-0 text-xs font-medium text-sand-700 tabular-nums">{l.items.length}</span>
                </button>
              )
            })}
          </div>
          {/* Новий список — і рослина одразу в ньому */}
          {/* Не тег form: кнопка буває і всередині форми товару, а форма у формі не можна */}
          <div className="mt-1.5 flex gap-1.5 border-t-2 border-sand-200 pt-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                createList()
              }}
              placeholder={t('admin.lists.newPlaceholder')}
              aria-label={t('admin.lists.new')}
              className="min-w-0 flex-1 rounded-xl border-2 border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={createList}
              disabled={!newName.trim() || create.isPending}
              aria-label={t('admin.lists.create')}
              title={t('admin.lists.create')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sand-50 hover:bg-brand-700 disabled:opacity-40"
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
