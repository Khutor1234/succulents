import { ArrowRight, Droplets, PackageOpen, Shovel, Sprout, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

const STEPS: { icon: ReactNode; title: string; text: string; link?: { to: string; label: string } }[] = [
  {
    icon: <PackageOpen size={20} strokeWidth={2.25} aria-hidden />,
    title: 'Дайте відпочити',
    text: 'Після доставки огляньте рослину й поставте на 1–2 дні в світле місце без прямого сонця.',
  },
  {
    icon: <Sprout size={20} strokeWidth={2.25} aria-hidden />,
    title: 'Укорінення',
    text: 'Живець чи рослину без коріння підсушіть 2–3 дні, покладіть на сухий ґрунт і не поливайте тиждень. Корінці з’являться за 2–4 тижні.',
    link: { to: '/blog/rozmnozhennya-lystkom', label: 'Як це виглядає' },
  },
  {
    icon: <Shovel size={20} strokeWidth={2.25} aria-hidden />,
    title: 'Горщик і ґрунт',
    text: 'Горщик з отвором, трохи ширший за коріння. Суміш — пухка, з пемзою чи перлітом.',
    link: { to: '/blog/grunt-dlya-sukulentiv', label: 'Рецепт і калькулятор' },
  },
  {
    icon: <Sun size={20} strokeWidth={2.25} aria-hidden />,
    title: 'Світло',
    text: 'Найсвітліше вікно — південь або схід. До прямого сонця привчайте поступово.',
    link: { to: '/blog/svitlo-dlya-sukulentiv', label: 'Детальніше' },
  },
  {
    icon: <Droplets size={20} strokeWidth={2.25} aria-hidden />,
    title: 'Полив',
    text: 'Рясно, але лише коли ґрунт повністю висох. Узимку — рідко.',
    link: { to: '/blog/yak-polyvaty-sukulenty', label: 'Детальніше' },
  },
]

/** Коротка пам’ятка в кабінеті: що робити з новою рослиною. */
export function CareGuide() {
  return (
    <section className="rounded-[32px] bg-brand-600 p-5 text-sand-50 sm:p-7" aria-labelledby="care-title">
      <h2 id="care-title" className="font-display text-2xl font-extrabold sm:text-3xl">
        Пам’ятка: нова рослина вдома
      </h2>
      <p className="mt-1 text-sm text-sand-100">П’ять простих кроків, щоб рослина швидко прижилась.</p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col rounded-2xl bg-sand-50 p-4 text-ink">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">{s.icon}</span>
              <span className="font-display text-lg font-extrabold">
                <span className="mr-1.5 text-sunset-600">{i + 1}.</span>
                {s.title}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-sand-700">{s.text}</p>
            {s.link && (
              <Link to={s.link.to} className="group mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
                {s.link.label}
                <ArrowRight size={14} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            )}
          </li>
        ))}
        {/* Остання плитка — до всіх статей */}
        <li className="flex flex-col justify-center rounded-2xl border-2 border-dashed border-sand-100/50 p-4">
          <p className="font-bold">Є питання?</p>
          <p className="mt-1 text-sm text-sand-100">Про шкідників, зимівлю, добрива й інше — у блозі.</p>
          <Link to="/blog" className="mt-3 inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-sand-50 px-4 text-sm font-bold text-brand-700 hover:bg-sand-100">
            Усі статті
            <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
          </Link>
        </li>
      </ol>
    </section>
  )
}
