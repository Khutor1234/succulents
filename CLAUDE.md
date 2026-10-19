# Магазин «сукуленти.» — пам'ятка для Claude

Інтернет-магазин сукулентів власниці Олександри. Живий сайт: https://succulents-shop-ua.web.app
(Firebase-проєкт `succulents-shop-ua`, репозиторій `Khutor1234/succulents`). Увесь код пише Claude.

## Як працювати з власницею

- Відповідати **українською**, простими словами, без технічного жаргону. Вона не програмістка.
- Налаштування, команди й перевірки робити самому; від неї — лише те, що вимагає її акаунта (вхід, оплата, паролі).
- **Не комітити й не пушити, поки вона не скаже «Публікуй».** Push у `main` одразу публікує сайт (див. нижче).
  Спершу показувати зміни на localhost.
- Паролі, ключі, платіжні дані не вводити й не читати (`.env` з секретами, токени firebase-tools тощо).
- Справжню базу на проді змінювати лише через адмінку сайту (напр. сторінку «Імпорт»), а не скриптами з токенами.

## Стек і структура

```
web/        сайт: Vite + React 19 + TypeScript, Tailwind v4, react-router, TanStack Query, Zustand, i18next
functions/  Cloud Functions (Node 22): createOrder, бонуси, статуси замовлень, Telegram, syncAccount (роль продавця)
docs/       system-design.md (архітектура, модель даних), deploy.md, monitoring.md
firestore.rules, storage.rules, firestore.indexes.json
```

- Усі тексти інтерфейсу — `web/src/i18n/uk.ts` (лише українська).
- Каталог: `web/src/features/catalog` (картки `ProductCard.tsx`, сторінки `pages.tsx`, пошук `SearchPage.tsx`, запити `api.ts`).
- Адмінка: `web/src/features/admin` (вантажиться окремим шматком, маршрути в `AdminApp.tsx`): `/admin` — огляд із плитками,
  `/admin/products/:id` і `/admin/products/new` — форма товару, `/admin/orders`, `/admin/categories`, `/admin/customers`,
  `/admin/analytics`, `/admin/pedigrees` («Родоводи»: трійки мама × тато → дитина, батько й дитина, форми однієї рослини —
  розрахунок у `pedigrees.ts`), інструменти `/admin/import` і `/admin/forms`. **Окремого списку товарів немає** — товари керуються
  в магазині: кнопки продавця на картках, «Вибрати» (масові дії, `BulkBar`), «Додати» в каталозі й пошуку.
- Блог: статті прямо в коді — `web/src/features/blog/articles.ts`.
- Назви рослин і теги-форми: `web/src/lib/plants.ts`, `web/src/lib/plantName.ts`.
  Повна назва = рід + сорт + форми з галочок, напр. «Echeveria Lola variegata».
- Ціни зберігаються в **копійках** (`price: 28000` = 280 грн).

## Ролі й видимість

- Продавець (адмін) — `useAuth((s) => s.role === 'seller')`. Список email-ів має збігатися в чотирьох місцях:
  `firestore.rules`, `storage.rules`, `web/.env.production` (`VITE_SELLER_EMAILS`), `functions/.env.succulents-shop-ua`.
- Товар з `isActive: false` прихований: покупці його не бачать (так і в Rules). Продавець бачить приховані **скрізь**
  (каталог, головна, пошук, сторінка товару) з позначкою «Приховано» — запити в `catalog/api.ts` мають параметр `withHidden`.
- Для продавця в магазині: замість «У кошик» — кнопки Редагувати / Показати-приховати (око) / Копія / Видалити;
  у шапці немає кошика й кабінету, є «Адмінка».

## Імпорт з таблиці (Google Sheet «Рослини»)

`/admin/import`: вставити рядки таблиці (TSV) → попередній перегляд → «Застосувати».
Логіка в `web/src/features/admin/sheetImport.ts`: перейменовує існуючі товари за правилами назв, нові рослини створює
**прихованими** (`isActive: false`, залишок 0, ціна = «Max ₴»). Фото й наявність не чіпає.

## Локальна розробка

Емулятори Firebase (проєкт `demo-succulents`), справжній Firebase не потрібен:
```
npm run emulators   # термінал 1
npm run seed        # тестові товари й тестовий продавець (логін — у functions/scripts/seed.mjs)
npm run dev         # http://localhost:5173
```
У Claude desktop: dev-сервер «web» з `.claude/launch.json` (порт 5173). Firebase CLI на Windows — `npx.cmd firebase-tools`.
Перевірка перед публікацією: `npm --prefix web run lint` і `npm --prefix web run build`.

## Публікація

Push у `main` → GitHub Actions (`.github/workflows/deploy.yml`): lint → build → `firebase deploy` (сайт, функції, правила).
Займає кілька хвилин; стан — `https://api.github.com/repos/Khutor1234/succulents/actions/runs?per_page=1`.
Коміти — українською, коротко описують зміну для людини.
