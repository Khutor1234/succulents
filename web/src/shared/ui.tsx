import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { imageUrl } from '../firebase/config'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' }

const BUTTON_STYLES = {
  primary: 'bg-brand-600 text-sand-50 hover:bg-brand-700 disabled:bg-sand-300 disabled:text-sand-700',
  accent: 'bg-sunset-600 text-sand-50 hover:bg-sunset-500 disabled:bg-sand-300 disabled:text-sand-700',
  secondary: 'bg-sand-200 text-ink hover:bg-sand-300 disabled:text-sand-700',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  )
}

const FIELD = 'w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3.5 py-2.5 focus:border-brand-500 focus:outline-none'

// ComponentProps<'input'> містить ref — у React 19 він передається як звичайний проп (потрібно для react-hook-form).
type InputProps = ComponentProps<'input'> & { label: string; error?: string }

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-sand-700">{label}</span>
      <input className={FIELD} {...props} />
      {error && <span className="mt-1 block text-sm text-red-700">{error}</span>}
    </label>
  )
}

type PasswordInputProps = Omit<InputProps, 'type'> & { showLabel: string; hideLabel: string }

/** Поле пароля з кнопкою-«оком», що показує або ховає введене. */
export function PasswordInput({ label, error, className = '', showLabel, hideLabel, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-sand-700">{label}</span>
      <span className="relative block">
        <input type={visible ? 'text' : 'password'} className={`${FIELD} pr-12`} {...props} />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          title={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-sand-700 hover:text-brand-600"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </span>
      {error && <span className="mt-1 block text-sm text-red-700">{error}</span>}
    </label>
  )
}

type TextareaProps = ComponentProps<'textarea'> & { label: string; error?: string }

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-sand-700">{label}</span>
      <textarea rows={4} className={FIELD} {...props} />
      {error && <span className="mt-1 block text-sm text-red-700">{error}</span>}
    </label>
  )
}

type SelectProps = ComponentProps<'select'> & {
  label?: string
  compact?: boolean
  /**
   * Поточне значення для показу, якщо список керується react-hook-form (register) і значення
   * змінюється програмно через setValue — тоді передайте useWatch(...) сюди.
   */
  current?: string
}

/**
 * Випадний список у стилі сайту. Системне меню браузера (квадратне, сіре) не стилізується,
 * тому меню власне: заокруглене, з тінню, плавною появою й галочкою біля вибраного.
 *
 * Під капотом лишається прихований справжній <select> — він отримує ref/onChange/value,
 * тож список працює і з react-hook-form, і як звичайний контрольований <select>.
 * Клавіатура: Enter/Пробіл/↓ — відкрити, ↑↓ — рух, Enter — вибрати, Esc/Tab — закрити.
 */
export function Select({ label, compact = false, className = '', children, current, ref, disabled, ...props }: SelectProps) {
  const nativeRef = useRef<HTMLSelectElement | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Значення, вибране в цьому компоненті (для неконтрольованих полів react-hook-form).
  const [picked, setPicked] = useState<string | null>(null)

  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((el) => {
      const p = el.props as { value?: string | number; children?: ReactNode }
      return { value: String(p.value ?? ''), label: p.children }
    })
  const value = props.value !== undefined ? String(props.value) : (current ?? picked ?? props.defaultValue?.toString() ?? options[0]?.value ?? '')
  const selected = options.find((o) => o.value === value) ?? options[0]

  // Клік поза списком — закрити.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function choose(v: string) {
    const el = nativeRef.current
    setOpen(false)
    setPicked(v)
    if (!el || el.value === v) return
    // Ставимо значення справжньому <select> і «стріляємо» change — React і react-hook-form побачать вибір.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function openList() {
    if (disabled) return
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'ArrowDown') setActive((i) => Math.min(options.length - 1, i + 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(options.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') choose(options[active].value)
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  const sm = compact
  const field = (
    <span ref={rootRef} className="relative block">
      <select
        {...props}
        ref={(el) => {
          nativeRef.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          setPicked(e.target.value)
          props.onChange?.(e)
        }}
      >
        {children}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        className={`relative flex w-full cursor-pointer items-center gap-2 rounded-xl border-2 bg-sand-50 text-left font-bold text-ink transition-[border-color,box-shadow] hover:border-sand-400 focus:outline-none focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-sand-200'
        } ${sm ? 'min-h-10 py-1.5 pr-9 pl-3 text-sm' : 'min-h-11 py-2.5 pr-11 pl-3.5'}`}
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          viewBox="0 0 24 24"
          width={sm ? 16 : 18}
          height={sm ? 16 : 18}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-brand-600 transition-transform duration-200 ${sm ? 'right-3' : 'right-4'} ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-72 min-w-full origin-top animate-menu-in overflow-auto rounded-2xl border-2 border-sand-200 bg-sand-50 p-1.5 shadow-[0_18px_40px_-12px_rgba(43,33,24,0.35)]"
        >
          {options.map((o, i) => {
            const isSel = o.value === value
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                // mousedown, а не click — щоб спрацювало раніше, ніж кнопка втратить фокус
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o.value)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 whitespace-nowrap ${sm ? 'text-sm' : ''} ${
                  i === active ? 'bg-sand-200' : ''
                } ${isSel ? 'font-bold text-brand-700' : 'font-medium text-ink'}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`shrink-0 text-brand-600 ${isSel ? '' : 'invisible'}`}
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {o.label}
              </li>
            )
          })}
        </ul>
      )}
    </span>
  )
  if (!label) return <span className={`inline-block ${className}`}>{field}</span>
  return (
    <div className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-sand-700">{label}</span>
      {field}
    </div>
  )
}

/** Контур сукулента — заглушка, поки у товару немає фото. */
export function SucculentIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M60 78C40 70 30 52 34 36c14 8 22 22 26 42z" />
      <path d="M60 78c20-8 30-26 26-42-14 8-22 22-26 42z" />
      <path d="M60 78c-8-20-6-42 0-56 6 14 8 36 0 56z" />
      <path d="M38 84h44l-6 22H44z" />
    </svg>
  )
}

export function ProductImage({ src, alt, tint = 'bg-sand-200' }: { src?: string; alt: string; tint?: string }) {
  if (!src) {
    return (
      <div className={`flex aspect-square items-center justify-center rounded-2xl text-brand-600 ${tint}`}>
        <SucculentIcon className="w-2/5" />
      </div>
    )
  }
  return <img src={imageUrl(src)} alt={alt} className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />
}

export function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-3xl border-2 border-sand-200 bg-sand-50 p-5">
      <legend className="flex items-center gap-2 px-2 font-display text-lg font-extrabold text-brand-600">
        {icon}
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 font-display text-4xl font-extrabold text-brand-600">{children}</h1>
}
