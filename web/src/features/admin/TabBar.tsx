import type { LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'

/**
 * Вкладка розділу адмінки — в адресі (?tab=…), щоб «Назад» і оновлення сторінки лишали ту саму вкладку.
 * Перша вкладка — без параметра. Інші параметри адреси (напр. ?view= у «Родоводах») не чіпає.
 */
export function useTab<T extends string>(tabs: readonly T[], param = 'tab'): [T, (id: T) => void] {
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((x) => x === params.get(param)) ?? tabs[0]
  const setTab = (id: T) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === tabs[0]) next.delete(param)
        else next.set(param, id)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  return [tab, setTab]
}

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Коротка назва для телефона */
  short?: string
  Icon: LucideIcon
  /** Число в дужках біля назви */
  count?: number
}

/** Перемикач вкладок розділу: на телефоні — без значків, з короткими назвами, що не вмістилось — переноситься в наступний рядок. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div
      className="flex flex-wrap rounded-2xl bg-sand-200 p-1 sm:w-fit"
      role="tablist"
      aria-label={label}
    >
      {tabs.map(({ id, label, short, Icon, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`inline-flex min-h-10 flex-auto items-center justify-center gap-1 rounded-xl px-3 sm:flex-none text-sm font-bold whitespace-nowrap transition-colors sm:gap-1.5 sm:px-4 ${
            active === id ? 'bg-brand-600 text-sand-50 shadow-sm' : 'text-sand-700 hover:text-ink'
          }`}
        >
          <Icon size={16} strokeWidth={2.25} className="hidden sm:block" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{short ?? label}</span>
          {count !== undefined && <span className={active === id ? 'font-semibold opacity-80' : 'font-semibold'}>({count})</span>}
        </button>
      ))}
    </div>
  )
}
