import { useEffect, useRef, useState } from 'react'

/**
 * Довгі списки показуємо порціями: спершу `step` штук, а наступні — коли людина догортала
 * майже до кінця (за ~1,5 екрана). Так сторінка з сотнями товарів відкривається одразу, навіть на телефоні.
 * Новий список (інший фільтр, сортування, категорія) — знову з першої порції.
 */
export function useProgressive<T>(items: T[], step = 24, resetKey?: string) {
  const [count, setCount] = useState(step)
  const [prevKey, setPrevKey] = useState(resetKey)
  if (prevKey !== resetKey) {
    setPrevKey(resetKey)
    setCount(step)
  }
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = count < items.length

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setCount((c) => c + step),
      { rootMargin: '150% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, step, count])

  return {
    visible: hasMore ? items.slice(0, count) : items,
    hasMore,
    /** Показати щонайменше n перших (напр., щоб перейти до потрібної літери в алфавіті). */
    showAtLeast: (n: number) => setCount((c) => Math.max(c, n)),
    /** Невидима мітка в кінці списку: коли вона близько до екрана — додаємо ще порцію. */
    sentinel: hasMore ? <div ref={sentinelRef} aria-hidden className="h-px" /> : null,
  }
}
