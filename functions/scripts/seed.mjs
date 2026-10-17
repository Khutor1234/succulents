// Заповнює локальний емулятор тестовими товарами.
// Запуск (емулятори мають працювати): npm run seed
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { fileURLToPath } from 'node:url'
import { writeSeedImages } from './seedImages.mjs'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-succulents' })
const db = getFirestore()

const l = (uk, en) => ({ uk, en })
// Рослини називаємо латиною/англійською, як колекціонери (Echeveria 'Lola' variegata); мова сайту — українська.
const latin = (name) => ({ uk: name, en: name })
const spec = (label, value) => ({ label, value })
const pot = (cm) => spec(l('Діаметр горщика', 'Pot diameter'), l(`${cm} см`, `${cm} cm`))
const volume = (litres) => spec(l('Об’єм', 'Volume'), l(`${litres} л`, `${litres} L`))

const products = [
  {
    slug: 'echeveria-elegans',
    category: 'plants',
    name: latin('Echeveria elegans'),
    description: l(
      'Блакитна розетка, яка легко розмножується листками. Любить яскраве світло та рідкий полив.',
      'A blue rosette that is easy to propagate from leaves. Likes bright light and infrequent watering.',
    ),
    price: 15000,
    stock: 12,
    origin: 'natural',
    habitat: 'Мексика',
    genus: 'Echeveria',
    specs: [pot(8), spec(l('Освітлення', 'Light'), l('Яскраве', 'Bright'))],
  },
  // Кілька рослин із таблиці продавця — щоб було на чому перевіряти фільтри за видом і тегами.
  {
    slug: 'echeveria-lola-variegata',
    category: 'plants',
    name: latin("Echeveria 'Lola' variegata"),
    description: l('Гібрид E. lilacina × E. Deresina (Dick Wright). Варієгатна форма.', 'E. lilacina × E. Deresina hybrid (Dick Wright). Variegated form.'),
    price: 40000,
    stock: 2,
    genus: 'Echeveria',
    tags: ['variegata'],
    parents: ['Echeveria lilacina', 'Echeveria Deresina'],
    breeder: 'Dick Wright',
  },
  {
    slug: 'echeveria-agavoides-cristata',
    category: 'plants',
    name: latin('Echeveria agavoides cristata'),
    description: l('Кристатна (гребінчаста) форма E. agavoides.', 'Crested form of E. agavoides.'),
    price: 16000,
    stock: 1,
    genus: 'Echeveria',
    tags: ['cristata'],
  },
  {
    slug: 'echeveria-angel-wings',
    category: 'plants',
    name: latin('Echeveria Angel wings variegata cristata'),
    description: l('Одночасно кристатна й варієгатна.', 'Both crested and variegated.'),
    price: 24000,
    stock: 1,
    genus: 'Echeveria',
    tags: ['cristata', 'variegata'],
  },
  {
    slug: 'aeonium-cat-eye-variegata',
    category: 'plants',
    name: latin('Aeonium Cat eye variegata'),
    description: l('Зріз для вкорінення.', 'Cutting for rooting.'),
    price: 28000,
    stock: 1,
    genus: 'Aeonium',
    tags: ['cutting', 'variegata'],
  },
  // По одній рослині кожного роду з таблиці продавця (перший рядок, що є в наявності), ціни — колонка «Min ₴».
  ...[
    ['Corpuscularia', 'Lehmannii', ['variegata'], 28000],
    ['Cotyledon', 'Orbiculata', ['variegata'], 40000],
    ['Graptopetalum', 'Apricot', ['variegata'], 24000],
    ['Graptoveria', 'Alycia', [], 16000, 3],
    ['Graptoveria', 'Debbie', ['monstrose'], 20000, 2],
    ['Greenovia', '', ['variegata'], 44000],
    ['Kalanchoe', 'Fedchenkoi', [], 8000],
    ['Pachyphytum', 'Doctor Cornelius', ['variegata'], 100000],
    ['Pachysedum', 'Ganzhou', [], 16000],
    ['Pachyveria', 'Coco', [], 12000],
    ['Sedeveria', 'Blue elf', [], 16000, 3],
    ['Sedum', 'Buritto', [], 8000],
    ['Senecio', 'Agave Cream Spike', ['variegata'], 40000],
    ['Echeveria', 'lilacina', ['monstrose'], 20000],
    ['Echeveria', 'Romeo x Rubin', [], 20000],
  ].map(([genus, cultivar, tags, price, stock = 1]) => {
    // Батьки деяких гібридів — щоб на сайті було видно посилання «A × B» (деякі з батьків є і в магазині).
    const aliases = {
      Buritto: ['Sedum morganianum burrito', 'Ослячий хвіст', "Burro's tail"],
      Fedchenkoi: ['Bryophyllum fedtschenkoi', 'Каланхое Федченка'],
      'Agave Cream Spike': ['Senecio kleiniiformis', 'Kleinia'],
    }[cultivar]
    const parents = {
      'Romeo x Rubin': ['Echeveria Romeo', 'Echeveria Rubin'],
      Debbie: ['Graptopetalum amethystinum', 'Echeveria lilacina'],
      Alycia: ['Graptopetalum', "Echeveria 'Lola'"],
      Coco: ['Pachyphytum oviferum'],
      lilacina: ['Echeveria lilacina'],
    }[cultivar]
    const origin = cultivar === 'lilacina' ? 'cultivar' : undefined
    // Назва у форматі адмінки: «Вид Сорт форми» (форми — без «f.»), напр. «Graptoveria Debbie monstrose»
    const name = [genus, cultivar, ...tags].filter(Boolean).join(' ')
    return {
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      category: 'plants',
      name: latin(name),
      description: l(`${genus} — з колекції продавця.`, `${genus} from the seller's collection.`),
      price,
      stock,
      genus,
      tags,
      ...(aliases ? { aliases } : {}),
      ...(parents ? { parents } : {}),
      ...(origin ? { origin } : {}),
    }
  }),
  {
    slug: 'crassula-gollum',
    category: 'plants',
    name: latin('Crassula Gollum'),
    description: l('Трубчасті листки, «вушка Шрека».', 'Tubular leaves, "Shrek ears".'),
    price: 20000,
    stock: 1,
    genus: 'Crassula',
  },
  {
    slug: 'haworthia-fasciata',
    category: 'plants',
    name: latin('Haworthia fasciata'),
    description: l('Невибаглива, витримує півтінь. Ідеальна для підвіконня.', 'Undemanding, tolerates partial shade. Perfect for a windowsill.'),
    price: 12000,
    stock: 8,
    genus: 'Haworthia',
    specs: [pot(6), spec(l('Освітлення', 'Light'), l('Півтінь', 'Partial shade'))],
  },
  {
    slug: 'crassula-ovata',
    category: 'plants',
    name: latin('Crassula ovata'),
    description: l('Класичне «грошове дерево». Росте повільно, живе десятиліттями.', 'The classic jade plant. Grows slowly and lives for decades.'),
    price: 22000,
    stock: 5,
    genus: 'Crassula',
    aliases: ['Грошове дерево', 'Товстянка', 'Jade plant'],
    origin: 'natural',
    habitat: 'ПАР',
    specs: [pot(10)],
  },
  {
    slug: 'lithops-mix',
    category: 'plants',
    name: latin('Lithops mix'),
    description: l('Мікс із трьох рослин різних кольорів.', 'A mix of three plants of different colours.'),
    price: 18000,
    stock: 0,
    genus: 'Lithops',
    specs: [pot(5)],
  },
  {
    slug: 'succulent-tweezers',
    category: 'tools',
    name: l('Пінцет для сукулентів 27 см', 'Succulent tweezers 27 cm'),
    description: l('Довгий пінцет для пересадки та прибирання сухих листків.', 'Long tweezers for repotting and removing dry leaves.'),
    price: 9000,
    stock: 20,
  },
  {
    slug: 'succulent-tweezers-used',
    category: 'tools',
    name: l('Пінцет для сукулентів 27 см (Б/У)', 'Succulent tweezers 27 cm (used)'),
    description: l('Вживаний, у доброму стані.', 'Used, in good condition.'),
    price: 5000,
    stock: 1,
    tags: ['used'],
  },
  // Горщики: новий і вживаний (тег «Б/У»)
  {
    slug: 'clay-pot-8cm',
    category: 'pots',
    name: l('Глиняний горщик 8 см', 'Clay pot 8 cm'),
    description: l('Теракотовий горщик з дренажним отвором — глина «дихає», ґрунт швидше просихає.', 'Terracotta pot with a drainage hole.'),
    price: 6000,
    stock: 25,
    specs: [pot(8)],
  },
  {
    slug: 'ceramic-pot-12cm-used',
    category: 'pots',
    name: l('Керамічний горщик 12 см', 'Ceramic pot 12 cm'),
    description: l('Вживаний, без сколів.', 'Used, no chips.'),
    price: 9000,
    stock: 1,
    specs: [pot(12)],
    tags: ['used'],
  },
  {
    slug: 'watering-bottle',
    category: 'tools',
    name: l('Пляшка для точкового поливу', 'Precision watering bottle'),
    description: l('Тонкий носик — вода потрапляє під розетку, а не на листя.', 'A thin spout delivers water under the rosette, not on the leaves.'),
    price: 7000,
    stock: 15,
  },
  {
    slug: 'succulent-soil-2l',
    category: 'soil',
    name: l('Ґрунт для сукулентів', 'Succulent soil'),
    description: l('Суміш торфу, піску, перліту й цеоліту. Добре дренується.', 'A blend of peat, sand, perlite and zeolite. Drains well.'),
    price: 8500,
    stock: 30,
    specs: [volume(2)],
  },
  {
    slug: 'pumice-3-6mm',
    category: 'soil',
    name: l('Пемза 3–6 мм', 'Pumice 3–6 mm'),
    description: l('Мінеральна добавка для розпушення ґрунту.', 'A mineral additive to loosen the soil.'),
    price: 11000,
    stock: 10,
    specs: [volume(1)],
  },
  {
    slug: 'cactus-fertilizer',
    category: 'fertilizers',
    name: l('Добриво для кактусів і сукулентів', 'Cactus & succulent fertilizer'),
    description: l('Рідке добриво з низьким вмістом азоту. 5 мл на 1 л води раз на місяць.', 'Low-nitrogen liquid fertilizer. 5 ml per 1 L of water once a month.'),
    price: 9500,
    stock: 18,
    specs: [spec(l('Об’єм', 'Volume'), l('250 мл', '250 ml'))],
  },
  {
    slug: 'systemic-insecticide',
    category: 'pest-control',
    name: l('Системний інсектицид від борошнистого червеця', 'Systemic insecticide for mealybugs'),
    description: l(
      'Захищає від червеця, трипсів і щитівки. Працювати в рукавичках, тримати подалі від дітей і тварин.',
      'Protects against mealybugs, thrips and scale. Wear gloves, keep away from children and pets.',
    ),
    price: 13000,
    stock: 9,
    specs: [spec(l('Об’єм', 'Volume'), l('100 мл', '100 ml'))],
  },
]

// Спершу прибираємо старі тестові товари — щоб після змін у списку не лишалось залишків попередніх запусків.
// (Скрипт працює лише з емулятором: FIRESTORE_EMULATOR_HOST задано вище.)
const oldProducts = await db.collection('products').get()
await Promise.all(oldProducts.docs.map((d) => d.ref.delete()))

// Намальовані картинки товарів — у web/public/seed (ці файли в git не потрапляють).
const images = writeSeedImages(products, fileURLToPath(new URL('../../web/public', import.meta.url)))

const batch = db.batch()
batch.set(db.collection('settings').doc('categories'), {
  items: [
    { id: 'plants', name: 'Рослини', visible: true },
    { id: 'tools', name: 'Інструменти', visible: true },
    { id: 'pots', name: 'Горщики', visible: true },
    { id: 'soil', name: 'Ґрунтові суміші', visible: true },
    { id: 'fertilizers', name: 'Добрива', visible: true },
    { id: 'pest-control', name: 'Засоби від шкідників', visible: true },
  ],
  updatedAt: FieldValue.serverTimestamp(),
})
for (const p of products) {
  batch.set(db.collection('products').doc(p.slug), {
    images: images.get(p.slug) ?? [],
    isActive: true,
    specs: [],
    ...p,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
await batch.commit()
console.log(`Seeded ${products.length} products into ${process.env.FIRESTORE_EMULATOR_HOST}`)

// Тестовий продавець — тільки для локального емулятора. Його email є в functions/.env.local (SELLER_EMAILS),
// тому роль підтверджує й claimSellerRole.
const TEST_SELLER = { email: 'seller@example.test', password: 'seller-test-123' }
const auth = getAuth()
const seller = await auth
  .getUserByEmail(TEST_SELLER.email)
  .catch(() => auth.createUser({ ...TEST_SELLER, displayName: 'Test Seller' }))
await auth.updateUser(seller.uid, { emailVerified: true })
await auth.setCustomUserClaims(seller.uid, { role: 'seller' })
console.log(`Test seller: ${TEST_SELLER.email} / ${TEST_SELLER.password}`)

// Тестовий покупець (без адмінки). Бонусний рахунок обнуляється — при першому вході він отримає
// вітальні 100 грн, як справжній новий покупець.
const TEST_CUSTOMER = { email: 'customer@example.test', password: 'customer-test-123' }
const customer = await auth
  .getUserByEmail(TEST_CUSTOMER.email)
  .catch(() => auth.createUser({ ...TEST_CUSTOMER, displayName: 'Test Customer' }))
await auth.updateUser(customer.uid, { emailVerified: true })
await auth.setCustomUserClaims(customer.uid, null)
const bonusAccount = db.collection('bonuses').doc(customer.uid)
const oldHistory = await bonusAccount.collection('history').get()
await Promise.all(oldHistory.docs.map((d) => d.ref.delete()))
await bonusAccount.delete()
console.log(`Test customer: ${TEST_CUSTOMER.email} / ${TEST_CUSTOMER.password} (отримає 100 грн при першому вході)`)

// Тестові замовлення за останні 2 місяці — для перевірки адмінки й сторінки аналітики.
// Склад товарів не чіпаємо: це лише приклади. Старі тестові замовлення прибираємо.
const oldOrders = await db.collection('orders').get()
await Promise.all(oldOrders.docs.map((d) => d.ref.delete()))
const BUYERS = [
  { fullName: 'Олена Коваль', phone: '+380671234567', city: 'Київ', warehouse: '№ 12', email: 'olena@example.test' },
  { fullName: 'Андрій Мельник', phone: '+380501112233', city: 'Львів', warehouse: '№ 3', email: 'andrii@example.test' },
  { fullName: 'Марія Шевченко', phone: '+380931234000', city: 'Одеса', warehouse: '№ 40', email: 'maria@example.test' },
  { fullName: 'Ірина Бондар', phone: '+380661110022', city: 'Київ', warehouse: '№ 155', email: 'iryna@example.test' },
  { fullName: 'Test Customer', phone: '+380970000000', city: 'Дніпро', warehouse: '№ 7', email: TEST_CUSTOMER.email, uid: customer.uid },
]
// Простий детермінований «випадок», щоб дані були однакові після кожного запуску.
let rnd = 42
const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648)
const choose = (arr) => arr[Math.floor(random() * arr.length)]
// Рослини замовляють частіше, ніж ґрунт чи інструменти; деякі — особливо популярні.
const popular = ['echeveria-lola-variegata', 'lithops-mix', 'haworthia-fasciata', 'succulent-soil-2l', 'crassula-gollum']
const ordersBatch = db.batch()
for (let n = 0; n < 28; n++) {
  const daysAgo = Math.floor(Math.pow(random(), 1.4) * 60)
  const createdAt = new Date(Date.now() - daysAgo * 86400000)
  createdAt.setHours(9 + Math.floor(random() * 13), Math.floor(random() * 60))
  if (createdAt > new Date()) createdAt.setDate(createdAt.getDate() - 1)
  const lines = new Map()
  const count = 1 + Math.floor(random() * 4)
  for (let k = 0; k < count; k++) {
    const hit = random() < 0.45 ? choose(popular) : null
    const p = (hit && products.find((x) => x.slug === hit)) || choose(products)
    lines.set(p.slug, (lines.get(p.slug) ?? 0) + 1 + (random() < 0.2 ? 1 : 0))
  }
  // Мінімальне замовлення 1000 грн: докладаємо ще рослин, як зробив би справжній покупець.
  const pricey = products.filter((x) => x.category === 'plants' && x.price >= 300_00)
  const sum = () => [...lines].reduce((s, [slug, qty]) => s + products.find((x) => x.slug === slug).price * qty, 0)
  while (sum() < 1000_00) {
    const p = choose(pricey)
    lines.set(p.slug, (lines.get(p.slug) ?? 0) + 1)
  }
  const items = [...lines].map(([slug, qty]) => {
    const p = products.find((x) => x.slug === slug)
    return { productId: slug, name: p.name, price: p.price, qty, image: images.get(slug)?.[0] ?? '' }
  })
  const sub = sum()
  const buyer = choose(BUYERS)
  const status = daysAgo < 2 ? 'new' : daysAgo < 5 ? choose(['confirmed', 'shipped']) : random() < 0.08 ? 'cancelled' : 'done'
  const bonusEarned = buyer.uid ? Math.floor(sub * 0.1) : 0
  ordersBatch.set(db.collection('orders').doc(`test-${1001 + n}`), {
    number: `SC-${1001 + n}`,
    userId: buyer.uid ?? null,
    email: buyer.email,
    accessToken: `test-${n}`,
    items,
    subtotal: sub,
    bonusUsed: 0,
    total: sub,
    bonusEarned,
    ...(status === 'done' && buyer.uid ? { bonusCredited: true } : {}),
    status,
    delivery: { fullName: buyer.fullName, phone: buyer.phone, city: buyer.city, warehouse: buyer.warehouse, comment: '' },
    payment: { method: 'card_transfer', paid: status === 'done' || status === 'shipped' },
    lang: 'uk',
    createdAt,
    updatedAt: createdAt,
  })
}
ordersBatch.set(db.collection('counters').doc('orders'), { last: 1001 + 28 })
await ordersBatch.commit()
console.log('Seeded 28 test orders')
