# Перший запуск на справжньому Firebase

Частину кроків робиш ти в браузері: там потрібні твій Google-акаунт і банківська картка. Решту робить Claude.

## Крок 1. Створити проєкт (ти, ~10 хв)

1. Відкрити https://console.firebase.google.com → **Create a project**.
   - Назва: напр. `succulents-shop`. Запам'ятай **Project ID** під назвою (напр. `succulents-shop-1a2b3`).
   - Google Analytics можна вимкнути.
2. **Тариф Blaze** (ліва панель знизу → *Upgrade*). Потрібен для Cloud Functions і зберігання фото.
   Для нашого обсягу безкоштовної квоти вистачає з запасом, тож очікувана плата — близько 0 грн/міс.
   - Одразу після переходу постав **бюджет-алерт**, напр. $5: *Google Cloud Console → Billing → Budgets & alerts*.
3. **Authentication** → *Get started* → *Sign-in method*:
   - увімкнути **Google** (вказати email підтримки — свою пошту);
   - увімкнути **Email/Password**.
4. **Firestore Database** → *Create database*:
   - Location: **europe-central2 (Warsaw)**. Змінити її потім неможливо.
   - Режим: **Production mode**. Наші правила доступу Claude задеплоїть сам.
5. **Storage** → *Get started* → та сама локація **europe-central2**, режим Production.
6. **Project settings** (шестерня) → *Your apps* → значок **`</>`** (Web) → назва `web` → *Register app*.
   Firebase покаже блок `firebaseConfig` з полями `apiKey`, `authDomain`, `projectId`, `storageBucket`, `appId`.
   **Скопіюй цей блок і надішли Claude.** Ці ключі публічні, вони однакові в коді будь-якого сайту на Firebase. Дані захищають правила доступу, а не ці ключі.

## Крок 2. Увійти у Firebase CLI (ти, 1 хв)

У терміналі в папці проєкту:
```
firebase login
```
Відкриється браузер → обрати той самий Google-акаунт → *Allow*. Пароль бачить тільки Google.

## Крок 3. Надіслати Claude

- **Project ID**;
- блок **firebaseConfig**;
- **email-и продавців** (хто бачитиме адмінку) — напр. твій і Сашин Gmail.

## Крок 4. Деплой (Claude)

Claude:
1. прив'яже проєкт (`.firebaserc`) і запише ключі в `web/.env.production`;
2. запише список продавців у `functions/.env`;
3. задасть заглушки для Telegram-секретів (поки бота немає);
4. виконає `firebase deploy` — правила, індекси, функції й сайт.

Сайт буде доступний за адресою `https://<project-id>.web.app`.

## Крок 5. Перевірка (разом)

1. Відкрити сайт → **Увійти через Google** → має з'явитись справжнє вікно вибору акаунта Google.
2. Якщо твій email у списку продавців — у шапці з'явиться «Адмінка».
3. В адмінці додати перші справжні товари з фото.

> База на справжньому сайті спочатку порожня: тестові товари з емулятора туди не потрапляють.

## Автопублікація з GitHub

Справжній проєкт: **succulents-shop-ua**, сайт https://succulents-shop-ua.web.app.

- Кожен `git push` у гілку `main` запускає GitHub Actions (`.github/workflows/deploy.yml`):
  встановлення залежностей → перевірка коду → публікація сайту, функцій і правил. Хід — на вкладці **Actions** репозиторію.
  Якщо перевірка не пройде, на сайт нічого не потрапить.
- Перепублікувати вручну: Actions → Deploy → **Run workflow**.
- Доступ GitHub до Firebase — сервісний акаунт `github-deploy` (Google Cloud → IAM → Service accounts),
  його ключ — у секреті репозиторію `FIREBASE_SERVICE_ACCOUNT`. Щоб замінити ключ: створити новий JSON-ключ
  для `github-deploy`, вставити його вміст у цей секрет, а старий ключ видалити в Google Cloud.
- Публічні налаштування справжнього проєкту лежать у git: `web/.env.production` (ключі Firebase для сайту,
  `VITE_SELLER_EMAILS`) і `functions/.env.succulents-shop-ua` (`SELLER_EMAILS`).
  Новий продавець — додати email у обидва файли **і** в `firestore.rules` та `storage.rules`.

## Локальна розробка і справжній сайт — різні бази

- `npm run emulators` + `npm run dev` — сайт на http://localhost:5173 з **локальною тестовою базою** (емулятори Firebase,
  тестові товари з `npm run seed`). Тут можна ламати що завгодно: справжніх покупців і замовлень це не стосується,
  а після вимкнення комп'ютера тестова база очищається.
- https://succulents-shop-ua.web.app — **справжня база** магазину. Змінюється лише через сайт/адмінку та push у `main`.
