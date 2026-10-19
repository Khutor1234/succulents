import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Спільні цеглинки сторінок аналітики (продажі й рослини)

export function Card({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-sand-200 bg-sand-50 p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-extrabold text-brand-600">
        <Icon size={18} strokeWidth={2.25} aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Tile({ icon: Icon, label, value, hint, accent }: { icon: LucideIcon; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`animate-rise rounded-3xl p-4 ${accent ? 'bg-brand-600 text-sand-50' : 'border-2 border-sand-200 bg-sand-50'}`}>
      <p className={`flex items-center gap-1.5 text-sm font-bold ${accent ? 'text-sand-200' : 'text-sand-700'}`}>
        <Icon size={16} strokeWidth={2.25} aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-extrabold break-words tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${accent ? 'text-sand-200' : 'text-sand-700'}`}>{hint}</p>}
    </div>
  )
}

export function Fact({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border-2 border-dashed border-sunset-500/60 bg-sand-50 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunset-100 text-sunset-700">
        <Icon size={18} strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-bold first-letter:uppercase">{title}</p>
        <p className="mt-0.5 text-sm text-sand-700">{children}</p>
      </div>
    </div>
  )
}

/** Тонка горизонтальна смужка величини (одна серія — один колір). */
export function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand-200">
      <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

export function RankList({ rows, max }: { rows: { key: string; label: ReactNode; value: number; text: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-bold">{r.label}</span>
            <span className="text-sand-700 tabular-nums">{r.text}</span>
          </div>
          <Bar value={r.value} max={top} />
        </li>
      ))}
    </ul>
  )
}

