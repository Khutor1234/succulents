# Магазин сукулентів — System Design

> Версія 1 · 2026-10-17 · статус: чернетка для обговорення

## 1. Вимоги

### Функціональні
- Каталог товарів з категоріями:
  - **Рослини** (сукуленти)
  - **Інструменти**
  - **Ґрунтові суміші**
  - **Добрива**
  - **Засоби від шкідників**
- Сторінка товару, кошик, оформлення замовлення.
- Реєстрація / вхід (email + Google).
- Дві ролі: **клієнт** (купує) і **продавець** (керує товарами й замовленнями).
- Адмінка (етап 2): додати / редагувати / приховати товар, завантажити фото, змінити залишок, переглянути замовлення.

### Нефункціональні
- Малий масштаб: до ~1 000 відвідувачів на день, до ~500 товарів, десятки замовлень на день.
- Мінімальна вартість — вкластися в безкоштовний тариф Firebase (Spark) на старті, потім Blaze (pay-as-you-go, бо Cloud Functions його вимагають).
- Дизайн суперпростий, але адаптивний (телефон — основний пристрій покупця).
- Безпека: ціну й залишок рахує тільки сервер, клієнт не може змінити собі роль.

### Обмеження та припущення
- Команда — 2 людини, розробка з AI-асистентом.
- Стек: React + Firebase + Node (Cloud Functions).
- Оплата: тільки передоплата переказом на картку перед відправкою (продавець надсилає реквізити після підтвердження). Оплати при отриманні немає. Онлайн-оплату поки не робимо (повернемося пізніше).
- **Купувати можна без реєстрації** (guest checkout). Реєстрація — за бажанням, щоб бачити історію замовлень.
- Сповіщення про нові замовлення — **Telegram** (продавцю) + **email** (продавцю і покупцю).
- Доставка: Нова Пошта — поки що текстові поля (місто, відділення), без API-інтеграції.

---

## 2. Стек технологій

| Шар | Вибір | Чому |
|---|---|---|
| Збірка | **Vite** + **TypeScript** | Стандарт для нових React-проєктів, швидкий dev-сервер |
| UI | **React 19** | Вимога |
| Роутинг | **React Router v7** | Найпопулярніший, простий |
| Серверний стан (дані з Firestore) | **TanStack Query** | Кешування, завантаження, помилки, рефетч — «з коробки» |
| Клієнтський стан (кошик, UI) | **Zustand** (+ `persist` у localStorage) | Найпопулярніший легкий стейт-менеджер зараз: мало коду, без бойлерплейту Redux |
| Стилі | **Tailwind CSS** | Простий дизайн без окремих CSS-файлів; легко перейти на shadcn/ui пізніше |
| Форми (адмінка, checkout) | **React Hook Form** + **Zod** | Валідація, однакові схеми на клієнті й у Functions |
| Мови | **i18next** + **react-i18next** | Українська (за замовчуванням) + англійська; вибір зберігається в браузері |
| Auth | **Firebase Authentication** | Email/пароль + Google |
| БД | **Cloud Firestore** | Документна БД, real-time, Security Rules |
| Файли | **Firebase Storage** | Фото товарів |
| Бекенд | **Cloud Functions for Firebase (Node 22, TS)** | Створення замовлень, ролі, вебхуки оплати |
| Хостинг | **Firebase Hosting** | CDN, HTTPS, preview-канали для PR |
| Локальна розробка | **Firebase Emulator Suite** | Працюємо без реальної бази |

**Чому Zustand + TanStack Query, а не Redux Toolkit:** у магазину майже весь стан — це дані з сервера (товари, замовлення). TanStack Query закриває це повністю, а на Zustand лишається тільки кошик і дрібний UI-стан. Redux тут дав би більше коду без реальної вигоди.

---

## 3. Високорівнева архітектура

```
                    ┌──────────────────────────────┐
   Браузер          │  React SPA (Vite)            │
   (клієнт /        │  ├─ Магазин (публічна частина)│
    продавець)      │  ├─ Кошик / Checkout         │
                    │  └─ /admin (тільки seller)   │
                    │  Zustand: кошик              │
                    │  TanStack Query: дані        │
                    └───────┬───────────┬──────────┘
                            │           │
             читання товарів│           │ callable functions
             (Firestore SDK)│           │ (createOrder, setRole…)
                            ▼           ▼
   ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐
   │ Firebase Auth│  │ Firestore  │◄─┤ Cloud Functions (Node)│
   │ + custom     │  │ products   │  │ - createOrder         │
   │   claims     │  │ orders     │  │ - setUserRole         │
   │ (role)       │  │ users      │  │ - onImageUpload       │
   └──────────────┘  └────────────┘  │ - paymentWebhook (ет.3)│
                            ▲         └──────────────────────┘
                            │                    │
                     ┌──────┴──────┐             │
                     │  Storage    │◄────────────┘ (ресайз фото)
                     │  фото товарів│
                     └─────────────┘
         Хостинг: Firebase Hosting (CDN)
```

### Потоки даних
1. **Перегляд каталогу** — клієнт читає `products` напряму з Firestore (правила дозволяють читати тільки `isActive == true`).
2. **Кошик** — живе тільки в браузері (Zustand + localStorage). Сервер про нього не знає.
3. **Оформлення замовлення** — клієнт викликає `createOrder({ items, delivery })`. Функція в транзакції: перевіряє залишки, бере **ціни з бази** (не з клієнта), зменшує `stock`, створює `orders/{id}`.
4. **Адмінка** — продавець пише в `products` напряму (Security Rules перевіряють `role == 'seller'`), фото вантажить у Storage.

---

## 4. Ролі та доступ

Роль зберігається у **Firebase Auth custom claims** (`{ role: 'seller' }`), а не в документі користувача — тоді клієнт фізично не може її змінити, а Security Rules читають її без зайвого запиту (`request.auth.token.role`).

- Усі нові користувачі — `customer` (claim відсутній = клієнт).
- Першого продавця призначаємо скриптом (`scripts/set-seller.ts` через Admin SDK).
- Далі продавець може призначати інших через callable-функцію `setUserRole` (тільки якщо викликає seller).
- Після зміни ролі клієнт викликає `user.getIdToken(true)`, щоб оновити токен.

На фронті: компонент `<RequireRole role="seller">` закриває `/admin`. Це тільки UX — справжній захист у Rules і Functions.

---

## 5. Модель даних (Firestore)

```
// Категорії фіксовані в коді (web/src/lib/types.ts), назви — у файлах перекладів:
// plants | tools | soil | fertilizers | pest-control

products/{productId}
  name: { uk: string, en: string }        // кожен текст — обома мовами
  slug: string                    // для URL: /product/echeveria-elegans
  category: string                // slug категорії
  description: { uk: string, en: string }
  price: number                   // в копійках (int), напр. 15000 = 150 грн
  stock: number
  images: string[]                // шляхи в Storage
  isActive: boolean               // прихований товар не видно в магазині
  specs: [{ label: {uk,en}, value: {uk,en} }]   // характеристики, напр. «Діаметр горщика: 8 см»
  createdAt, updatedAt: timestamp

users/{uid}
  displayName, email, phone
  defaultDelivery: { city, warehouse }
  createdAt

orders/{orderId}
  number: string                  // короткий номер для людей: "SC-1042"
  userId: string | null           // null = гостьове замовлення
  email: string                   // обов'язково, для листа-підтвердження
  accessToken: string             // випадковий токен для посилання "статус замовлення" (гість)
  items: [{ productId, name, price, qty }]   // знімок на момент покупки
  total: number                               // копійки
  status: "new" | "confirmed" | "shipped" | "done" | "cancelled"
  delivery: { fullName, phone, city, warehouse, comment }
  payment: { method: "cod" | "card_transfer", paid: boolean }   // "online" — пізніше
  createdAt, updatedAt
```

**Рішення:**
- **Одна колекція `products` з полем `category`**, а не п'ять колекцій — один код для списку, пошуку й адмінки; запит `where('category','==','soil')`.
- **Ціни в копійках (int)** — без помилок округлення float.
- **`items` у замовленні — знімок** назви й ціни: якщо продавець потім змінить ціну, старі замовлення не зміняться.
- Індекси: `products (category, isActive, createdAt desc)`.

---

## 6. Security Rules (скорочено)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isSeller() { return request.auth != null && request.auth.token.role == 'seller'; }

    match /categories/{id} {
      allow read: if true;
      allow write: if isSeller();
    }
    match /products/{id} {
      allow read: if resource.data.isActive == true || isSeller();
      allow write: if isSeller();
    }
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid || isSeller();
    }
    match /orders/{id} {
      allow read: if (request.auth != null && request.auth.uid == resource.data.userId) || isSeller();
      allow create: if false;              // тільки через createOrder (і гість, і клієнт)
                                           // гість читає статус через getOrderStatus
      allow update: if isSeller();         // зміна статусу
    }
  }
}
```

Storage: читання `products/**` — всім, запис — тільки `isSeller()`, обмеження на тип `image/*` і розмір < 5 МБ.

---

## 7. Cloud Functions (Node)

| Функція | Тип | Що робить |
|---|---|---|
| `createOrder` | callable | Працює і для гостя, і для залогіненого. Валідація (Zod) → транзакція: перевірка `stock`, ціни з БД, декремент, запис замовлення. Захист від спаму — **App Check** (reCAPTCHA Enterprise, невидимий) + ліміт кількості товарів |
| `getOrderStatus` | callable | Гість відкриває посилання з листа `/order/:id?t=<accessToken>` і бачить статус без логіну |
| `setUserRole` | callable | Тільки seller; ставить custom claim |
| `onProductImageUpload` | Storage trigger | Генерує мініатюри (400px / 1200px, WebP) |
| `onOrderCreated` | Firestore trigger | **Telegram:** повідомлення в чат продавця (номер, товари, сума, телефон, НП). **Email:** лист продавцю + підтвердження покупцю |
| `onOrderCancelled` | Firestore trigger | Замовлення скасоване → товари повертаються на склад (`stock += qty`). Rules забороняють «розскасувати» замовлення |
| `onOrderStatusChanged` | Firestore trigger | Лист покупцю «замовлення відправлено» |
| `weeklyExport` | Scheduled | Щотижневий експорт усіх товарів і замовлень у JSON (див. розділ 9a) |

### Telegram-сповіщення
1. Створити бота через **@BotFather** → отримати токен.
2. Написати боту `/start` (або додати його в групу продавців) → дізнатися `chat_id`.
3. Токен і `chat_id` зберігаємо в **Secret Manager** (`firebase functions:secrets:set TELEGRAM_BOT_TOKEN`), не в коді.
4. `onOrderCreated` робить один HTTP-запит `sendMessage` до Telegram Bot API. Безкоштовно, без лімітів для нашого обсягу.
5. Пізніше можна додати кнопки в повідомленні («Підтвердити», «Відправлено») — бот міняє статус замовлення.

### Email
- Сервіс **Resend** (безкоштовно до 3 000 листів/міс) або розширення Firebase **Trigger Email** + будь-який SMTP.
- Потрібен свій домен (напр. `succulents.com.ua`) з налаштованими SPF/DKIM — інакше листи йдуть у спам.
- Шаблони листів — React Email (ті самі React-компоненти).

Окремий сервер на Express **не потрібен** — Cloud Functions і є наш Node-бекенд. Повертатися до цього питання варто тільки якщо з'явиться складна інтеграція (склад, 1С, маркетплейси).

---

## 8. Структура фронтенду

```
web/src/
  app/            router.tsx, Layout.tsx (шапка, меню), ErrorPage
  firebase/       config.ts (підключення, емулятори локально)
  i18n/           uk.ts — усі тексти інтерфейсу
  lib/            types.ts, format.ts (ціни в копійках), plants.ts / plantName.ts (назви й теги-форми), search.ts, slug.ts
  features/
    catalog/      pages.tsx (головна, категорія, товар), ProductCard, SearchPage, PlantFilters, api.ts
    cart/         cartStore.ts (Zustand), CartPage, AddToCart
    checkout/     CheckoutPage, OrderSuccessPage, schema.ts (Zod)
    auth/         LoginPage, RequireRole, authStore.ts (useAuth, роль)
    account/      кабінет: замовлення, дані доставки, пам'ятка з догляду
    favorites/    улюблене
    blog/         articles.ts (статті в коді), сторінки, коментарі
    admin/        AdminApp (маршрути), ProductsPage, ProductFormPage, ImagesEditor, ImportPage + sheetImport.ts,
                  OrdersPage, CategoriesPage, CustomersPage, AnalyticsPage
  shared/         ui (Button, ProductImage…), useProgressive
functions/src/    createOrder, adjustOrder, onOrderStatusChanged, bonuses, syncAccount, listCustomers, notifications
```

Продавець бачить у магазині й приховані товари (`isActive: false`) з позначкою «Приховано» та кнопками
редагування / показати-приховати / копії / видалення замість «У кошик».

### Маршрути
| URL | Сторінка |
|---|---|
| `/` | Головна: категорії + кілька товарів |
| `/c/:category` | Список товарів категорії |
| `/product/:slug` | Сторінка товару |
| `/cart` | Кошик |
| `/checkout` | Оформлення |
| `/search` | Пошук |
| `/blog`, `/blog/:slug` | Блог |
| `/login` | Вхід / реєстрація |
| `/account`, `/account/orders`, `/account/favorites` | Кабінет покупця |
| `/admin/products`, `/admin/products/:id` (`new`, `new?copy=<id>`), `/admin/import`, `/admin/orders`, `/admin/categories`, `/admin/customers`, `/admin/analytics` | Адмінка (seller) |

---

## 9. Масштаб і вартість

- 1 000 відвідувачів × ~30 читань документів ≈ 30 000 reads/день — це в межах безкоштовних 50 000/день Firestore.
- TanStack Query з `staleTime: 5 хв` суттєво зменшує повторні читання.
- Фото — найбільший трафік: мініатюри WebP + кеш-заголовки на Storage.
- Резервні копії: увімкнути Firestore scheduled backups (Blaze).
- Моніторинг: Firebase Crashlytics не для web → **Sentry** (безкоштовний тариф) + логи Cloud Functions.

---

## 9a. Чи не зникнуть дані? (надійність і бекапи)

**Що де лежить:**
- **Товари, замовлення, користувачі** → Firestore (база даних).
- **Фото** → Firebase Storage.
- **Файли сайту** (HTML/JS/CSS) → Firebase Hosting. «CDN» — це лише копії файлів сайту на серверах Google по світу, щоб сторінка швидко відкривалась. Товари там **не зберігаються**.

**Чи видаляє Firebase дані сам?** Ні. Firestore і Storage не мають «терміну придатності» — дані лежать, доки ми їх самі не видалимо або не видалимо проєкт. Google їх не змінює. Firestore зберігає дані з реплікацією в кількох дата-центрах (SLA 99,99%+).

**Реальні ризики й що робимо:**

| Ризик | Що станеться | Захист |
|---|---|---|
| Firestore створено в «test mode» | Через 30 днів правила самі закривають доступ — сайт «ламається», хоча дані цілі | Одразу пишемо власні Security Rules (розділ 6) |
| Storage на безкоштовному тарифі Spark | З 2026 р. Cloud Storage for Firebase **вимагає тариф Blaze** | Одразу переходимо на Blaze (безкоштовна квота лишається, платимо тільки понад неї) |
| Неоплата / проблема з карткою на Blaze | Сервіси зупиняються; дані ще якийсь час зберігаються, але проєкт може бути видалено | Бюджет-алерт на $5–10, актуальна картка, 2 власники проєкту (обидві людини) |
| Хтось випадково видалив товари в адмінці | Дані втрачено | **Point-in-time recovery** (відкат на будь-яку хвилину за 7 днів) + щоденні scheduled backups Firestore |
| Злам акаунта Google власника | Можуть видалити проєкт | 2FA на обох акаунтах; видалений проєкт можна відновити протягом 30 днів |
| Захочемо піти з Firebase | — | `weeklyExport` + `gcloud firestore export` — повна копія в JSON, яку можна перенести в будь-яку БД |

**Висновок:** якщо заповнимо базу товарами, вони залишаться, доки ми їх не змінимо. Головне — власні правила, тариф Blaze з бюджет-алертом і ввімкнені бекапи.

---

## 10. Компроміси

| Рішення | Плюс | Мінус / ризик |
|---|---|---|
| Firebase замість власного бекенду | Нуль серверів, швидкий старт | Vendor lock-in; складні звіти/фільтри у Firestore незручні |
| SPA (Vite), а не Next.js | Простіше, все на Firebase Hosting | Гірше SEO для сторінок товарів. Якщо органічний трафік з Google стане важливим — перейти на Next.js / пре-рендер |
| Кошик тільки в localStorage | Просто, без запитів | Кошик не синхронізується між пристроями |
| Роль у custom claims | Безпечно, швидко в Rules | Треба оновлювати токен після зміни ролі |
| Адмінка в тому ж застосунку | Один код, один деплой | Адмін-код потрапляє в бандл → розв'язуємо lazy-loading `/admin` |
| Пошук через Firestore | Безкоштовно | Немає повнотекстового пошуку → пізніше Algolia / Typesense extension |

---

## 11. Етапи

1. **MVP (магазин):** каталог з 5 категоріями, сторінка товару, кошик, checkout для гостя й клієнта через `createOrder`, Telegram-сповіщення продавцю, вхід, «мої замовлення». Бекапи й бюджет-алерт — з першого дня. Товари поки що додаємо seed-скриптом.
2. **Адмінка:** CRUD товарів, завантаження фото, список замовлень і зміна статусу, призначення ролей, email-листи покупцю.
3. **Зростання:** онлайн-оплата, інтеграція Нової Пошти, пошук, SEO/пре-рендер, кнопки керування замовленням у Telegram.

## 12. Що переглянути, коли проєкт виросте
- Більше одного продавця (маркетплейс) → поле `sellerId` у товарах і замовленнях, окремі правила.
- Багато фільтрів (ціна + розмір горщика + освітлення) → зовнішній пошуковий індекс.
- SEO стане каналом продажів → SSR (Next.js) або пре-рендер сторінок товарів.
- Аналітика продажів → експорт Firestore у BigQuery.

## 12a. Категорії, бонуси, мова (додано 2026-10-17)

**Категорії** зберігаються в `settings/categories` → `items: [{ id, name, visible }]` у порядку показу.
Продавець в адмінці додає, перейменовує, ховає, переставляє й видаляє їх. Видалити можна лише порожню категорію.
Товари схованої категорії зникають з вітрини, а `createOrder` відмовляє в їх замовленні.

**Бонуси**: 100 грн за реєстрацію (один раз на акаунт, лише з підтвердженим email — функція `syncAccount` після входу) + 10% від сплаченої суми кожного замовлення залогіненого покупця.
**Профіль**: `users/{uid}.delivery` — збережені ПІБ, телефон, місто, відділення; підставляються в оформлення й оновлюються після замовлення (галочка «Запам'ятати»).
**Оплата**: тільки передоплата на картку перед відправкою.
- `bonuses/{uid}` → `balance` (копійки), `bonuses/{uid}/history/*` — рядки earn/spend/refund/revoke. Писати можуть лише Functions.
- Списання — у `createOrder` в тій самій транзакції (до 100% суми замовлення).
- Нарахування — коли замовлення стає «Виконане» (тригер `onOrderStatusChanged`); якщо статус змінили назад — бонуси знімаються.
- Скасування — товари повертаються на склад, списані бонуси повертаються на рахунок.
- Кожна дія позначається прапорцем у замовленні (`bonusCredited`, `bonusRefunded`, `stockRestored`), тож повторний запуск тригера нічого не задвоює.

**Мова** — тільки українська. Поле `en` у товарах лишилось необов'язковим, щоб англійську можна було повернути без міграції.

## 13. Рішення та відкриті питання

**Вирішено (2026-10-17):**
- Онлайн-оплата — не зараз, пізніше.
- Купівля без реєстрації — так.
- Сповіщення — Telegram + email.
- ~~Мови сайту — українська + англійська.~~ Змінено: тільки українська.
- Бонуси 10% для залогінених, нараховуються після «Виконане».
- Дизайн — стиль «Пустеля».

**Відкрито:**
- Домен для сайту й пошти (потрібен для email) — вирішимо пізніше.
