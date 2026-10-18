import { ChevronLeft, ChevronRight, Droplets, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { SOIL_RECIPES } from './articles'
import { PestFigure, PestPicture, type PestKind } from './PestPictures'

/*
 * Живі ілюстрації для статей блогу: малюнок + керування (повзунок, кнопки) + пояснення, що змінюється.
 * Малюємо самі в SVG — легко, швидко й у кольорах сайту. Плавність — через CSS transition.
 */

const SMOOTH = 'transform 700ms cubic-bezier(0.3, 0.8, 0.3, 1), fill 700ms ease, stroke 700ms ease, opacity 700ms ease'

/** Змішує два кольори #rrggbb: t=0 — перший, t=1 — другий. */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

/** Листок, що росте з точки (0,0) догори. */
const leafPath = (l: number, w: number) => `M0 0C${-w} ${-l * 0.35} ${-w * 0.7} ${-l * 0.85} 0 ${-l}C${w * 0.7} ${-l * 0.85} ${w} ${-l * 0.35} 0 0Z`

// Компактна розетка: зовнішні листки майже лежать, внутрішні дивляться вгору
const COMPACT = [
  [-84, 40], [84, 40], [-66, 39], [66, 39], [-48, 36], [48, 36], [-30, 32], [30, 32], [-14, 27], [14, 27], [-5, 21], [5, 21], [0, 15],
] as const

/**
 * Ехеверія в горщику. Точка (0,0) — середина верху горщика.
 * - `stretch` 0…1 — наскільки витягнулась від нестачі світла (довге стебло, рідкі бліді листки);
 * - `blush` 0…1 — «стресові кольори» від сонця й прохолоди (рожеві краї);
 * - `shrivel` 0…1 — зморщена від нестачі води.
 */
export function Rosette({
  stretch = 0,
  blush = 0,
  shrivel = 0,
  variegated = 0,
  pot = true,
}: {
  stretch?: number
  blush?: number
  shrivel?: number
  /** 0…1 — наскільки видно кремові смуги строкатої (варієгатної) форми */
  variegated?: number
  pot?: boolean
}) {
  const stem = 6 + stretch * 72
  const top = -(stem + 10)
  const fill = mix(mix('#6d9f86', '#a9c58e', stretch), '#b48aa8', blush * 0.35)
  const edge = mix(mix('#3f6f58', '#7f9a5c', stretch), '#d9627a', blush)
  return (
    <g>
      {/* Стебло: росте вгору зі збільшенням stretch */}
      <rect x={-3} y={-1} width={6} height={1} fill="#86a36f" style={{ transform: `scaleY(${stem})`, transition: SMOOTH }} />
      {COMPACT.map(([angle, length], i) => {
        const t = i / (COMPACT.length - 1)
        // Витягнута рослина: листки розкидані по стеблу знизу догори й звисають у боки
        const stretchedY = -8 - stem * t
        const stretchedAngle = (i % 2 ? 1 : -1) * (100 - t * 50)
        const y = lerp(top, stretchedY, stretch)
        const a = lerp(angle, stretchedAngle, stretch)
        const l = length * (1 + stretch * 0.1) * (1 - shrivel * 0.12)
        const w = (length * 0.42) * (1 - stretch * 0.3) * (1 - shrivel * 0.35)
        return (
          <path
            key={i}
            d={leafPath(l, w)}
            // Строката форма: частина листків кремова — у цих клітинах немає хлорофілу
            style={{ transform: `translate(0px, ${y}px) rotate(${a}deg)`, fill: i % 3 === 1 ? mix(fill, '#f1e3b0', variegated) : fill, stroke: edge, transition: SMOOTH }}
            strokeWidth={1.4 + blush * 2.2}
            strokeLinejoin="round"
          />
        )
      })}
      {pot && (
        <>
          <path d="M-34 4 L34 4 L27 46 L-27 46 Z" fill="#c2774f" />
          <rect x={-39} y={-4} width={78} height={11} rx={3} fill="#a9603d" />
        </>
      )}
    </g>
  )
}

/** Рамка для інтерактиву: малюнок, керування, пояснення. */
function Demo({ title, children, controls, explain }: { title: string; children: ReactNode; controls: ReactNode; explain: ReactNode }) {
  return (
    <figure className="mt-7 overflow-hidden rounded-3xl border-2 border-sand-200 bg-sand-50">
      <figcaption className="flex items-center gap-2 border-b-2 border-sand-200 px-5 py-3 text-xs font-bold tracking-wider text-sand-700 uppercase">
        <span className="h-2 w-2 rounded-full bg-sunset-500" aria-hidden />
        {title}
      </figcaption>
      <div className="px-4 pt-4">{children}</div>
      <div className="px-5 pt-3">{controls}</div>
      <div aria-live="polite" className="m-4 mt-3 rounded-2xl bg-sand-100 p-4 text-sm leading-relaxed">
        {explain}
      </div>
    </figure>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 rounded-full border-2 px-4 text-sm font-bold transition-colors ${
            value === o.id ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 hover:border-brand-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step = 1, onChange, display }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; display: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm font-bold">
        {label}
        <span className="font-display text-lg text-sunset-600">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-600"
      />
    </label>
  )
}

// ——— Світло ———

export function LightDemo() {
  const [hours, setHours] = useState(3)
  const stretch = clamp((6 - hours) / 4)
  const blush = clamp((hours - 6) / 5) * 0.75
  const sky = mix('#d9d4c8', '#ffe6b8', clamp((hours - 1) / 10))
  const verdict =
    hours < 4
      ? { title: 'Замало світла', text: 'Рослина витягується до вікна: стебло видовжується, листки рідшають і бліднуть. Витягнута частина вже не стане компактною.' }
      : hours < 6
        ? { title: 'Трохи бракує', text: 'Розетка ще тримає форму, але кольори тьмяніють і листя відгинається вниз. Переставте ближче до південного чи східного вікна.' }
        : { title: 'Те, що треба', text: 'Компактна щільна розетка. Від яскравого сонця з’являються рожеві краї — це природний «сонцезахисний крем», а не хвороба.' }
  return (
    <Demo
      title="Спробуйте: скільки світла отримує рослина"
      controls={<Slider label="Яскравого світла на день" value={hours} min={1} max={11} onChange={setHours} display={`${hours} год`} />}
      explain={
        <>
          <b className="text-brand-600">{verdict.title}.</b> {verdict.text}
        </>
      }
    >
      <svg viewBox="0 0 300 200" className="mx-auto block w-full max-w-md" role="img" aria-label="Ехеверія при різній кількості світла">
        <rect width="300" height="200" rx="18" style={{ fill: sky, transition: SMOOTH }} />
        <g style={{ transform: 'translate(250px, 40px)' }}>
          <g className="animate-glow" style={{ opacity: 0.25 + clamp(hours / 11) * 0.75, transition: SMOOTH }}>
            <circle r="22" fill="#f4b740" />
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={i} x={-2} y={-36} width={4} height={9} rx={2} fill="#f4b740" transform={`rotate(${i * 45})`} />
            ))}
          </g>
        </g>
        <rect y="185" width="300" height="15" fill="#e9c99a" />
        <g transform="translate(130 140)">
          <Rosette stretch={stretch} blush={blush} />
        </g>
      </svg>
    </Demo>
  )
}

// ——— Кольори ———

type ColorMode = 'shade' | 'bright' | 'cold'
const COLOR_MODES: Record<ColorMode, { label: string; blush: number; stretch: number; text: ReactNode }> = {
  shade: { label: 'Тінь', blush: 0, stretch: 0.25, text: <>У тіні рослина <b>зелена й бліда</b>: їй нема від чого захищатися, тож пігменти не потрібні.</> },
  bright: { label: 'Яскраве сонце', blush: 0.55, stretch: 0, text: <>Під сонцем листя виробляє <b>антоціани</b> — червоні пігменти, що поглинають надлишок світла. Краї рожевіють.</> },
  cold: {
    label: 'Сонце + прохолодні ночі',
    blush: 1,
    stretch: 0,
    text: <>Найяскравіше — восени: <b>теплі сонячні дні й прохолодні ночі</b>. Прохолода посилює синтез антоціанів, а в теплі вони швидше руйнуються, — тож рослина «рум’яніє» найсильніше.</>,
  },
}

export function ColorDemo() {
  const [mode, setMode] = useState<ColorMode>('shade')
  const m = COLOR_MODES[mode]
  return (
    <Demo
      title="Спробуйте: що вмикає кольори"
      controls={<Segmented value={mode} onChange={setMode} options={(Object.keys(COLOR_MODES) as ColorMode[]).map((id) => ({ id, label: COLOR_MODES[id].label }))} />}
      explain={m.text}
    >
      <svg viewBox="0 0 300 190" className="mx-auto block w-full max-w-md" role="img" aria-label="Ехеверія змінює колір">
        <rect width="300" height="190" rx="18" style={{ fill: mode === 'shade' ? '#dcd7cb' : mode === 'bright' ? '#ffe9c2' : '#f7dcc9', transition: SMOOTH }} />
        {mode === 'cold' && (
          <text x="246" y="44" fontSize="26" textAnchor="middle" aria-hidden>
            ❄
          </text>
        )}
        <rect y="176" width="300" height="14" fill="#e9c99a" />
        <g transform="translate(150 128)">
          <Rosette stretch={m.stretch} blush={m.blush} />
        </g>
      </svg>
    </Demo>
  )
}

// ——— Зимівля ———

type WinterMode = 'warmDark' | 'cool' | 'lamp'
const WINTER: Record<WinterMode, { label: string; temp: string; stretch: number; blush: number; text: ReactNode }> = {
  warmDark: {
    label: 'Тепло, без лампи',
    temp: '+23 °C',
    stretch: 0.9,
    blush: 0,
    text: <><b>Найгірший варіант.</b> У теплі рослина росте, а світла на ріст немає — до весни вона витягнеться й зблідне.</>,
  },
  cool: {
    label: 'Прохолодне підвіконня',
    temp: '+12 °C',
    stretch: 0.05,
    blush: 0.35,
    text: <><b>Природний відпочинок.</b> У прохолоді ріст майже зупиняється, тож рослина не витягується. Полив — раз на 3–5 тижнів.</>,
  },
  lamp: {
    label: 'Тепло + фітолампа',
    temp: '+23 °C',
    stretch: 0,
    blush: 0.15,
    text: <><b>Як навесні.</b> Лампа 12–14 годин на день дає достатньо світла — рослину можна поливати як зазвичай.</>,
  },
}

export function WinterDemo() {
  const [mode, setMode] = useState<WinterMode>('warmDark')
  const w = WINTER[mode]
  return (
    <Demo
      title="Спробуйте: де зимує рослина"
      controls={<Segmented value={mode} onChange={setMode} options={(Object.keys(WINTER) as WinterMode[]).map((id) => ({ id, label: WINTER[id].label }))} />}
      explain={w.text}
    >
      <svg viewBox="0 0 300 200" className="mx-auto block w-full max-w-md" role="img" aria-label="Ехеверія після зимівлі в різних умовах">
        <rect width="300" height="200" rx="18" fill="#dfe3e6" />
        {/* Вікно з зимовим небом */}
        <rect x="18" y="16" width="96" height="110" rx="6" fill="#c9d6e0" stroke="#fff6e8" strokeWidth="5" />
        <line x1="66" y1="16" x2="66" y2="126" stroke="#fff6e8" strokeWidth="4" />
        {/* Фітолампа */}
        <g style={{ opacity: mode === 'lamp' ? 1 : 0, transition: SMOOTH }}>
          <rect x="130" y="14" width="80" height="10" rx="5" fill="#6e5a44" />
          <path d="M138 24 L202 24 L222 120 L118 120 Z" fill="#f0b6e0" opacity="0.28" />
        </g>
        {/* Термометр */}
        <g transform="translate(262 40)">
          <rect x="-7" y="0" width="14" height="80" rx="7" fill="#fff6e8" />
          <rect x="-3" y={mode === 'cool' ? 46 : 18} width="6" height={mode === 'cool' ? 30 : 58} rx="3" fill={mode === 'cool' ? '#5b8fb9' : '#d9662f'} style={{ transition: SMOOTH }} />
          <circle cy="84" r="10" fill={mode === 'cool' ? '#5b8fb9' : '#d9662f'} />
          <text y="112" textAnchor="middle" fontSize="13" fontWeight="700" fill="#2b2118">
            {w.temp}
          </text>
        </g>
        <rect y="176" width="300" height="24" fill="#e9c99a" />
        <g transform="translate(170 136)">
          <Rosette stretch={w.stretch} blush={w.blush} />
        </g>
      </svg>
    </Demo>
  )
}

// ——— Полив ———

export function WateringDemo() {
  const [summer, setSummer] = useState(true)
  const [days, setDays] = useState(2)
  // Скільки вологи лишилось у горщику (умовно): улітку сохне швидко, взимку — повільно
  const moisture = clamp(1 - days / (summer ? 9 : 24))
  const tooLong = days > (summer ? 20 : 45)
  const wetHeight = 66 * moisture
  const verdict =
    moisture > 0.12
      ? { title: 'Ще рано', text: 'На паличці вологі грудочки — ґрунт у глибині ще мокрий. Полив зараз = коріння постійно в воді, а це шлях до гнилі.' }
      : tooLong
        ? { title: 'Давно час', text: 'Листя м’якне й зморщується — рослина витрачає запаси. Не страшно: після рясного поливу за день-два воно знову пружне.' }
        : { title: 'Можна поливати', text: 'Паличка суха до самого дна. Полийте рясно, поки вода не витече з отвору, а через 15 хвилин злийте її з піддона.' }
  return (
    <Demo
      title="Спробуйте: коли поливати"
      controls={
        <div className="space-y-3">
          <Segmented
            value={summer ? 'summer' : 'winter'}
            onChange={(v) => setSummer(v === 'summer')}
            options={[
              { id: 'summer', label: 'Літо, ріст' },
              { id: 'winter', label: 'Зима, прохолода' },
            ]}
          />
          <Slider label="Днів після поливу" value={days} min={0} max={summer ? 24 : 50} onChange={setDays} display={`${days} дн.`} />
        </div>
      }
      explain={
        <>
          <b className="text-brand-600">{verdict.title}.</b> {verdict.text}
        </>
      }
    >
      <svg viewBox="0 0 300 210" className="mx-auto block w-full max-w-md" role="img" aria-label="Вологість ґрунту в горщику">
        <rect width="300" height="210" rx="18" fill="#f6e9d2" />
        {/* Горщик у розрізі */}
        <g transform="translate(150 0)">
          <path d="M-70 92 L70 92 L58 196 L-58 196 Z" fill="#c2774f" />
          <path d="M-62 98 L62 98 L52 188 L-52 188 Z" fill="#d9b47e" />
          {/* Волога частина ґрунту — знизу, сохне згори донизу */}
          <clipPath id="soil-clip">
            <path d="M-62 98 L62 98 L52 188 L-52 188 Z" />
          </clipPath>
          <rect x="-70" y={188 - wetHeight * 1.36} width="140" height={wetHeight * 1.36} fill="#6e5a44" clipPath="url(#soil-clip)" style={{ transition: 'all 500ms ease' }} />
          {/* Дерев'яна паличка: волога частина темніша */}
          <rect x="34" y="40" width="8" height="146" rx="3" fill="#e2b77a" />
          <rect x="34" y={186 - wetHeight * 1.36} width="8" height={wetHeight * 1.36} rx="3" fill="#8a6a45" style={{ transition: 'all 500ms ease' }} />
          <g transform="translate(-10 92)">
            <Rosette shrivel={tooLong ? 1 : 0} pot={false} />
          </g>
        </g>
        <text x="20" y="34" fontSize="13" fontWeight="700" fill="#6e5a44">
          Волога в горщику
        </text>
        <rect x="20" y="42" width="90" height="10" rx="5" fill="#efdcbb" />
        <rect x="20" y="42" width={90 * moisture} height="10" rx="5" fill="#3f7a5c" style={{ transition: 'width 500ms ease' }} />
      </svg>
    </Demo>
  )
}

// ——— Ґрунт: як проходить вода ———

export function SoilDrainDemo() {
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'pour' | 'after'>('idle')
  useEffect(() => {
    if (!run) return
    setPhase('pour')
    const t = setTimeout(() => setPhase('after'), 1600)
    return () => clearTimeout(t)
  }, [run])

  const pot = (x: number, mixSoil: boolean) => {
    const wet = phase !== 'idle' && (!mixSoil || phase === 'pour')
    const puddle = phase !== 'idle' && !mixSoil
    return (
      <g transform={`translate(${x} 0)`}>
        {/* Краплі зверху під час поливу */}
        {phase === 'pour' &&
          [-16, 0, 16].map((dx, i) => (
            <circle key={dx} cx={dx} cy={56} r={4} fill="#5b8fb9" className="animate-fall" style={{ animationDelay: `${i * 220}ms` }} />
          ))}
        <path d="M-55 80 L55 80 L45 170 L-45 170 Z" fill="#c2774f" />
        <path d="M-48 86 L48 86 L40 162 L-40 162 Z" style={{ fill: wet ? (mixSoil ? '#7d6448' : '#4a3a2a') : mixSoil ? '#c9a77a' : '#8a6a45', transition: 'fill 900ms ease' }} />
        {/* Мінеральна суміш — видно зерна пемзи й цеоліту */}
        {mixSoil &&
          Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={-38 + ((i * 37) % 76)} cy={92 + ((i * 23) % 66)} r={2.6 + (i % 3)} fill={i % 2 ? '#efe7da' : '#b9b3a6'} />
          ))}
        {/* Калюжа зверху на щільному ґрунті */}
        <rect x="-46" y="82" width="92" height="6" rx="3" fill="#5b8fb9" style={{ opacity: puddle ? 0.85 : 0, transition: 'opacity 1200ms ease' }} />
        {/* Вода витікає з отвору знизу */}
        {mixSoil &&
          phase === 'pour' &&
          [0, 1, 2].map((i) => <circle key={i} cx={0} cy={172} r={3.5} fill="#5b8fb9" className="animate-drip" style={{ animationDelay: `${300 + i * 300}ms` }} />)}
        <text y="206" textAnchor="middle" fontSize="13" fontWeight="700" fill="#2b2118">
          {mixSoil ? 'Суміш з мінералами' : 'Торфовий ґрунт'}
        </text>
      </g>
    )
  }

  return (
    <Demo
      title="Спробуйте: полийте обидва горщики"
      controls={
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-sand-50 hover:bg-brand-700 active:scale-[0.97]"
        >
          {phase === 'idle' ? <Droplets size={18} strokeWidth={2.25} aria-hidden /> : <RotateCcw size={18} strokeWidth={2.25} aria-hidden />}
          {phase === 'idle' ? 'Полити' : 'Полити ще раз'}
        </button>
      }
      explain={
        phase === 'idle' ? (
          <>Натисніть «Полити» й подивіться, куди дівається вода.</>
        ) : (
          <>
            <b className="text-brand-600">Торф</b> вбирає воду, як губка: зверху калюжа, а всередині мокро ще 1–2 тижні — коріння без повітря починає гнити.{' '}
            <b className="text-brand-600">Суміш з мінералами</b> пропускає воду за секунди: зайве витікає знизу, а між зернами лишається повітря. За кілька днів ґрунт сухий — можна знову поливати.
          </>
        )
      }
    >
      <svg viewBox="0 0 300 215" className="mx-auto block w-full max-w-md" role="img" aria-label="Як вода проходить крізь різні ґрунти">
        <rect width="300" height="215" rx="18" fill="#f6e9d2" />
        {pot(80, false)}
        {pot(220, true)}
      </svg>
    </Demo>
  )
}

// ——— Розмноження листком ———

const LEAF_STEPS = [
  { title: 'Відламати цілим', text: 'Обережно похитайте нижній листок, доки він не відокремиться разом із точкою кріплення — саме з неї з’явиться нова рослина.' },
  { title: 'Підсушити 2–5 днів', text: 'Місце відриву затягується сухою плівкою (видно темну крапку). Так листок не загниє на ґрунті.' },
  { title: 'Корінці (2–4 тижні)', text: 'Листок лежить на сухому ґрунті, і з місця відриву виростають рожеві корінці. Тепер присипте їх ґрунтом і зрідка зволожуйте.' },
  { title: 'Дитинка (ще кілька тижнів)', text: 'З’являється крихітна розетка. Материнський листок віддає їй свої запаси.' },
  { title: 'Нова рослина', text: 'Листок зморщився й висох — дитинка стала самостійною. Тепер її можна садити в окремий горщик.' },
]

export function LeafDemo() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setStep((s) => (s + 1) % LEAF_STEPS.length), 1800)
    return () => clearInterval(t)
  }, [playing])
  const s = LEAF_STEPS[step]
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border-2 border-sand-200 bg-sand-50 hover:border-brand-500 disabled:opacity-40'
  return (
    <Demo
      title="Покроково: від листка до рослини"
      controls={
        <div className="flex items-center gap-2">
          <button type="button" className={btn} disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Попередній крок">
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
          </button>
          <div className="flex flex-1 justify-center gap-1.5">
            {LEAF_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Крок ${i + 1}`}
                aria-current={i === step}
                className={`h-2.5 rounded-full transition-all ${i === step ? 'w-7 bg-brand-600' : 'w-2.5 bg-sand-300'}`}
              />
            ))}
          </div>
          <button type="button" className={btn} onClick={() => setPlaying(!playing)} aria-label={playing ? 'Пауза' : 'Програти'}>
            {playing ? <Pause size={18} strokeWidth={2.4} aria-hidden /> : <Play size={18} strokeWidth={2.4} aria-hidden />}
          </button>
          <button type="button" className={btn} disabled={step === LEAF_STEPS.length - 1} onClick={() => setStep(step + 1)} aria-label="Наступний крок">
            <ChevronRight size={20} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      }
      explain={
        <>
          <b className="text-brand-600">
            {step + 1}. {s.title}.
          </b>{' '}
          {s.text}
        </>
      }
    >
      <svg viewBox="0 0 300 170" className="mx-auto block w-full max-w-md" role="img" aria-label={s.title}>
        <rect width="300" height="170" rx="18" fill="#f6e9d2" />
        <rect y="118" width="300" height="52" fill="#c9a77a" />
        {/* Листок лежить на ґрунті */}
        <g style={{ transform: `translate(${step === 0 ? 150 : 175}px, ${step === 0 ? 70 : 116}px) rotate(${step === 0 ? -20 : -96}deg)`, transition: SMOOTH }}>
          <path
            d={leafPath(70, 24)}
            style={{
              fill: step >= 4 ? '#c9b77d' : step === 3 ? '#93b08a' : '#6d9f86',
              stroke: '#3f6f58',
              transform: `scale(${step >= 4 ? 0.82 : 1}, ${step >= 4 ? 0.65 : 1})`,
              transition: SMOOTH,
            }}
            strokeWidth="1.5"
          />
          {/* Підсохлий зріз */}
          <circle r="4" fill="#7a5a3a" style={{ opacity: step >= 1 ? 1 : 0, transition: SMOOTH }} />
        </g>
        {/* Корінці */}
        {[
          'M178 120 q-6 14 -2 26',
          'M180 120 q6 12 2 24',
          'M176 121 q-14 8 -18 20',
        ].map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#e0889a"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            style={{ strokeDashoffset: step >= 2 ? 0 : 1, transition: `stroke-dashoffset 900ms ease ${i * 150}ms` }}
          />
        ))}
        {/* Дитинка */}
        <g transform="translate(184 118)">
          <g style={{ transform: `scale(${step >= 4 ? 0.62 : step === 3 ? 0.32 : 0})`, transition: SMOOTH }}>
            <Rosette pot={false} blush={0.2} />
          </g>
        </g>
        {step === 0 && (
          <text x="40" y="44" fontSize="22" aria-hidden>
            ✋
          </text>
        )}
      </svg>
    </Demo>
  )
}

// ——— Калькулятор ґрунту ———

export function SoilCalculator() {
  const [recipeId, setRecipeId] = useState(SOIL_RECIPES[0].id)
  const [litres, setLitres] = useState(3)
  const recipe = SOIL_RECIPES.find((r) => r.id === recipeId) ?? SOIL_RECIPES[0]
  const COLORS = ['#8a6a45', '#efe7da', '#b9b3a6', '#e2c48f']
  const fmt = (l: number) => (l >= 1 ? `${(Math.round(l * 10) / 10).toLocaleString('uk-UA')} л` : `${Math.round(l * 1000)} мл`)
  return (
    <Demo
      title="Калькулятор: скільки чого змішати"
      controls={
        <div className="space-y-3">
          <Segmented value={recipeId} onChange={setRecipeId} options={SOIL_RECIPES.map((r) => ({ id: r.id, label: r.short }))} />
          <Slider label="Скільки суміші потрібно" value={litres} min={0.5} max={20} step={0.5} onChange={setLitres} display={`${litres.toLocaleString('uk-UA')} л`} />
          <div className="flex flex-wrap gap-2">
            {[1, 3, 5, 10].map((l) => (
              <button key={l} type="button" onClick={() => setLitres(l)} className="rounded-full bg-sand-200 px-3 py-1 text-xs font-bold hover:bg-sand-300">
                {l} л
              </button>
            ))}
          </div>
        </div>
      }
      explain={
        <>
          Об’єм міряйте будь-якою ємністю: банка 1 л, склянка ≈ 250 мл. Горщик діаметром 10 см вміщує приблизно 0,5 л ґрунту, 15 см — 1,5 л, 20 см — 3–4 л.
          {recipe.note && <> {recipe.note}</>}
        </>
      }
    >
      <div className="mx-auto max-w-md">
        {/* Смуга-пропорція */}
        <div className="flex h-9 overflow-hidden rounded-xl border-2 border-sand-200">
          {recipe.parts.map((p, i) => (
            <div key={p.name} className="flex items-center justify-center text-xs font-bold" style={{ width: `${p.pct}%`, background: COLORS[i], color: i === 0 ? '#fff6e8' : '#2b2118', transition: 'width 500ms ease' }}>
              {p.pct}%
            </div>
          ))}
        </div>
        <ul className="mt-3 divide-y-2 divide-sand-200">
          {recipe.parts.map((p, i) => (
            <li key={p.name} className="flex items-center gap-3 py-2.5">
              <span className="h-4 w-4 shrink-0 rounded-md border border-sand-300" style={{ background: COLORS[i] }} aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-bold">{p.name}</span> <span className="text-sand-700">· {p.pct}%</span>
              </span>
              <span className="font-display text-lg font-extrabold whitespace-nowrap text-sunset-600">{fmt((litres * p.pct) / 100)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Demo>
  )
}

// ——— Шкідники: помічник за симптомом ———

const PESTS = [
  {
    symptom: 'Білі «ватні» грудочки в пазухах листя',
    pest: 'Борошнистий червець',
    kind: 'mealybug' as PestKind,
    remedy: 'Інсектицид',
    how: 'Поодиноких — знімайте ватною паличкою зі спиртом навпіл з водою. Багато — полив системним інсектицидом (тіаметоксам, імідаклоприд), повтор через 2–3 тижні.',
  },
  {
    symptom: 'Білий наліт на корінні при пересадці',
    pest: 'Кореневий червець',
    kind: 'root' as PestKind,
    remedy: 'Інсектицид',
    how: 'Промийте коріння теплою водою, підсушіть, посадіть у новий ґрунт і полийте системним інсектицидом.',
  },
  {
    symptom: 'Дрібні світлі цятки, сіруватий «запилений» вигляд, павутинка',
    pest: 'Павутинний кліщ',
    kind: 'mite' as PestKind,
    remedy: 'Акарицид',
    how: 'Кліщ — не комаха, інсектициди на нього майже не діють. Потрібен акарицид (піридабен, пропаргіт або авермектини): 2–3 обробки з інтервалом 5–7 днів, препарати чергувати.',
  },
  {
    symptom: 'Сріблясті плями, чорні крапки, покручені молоді листки',
    pest: 'Трипси',
    kind: 'thrips' as PestKind,
    remedy: 'Інсектицид',
    how: 'Системний інсектицид поливом плюс обприскування, повтор через 7–10 днів. Огляньте сусідні рослини.',
  },
  {
    symptom: 'Дрібні чорні мушки над ґрунтом',
    pest: 'Ґрунтові мушки (сциариди)',
    kind: 'gnats' as PestKind,
    remedy: 'Підсушити + інсектицид',
    how: 'Ґрунт занадто довго мокрий. Дайте йому повністю висохнути, повісьте жовті липкі пастки; за потреби — полив інсектицидом проти личинок.',
  },
  {
    symptom: 'Стебло біля землі темне й м’яке, листя чорніє і відпадає',
    pest: 'Гниль',
    kind: 'rot' as PestKind,
    remedy: 'Фунгіцид',
    how: 'Зріжте до здорової тканини, обробіть зріз фунгіцидом або вугіллям, підсушіть 3–7 днів і вкореніть верхівку в сухому мінеральному ґрунті.',
  },
] as const

const REMEDY_STYLE: Record<string, string> = {
  Інсектицид: 'bg-sunset-100 text-sunset-700',
  Акарицид: 'bg-[#efe0f3] text-[#6d3f7c]',
  Фунгіцид: 'bg-brand-100 text-brand-700',
  'Підсушити + інсектицид': 'bg-sand-200 text-sand-700',
}

export function PestsDemo() {
  const [i, setI] = useState(0)
  const p = PESTS[i]
  return (
    <Demo
      title="Помічник: що ви бачите на рослині?"
      controls={null}
      explain={
        <>
          <span className="flex flex-wrap items-center gap-2">
            <b className="font-display text-lg text-brand-600">{p.pest}</b>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${REMEDY_STYLE[p.remedy]}`}>{p.remedy}</span>
          </span>
          <span className="mt-1 block">{p.how}</span>
        </>
      }
    >
      {/* Малюнок змінюється разом із вибраним симптомом */}
      <div key={p.kind} className="mx-auto mb-3 max-w-md animate-page-in">
        <PestPicture kind={p.kind} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PESTS.map((x, j) => (
          <button
            key={x.pest}
            type="button"
            aria-pressed={i === j}
            onClick={() => setI(j)}
            className={`rounded-2xl border-2 p-3 text-left text-sm leading-snug transition-colors ${
              i === j ? 'border-brand-600 bg-brand-600 font-bold text-sand-50' : 'border-sand-200 bg-sand-50 hover:border-brand-500'
            }`}
          >
            {x.symptom}
          </button>
        ))}
      </div>
    </Demo>
  )
}

// ——— Форми: Variegata, Cristata, Monstrose ———

type Form = 'normal' | 'variegata' | 'cristata' | 'monstrose'
const FORMS: Record<Form, { label: string; text: ReactNode }> = {
  normal: { label: 'Звичайна', text: <>Звичайна розетка росте з <b>однієї точки росту</b> в центрі — листки утворюють рівне коло.</> },
  variegata: {
    label: 'Variegata',
    text: <><b>Строкатість.</b> У частині клітин немає хлорофілу — на листі кремові, жовті чи рожеві смуги. Форма та ріст звичайні, але рослина росте повільніше й чутливіша до сонця.</>,
  },
  cristata: {
    label: 'Cristata',
    text: <><b>Гребінчаста форма.</b> Точка росту витягується з крапки в лінію — рослина росте «віялом» чи хвилястим гребенем.</>,
  },
  monstrose: {
    label: 'Monstrose',
    text: <><b>Потворна форма.</b> Точок росту багато, і жодна не головна — рослина вкрита безліччю дрібних розеток і горбиків.</>,
  },
}

export function FormsDemo() {
  const [form, setForm] = useState<Form>('normal')
  const show = (f: Form) => ({ opacity: form === f ? 1 : 0, transform: `scale(${form === f ? 1 : 0.85})`, transition: SMOOTH })
  const crest = Array.from({ length: 23 }, (_, i) => {
    const x = -66 + i * 6
    return { x, y: -38 + Math.sin(i / 2.6) * 9 - Math.cos(i / 5) * 6 }
  })
  const heads = [
    [-34, -30, 0.42], [-8, -46, 0.5], [22, -34, 0.44], [40, -18, 0.34], [-46, -12, 0.32], [6, -18, 0.38], [-20, -14, 0.3],
  ] as const
  return (
    <Demo
      title="Спробуйте: чим відрізняються форми"
      controls={<Segmented value={form} onChange={setForm} options={(Object.keys(FORMS) as Form[]).map((id) => ({ id, label: FORMS[id].label }))} />}
      explain={FORMS[form].text}
    >
      <svg viewBox="0 0 300 200" className="mx-auto block w-full max-w-md" role="img" aria-label={FORMS[form].label}>
        <rect width="300" height="200" rx="18" fill="#f6e9d2" />
        <rect y="186" width="300" height="14" fill="#e9c99a" />
        <g transform="translate(150 140)">
          <g style={show('normal')}>
            <Rosette pot={false} />
          </g>
          <g style={show('variegata')}>
            <Rosette pot={false} variegated={1} blush={0.25} />
          </g>
          <g style={show('cristata')}>
            {/* Гребінь: багато дрібних листків уздовж хвилястої лінії */}
            {crest.map(({ x, y }, i) => (
              <g key={i}>
                <path d={leafPath(26, 7)} transform={`translate(${x} ${y + 18}) rotate(${(i % 2 ? 1 : -1) * 18 + x / 6})`} fill="#6d9f86" stroke="#3f6f58" strokeWidth="1.2" />
                <path d={leafPath(16, 5)} transform={`translate(${x + 3} ${y + 8}) rotate(${x / 5})`} fill="#86b39b" stroke="#3f6f58" strokeWidth="1" />
              </g>
            ))}
            <path d="M-60 4 Q0 -14 60 4 L60 6 L-60 6 Z" fill="#86a36f" />
          </g>
          <g style={show('monstrose')}>
            {heads.map(([x, y, k], i) => (
              <g key={i} transform={`translate(${x} ${y + 40}) scale(${k})`}>
                <Rosette pot={false} blush={0.15} />
              </g>
            ))}
          </g>
          <path d="M-34 4 L34 4 L27 46 L-27 46 Z" fill="#c2774f" transform="translate(0 -2)" />
          <rect x={-39} y={-6} width={78} height={11} rx={3} fill="#a9603d" />
        </g>
      </svg>
    </Demo>
  )
}

// ——— Як читати назву рослини ———

type Part = { text: string; kind: 'genus' | 'species' | 'cultivar' | 'cross' | 'rank' | 'infra' | 'plain'; note: string }
const NAMES: { label: string; parts: Part[] }[] = [
  {
    label: 'Вид',
    parts: [
      { text: 'Echeveria', kind: 'genus', note: '**Рід** — з великої літери, курсивом. Як прізвище: об’єднує близьких «родичів».' },
      { text: 'lilacina', kind: 'species', note: '**Видовий епітет** — з малої літери, курсивом. Рід + епітет разом = назва виду.' },
    ],
  },
  {
    label: 'Сорт',
    parts: [
      { text: 'Echeveria', kind: 'genus', note: '**Рід** — курсивом, з великої.' },
      { text: '\u2018Lola\u2019', kind: 'cultivar', note: '**Сорт** (культивар) — в **одинарних лапках**, з великої літери, **не** курсивом. Це рослина, відібрана людиною; розмножують вегетативно, щоб зберегти ознаки.' },
    ],
  },
  {
    label: 'Гібрид видів',
    parts: [
      { text: 'Echeveria', kind: 'genus', note: '**Рід** — курсивом.' },
      { text: 'lilacina', kind: 'species', note: '**Материнська рослина** (♀) — у садівництві її зазвичай пишуть першою.' },
      { text: '×', kind: 'cross', note: '**Хрестик ×** між назвами означає схрещування: «мати × батько». Пишуть саме знак множення ×, а не літеру x.' },
      { text: 'E.', kind: 'genus', note: 'Повторений рід можна **скорочувати** до першої літери з крапкою, якщо він уже згадувався.' },
      { text: '\u2018Deresina\u2019', kind: 'cultivar', note: '**Батьківська рослина** (♂) — тут це сорт, тому в лапках.' },
    ],
  },
  {
    label: 'Гібрид родів',
    parts: [
      { text: '×', kind: 'cross', note: '**× перед назвою роду** означає міжродовий гібрид. Часто × пропускають і пишуть просто Graptoveria — обидва варіанти трапляються.' },
      { text: 'Graptoveria', kind: 'genus', note: '**Гібридний рід** = Graptopetalum × Echeveria. Назва складена з частин обох родів.' },
      { text: '\u2018Debbie\u2019', kind: 'cultivar', note: '**Сорт** цього гібрида — в одинарних лапках.' },
    ],
  },
  {
    label: 'Різновид і форма',
    parts: [
      { text: 'Echeveria', kind: 'genus', note: '**Рід** — курсивом.' },
      { text: 'agavoides', kind: 'species', note: '**Вид** — курсивом, з малої.' },
      { text: 'var.', kind: 'rank', note: '**var.** (varietas) — різновид: природна стійка відмінність усередині виду. Інші скорочення: **subsp.** — підвид, **f.** — форма. Самі скорочення — прямим шрифтом.' },
      { text: 'prolifera', kind: 'infra', note: '**Назва різновиду** — курсивом, з малої.' },
    ],
  },
  {
    label: 'Особлива форма',
    parts: [
      { text: 'Echeveria', kind: 'genus', note: '**Рід** — курсивом.' },
      { text: '\u2018Lola\u2019', kind: 'cultivar', note: '**Сорт** — у лапках.' },
      { text: 'variegata', kind: 'plain', note: '**Variegata, cristata, monstrose** — описи особливих форм (строката, гребінчаста, потворна). У колекціях їх дописують після назви — «variegata» чи «f. variegata», хоча формально це не частина назви сорту.' },
    ],
  },
]

const KIND_STYLE: Record<Part['kind'], string> = {
  genus: 'italic',
  species: 'italic',
  infra: 'italic',
  cultivar: '',
  cross: 'text-sunset-600',
  rank: 'text-sand-700',
  plain: 'text-sand-700',
}

function Bold({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((x, i) => (i % 2 ? <b key={i} className="text-brand-600">{x}</b> : x))}</>
}

export function NamesDemo() {
  const [n, setN] = useState(0)
  const [part, setPart] = useState(0)
  const name = NAMES[n]
  const current = name.parts[Math.min(part, name.parts.length - 1)]
  return (
    <Demo
      title="Розбір назви: натисніть на частину"
      controls={
        <Segmented
          value={String(n)}
          onChange={(v) => {
            setN(Number(v))
            setPart(0)
          }}
          options={NAMES.map((x, i) => ({ id: String(i), label: x.label }))}
        />
      }
      explain={<Bold text={current.note} />}
    >
      <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 py-6 text-center font-display text-3xl font-extrabold sm:text-4xl">
        {name.parts.map((x, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPart(i)}
            aria-pressed={part === i}
            className={`rounded-lg px-1.5 transition-colors ${KIND_STYLE[x.kind]} ${part === i ? 'bg-sunset-100 underline decoration-sunset-500 decoration-4 underline-offset-8' : 'hover:bg-sand-200'}`}
          >
            {x.text}
          </button>
        ))}
      </p>
    </Demo>
  )
}

// ——— Міжродові гібриди: «схрещувач» ———

const GENERA = ['Echeveria', 'Graptopetalum', 'Sedum', 'Pachyphytum', 'Cremnophila', 'Agave', 'Manfreda'] as const
type Genus = (typeof GENERA)[number]

const HYBRIDS: { a: Genus; b: Genus; name: string; uk: string; examples: string; text: string }[] = [
  {
    a: 'Graptopetalum', b: 'Echeveria', name: 'Graptoveria', uk: 'Граптоверія',
    examples: "'Debbi', 'Fred Ives', 'Opalina'",
    text: 'Найпопулярніший міжродовий гібрид. Від ехеверії — велика гарна розетка, від граптопеталума — товсте листя, перламутрові відтінки й невибагливість.',
  },
  {
    a: 'Sedum', b: 'Echeveria', name: 'Sedeveria', uk: 'Седеверія',
    examples: "'Letizia', 'Blue Elf', 'Harry Butterfield'",
    text: 'Від седума — витривалість і схильність кущитися, від ехеверії — форма розетки. Часто дуже яскраво забарвлюються на сонці.',
  },
  {
    a: 'Graptopetalum', b: 'Sedum', name: 'Graptosedum', uk: 'Граптоседум',
    examples: "'California Sunset', 'Bronze'",
    text: 'Невеликі розетки на стеблах, що кущаться. Дуже невибагливі й легко розмножуються листком.',
  },
  {
    a: 'Pachyphytum', b: 'Echeveria', name: 'Pachyveria', uk: 'Пахіверія',
    examples: "'Glauca', 'Scheideckeri'",
    text: 'Від пахіфітума — дуже товсте, «пухке» листя з восковим нальотом, від ехеверії — розетка.',
  },
  {
    a: 'Graptopetalum', b: 'Pachyphytum', name: 'Graptophytum', uk: 'Граптофітум',
    examples: "'Supreme'",
    text: 'Пухкі округлі листки з ніжними пастельними відтінками.',
  },
  {
    a: 'Cremnophila', b: 'Echeveria', name: 'Cremneria', uk: 'Кремнерія',
    examples: "'Expatriata'",
    text: 'Рідкісніший гібрид із бархатистим або глянцевим листям.',
  },
  {
    a: 'Manfreda', b: 'Agave', name: 'Mangave', uk: 'Мангаве',
    examples: "'Kaleidoscope', 'Pineapple Express'",
    text: 'Від агави — форма, від манфреди — плямисте забарвлення й швидший ріст.',
  },
]

function GenusSelect({ value, onChange, label }: { value: Genus; onChange: (g: Genus) => void; label: string }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="text-xs font-bold text-sand-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Genus)}
        className="mt-1 min-h-11 w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-3 font-bold italic outline-none focus:border-brand-500"
      >
        {GENERA.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </label>
  )
}

export function HybridDemo() {
  const [a, setA] = useState<Genus>('Graptopetalum')
  const [b, setB] = useState<Genus>('Echeveria')
  const hybrid = HYBRIDS.find((h) => (h.a === a && h.b === b) || (h.a === b && h.b === a))
  return (
    <Demo
      title="Спробуйте: схрестіть два роди"
      controls={
        <div className="flex items-end gap-2">
          <GenusSelect label="Перший рід" value={a} onChange={setA} />
          <span className="pb-2 font-display text-2xl font-extrabold text-sunset-600" aria-hidden>
            ×
          </span>
          <GenusSelect label="Другий рід" value={b} onChange={setB} />
        </div>
      }
      explain={
        hybrid ? (
          <>
            <b className="text-brand-600">{hybrid.uk}.</b> {hybrid.text} Відомі сорти: <span className="font-semibold">{hybrid.examples}</span>.
          </>
        ) : a === b ? (
          <>Це один і той самий рід — виходить звичайний гібрид усередині роду, наприклад <i>Echeveria</i> &lsquo;Lola&rsquo;.</>
        ) : (
          <>Такий гібрид поки не відомий або дуже рідкісний. Спробуйте, наприклад, Graptopetalum × Echeveria чи Sedum × Echeveria.</>
        )
      }
    >
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm text-sand-700">
          <i>{a}</i> <span className="font-bold text-sunset-600">×</span> <i>{b}</i> =
        </p>
        <p key={hybrid?.name ?? 'none'} className="animate-pop font-display text-3xl font-extrabold text-brand-600 sm:text-4xl">
          {hybrid ? (
            <>
              <span className="text-sunset-600">×</span> <i>{hybrid.name}</i>
            </>
          ) : (
            '?'
          )}
        </p>
        {hybrid && <p className="text-sm text-sand-700">{hybrid.uk}</p>}
      </div>
    </Demo>
  )
}

// ——— Стрічка часу селекції ———

const TIMELINE = [
  { year: 'XIX ст.', title: 'Перші гібриди', text: 'У Франції Делеєю (Deleuil) приписують Echeveria × imbricata — одну з найстаріших гібридних ехеверій.' },
  { year: '1930-ті', title: '‘Perle von Nürnberg’', text: 'Р. Ґреснер у Німеччині виводить «Перлину Нюрнберга» з рожево-бузковим листям.' },
  { year: '1958', title: 'Початок Діка Райта', text: 'Дік Райт починає схрещувати ехеверії. Згодом він стане найвідомішим селекціонером ехеверій у світі.' },
  { year: '1975', title: 'Розсадник у Фоллбруці', text: 'Родина Райтів переїжджає до Фоллбрука (Каліфорнія) і відкриває власний розсадник.' },
  { year: '1980', title: '‘Lola’', text: 'Райт створює ‘Lola’ — один із найпопулярніших гібридів ехеверій у світі.' },
  { year: '1985', title: 'Пожежа', text: 'Вогонь знищує розсадник разом із численними сіянцями й роками напрацювань. Але Райт не кидає селекцію.' },
  { year: 'Далі', title: 'Нові гібриди', text: 'Райт десятиліттями створює нові гібриди — серед них ‘Arlie Wright’ і седеверія ‘Harry Butterfield’.' },
  { year: 'Сьогодні', title: 'Корея та Японія', text: 'Азійські селекціонери задають моду: компактні розетки, пухке листя і яскраві кольори.' },
]

export function TimelineDemo() {
  // Відкриваємо на пожежі 1985-го — центральній події статті
  const [i, setI] = useState(5)
  const e = TIMELINE[i]
  return (
    <Demo
      title="Стрічка часу: натисніть на рік"
      controls={null}
      explain={
        <>
          <b className="text-brand-600">
            {e.year} — {e.title}.
          </b>{' '}
          {e.text}
        </>
      }
    >
      <div className="relative overflow-x-auto pb-2">
        <div className="relative flex min-w-max items-start gap-1 px-1 pt-2">
          <div className="absolute top-[22px] right-4 left-4 h-1 rounded-full bg-sand-200" aria-hidden />
          {TIMELINE.map((x, j) => (
            <button key={x.year} type="button" onClick={() => setI(j)} aria-pressed={i === j} className="relative flex w-20 flex-col items-center gap-2 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-4 transition-all ${
                  i === j ? 'scale-110 border-sunset-500 bg-sunset-500' : x.year === '1985' ? 'border-sunset-500 bg-sand-50' : 'border-brand-500 bg-sand-50'
                }`}
              >
                {x.year === '1985' && <span className="text-xs" aria-hidden>🔥</span>}
              </span>
              <span className={`text-xs leading-tight font-bold ${i === j ? 'text-sunset-600' : 'text-sand-700'}`}>{x.year}</span>
            </button>
          ))}
        </div>
      </div>
    </Demo>
  )
}

// ——— Літо: температура на балконі ———

export function SummerDemo() {
  const [temp, setTemp] = useState(26)
  const hot = clamp((temp - 30) / 10)
  const advice =
    temp < 12
      ? { title: 'Ще прохолодно', text: 'Ночі нижче +10 °C — рано виносити на відкритий балкон. Зачекайте стабільного тепла.' }
      : temp <= 30
        ? { title: 'Ідеально', text: 'Активний ріст: багато світла, полив після повного висихання ґрунту, можна підгодовувати й розмножувати.' }
        : temp <= 35
          ? { title: 'Спекотно', text: 'Ріст сповільнюється. Поливайте вранці або ввечері, притіняйте в полудень, не мочіть розетку.' }
          : { title: 'Літній спокій', text: 'Рослина «засинає»: поливайте менше й рідше, обов’язково притіняйте найспекотніші години, не годуйте й не пересаджуйте.' }
  return (
    <Demo
      title="Спробуйте: яка спека на балконі"
      controls={<Slider label="Температура вдень" value={temp} min={8} max={42} onChange={setTemp} display={`+${temp} °C`} />}
      explain={
        <>
          <b className="text-brand-600">{advice.title}.</b> {advice.text}
        </>
      }
    >
      <svg viewBox="0 0 300 200" className="mx-auto block w-full max-w-md" role="img" aria-label="Ехеверія на балконі в спеку">
        <rect width="300" height="200" rx="18" style={{ fill: mix(mix('#cfe0e8', '#ffe9c2', clamp((temp - 8) / 20)), '#ffc9a3', hot), transition: SMOOTH }} />
        <g style={{ transform: 'translate(250px, 42px)' }}>
          <g className="animate-glow">
            <circle r={18 + hot * 8} style={{ fill: mix('#f4b740', '#e8652f', hot), transition: SMOOTH }} />
          </g>
        </g>
        {/* Притінювальна сітка з’являється в спеку */}
        <g style={{ opacity: temp > 30 ? 1 : 0, transition: SMOOTH }}>
          <path d="M60 70 L220 70" stroke="#6e5a44" strokeWidth="3" />
          <path d="M70 70 L80 104 L200 104 L210 70" fill="#fff6e8" opacity="0.55" stroke="#e9c99a" strokeWidth="2" />
        </g>
        <rect y="176" width="300" height="24" fill="#e9c99a" />
        <g transform="translate(140 138)">
          <Rosette blush={clamp((temp - 16) / 16) * 0.8} shrivel={clamp((temp - 34) / 8)} />
        </g>
        <text x="20" y="34" fontSize="16" fontWeight="800" style={{ fill: temp > 35 ? '#b9501f' : '#2b2118' }}>
          +{temp} °C
        </text>
      </svg>
    </Demo>
  )
}

// ——— Калькулятор добрива ———

export function FertilizerCalc() {
  const [dose, setDose] = useState(5)
  const [water, setWater] = useState(1)
  const [part, setPart] = useState<'half' | 'quarter'>('half')
  const k = part === 'half' ? 0.5 : 0.25
  const ml = Math.round(dose * water * k * 10) / 10
  return (
    <Demo
      title="Калькулятор: скільки добрива на вашу воду"
      controls={
        <div className="space-y-3">
          <Slider label="Доза з упаковки (на 1 л, для кімнатних рослин)" value={dose} min={1} max={20} onChange={setDose} display={`${dose} мл`} />
          <Slider label="Скільки води для поливу" value={water} min={0.5} max={10} step={0.5} onChange={setWater} display={`${water.toLocaleString('uk-UA')} л`} />
          <Segmented
            value={part}
            onChange={setPart}
            options={[
              { id: 'half', label: 'Половина дози — сезон росту' },
              { id: 'quarter', label: 'Чверть — слабкі й молоді' },
            ]}
          />
        </div>
      }
      explain={
        <>
          Додайте <b className="text-brand-600">{ml.toLocaleString('uk-UA')} мл</b> добрива на {water.toLocaleString('uk-UA')} л води ({part === 'half' ? 'половина' : 'чверть'} від
          дози для кімнатних рослин). Зручно відміряти шприцом без голки. Поливайте лише по вологому ґрунту, раз на 3–4 тижні навесні й улітку.
        </>
      }
    >
      <div className="flex items-end justify-center gap-8 py-3">
        {/* Пляшка добрива */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-24 w-10 overflow-hidden rounded-t-lg rounded-b-xl border-2 border-sand-300 bg-sand-50">
            <div className="absolute inset-x-0 bottom-0 bg-brand-500/70 transition-all duration-500" style={{ height: `${Math.min(100, ml * 6)}%` }} />
          </div>
          <span className="font-display text-lg font-extrabold text-sunset-600">{ml.toLocaleString('uk-UA')} мл</span>
        </div>
        <span className="pb-8 font-display text-2xl font-extrabold text-sand-700">+</span>
        {/* Лійка з водою */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-sand-300 bg-sand-50">
            <div className="absolute inset-x-0 bottom-0 bg-[#9cc3dc] transition-all duration-500" style={{ height: `${(water / 10) * 100}%` }} />
          </div>
          <span className="font-display text-lg font-extrabold text-brand-600">{water.toLocaleString('uk-UA')} л води</span>
        </div>
      </div>
    </Demo>
  )
}

// ——— Літопси: календар року ———

type LithopsStage = 'grow' | 'change' | 'dry' | 'rest'
const LITHOPS_STAGES: Record<LithopsStage, { title: string; water: string; text: string }> = {
  grow: {
    title: 'Ріст і цвітіння',
    water: 'Полив раз на 2–3 тижні, коли ґрунт повністю сухий',
    text: 'Головний сезон: рослина наливається, а з щілини між листками з’являється квітка — біла чи жовта, схожа на ромашку.',
  },
  change: {
    title: 'Зміна листя',
    water: 'Не поливати',
    text: 'Усередині старої пари росте нова. Стара пара віддає їй усю воду й зморщується — так і має бути. Полив зараз зашкодить: новим листкам нема куди подітися, і вони можуть загнити чи луснути.',
  },
  dry: {
    title: 'Нова пара',
    water: 'Злегка, раз на 3–4 тижні — лише коли стара пара висохла',
    text: 'Стара пара перетворилася на тонку суху «шкірку», нові листки повністю розкрилися. Можна обережно відновлювати полив.',
  },
  rest: {
    title: 'Літній спокій',
    water: 'Майже без поливу: трохи, лише якщо сильно зморщились',
    text: 'У спеку літопси «сплять». Легке зморщування — нормально. Регулярний полив у цей час — найчастіша причина гнилі.',
  },
}
const MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const stageOf = (m: number): LithopsStage => (m >= 8 && m <= 10 ? 'grow' : m === 11 || m <= 2 ? 'change' : m <= 4 ? 'dry' : 'rest')
const STAGE_COLOR: Record<LithopsStage, string> = { grow: 'bg-brand-600', change: 'bg-sunset-500', dry: 'bg-sand-400', rest: 'bg-[#9cc3dc]' }

/** Пара листків літопса: дві напівкулі з щілиною, зверху — «віконця» з візерунком. */
function LithopsPair({ w = 1, shrink = 0, fill = '#b9a27f', top = '#d8c6a3' }: { w?: number; shrink?: number; fill?: string; top?: string }) {
  const r = 30 * w * (1 - shrink * 0.15)
  const h = 46 * w * (1 - shrink * 0.2)
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(${side * (r + 1.5)} 0)`}>
          <path d={`M${-r} 0 L${-r} ${-h * 0.55} Q${-r} ${-h} 0 ${-h} Q${r} ${-h} ${r} ${-h * 0.55} L${r} 0 Z`} style={{ fill, transition: SMOOTH }} stroke="#8a7350" strokeWidth="1.5" />
          <ellipse cy={-h * 0.82} rx={r * 0.78} ry={h * 0.16} style={{ fill: top, transition: SMOOTH }} />
          {[-0.4, 0, 0.35].map((dx, i) => (
            <circle key={i} cx={dx * r} cy={-h * (0.8 + (i % 2) * 0.05)} r={2.2 * w} fill="#9b845e" opacity="0.7" />
          ))}
          {shrink > 0.3 && <path d={`M${-r * 0.7} ${-h * 0.4} q${r * 0.3} -4 ${r * 0.6} 0 M${-r * 0.5} ${-h * 0.25} q${r * 0.3} -3 ${r * 0.6} 0`} fill="none" stroke="#8a7350" strokeWidth="1" opacity="0.6" />}
        </g>
      ))}
    </g>
  )
}

export function LithopsDemo() {
  const [month, setMonth] = useState(9)
  const stage = stageOf(month)
  const info = LITHOPS_STAGES[stage]
  return (
    <Demo
      title="Календар літопса: оберіть місяць"
      controls={
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonth(i)}
              aria-pressed={month === i}
              className={`relative min-h-10 rounded-xl border-2 text-xs font-bold transition-colors ${month === i ? 'border-brand-600 bg-brand-600 text-sand-50' : 'border-sand-200 bg-sand-50 hover:border-brand-500'}`}
            >
              {m}
              <span className={`absolute inset-x-2 bottom-1 h-1 rounded-full ${STAGE_COLOR[stageOf(i)]}`} aria-hidden />
            </button>
          ))}
        </div>
      }
      explain={
        <>
          <b className="text-brand-600">{info.title}.</b> {info.text}
          <span className="mt-2 flex items-center gap-2 font-bold">
            <Droplets size={16} strokeWidth={2.25} className="shrink-0 text-[#5b8fb9]" aria-hidden />
            {info.water}
          </span>
        </>
      }
    >
      <svg viewBox="0 0 300 180" className="mx-auto block w-full max-w-md" role="img" aria-label={info.title}>
        <rect width="300" height="180" rx="18" fill={stage === 'rest' ? '#ffe9c2' : '#f6e9d2'} />
        <rect y="138" width="300" height="42" fill="#c9a77a" />
        {/* дрібна галька зверху ґрунту */}
        {[30, 60, 210, 250, 275, 90, 190].map((x, i) => (
          <ellipse key={x} cx={x} cy={142 + (i % 3) * 6} rx="6" ry="4" fill={i % 2 ? '#e9dcc4' : '#b9ab92'} />
        ))}
        <g transform="translate(150 144) scale(1.6)">
          {stage === 'grow' && (
            <>
              <LithopsPair />
              {/* Квітка з щілини */}
              <g transform="translate(0 -50)">
                {Array.from({ length: 14 }, (_, i) => (
                  <ellipse key={i} rx="3.2" ry="15" cy="-14" fill="#f4d35e" transform={`rotate(${(i * 360) / 14})`} />
                ))}
                <circle r="6" fill="#e0a526" />
              </g>
            </>
          )}
          {stage === 'change' && (
            <>
              {/* Стара пара розходиться й зморщується, усередині — нова */}
              {/* Стара пара (зморщена, темніша) розступилась — між її половинками видно світлу нову пару */}
              <g transform="translate(-34 0) rotate(-12)">
                <path d="M-26 0 L-26 -22 Q-26 -40 0 -40 Q22 -40 24 -24 L22 0 Z" fill="#a08566" stroke="#7a6243" strokeWidth="1.5" />
                <path d="M-18 -28 q8 -4 16 0 M-20 -18 q10 -4 20 0 M-18 -8 q8 -3 16 0" fill="none" stroke="#7a6243" strokeWidth="1.2" />
              </g>
              <g transform="translate(34 0) rotate(12)">
                <path d="M26 0 L26 -22 Q26 -40 0 -40 Q-22 -40 -24 -24 L-22 0 Z" fill="#a08566" stroke="#7a6243" strokeWidth="1.5" />
                <path d="M18 -28 q-8 -4 -16 0 M20 -18 q-10 -4 -20 0 M18 -8 q-8 -3 -16 0" fill="none" stroke="#7a6243" strokeWidth="1.2" />
              </g>
              <LithopsPair w={0.62} fill="#d2c19a" top="#f1e6cb" />
            </>
          )}
          {stage === 'dry' && (
            <>
              <path d="M-78 0 Q-80 -40 -60 -48 Q-66 -20 -62 0 Z M78 0 Q80 -40 60 -48 Q66 -20 62 0 Z" fill="#a08566" opacity="0.8" />
              <LithopsPair w={0.95} />
            </>
          )}
          {stage === 'rest' && <LithopsPair w={0.9} shrink={0.6} />}
        </g>
      </svg>
    </Demo>
  )
}

/** Яку ілюстрацію вставити в статтю (блок `figure` з цим id). */
export const FIGURES = {
  lithops: LithopsDemo,
  pestMealybug: () => <PestFigure kind="mealybug" />,
  pestRoot: () => <PestFigure kind="root" />,
  pestMite: () => <PestFigure kind="mite" />,
  pestThrips: () => <PestFigure kind="thrips" />,
  pestGnats: () => <PestFigure kind="gnats" />,
  pestRot: () => <PestFigure kind="rot" />,
  summer: SummerDemo,
  fertilizer: FertilizerCalc,
  timeline: TimelineDemo,
  hybrids: HybridDemo,
  pests: PestsDemo,
  forms: FormsDemo,
  names: NamesDemo,
  soilDrain: SoilDrainDemo,
  soilCalc: SoilCalculator,
  watering: WateringDemo,
  light: LightDemo,
  color: ColorDemo,
  leaf: LeafDemo,
  winter: WinterDemo,
} as const
export type FigureId = keyof typeof FIGURES

