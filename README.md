# Auction Marketplace

Платформа для проведения онлайн-аукционов с real-time ставками, интеграцией платежей Stripe и современной архитектурой.

## 📋 О проекте

Auction Marketplace — это полнофункциональная платформа, позволяющая:
- Продавцам размещать лоты на аукцион
- Покупателям участвовать в торгах в реальном времени
- Автоматически завершать аукционы по истечении времени
- Обрабатывать платежи через Stripe
- Просматривать историю транзакций и ставок

## 🛠 Технологический стек

### Frontend
- **React 19** — библиотека для построения пользовательского интерфейса
- **Vite** — быстрый сборщик и dev-сервер
- **TypeScript** — статическая типизация
- **Tailwind CSS** — утилитарный CSS-фреймворк
- **Zustand** — легковесное управление состоянием
- **React Router DOM** — маршрутизация
- **Socket.io-client** — real-time коммуникация
- **Zod** — валидация форм и данных
- **Axios** — HTTP-клиент

### Backend
- **Node.js 20+** — среда выполнения
- **Express 4.x** — веб-фреймворк
- **Prisma** — ORM для работы с базой данных
- **PostgreSQL** — основная база данных
- **Redis** — кэширование, очереди задач (Bull), rate limiting, адаптер Socket.io
- **Socket.io** — WebSocket сервер для real-time обновлений
- **Stripe** — платежная интеграция
- **JWT** — аутентификация (access + refresh токены)
- **Zod** — валидация данных
- **bcrypt** — хеширование паролей
- **Bull** — очередь фоновых задач
- **Vitest + Supertest** — тестирование
- **prom-client** — метрики для Prometheus

## 📁 Структура проекта

```
auction-marketplace/
├── backend/                 # Серверная часть
│   ├── prisma/             # Prisma схема и миграции
│   ├── src/
│   │   ├── config/         # Конфигурация приложения
│   │   ├── controllers/    # Контроллеры API
│   │   ├── middleware/     # Middleware (auth, security, metrics)
│   │   ├── routes/         # Маршруты API
│   │   ├── services/       # Бизнес-логика
│   │   ├── utils/          # Утилиты
│   │   └── server.ts       # Точка входа
│   ├── uploads/            # Загруженные файлы
│   └── package.json
├── frontend/               # Клиентская часть
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   ├── pages/          # Страницы приложения
│   │   ├── stores/         # Zustand store
│   │   ├── hooks/          # Кастомные хуки
│   │   ├── services/       # API клиенты
│   │   └── App.tsx         # Корневой компонент
│   ├── index.html
│   └── package.json
├── Техническое_задание.md  # Подробное ТЗ проекта
├── REFACTORING_ISSUES.md   # Проблемы рефакторинга
└── README.md               # Этот файл
```

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 20+
- PostgreSQL 14+
- Redis 6+

### Установка

1. **Клонирование репозитория**
```bash
git clone <repository-url>
cd auction-marketplace
```

2. **Установка зависимостей**
```bash
# Установка зависимостей для backend
cd backend
npm install

# Установка зависимостей для frontend
cd ../frontend
npm install
```

3. **Настройка окружения**

Скопируйте `.env.example` в `.env` в папке `backend` и заполните переменные:
```bash
cp backend/.env.example backend/.env
```

Необходимые переменные окружения:
- `DATABASE_URL` — подключение к PostgreSQL
- `REDIS_URL` — подключение к Redis
- `JWT_SECRET` — секретный ключ для JWT
- `STRIPE_SECRET_KEY` — секретный ключ Stripe
- `STRIPE_WEBHOOK_SECRET` — секрет webhook Stripe
- `FRONTEND_URL` — URL фронтенда (для CORS)

4. **Настройка базы данных**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

5. **Запуск приложения**

В режиме разработки (из корня проекта):
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Или используйте root скрипты (если настроены):
```bash
npm run dev:backend  # Запуск backend
npm run dev:frontend # Запуск frontend
```

## 📡 API Endpoints

### Аутентификация
| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация нового пользователя |
| POST | `/api/auth/login` | Вход пользователя |
| GET | `/api/auth/me` | Получение текущего пользователя |
| POST | `/api/auth/refresh` | Обновление токенов |
| POST | `/api/auth/logout` | Выход (добавление токена в blacklist) |

### Аукционы
| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/auctions` | Список всех аукционов |
| GET | `/api/auctions/:id` | Детали аукциона |
| POST | `/api/auctions` | Создать аукцион |
| PUT | `/api/auctions/:id` | Обновить аукцион |
| DELETE | `/api/auctions/:id` | Удалить аукцион |

### Ставки
| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/auctions/:auctionId/bids` | Сделать ставку |
| GET | `/api/auctions/:auctionId/bids` | История ставок |

### Платежи
| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/payments/create-intent` | Создание Payment Intent |
| POST | `/api/payments/webhook` | Stripe webhook |
| GET | `/api/payments/history` | История платежей пользователя |

### Метрики
| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/metrics` | Экспорт метрик Prometheus |

## 🔒 Безопасность

В проекте реализован комплексный подход к безопасности:

### Security Headers
- **Content-Security-Policy (CSP)** — ограничение источников ресурсов
- **X-Frame-Options: DENY** — защита от clickjacking
- **X-Content-Type-Options: nosniff** — предотвращение MIME-sniffing
- **Strict-Transport-Security (HSTS)** — принудительный HTTPS
- **Referrer-Policy** — контроль передачи referrer
- **Permissions-Policy** — ограничение доступа к API браузера

### Аутентификация и авторизация
- Двухуровневая система JWT (access token 15 мин + refresh token 7 дней)
- HTTP-only Secure cookies для refresh токенов
- Blacklist токенов в Redis при выходе
- Rate limiting на попытки входа/регистрации

### Защита от атак
- **Rate Limiting** — 100 запросов/мин на IP (глобально)
- **CSRF Protection** — middleware для state-changing запросов
- **HPP** — защита от параметрического загрязнения
- **Валидация Zod** — на фронтенде и бэкенде
- **WebSocket Rate Limiting** — ограничение ставок и подключений

### Исправленные уязвимости OWASP Top 10
- ✅ A02: Cryptographic Failures
- ✅ A03: Injection
- ✅ A07: Identification and Authentication Failures
- ✅ A09: Security Logging and Monitoring Failures

## ⚡ Real-time функциональность

Проект использует **Socket.io** с Redis адаптером для:
- Мгновенного обновления ставок (`bid:created`)
- Обновления статуса аукциона (`auction:updated`, `auction:completed`)
- Уведомлений пользователям

### WebSocket события
```typescript
// Клиент отправляет
socket.emit('bid:place', { auctionId, amount })

// Сервер рассылает
socket.on('bid:created', (data) => { ... })
socket.on('auction:completed', (data) => { ... })
```

## 🗄 База данных

### Основные модели
- **User** — пользователи (продавцы и покупатели)
- **Auction** — лоты аукциона
- **Bid** — ставки
- **Payment** — платежи

Схема описана в `backend/prisma/schema.prisma`.

### Миграции
```bash
# Создать миграцию
npx prisma migrate dev --name <migration_name>

# Применить миграции
npx prisma migrate deploy

# Сбросить БД (development)
npx prisma migrate reset
```

## 🧪 Тестирование

```bash
# Backend тесты
cd backend
npm test

# Frontend тесты
cd frontend
npm test
```

Используется **Vitest** для unit/integration тестов и **Supertest** для HTTP тестирования API.

## 📊 Мониторинг и производительность

### Метрики Prometheus
- Использование CPU и памяти Node.js
- Количество HTTP запросов и время ответа
- Активные WebSocket соединения
- Доступно по эндпоинту `/metrics`

### Управление ресурсами Node.js
- Настройка лимитов памяти (`--max-old-space-size=512`)
- Мониторинг утечек памяти в development
- Принудительный GC (с флагом `--expose-gc`)

### Логирование
- Централизованное логирование ошибок
- Интеграция с Sentry (опционально)
- Алертинг при подозрительной активности

## 🎯 Основные функции

1. **Регистрация/Вход** — JWT аутентификация, хеширование bcrypt
2. **Создание лота** — форма с валидацией, загрузка изображений, установка времени окончания
3. **Просмотр лотов** — пагинация, фильтрация, поиск, сортировка
4. **Real-time ставки** — WebSocket обновления, проверка корректности ставок
5. **Автозавершение аукционов** — очередь задач Bull по истечении времени
6. **Оплата Stripe** — Checkout, Payment Intent, webhook обработка
7. **Личный кабинет** — история аукционов, ставок, платежей
8. **Таймер обратного отсчёта** — на странице аукциона

## 🔧 Конфигурация

### Переменные окружения (backend/.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/auction_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Server
PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📈 Архитектура

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │◄────►│   Backend    │◄────►│ PostgreSQL  │
│  (React+Vite)│ HTTP │  (Express)   │ Prisma│             │
└─────────────┘      └──────────────┘      └─────────────┘
       │                    │
       │ WebSocket          │ Redis
       ▼                    ▼
┌─────────────┐      ┌──────────────┐
│ Socket.io   │◄────►│   Redis      │
│   Client    │      │ (Cache/Bull) │
└─────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    Stripe    │
                     │   Payments   │
                     └──────────────┘
```

## 📝 Дополнительная документация

- [Техническое задание](./Техническое_задание.md) — подробное описание требований
- [REFACTORING_ISSUES.md](./REFACTORING_ISSUES.md) — известные проблемы и задачи рефакторинга
- [Backend .env.example](./backend/.env.example) — шаблон переменных окружения

## 🤝 Вклад в проект

1. Создайте ветку для вашей фичи (`git checkout -b feature/amazing-feature`)
2. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
3. Отправьте в удалённый репозиторий (`git push origin feature/amazing-feature`)
4. Откройте Pull Request

## 📄 Лицензия

MIT License — подробности см. в файле LICENSE (если существует).

## 👥 Контакты

Проект разработан в рамках роли Full-Stack Developer (Июнь 2026).

---

**Статус:** В разработке 🚧

**Последнее обновление:** Август 2026
