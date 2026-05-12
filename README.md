# 📅 Информационная система для учета и составления расписания университета

Данный проект представляет собой попытку реализации системы для полностью автоматического составления расписания без конфликтов занятий.

Система позволяет вести справочники, генерировать учебные группы, юниты, занятия, назначать аудитории, автоматически генерировать расписание расписание жадным алгоритмом и редактировать его вручную через drag‑and‑drop интерфейс с последующей оптимизацией.

Данное приложение не позволяет зарегистрироваться в систему из вне, кроме самого первого сотрудника (администратора ИС). Дальнейший вход производится только по логину и паролю. Предусмотрено восстановление доступа по email.


## 🧰 Технологический стек

- **Фреймворк:** Next.js 15 (App Router)
- **Язык:** TypeScript (строгий режим)
- **API:** tRPC v11
- **База данных:** PostgreSQL
- **ORM:** Drizzle ORM + drizzle-kit
- **Аутентификация:** логин + пароль, сессии в httpOnly cookie
- **Восстановление пароля:** по email (через Mailpit в dev‑режиме)
- **Управление состоянием:** TanStack React Query
- **UI‑кит:** Tailwind CSS, next‑themes (тёмная/светлая тема), Lucide React
- **Таблицы:** TanStack React Table
- **Drag‑and‑Drop:** dnd‑kit
- **Уведомления:** Sonner (тосты)
- **Тестирование:** Vitest (132 unit‑теста), Playwright (E2E в планах)
- **Почта (dev):** Mailpit (перехватывает письма на localhost:8025)

## 📋 Требования

- **Node.js** ≥ 20.17 (рекомендуется последняя LTS)
- **npm** ≥ 9
- **PostgreSQL** ≥ 14 (или совместимый)

## 🚀 Быстрый старт (локальная разработка)

### 1. Клонирование репозитория

```bash
git clone <url-репозитория> ваша_папка
cd ваша_папка
```
### 2. Установка зависимостей
```bash
npm install
```
### 3. Настройка окружения
Скопируйте файл ниже указанный код в ```.env``` и заполните его по образцу.
Там хранятся переменные для подключения к базе данных и почтовому серверу (```mailpit``` для тестов).

```bash

# База данных
DATABASE_URL=postgresql://postgres:ваш_пароль@localhost:5432/university_schedule

# Локальный почтовый сервер (Mailpit) – для восстановления пароля через почту
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Расписание университета <ваша_почта@mail.ru>"

# 
    Реальные настройки (например, mail.ru)
SMTP_HOST=smtp.mail.ru                                   #почтовый домен
SMTP_PORT=587                                            # порт почтового сервера
SMTP_USER=ваша_почта@mail.ru                             # логин почтового сервера
SMTP_PASS=                                               # пароль приложения 
SMTP_FROM="Расписание университета <ваша_почта@mail.ru>" # от кого будет приходить письмо
```
* Необходимо также создать базу данных в ```postresql```, имя которой будет таким же каким имя из DATABASE_URL, например ```university_schedule```

Запустить ```Mailpit``` (находится в папке ```mailpit```) можно командой:
```bash
# В корне проекта выполните
.\mailpit\mailpit.exe
```
Почтовый сервис ```MailPit``` будет доступен на [http://localhost:8025](http://localhost:8025).

Если у вас другая ОС, скачайте Mailpit с <a href="https://mailpit.axllent.org/docs/install/">официального сайта</a> и запустите аналогично.
### 4. Создание базы данных и накат схемы
В корне проекта последовательно выполните команды:
```bash
npm run db:generate   # генерация миграций
npm run db:push       # применение миграций к базе данных
npm run seed          # заполнение базы тестовыми данными
```
### 5. Запуск приложения
В отдельном терминале откройте корень проекта и выполните команду:
```bash
npm run dev
```
Перейдите по адресу [http://localhost:3000](http://localhost:3000). Вам будет предложено зарегистрироваться. 

Если этого не произошло перейдите по пути [http://localhost:3000/setup](http://localhost:3000/setup). Заполните обязательные поля и нажмите кнопку "Зарегистрироваться". 

Вы будете перенаправлены на страницу входа. Введите логин и пароль, которые вы указали при регистрации, и нажмите кнопку "Войти". Вы будет перенаправлены на главную страницу приложения в панель администратора.
### 6. Тестирование
Для запуска ```unit```-тестов необходимо создать тестовое окружение.
создайте файл ```.env.test``` и заполните его данными:
```bash
DATABASE_URL=postgresql://postgres:ваш_пароль@localhost:5432/university_schedule_test

# Локальный почтовый сервер (Mailpit) – для восстановления пароля через почту
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Расписание университета <ваша_почта@mail.ru>"
```
* Необходимо также создать базу данных в ```postresql```, имя которой будет таким же каким имя из DATABASE_URL, например ```university_schedule_test```.

Когда база будет создана, последовательно в корне проекта выполните команды:
```bash
npm run test:db:push
npm run test
```
### 7. e2e тестирование.
в разработке

### 8. 📜 Доступные npm‑скрипты

| Скрипт              | Описание                                 |
|:--------------------|:-----------------------------------------|
| npm run build       | Сборка production‑версии                 |
| npm run db:generate | Генерация миграций Drizzle               |
| npm run db:push     | Применение миграций к текущей БД         |
| npm run dev         | Запуск сервера разработки Next.js        |
| npm run lint        | Линтинг кода (ESLint)                    |
| npm run lint:fix    | Автоисправление ошибок линтинга          |
| npm run test:db:push| Накат схемы на тестовую БД               |
| npm run type-check  | Проверка типов TypeScript                |
| npm run test        | Запуск всех тестов Vitest                |
| npm run seed        | Наполнение БД тестовыми данными          |
| npm run start       | Запуск production‑сервера                |

### 9. Структура проекта
```

mailpit/                      — служебная папка почтового сервера Mailpit
├── LICENSE                   — лицензия Mailpit
├── README.md                 — документация Mailpit
└── mailpit.exe               — исполняемый файл Mailpit (Windows)

public/                       — статические ресурсы
├── file.svg
├── globe.svg
├── next.svg
├── vercel.svg
└── window.svg

src/                          — исходный код приложения
├── app/                      — Next.js App Router
│   ├── globals.css           — глобальные стили Tailwind
│   ├── layout.tsx            — корневой макет приложения
│   ├── page.tsx              — главная страница (дашборд / редирект)
│   │
│   ├── admin/                — панель администратора
│   │   ├── layout.tsx        — общий макет админки
│   │   ├── page.tsx          — главная страница админки
│   │   ├── account/          — аккаунт текущего администратора
│   │   │   └── page.tsx
│   │   ├── administrators/   — управление другими администраторами
│   │   │   └── page.tsx
│   │   ├── credentials/      — учётные данные (студентов/преподавателей)
│   │   │   └── page.tsx
│   │   ├── crud/             — динамический CRUD всех справочников
│   │   │   ├── page.tsx      — основная страница CRUD
│   │   │   └── _components/  — компоненты CRUD-интерфейса
│   │   │       ├── ColumnFilterPopover.tsx
│   │   │       ├── DataTable.tsx
│   │   │       ├── ForeignKeyCell.tsx
│   │   │       └── RecordForm.tsx
│   │   ├── generations/      — запуск генерации расписания
│   │   │   └── page.tsx
│   │   ├── import-export/    — импорт / экспорт данных
│   │   │   └── page.tsx
│   │   ├── manual/           — ручная документация / руководство
│   │   │   └── page.tsx
│   │   ├── optimization-settings/ — настройки оптимизации расписания
│   │   │   └── page.tsx
│   │   ├── schedule/         — работа с готовым расписанием
│   │   │   └── page.tsx
│   │   └── users/            — просмотр пользователей (студенты, преподаватели)
│   │       └── page.tsx
│   │
│   ├── api/                  — API-роуты Next.js
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts  — обработчик tRPC-запросов
│   │
│   ├── forgot-password/      — страница «Забыли пароль?»
│   │   └── page.tsx
│   ├── login/                — страница входа
│   │   └── page.tsx
│   ├── reset-password/       — страница сброса пароля
│   │   └── page.tsx
│   └── setup/                — первичная регистрация администратора
│       └── page.tsx
│
├── components/               — переиспользуемые React-компоненты
│   ├── EntityTooltip.tsx     — тултип с информацией о сущности
│   ├── Providers.tsx         — обёртка провайдеров (темы, tRPC, тосты)
│   └── ThemeToggle.tsx       — переключатель тёмной / светлой темы
│
├── db/                       — уровень базы данных (Drizzle ORM)
│   ├── index.ts              — инициализация клиента БД
│   ├── schema.ts             — описание таблиц и связей
│   └── seed.ts               — наполнение тестовыми данными
│
├── lib/                      — библиотеки и утилиты
│   ├── clearGeneratedData.ts — очистка сгенерированных данных
│   ├── safeDelete.ts         — безопасное удаление с проверкой внешних ключей
│   ├── table-meta.ts         — метаданные таблиц для динамического CRUD
│   └── trpc/
│       └── client.ts         — tRPC-клиент для серверных вызовов
│
├── server/                   — серверная логика
│   ├── email.ts              — почтовый клиент (Nodemailer)
│   ├── api/
│   │   └── routers/
│   │       └── lookup.ts     — служебный роутер (списки, enum)
│   ├── auth/
│   │   ├── password.ts       — хеширование / проверка паролей
│   │   └── session.ts        — управление сессиями
│   └── trpc/                 — tRPC-сервер
│       ├── context.ts        — контекст запроса (БД, сессия)
│       ├── index.ts          — точка входа серверной части tRPC
│       ├── router.ts         — корневой роутер
│       ├── trpc.ts           — инициализация tRPC, процедуры, middleware
│       └── routers/          — подроутеры
│           ├── academicLoadTypes.ts
│           ├── adminManagement.ts
│           ├── auth.ts
│           ├── batchDelete.ts
│           ├── buildings.ts
│           ├── classRooms.ts
│           ├── controlTypes.ts
│           ├── crudImportExport.ts
│           ├── curriculum.ts
│           ├── curriculumProfiles.ts
│           ├── daysOfWeek.ts
│           ├── departments.ts
│           ├── disciplines.ts
│           ├── disciplineTeachers.ts
│           ├── education.ts
│           ├── educationForms.ts
│           ├── educationLevels.ts
│           ├── employees.ts
│           ├── employeesDepartments.ts
│           ├── employmentTypes.ts
│           ├── globalImportExport.ts
│           ├── hourTypeMapping.ts
│           ├── institutes.ts
│           ├── lessonClassrooms.ts
│           ├── lessons.ts
│           ├── lessonTypes.ts
│           ├── lookup.ts
│           ├── pairs.ts
│           ├── positions.ts
│           ├── profiles.ts
│           ├── schedule.ts
│           ├── scheduleDisplay.ts
│           ├── scheduleOptimizer.ts
│           ├── settings.ts
│           ├── specialties.ts
│           ├── students.ts
│           ├── studyGroups.ts
│           ├── unitRoots.ts
│           ├── units.ts
│           ├── unitTypes.ts
│           ├── userManagement.ts
│           ├── weeks.ts
│           ├── generations/  — генераторы этапов расписания
│           │   ├── assignClassrooms.ts
│           │   ├── generateCredentials.ts
│           │   ├── generateGroups.ts
│           │   ├── generateLessons.ts
│           │   ├── generateSchedule.ts
│           │   ├── generateUnits.ts
│           │   └── index.ts
│           └── __tests__/    — модульные тесты роутеров
│               ├── academicLoadTypes.test.ts
│               ├── auth.test.ts
│               ├── buildings.test.ts
│               ├── classRooms.test.ts
│               ├── controlTypes.test.ts
│               ├── curriculum.test.ts
│               ├── curriculumProfiles.test.ts
│               ├── daysOfWeek.test.ts
│               ├── departments.test.ts
│               ├── disciplines.test.ts
│               ├── disciplineTeachers.test.ts
│               ├── education.test.ts
│               ├── educationForms.test.ts
│               ├── educationLevels.test.ts
│               ├── employees.test.ts
│               ├── employeesDepartments.test.ts
│               ├── employmentTypes.test.ts
│               ├── generators.test.ts
│               ├── hourTypeMapping.test.ts
│               ├── lookup.test.ts
│               ├── pairs.test.ts
│               ├── positions.test.ts
│               ├── profiles.test.ts
│               ├── settings.test.ts
│               ├── specialties.test.ts
│               ├── students.test.ts
│               ├── studyGroups.test.ts
│               ├── userManagement.test.ts
│               └── weeks.test.ts
│
├── test/                     — инфраструктура тестирования
│   ├── setup.ts              — глобальные моки
│   ├── trpc.ts               — создание тестового tRPC-клиента
│   └── fixtures/
│       └── fixtures.ts       — наполнение тестовой БД
│
├── trpc/                     — клиентская часть tRPC
│   ├── client.ts             — tRPC-клиент для браузера
│   └── provider.tsx          — обёртка с React Query и обработкой ошибок
│
└── types/
    └── css.d.ts              — декларация типов для CSS-модулей

Корневые файлы:
├── .gitignore                — игнорируемые файлы Git
├── drizzle.config.ts         — конфигурация Drizzle Kit
├── eslint.config.js          — базовая конфигурация ESLint
├── eslint.config.mjs         — конфигурация ESLint (Next.js)
├── LICENSE                   — лицензия проекта
├── next.config.ts            — конфигурация Next.js
├── package-lock.json         — фиксация зависимостей npm
├── package.json              — описание проекта и скрипты
├── postcss.config.mjs        — конфигурация PostCSS
├── README.md                 — документация проекта
├── tailwind.config.ts        — конфигурация Tailwind CSS
├── tsconfig.json             — конфигурация TypeScript
└── vitest.config.mts         — конфигурация Vitest
```

### 10. 🔑 Аутентификация и безопасность
* Вход осуществляется по логину и паролю (не по email). Email может быть указан у сотрудника/студента и используется только для восстановления пароля.

* Все административные процедуры защищены через adminProcedure.

* Пароли хэшируются с помощью bcryptjs.

* Сессии хранятся в httpOnly cookie, что предотвращает XSS‑атаки.

* При попытке удалить запись, на которую ссылаются другие таблицы, пользователь видит тост с понятным сообщением (благодаря safeDelete).

### 11. Инструкция пользователя ИС
в разработке

### 12. 🩺 Возможные проблемы и их решение
* Ошибка подключения к БД – проверьте DATABASE_URL и доступность PostgreSQL.

* Письма не отправляются – убедитесь, что Mailpit запущен и адрес [http://localhost:8025](http://localhost:8025) доступен. Для продакшена настройте реальный SMTP.

* Тесты падают с ошибками уникальности – выполните npm run test:db:push для тестовой БД и убедитесь, что в .env.test указана правильная строка подключения.