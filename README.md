# 📅 Информационная система для учета и составления расписания университета

Данный проект представляет собой реализацию системы для полностью автоматического составления расписания без конфликтов занятий.

Система позволяет вести справочники, генерировать учебные группы, юниты, занятия, назначать аудитории, автоматически генерировать расписание жадным алгоритмом и редактировать его вручную через drag‑and‑drop интерфейс с последующей оптимизацией.

Данное приложение не позволяет зарегистрироваться в систему извне, кроме самого первого сотрудника (администратора ИС). Дальнейший вход производится только по логину и паролю. Предусмотрено восстановление доступа по email.

## 🧰 Технологический стек

- **Фреймворк:** Next.js 15 (App Router)
- **Язык:** TypeScript (строгий режим)
- **API:** tRPC v11
- **База данных:** PostgreSQL
- **ORM:** Drizzle ORM + drizzle-kit
- **Аутентификация:** логин + пароль
- **Восстановление пароля:** по email (через Mailpit в dev‑режиме)
- **Управление состоянием:** TanStack React Query
- **UI‑кит:** Tailwind CSS, next‑themes (тёмная/светлая тема), Lucide React
- **Таблицы:** TanStack React Table
- **Drag‑and‑Drop:** dnd‑kit
- **Уведомления:** Sonner (тосты)
- **Тестирование:** Vitest (143 unit‑теста), Playwright (e2e-тесты)
- **CI/CD:** GitHub Actions (проверка типов, линтера, тестов и сборки)
- **Почта (dev):** Mailpit (перехватывает письма на localhost:8025)

## 🏗️ Архитектура (основные модули)

- `public/` – статические ресурсы (favicon).
- `e2e/` – end‑to‑end тесты (Playwright).
- `src/contexts` – React‑контексты (ConfirmContext).
- `src/hooks` – пользовательские хуки (useConfirm).
- `src/db` – схема базы данных (Drizzle ORM), миграции, сиды.
- `src/lib` – утилиты: очистка данных (`clearGeneratedData`), безопасное удаление (`safeDelete`), метаданные таблиц (`table-meta`), пересчёт метрики аудиторий (`usageMetrics`), tRPC‑клиент для серверных вызовов.
- `src/server/email.ts` – почтовый клиент (Nodemailer).
- `src/server/auth` – хеширование паролей и управление сессиями.
- `src/server/trpc` – tRPC‑сервер (контекст, корневой роутер, процедуры, middleware, роутеры сущностей, генераторы).
- `src/trpc` – tRPC‑клиент для браузера и провайдер с React Query.
- `src/test` – утилиты для тестирования (test caller, фикстуры).
- `.github/workflows` – конфигурация CI/CD.

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
Создайте файл ```.env``` в корне проекта. В нем хранятся глобальные переменные для подключения к базе данных и почтовому серверу. Вы можете использовать файл ```.env.example``` в корне проекта как шаблон.

### 4. Создайте базу данных
Приложение работает с СУБД ```postgresql```. Следуйте инструкциям по настройке и созданию базы данных из <a href="https://postgrespro.ru/">официального источника</a>.

### 5. Локальный почтовый сервер
Если у вас нет реальной почты для отправки писем на восстановление доступа (сброс логина и пароля) вы можете использовать приложение MailPit (уже включено в проект).
Запустите ```Mailpit``` в отдельном терминале командой:
```bash
# В корне проекта выполните
.\ваша_папка\mailpit.exe
```
Проверьте что вы указали указали конфигурацию почтового сервиса в файле ```.env```:
```bash
# Локальный почтовый сервер (Mailpit) – для восстановления пароля через почту
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Расписание университета <ваша_почта@mail.ru>"
```
Почтовый сервис ```MailPit``` будет доступен на [http://localhost:8025](http://localhost:8025).

Если у вас возникнут трудности с запуском, обратитесь к  <a href="https://mailpit.axllent.org/docs/install/">официальному сайту MailPit</a>.
### 6. Создание базы таблиц и накат схемы БД
В корне проекта последовательно выполните команды:
```bash
npm run db:generate   # генерация миграций
npm run db:push       # применение миграций к базе данных
npm run seed          # заполнение базы тестовыми данными
```
Не забудьте создать базу данных в ```postgresql``` и настроить подключение в файле ```.env```.
### 7. Запуск приложения
В отдельном терминале откройте корень проекта и выполните команду:
```bash
npm run dev
```
Перейдите по адресу [http://localhost:3000](http://localhost:3000). Вам будет предложено зарегистрироваться. 

Если этого не произошло перейдите по пути [http://localhost:3000/setup](http://localhost:3000/setup). Заполните обязательные поля и нажмите кнопку "Зарегистрироваться". 

Вы будете перенаправлены на страницу входа. Введите логин и пароль, которые вы указали при регистрации, и нажмите кнопку "Войти". Вы будет перенаправлены на главную страницу приложения в панель администратора.
### 8. Тестирование

## 8.1 Unit-тесты
Для запуска ```unit```-тестов необходимо создать тестовое окружение и тестовую базу данных.
создайте файл ```.env.test``` и заполните его данными:
```bash
DATABASE_URL=postgresql://postgres:ваш_пароль@localhost:5432/ваша_тестовая_база_данных

# Локальный почтовый сервер (Mailpit) – для восстановления пароля через почту
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Расписание университета <ваша_почта@mail.ru>"
```

Когда база будет создана, последовательно в корне проекта выполните команды:
```bash
npm run test:db:push
npm run test
```
### 8.2 E2E-тесты (PlayWright).
Установите браузеры playwright:
```bash
npx playwright install
```

Затем запустите тестовый сервер (в отдельном терминале):
```bash
npm run dev:test   # сервер с тестовой базой данных
```
и выполните:
```bash
npx playwright test
```
Для тестирования восстановления пароля через почту дополнительно запустите Mailpit (см. п. 5).
Доступные команды для запуска E2E‑тестов:
```bash
npm run test:e2e:auth    # только авторизация
npm run test:e2e:reset   # восстановление пароля (без почты)
npm run test:e2e:mail    # восстановление пароля через почту (Mailpit)
npm run test:e2e         # все E2E‑тесты (без графического интерфейса)
```
E2E‑тесты покрывают сценарии авторизации, восстановления пароля (в том числе через Mailpit) и готовы к расширению.

### 9. Непрерывная интеграция (CI/CD)
Проект использует GitHub Actions:
- **CI** (`.github/workflows/ci.yml`) — автоматический прогон типов, линтера, unit‑тестов и сборки при пушах.
- **E2E** (`.github/workflows/e2e.yml`) — полный цикл Playwright‑тестов с поднятием тестового сервера и Mailpit. Запускается **вручную** из вкладки Actions.
### 10. 📜 Доступные npm‑скрипты

|Скрипт	                |   Описание                                             |
|:----------------------|:-------------------------------------------------------|
|npm run dev	        |   Запуск сервера разработки (рабочая БД)               |
|npm run dev:test	    |   Запуск сервера с тестовой базой данных               |
|npm run build	        |   Сборка production‑версии                             |
|npm run start	        |   Запуск production‑сервера                            |
|npm run db:generate	|   Генерация миграций Drizzle                           |
|npm run db:push	    |   Применение миграций к текущей БД                     |
|npm run type-check	    |   Проверка типов TypeScript                            |
|npm run lint	        |   Линтинг кода (ESLint)                                |
|npm run lint:fix	    |   Автоисправление ошибок линтинга                      |
|npm run test:db:push	|   Накат схемы на тестовую БД                           |
|npm run test	        |   Запуск всех unit‑тестов Vitest (исключая e2e/)       |
|npm run test:e2e:auth	|   Запуск E2E теста авторизации (с графикой)            |
|npm run test:e2e:reset |	Запуск E2E теста восстановления пароля (без почты)   |
|npm run test:e2e:mail	|   Запуск E2E теста восстановления через почту (Mailpit)|
|npm run test:e2e	    |   Запуск всех E2E‑тестов (без графического интерфейса) |
|npm run seed	        |   Наполнение БД тестовыми данными                      |

### 11. Структура проекта
```
mailpit/                           # служебная папка почтового сервера Mailpit
├── LICENSE
├── README.md
└── mailpit.exe

e2e/                               # end‑to‑end тесты (Playwright)
├── auth-setup.spec.ts
├── password-reset.spec.ts
└── password-reset-mail.spec.ts

public/                            # статические ресурсы
src/
├── app/                           # Next.js App Router
│   ├── globals.css                # глобальные стили Tailwind
│   ├── layout.tsx                 # корневой макет (провайдеры, метаданные)
│   ├── not-found.tsx              # страница 404
│   ├── page.tsx                   # главная страница (редирект на /login или /setup)
│   ├── admin/                     # панель администратора
│   │   ├── layout.tsx             # общий макет админки (боковое меню)
│   │   ├── page.tsx               # главная страница админки (сетка разделов)
│   │   ├── account/               # аккаунт текущего администратора
│   │   │   └── page.tsx
│   │   ├── administrators/        # управление другими администраторами
│   │   │   └── page.tsx
│   │   ├── credentials/           # генерация логинов/паролей сотрудников и студентов
│   │   │   └── page.tsx
│   │   ├── crud/                  # динамический CRUD всех справочников
│   │   │   ├── page.tsx           # основная страница CRUD (список таблиц, DnD)
│   │   │   └── _components/       # компоненты CRUD-интерфейса
│   │   │       ├── ColumnFilterPopover.tsx  # фильтр по столбцу
│   │   │       ├── DataTable.tsx           # таблица с сортировкой, поиском, пагинацией
│   │   │       ├── ForeignKeyCell.tsx      # отображение внешних ключей
│   │   │       └── RecordForm.tsx          # форма создания/редактирования записи
│   │   ├── generations/           # запуск генераторов расписания
│   │   │   └── page.tsx
│   │   ├── import-export/         # глобальный импорт/экспорт данных
│   │   │   └── page.tsx
│   │   ├── manual/                # инструкция пользователя
│   │   │   └── page.tsx
│   │   ├── optimization-settings/ # настройки штрафов оптимизатора
│   │   │   └── page.tsx
│   │   ├── schedule/              # работа с готовым расписанием (просмотр, drag‑and‑drop, оптимизация)
│   │   │   └── page.tsx
│   │   └── users/                 # просмотр пользователей (студенты, преподаватели)
│   │       └── page.tsx
│   ├── api/trpc/[trpc]/route.ts   # обработчик tRPC-запросов
│   ├── forgot-password/           # страница «Забыли пароль?»
│   │   └── page.tsx
│   ├── login/                     # страница входа
│   │   └── page.tsx
│   ├── reset-password/            # страница сброса пароля
│   │   ├── page.tsx               # обёртка с Suspense
│   │   └── ResetPasswordForm.tsx  # клиентская форма сброса
│   └── setup/                     # первичная регистрация администратора
│       └── page.tsx
│
├── components/                    # переиспользуемые React-компоненты
│   ├── EntityTooltip.tsx          # тултип с информацией о сущности
│   ├── Forbidden.tsx              # страница 403
│   ├── Providers.tsx              # провайдеры (темы, tRPC, тосты, сессия)
│   ├── ThemeToggle.tsx            # переключатель тёмной/светлой темы
│   └── ui/                        # UI-кит (диалоги, скелетоны)
│       ├── ConfirmDialog.tsx      # кастомное окно подтверждения
│       ├── InputDialog.tsx        # окно ввода текста
│       └── skeleton.tsx           # компоненты-скелетоны для загрузки
│
├── contexts/                      # React-контексты
│   └── ConfirmContext.tsx         # контекст для ConfirmDialog
│
├── db/                            # уровень базы данных (Drizzle ORM)
│   ├── index.ts                   # инициализация клиента БД
│   ├── schema.ts                  # описание таблиц и связей
│   └── seed.ts                    # заполнение тестовыми данными
│
├── hooks/                         # пользовательские хуки
│   └── useConfirm.ts             # хук для вызова ConfirmDialog
│
├── lib/                           # библиотеки и утилиты
│   ├── clearGeneratedData.ts      # очистка сгенерированных данных
│   ├── safeDelete.ts              # безопасное удаление (проверка внешних ключей)
│   ├── table-meta.ts              # метаданные таблиц для динамического CRUD
│   ├── usageMetrics.ts            # пересчёт метрики использования аудиторий
│   └── trpc/client.ts             # tRPC-клиент для серверных вызовов
│
├── server/                        # серверная логика
│   ├── email.ts                   # почтовый клиент (Nodemailer)
│   ├── api/routers/lookup.ts      # служебный роутер (списки, enum)
│   ├── auth/                      # аутентификация
│   │   ├── password.ts            # хеширование/проверка паролей
│   │   └── session.ts             # управление сессиями (создание, удаление)
│   └── trpc/                      # tRPC-сервер
│       ├── context.ts             # контекст запроса (БД, сессия)
│       ├── index.ts               # точка входа серверной части tRPC
│       ├── router.ts              # корневой роутер
│       ├── trpc.ts                # инициализация tRPC, процедуры, middleware
│       └── routers/               # подроутеры для всех сущностей
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
│           ├── e2eTestHelpers.ts   # хелперы для e2e тестов (сброс/заполнение БД)
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
│           ├── scheduleVersions.ts
│           ├── settings.ts
│           ├── specialties.ts
│           ├── students.ts
│           ├── studyGroups.ts
│           ├── unitRoots.ts
│           ├── units.ts
│           ├── unitTypes.ts
│           ├── userManagement.ts
│           ├── weeks.ts
│           ├── generations/       # генераторы этапов расписания
│           │   ├── assignClassrooms.ts   # назначение аудиторий
│           │   ├── generateCredentials.ts # генерация логинов/паролей
│           │   ├── generateGroups.ts     # генерация учебных групп
│           │   ├── generateLessons.ts    # генерация занятий
│           │   ├── generateSchedule.ts   # генерация расписания
│           │   ├── generateUnits.ts      # генерация юнитов
│           │   └── index.ts
│           └── __tests__/         # unit‑тесты роутеров и генераторов
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
│               ├── generators-logic.test.ts   # тесты бизнес-правил генераторов
│               ├── generators.test.ts        # тесты порядка вызова генераторов
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
├── test/                          # инфраструктура тестирования
│   ├── setup.ts                   # глобальные моки
│   ├── trpc.ts                    # создание тестового tRPC-клиента
│   └── fixtures/
│       └── fixtures.ts            # наполнение тестовой БД (сиды)
│
├── trpc/                          # клиентская часть tRPC
│   ├── client.ts                  # tRPC-клиент для браузера
│   └── provider.tsx               # обёртка с React Query и обработкой ошибок
│
└── types/
    └── css.d.ts                   # декларация типов для CSS-модулей

Корневые файлы:
├── .gitignore
├── drizzle.config.ts
├── eslint.config.js
├── eslint.config.mjs
├── LICENSE
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.mts
```

### 11. 🔑 Аутентификация и безопасность
* Вход осуществляется по логину и паролю (не по email). Email может быть указан у сотрудника/студента и используется только для восстановления пароля.

* Все административные процедуры защищены через adminProcedure.

* Пароли хэшируются с помощью bcryptjs.

* Сессии хранятся в httpOnly cookie, что предотвращает XSS‑атаки.

* При попытке удалить запись, на которую ссылаются другие таблицы, пользователь видит тост с понятным сообщением.

### 12. Инструкция пользователя ИС
На панели администратора мы можете найти ознакомиться с инструкцией пользователя ИС, где описаны возможные действия с интерфейсом.

### 13. 🩺 Возможные проблемы и их решение
* Ошибка подключения к БД – проверьте DATABASE_URL и доступность PostgreSQL.

* Письма не отправляются – убедитесь, что Mailpit запущен и адрес [http://localhost:8025](http://localhost:8025) доступен. Для продакшена настройте реальный SMTP.

* Тесты падают с ошибками уникальности – выполните npm run test:db:push для тестовой БД и убедитесь, что в .env.test указана правильная строка подключения.