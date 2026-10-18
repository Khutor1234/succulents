import type { ReactNode } from 'react'
import { Rosette } from './Illustrations'

/*
 * Малюнки шкідників і хвороб: ліворуч — як це виглядає на рослині, праворуч — «лупа» зі збільшеним шкідником.
 * Усе намальовано в SVG (без фото), у кольорах сайту.
 */

export type PestKind = 'mealybug' | 'root' | 'mite' | 'thrips' | 'gnats' | 'rot'

const LEAF = 'M18 150 C 30 70, 140 26, 205 42 C 178 92, 104 152, 18 150 Z'
const LENS = { x: 250, y: 86, r: 58 }

/** Псевдовипадкові, але завжди однакові точки — для крапок, ворсинок тощо. */
function dots(n: number, seed: number, w: number, h: number) {
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: n }, () => [rnd() * w, rnd() * h] as const)
}

function Leaf({ children }: { children?: ReactNode }) {
  return (
    <g>
      <path d={LEAF} fill="#6d9f86" stroke="#3f6f58" strokeWidth="2" />
      <path d="M26 146 C 80 110, 140 70, 198 46" fill="none" stroke="#5a8a72" strokeWidth="1.5" />
      {children}
    </g>
  )
}

/** Кругла «лупа» з підписом; вміст обрізається колом. */
function Lens({ id, bg, children }: { id: string; bg: string; children: ReactNode }) {
  const { x, y, r } = LENS
  return (
    <g>
      <clipPath id={`lens-${id}`}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <rect x={x - 100} y={y + 46} width="10" height="44" rx="5" fill="#6e5a44" transform={`rotate(-40 ${x - 40} ${y + 50})`} />
      <circle cx={x} cy={y} r={r} fill={bg} />
      <g clipPath={`url(#lens-${id})`}>{children}</g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="#2b2118" strokeWidth="5" />
      <circle cx={x} cy={y} r={r - 4} fill="none" stroke="#fff6e8" strokeWidth="2" opacity="0.5" />
      <text x={x} y={y + r + 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6e5a44">
        збільшено
      </text>
    </g>
  )
}

/** Борошнистий червець: овальне тільце у восковому «пуху» з ниточками по краях. */
function Mealybug({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return <line key={i} x1={Math.cos(a) * 20} y1={Math.sin(a) * 11} x2={Math.cos(a) * 28} y2={Math.sin(a) * 17} stroke="#efe9dc" strokeWidth="2.2" strokeLinecap="round" />
      })}
      <ellipse rx="22" ry="12.5" fill="#f7f3ea" stroke="#d9d0bd" strokeWidth="1.2" />
      {[-12, -6, 0, 6, 12].map((dx) => (
        <path key={dx} d={`M${dx} -11 Q${dx + 2} 0 ${dx} 11`} fill="none" stroke="#ddd4c2" strokeWidth="1.2" />
      ))}
    </g>
  )
}

/** Ватяна грудочка (на рослині здалеку) */
const Fluff = ({ x, y, k = 1 }: { x: number; y: number; k?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} fill="#fbf8f1">
    <circle r="6" />
    <circle cx="5" cy="-2" r="4.5" />
    <circle cx="-5" cy="1" r="4" />
    <circle cx="1" cy="4" r="4" />
  </g>
)

/** Павутинний кліщ: крихітне тільце з двома темними плямами й вісьмома ніжками. */
function Mite({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {[-1, 1].map((side) =>
        [-6, -2, 2, 6].map((dy, i) => (
          <path key={`${side}${dy}`} d={`M${side * 7} ${dy} q${side * 6} ${i < 2 ? -4 : 4} ${side * 11} ${i < 2 ? -2 : 6}`} fill="none" stroke="#a5672a" strokeWidth="1.4" />
        )),
      )}
      <ellipse rx="9" ry="11" fill="#e3a94a" stroke="#a5672a" strokeWidth="1.2" />
      <circle cx="-4" cy="1" r="2.6" fill="#5a3a1a" />
      <circle cx="4" cy="1" r="2.6" fill="#5a3a1a" />
    </g>
  )
}

/** Трипс: видовжене темне тільце з бахромчастими крильцями. */
function Thrips({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={`M${side * 2} -6 L${side * 9} 14`} stroke="#c9b9a3" strokeWidth="2" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={side * (3 + i)} y1={-4 + i * 3.2} x2={side * (7 + i)} y2={-5 + i * 3.2} stroke="#d8cbb8" strokeWidth="0.9" />
          ))}
        </g>
      ))}
      <ellipse rx="4" ry="19" fill="#6b4a2b" />
      <ellipse cy="-17" rx="3" ry="3.5" fill="#4a321c" />
      <path d="M-1.5 -20 l-3 -6 M1.5 -20 l3 -6" stroke="#4a321c" strokeWidth="1.2" />
    </g>
  )
}

/** Ґрунтова мушка (сциарида) */
function Gnat({ x, y, k = 1 }: { x: number; y: number; k?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <ellipse cx="-5" cy="-4" rx="7" ry="3.2" fill="#cfd8de" opacity="0.8" transform="rotate(-25 -5 -4)" />
      <ellipse cx="5" cy="-4" rx="7" ry="3.2" fill="#cfd8de" opacity="0.8" transform="rotate(25 5 -4)" />
      <ellipse rx="2.6" ry="6" fill="#1f1a16" />
      <circle cy="-6" r="2.2" fill="#1f1a16" />
      <path d="M-1 -7 l-4 -5 M1 -7 l4 -5" stroke="#1f1a16" strokeWidth="0.9" />
    </g>
  )
}

/** Личинка мушки: напівпрозорий хробачок з чорною голівкою */
const Larva = ({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x="-18" y="-5" width="36" height="10" rx="5" fill="#f3ece0" opacity="0.92" />
    {[-10, -4, 2, 8].map((dx) => (
      <line key={dx} x1={dx} y1="-5" x2={dx} y2="5" stroke="#ddd2bf" strokeWidth="1" />
    ))}
    <circle cx="19" r="4.5" fill="#1f1a16" />
  </g>
)

const SCENES: Record<PestKind, { label: string; scene: ReactNode; lens: { bg: string; content: ReactNode } }> = {
  mealybug: {
    label: 'Борошнистий червець на листку: білі «ватні» грудочки',
    scene: (
      <Leaf>
        <Fluff x={46} y={134} />
        <Fluff x={64} y={124} k={0.8} />
        <Fluff x={92} y={110} k={0.7} />
        <Fluff x={58} y={140} k={0.6} />
        <Fluff x={130} y={84} k={0.55} />
      </Leaf>
    ),
    lens: {
      bg: '#7aa991',
      content: (
        <>
          <Mealybug x={232} y={70} rot={-20} />
          <Mealybug x={268} y={104} s={0.85} rot={15} />
          <Mealybug x={226} y={118} s={0.55} rot={40} />
          <Fluff x={278} y={58} k={1.2} />
        </>
      ),
    },
  },
  root: {
    label: 'Кореневий червець: білий наліт на корінні',
    scene: (
      <g>
        <rect x="0" y="0" width="200" height="180" fill="#8a6a45" />
        {dots(70, 7, 200, 180).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5 + (i % 3)} fill={i % 2 ? '#7a5c3a' : '#9b7b54'} />
        ))}
        {['M100 0 C 96 40, 70 70, 50 120 C 40 150, 44 170, 40 180', 'M100 0 C 108 50, 140 80, 150 130', 'M98 30 C 80 50, 40 60, 20 90', 'M104 50 C 130 70, 170 80, 190 110'].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#e6cfa4" strokeWidth={6 - i} strokeLinecap="round" />
        ))}
        <Fluff x={62} y={96} k={0.9} />
        <Fluff x={128} y={78} k={0.8} />
        <Fluff x={40} y={76} k={0.6} />
        <Fluff x={146} y={118} k={0.7} />
        <Fluff x={52} y={136} k={0.6} />
      </g>
    ),
    lens: {
      bg: '#8a6a45',
      content: (
        <>
          <path d="M190 40 C 230 70, 260 100, 320 120" fill="none" stroke="#e6cfa4" strokeWidth="18" strokeLinecap="round" />
          <Fluff x={232} y={72} k={2} />
          <Mealybug x={262} y={98} s={0.7} rot={25} />
          <Fluff x={290} y={112} k={1.4} />
        </>
      ),
    },
  },
  mite: {
    label: 'Павутинний кліщ: світлі цятки на листі й тонка павутинка',
    scene: (
      <Leaf>
        {dots(90, 3, 150, 90).map(([x, y], i) => (
          <circle key={i} cx={40 + x} cy={60 + y - x * 0.35} r={0.9 + (i % 2) * 0.5} fill="#e9efe0" opacity="0.9" />
        ))}
        {['M170 46 L205 30', 'M176 52 L210 44', 'M182 44 L200 60', 'M190 40 L196 70'].map((d, i) => (
          <path key={i} d={d} stroke="#fff" strokeWidth="0.8" opacity="0.8" />
        ))}
      </Leaf>
    ),
    lens: {
      bg: '#86ad97',
      content: (
        <>
          {dots(60, 11, 120, 120).map(([x, y], i) => (
            <circle key={i} cx={190 + x} cy={26 + y} r={1.6} fill="#e9efe0" opacity="0.85" />
          ))}
          {['M200 40 L300 70', 'M210 120 L300 50', 'M190 90 L310 100', 'M240 30 L260 140'].map((d, i) => (
            <path key={i} d={d} stroke="#fff" strokeWidth="1" opacity="0.7" />
          ))}
          <Mite x={236} y={76} rot={-25} />
          <Mite x={272} y={108} rot={30} />
          <circle cx="254" cy="62" r="2.5" fill="#f3e3b5" />
          <circle cx="260" cy="66" r="2.5" fill="#f3e3b5" />
        </>
      ),
    },
  },
  thrips: {
    label: 'Трипси: сріблясті плями й чорні крапки',
    scene: (
      <Leaf>
        {[[70, 116, 26, 9], [120, 86, 22, 7], [150, 64, 16, 6]].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#dfe6e0" opacity="0.85" transform={`rotate(-28 ${x} ${y})`} />
        ))}
        {dots(26, 5, 110, 50).map(([x, y], i) => (
          <circle key={i} cx={60 + x} cy={110 - x * 0.45 + y * 0.3} r="1.3" fill="#1f1a16" />
        ))}
      </Leaf>
    ),
    lens: {
      bg: '#7aa991',
      content: (
        <>
          <ellipse cx="250" cy="90" rx="60" ry="22" fill="#dfe6e0" opacity="0.8" transform="rotate(-20 250 90)" />
          {dots(18, 9, 100, 80).map(([x, y], i) => (
            <circle key={i} cx={200 + x} cy={50 + y} r="2.2" fill="#1f1a16" />
          ))}
          <Thrips x={236} y={84} rot={-35} />
          <Thrips x={272} y={98} rot={20} />
        </>
      ),
    },
  },
  gnats: {
    label: 'Ґрунтові мушки над горщиком',
    scene: (
      <g>
        <path d="M40 104 L160 104 L148 176 L52 176 Z" fill="#c2774f" />
        <rect x="34" y="96" width="132" height="12" rx="3" fill="#a9603d" />
        <rect x="44" y="96" width="112" height="6" fill="#4a3a2a" />
        <g className="animate-glow">
          <Gnat x={80} y={62} k={1.2} />
          <Gnat x={116} y={44} />
          <Gnat x={136} y={76} k={0.9} />
        </g>
        <path d="M70 70 q10 -16 24 -8 M110 52 q14 -10 22 4" fill="none" stroke="#6e5a44" strokeWidth="1" strokeDasharray="3 3" />
      </g>
    ),
    lens: {
      bg: '#5a4632',
      content: (
        <>
          {dots(40, 13, 120, 120).map(([x, y], i) => (
            <circle key={i} cx={190 + x} cy={26 + y} r={2 + (i % 3)} fill={i % 2 ? '#6e5640' : '#4a3a2a'} />
          ))}
          <path d="M196 60 C 230 74, 270 66, 310 90" fill="none" stroke="#c9b089" strokeWidth="6" strokeLinecap="round" />
          <Larva x={240} y={92} rot={-15} />
          <Larva x={262} y={120} rot={20} />
        </>
      ),
    },
  },
  rot: {
    label: 'Гниль: чорна м’яка основа стебла',
    scene: (
      <g>
        <g transform="translate(100 116) scale(1.3)">
          <Rosette blush={0.1} />
          {/* Нижні листки почорніли й обвисли, основа стебла темна й м’яка */}
          <ellipse cx="-28" cy="-9" rx="17" ry="6.5" fill="#2b2118" opacity="0.9" transform="rotate(18 -28 -9)" />
          <ellipse cx="28" cy="-9" rx="17" ry="6.5" fill="#2b2118" opacity="0.9" transform="rotate(-18 28 -9)" />
          <ellipse cx="0" cy="-6" rx="13" ry="8" fill="#1f1712" />
          <ellipse cx="-5" cy="-8" rx="3" ry="1.6" fill="#6e5a44" opacity="0.7" />
        </g>
        {/* Листок, що відпав */}
        <ellipse cx="160" cy="170" rx="16" ry="6" fill="#2b2118" opacity="0.85" transform="rotate(-8 160 170)" />
      </g>
    ),
    lens: {
      bg: '#6d9f86',
      content: (
        <>
          {/* Здорова тканина зверху, гнила — знизу; пунктир — де різати */}
          <rect x="190" y="26" width="120" height="58" fill="#8fbf9f" />
          <rect x="190" y="84" width="120" height="70" fill="#3a2c20" />
          {dots(14, 17, 110, 50).map(([x, y], i) => (
            <ellipse key={i} cx={196 + x} cy={96 + y} rx="5" ry="3" fill="#5a4632" opacity="0.8" />
          ))}
          <path d="M190 84 Q 220 70 250 84 T 310 84" fill="#55705f" opacity="0.6" />
          <line x1="192" y1="68" x2="308" y2="68" stroke="#d9662f" strokeWidth="2.5" strokeDasharray="6 4" />
          <text x="250" y="60" textAnchor="middle" fontSize="11" fontWeight="800" fill="#973f17">
            різати тут
          </text>
        </>
      ),
    },
  },
}

/** Малюнок шкідника чи хвороби з «лупою». */
export function PestPicture({ kind, className = '' }: { kind: PestKind; className?: string }) {
  const s = SCENES[kind]
  return (
    <svg viewBox="0 0 320 180" className={`block w-full ${className}`} role="img" aria-label={s.label}>
      <rect width="320" height="180" rx="16" fill="#f6e9d2" />
      <g clipPath="url(#pest-frame)">
        <clipPath id="pest-frame">
          <rect width="200" height="180" rx="16" />
        </clipPath>
        {s.scene}
      </g>
      <Lens id={kind} bg={s.lens.bg}>
        {s.lens.content}
      </Lens>
    </svg>
  )
}

/** Окремий малюнок у статті — з підписом. */
export function PestFigure({ kind }: { kind: PestKind }) {
  return (
    <figure className="mt-5 overflow-hidden rounded-3xl border-2 border-sand-200 bg-sand-50 p-3">
      <PestPicture kind={kind} />
      <figcaption className="mt-2 px-1 text-center text-sm text-sand-700">{SCENES[kind].label}</figcaption>
    </figure>
  )
}
