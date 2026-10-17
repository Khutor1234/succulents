// Ілюстрації для тестових товарів: прості SVG-«фото» в стилі пустелі — щоб каталог не був сірим.
// Малюнок залежить від виду рослини (розетка, «камінці», смугаста хавортія…) або категорії товару,
// а кольори — від адреси товару, тож усі картки трохи різні. Справжні фото продавчиня завантажує в адмінці.
import fs from 'node:fs'
import path from 'node:path'

const BACKGROUNDS = [
  ['#f6e7cf', '#eccfa6'],
  ['#f3dcc8', '#e7b892'],
  ['#e9efe0', '#cfdcbc'],
  ['#f8e3d6', '#efc1a7'],
  ['#efe6f3', '#d9c6e4'],
  ['#e2eef0', '#bfd8dc'],
]
const LEAVES = [
  ['#7fa88a', '#4f7d62'],
  ['#9fb7c9', '#6a8aa6'],
  ['#b4c98f', '#7f9b57'],
  ['#c7a6c9', '#8f6c98'],
  ['#e1a78f', '#b56b52'],
  ['#8fc2b0', '#4f8f7d'],
]
const POTS = ['#c8673f', '#d98b5f', '#ead9c0', '#6f8d9e', '#b9b2a8']

function hash(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
const pickOf = (arr, n) => arr[Math.abs(n) % arr.length]

const ROSETTES = ['Echeveria', 'Graptoveria', 'Graptopetalum', 'Pachyveria', 'Sedeveria', 'Greenovia', 'Aeonium']
const CHUBBY = ['Pachyphytum', 'Corpuscularia', 'Cotyledon', 'Kalanchoe', 'Crassula']
const TRAILING = ['Sedum', 'Senecio', 'Pachysedum']

function rosette([light, dark], { variegata, cristata, petals = 9 }) {
  const rings = [
    { n: petals, r: 72, w: 26, h: 70 },
    { n: petals - 1, r: 46, w: 22, h: 54 },
    { n: petals - 3, r: 22, w: 18, h: 38 },
  ]
  const centers = cristata ? [-48, -16, 16, 48] : [0]
  const scale = cristata ? 0.45 : 1
  let out = ''
  for (const cx of centers) {
    out += `<g transform="translate(${cx} ${cristata ? Math.abs(cx) / 4 : 0}) scale(${scale})">`
    rings.forEach((ring, i) => {
      for (let k = 0; k < ring.n; k++) {
        const a = (360 / ring.n) * k + i * 17
        out += `<path transform="rotate(${a}) translate(0 ${-ring.r})" d="M0 ${ring.h / 2} C ${ring.w} ${ring.h / 4} ${ring.w / 2} ${-ring.h / 2} 0 ${-ring.h / 2} C ${-ring.w / 2} ${-ring.h / 2} ${-ring.w} ${ring.h / 4} 0 ${ring.h / 2}Z" fill="${i % 2 ? light : dark}" stroke="${variegata ? '#fbf3d9' : dark}" stroke-width="${variegata ? 6 : 1.5}"/>`
      }
    })
    out += `<circle r="10" fill="${light}"/></g>`
  }
  return out
}

function lithops([light, dark]) {
  return [-46, 46]
    .map(
      (x, i) =>
        `<g transform="translate(${x} ${i ? 6 : 0})"><path d="M-40 40 C -44 -10 -30 -46 0 -46 C 30 -46 44 -10 40 40Z" fill="${light}"/>` +
        `<path d="M-38 -14 C -20 -30 20 -30 38 -14 L 2 -4Z" fill="${dark}" opacity=".55"/><path d="M0 -46 L0 40" stroke="${dark}" stroke-width="3"/></g>`,
    )
    .join('')
}

function haworthia([light, dark], { variegata }) {
  let out = ''
  for (let k = 0; k < 11; k++) {
    const a = -75 + k * 15
    out += `<g transform="rotate(${a}) translate(0 -10)"><path d="M-17 20 Q-6 -60 0 -96 Q6 -60 17 20Z" fill="${k % 2 ? dark : light}"/>`
    for (let s = 0; s < 6; s++) out += `<path d="M-7 ${8 - s * 15} h14" stroke="${variegata ? '#fff6d6' : '#f6f2ea'}" stroke-width="3" stroke-linecap="round"/>`
    out += '</g>'
  }
  return out
}

function chubby([light, dark], { variegata }) {
  let out = ''
  const leaves = [
    [-40, 10, -30], [40, 10, 30], [-24, -34, -14], [24, -34, 14], [0, -64, 0], [-56, -30, -50], [56, -30, 50],
  ]
  for (const [x, y, a] of leaves) {
    out += `<ellipse transform="translate(${x} ${y}) rotate(${a})" rx="22" ry="34" fill="${light}" stroke="${variegata ? '#fbf3d9' : dark}" stroke-width="${variegata ? 6 : 2}"/>`
  }
  return out + `<path d="M0 40 V-40" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>`
}

function trailing([light, dark]) {
  let out = ''
  for (const [x, dir] of [[-36, -1], [0, 0], [36, 1]]) {
    for (let k = 0; k < 9; k++) {
      const y = -40 + k * 16
      out += `<circle cx="${x + dir * k * 7 + (k % 2 ? 6 : -6)}" cy="${y}" r="11" fill="${k % 2 ? light : dark}"/>`
    }
  }
  return out
}

function plantSvg(p, n) {
  const leaf = pickOf(LEAVES, n >>> 3)
  const tags = p.tags ?? []
  const opts = { variegata: tags.includes('variegata'), cristata: tags.includes('cristata') }
  const genus = p.genus ?? ''
  let plant
  if (genus === 'Lithops') plant = lithops(leaf)
  else if (genus === 'Haworthia') plant = haworthia(leaf, opts)
  else if (TRAILING.includes(genus)) plant = trailing(leaf)
  else if (CHUBBY.includes(genus)) plant = chubby(leaf, opts)
  else plant = rosette(leaf, { ...opts, petals: ROSETTES.includes(genus) ? 8 + (n % 4) : 9 })
  // Зріз — без горщика, просто на піску.
  if (tags.includes('cutting')) {
    return `<ellipse cx="200" cy="330" rx="120" ry="18" fill="#000" opacity=".08"/><g transform="translate(200 220) scale(1.15)">${plant}</g>`
  }
  return potSvg(pickOf(POTS, n >>> 5), { y: 250 }) + `<g transform="translate(200 200) scale(1.3)">${plant}</g>`
}

function potSvg(color, { y = 230, big = false } = {}) {
  const w = big ? 120 : 92
  return (
    `<ellipse cx="200" cy="${y + 108}" rx="${w + 14}" ry="14" fill="#000" opacity=".08"/>` +
    `<path d="M${200 - w + 10} ${y + 10} L${200 - w + 34} ${y + 104} H${200 + w - 34} L${200 + w - 10} ${y + 10}Z" fill="${color}"/>` +
    `<rect x="${200 - w}" y="${y - 8}" width="${w * 2}" height="26" rx="8" fill="${color}"/>` +
    `<rect x="${200 - w}" y="${y - 8}" width="${w * 2}" height="26" rx="8" fill="#fff" opacity=".18"/>`
  )
}

function otherSvg(p, n) {
  const accent = pickOf(['#c8673f', '#4f7d62', '#6a8aa6', '#8f6c98'], n >>> 4)
  const used = (p.tags ?? []).includes('used')
  // Б/У — маленька «латка»-позначка, як наклейка на речі з рук.
  const usedMark = used
    ? `<g transform="translate(300 90) rotate(12)"><circle r="34" fill="#fbf3d9" stroke="${accent}" stroke-width="4" stroke-dasharray="6 5"/><text y="9" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="24" fill="${accent}">Б/У</text></g>`
    : ''
  switch (p.category) {
    case 'pots':
      return potSvg(pickOf(POTS, n), { y: 170, big: true }) + `<path d="M140 190 q60 30 120 0" stroke="#fff" stroke-width="5" fill="none" opacity=".35"/>` + usedMark
    case 'tools':
      if (p.slug.includes('bottle')) {
        return `<ellipse cx="200" cy="340" rx="80" ry="12" fill="#000" opacity=".08"/><rect x="150" y="150" width="100" height="190" rx="30" fill="${accent}"/><rect x="185" y="105" width="30" height="50" rx="8" fill="#ead9c0"/><path d="M200 105 Q240 60 290 70" stroke="#ead9c0" stroke-width="10" fill="none" stroke-linecap="round"/><rect x="165" y="210" width="70" height="60" rx="12" fill="#fff" opacity=".35"/>` + usedMark
      }
      return `<ellipse cx="200" cy="340" rx="110" ry="12" fill="#000" opacity=".08"/><g transform="rotate(-30 200 210)"><path d="M190 60 L178 330 L192 330 L200 90Z" fill="#9aa3a8"/><path d="M210 60 L222 330 L208 330 L200 90Z" fill="#b9c1c6"/><rect x="186" y="60" width="28" height="70" rx="10" fill="${accent}"/></g>` + usedMark
    case 'soil':
      return `<ellipse cx="200" cy="345" rx="120" ry="14" fill="#000" opacity=".08"/><path d="M110 110 H290 L305 340 H95Z" fill="#c9a77c"/><path d="M110 110 H290 L282 140 H118Z" fill="#a9845a"/><rect x="140" y="190" width="120" height="80" rx="14" fill="#fbf3d9"/><g fill="${accent}">${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${158 + k * 17}" cy="${230 + (k % 2) * 10}" r="6"/>`).join('')}</g>`
    case 'fertilizers':
      return `<ellipse cx="200" cy="345" rx="80" ry="12" fill="#000" opacity=".08"/><rect x="145" y="140" width="110" height="200" rx="24" fill="${accent}"/><rect x="175" y="100" width="50" height="46" rx="10" fill="#ead9c0"/><circle cx="200" cy="240" r="34" fill="#fbf3d9"/><path d="M200 262 V226 M200 236 q-16 -14 -24 -2 q10 12 24 2 M200 230 q16 -14 24 -2 q-10 12 -24 2" stroke="#4f7d62" stroke-width="4" fill="#7fa88a"/>`
    default:
      return `<ellipse cx="200" cy="345" rx="80" ry="12" fill="#000" opacity=".08"/><rect x="150" y="150" width="100" height="190" rx="22" fill="${accent}"/><path d="M175 150 V110 H230 L262 92 V128 L230 120 V150Z" fill="#ead9c0"/><g transform="translate(200 245)"><ellipse rx="22" ry="28" fill="#fbf3d9"/><path d="M-22 -10 L-40 -24 M22 -10 L40 -24 M-22 10 L-40 20 M22 10 L40 20" stroke="#fbf3d9" stroke-width="5" stroke-linecap="round"/><path d="M-30 -30 L30 30" stroke="#c0392b" stroke-width="8" stroke-linecap="round"/></g>`
  }
}

/** SVG-картинка товару; variant > 0 — той самий товар «з іншого ракурсу» (інший фон і масштаб). */
export function productSvg(p, variant = 0) {
  const n = hash(p.slug) + variant * 7
  const [bg1, bg2] = pickOf(BACKGROUNDS, n + variant)
  const body = p.category === 'plants' ? plantSvg(p, hash(p.slug)) : otherSvg(p, hash(p.slug))
  const zoom = variant ? 'translate(-60 -50) scale(1.3)' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#bg)"/>
<circle cx="${80 + (n % 240)}" cy="${60 + (n % 50)}" r="${34 + (n % 20)}" fill="#fff" opacity=".35"/>
<path d="M0 330 Q100 300 200 322 T400 312 V400 H0Z" fill="#fff" opacity=".25"/>
<g transform="${zoom}">${body}</g>
</svg>`
}

/**
 * Записує картинки в web/public/seed/ і повертає шляхи для поля images.
 * Сайт віддає їх як звичайні статичні файли (/seed/…svg), тож Storage для тестових даних не потрібен.
 */
export function writeSeedImages(products, webPublicDir) {
  const dir = path.join(webPublicDir, 'seed')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const images = new Map()
  products.forEach((p, i) => {
    // Кожен третій товар — з двома фото, щоб перевіряти перегляд фото.
    const count = i % 3 === 0 ? 2 : 1
    const list = []
    for (let v = 0; v < count; v++) {
      const file = `${p.slug}${v ? `-${v + 1}` : ''}.svg`
      fs.writeFileSync(path.join(dir, file), productSvg(p, v))
      list.push(`/seed/${file}`)
    }
    images.set(p.slug, list)
  })
  return images
}
