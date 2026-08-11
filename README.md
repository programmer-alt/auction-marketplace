# Auction Marketplace

Полнофункциональная торговая площадка для аукционов с использованием React, Node.js, Prisma и Stripe.

## Содержание
- [Описание](#описание)
- [Технологии](#технологии)
- [Архитектура](#архитектура)
- [Установка](#установка)
- [Использование](#использование)
- [Функции](#функции)
- [Документация по API](#документация-по-api)
- [Тестирование](#тестирование)
- [Развертывание](#развертывание)
- [Сотрудничество](#сотрудничество)
- [Лицензия](#лицензия)

## Описание

Этот проект представляет собой полнофункциональное веб-приложение для онлайн-аукционов. Оно позволяет пользователям создавать, управлять и участвовать в онлайн-аукционах. Приложение включает в себя систему торгов в реальном времени, безопасные платежи, аутентификацию пользователей и адаптивный интерфейс.

## Технологии

### Фронтенд
- **React**: Библиотека JavaScript для создания пользовательских интерфейсов.
- **TypeScript**: Строго типизированное надмножество JavaScript, компилируемое в обычный JavaScript.
- **Vite**: Быстрый инструмент сборки для современной веб-разработки.
- **Tailwind CSS**: Утилитарный CSS-фреймворк для быстрого создания собственных дизайнов.
- **React Router DOM**: Декларативные маршруты для приложений на React.
- **Zustand**: Маленький, быстрый и масштабируемый способ управления состоянием.
- **React Hook Form**: Производительные, гибкие формы с простой валидацией.
- **Zod**: Библиотека для объявления схем и валидации, ориентированная на TypeScript.
- **Socket.io Client**: Двусторонняя связь в реальном времени на основе событий.
- **Stripe React & JS**: Библиотеки для интеграции платежей Stripe.
- **Date-fns**: Современная библиотека утилит для работы с датами в JavaScript.
- **Lucide React**: Красивые, простые, идеально пиксельные иконки.
- **clsx**: Крошечная утилита для условного формирования строк className.
- **React Window**: Компоненты React для эффективного отображения больших списков и табличных данных.
- **React Hot Toast**: Доступные уведомления в виде тостов для React.

### Бэкенд
- **Node.js**: Среда выполнения JavaScript, построенная на движке V8 из Chrome.
- **Express**: Быстрый, гибкий, минималистичный веб-фреймворк для Node.js.
- **TypeScript**: Строго типизированное надмножество JavaScript, компилируемое в обычный JavaScript.
- **Prisma**: ORM следующего поколения для Node.js и TypeScript.
- **PostgreSQL**: Мощная, открытая объектно-реляционная система управления базами данных.
- **Socket.io**: Обеспечивает двустороннюю связь в реальном времени на основе событий.
- **Redis**: In-memory хранилище данных, используемое в качестве базы данных, кэша и брокера сообщений.
- **ioredis**: Надежный, высокопроизводительный и полнофункциональный клиент Redis для Node.js.
- **Bull**: Премиум-пакет очередей для обработки распределенных заданий и сообщений в Node.
- **Stripe**: Платформа для обработки онлайн-платежей.
- **Zod**: Библиотека для объявления схем и валидации, ориентированная на TypeScript.
- **JSON Web Token (JWT)**: Компактный, безопасный с точки зрения URL способ представления утверждений.
- **Helmet**: Помогает защитить приложения Express с помощью различных заголовков HTTP.
- **HPP**: Express-промежуточное ПО для защиты от атак загрязнения параметров HTTP.
- **CORS**: Промежуточное ПО для включения Cross-Origin Resource Sharing.
- **Compression**: Промежуточное ПО сжатия для Node.js.
- **Multer**: Промежуточное ПО для обработки multipart/form-data, в основном используемое для загрузки файлов.
- **Cookie Parser**: Разбор заголовка Cookie и заполнение req.cookies.
- **Express Rate Limit**: Простое промежуточное ПО для ограничения частоты запросов в Express.
- **Winston**: Логгер для Node.js.
- **Winston Daily Rotate File**: Транспорт для Winston, который записывает в ротируемый файл.
- **Prometheus Client (prom-client)**: Официальный клиент метрик Prometheus для Node.js.
- **BCryptJS**: Библиотека для хеширования паролей.
- **IP Address (ipaddr.js)**: Библиотека для манипуляций с адресами IPv4 и IPv6.
- **LRU Cache**: Объект кэша, удаляющий наименее часто используемые элементы.
- **Supertest**: Библиотека, управляемая super-agent, для тестирования HTTP-серверов.
- **Vitest**: Блестяще быстрый тестовый раннер.
- **TSX**: Выполнение файлов TypeScript и JavaScript одной командой.

### Разработка & DevOps
- **Concurrently**: Запуск нескольких команд одновременно в npm-скриптах.
- **Nodemon**: Утилита, которая следит за изменениями и автоматически перезапускает сервер.
- **TypeScript Compiler (tsc)**: Компиляция TypeScript в JavaScript.
- **ESLint**: Инструмент статического анализа кода для выявления проблемных шаблонов.
- **PostCSS**: Инструмент для преобразования CSS с помощью плагинов JavaScript.

## Архитектура

### Архитектура высокого уровня
На этой диаграмме показана архитектура приложения в целом, включая фронтенд, бэкенд, базу данных и внешние сервисы.

```mermaid
graph TB
    subgraph "Фронтенд (React)"
        F[Браузер]
    end

    subgraph "Бэкенд (Node.js/Express)"
        BE[Express-сервер]
        IO[Socket.io]
        JWT[JWT Аутентификация]
        PM[Модуль оплаты]
    end

    subgraph "База данных и Кэш"
        DB[(PostgreSQL)]
        RC[(Redis)]
    end

    subgraph "Внешние сервисы"
        STP[Stripe]
        SMTP[SMTP-сервер]
    end

    F <-- HTTP/AJAX --> BE
    F <-- WebSocket --> IO
    BE <-- Prisma ORM --> DB
    BE <-- Redis Client --> RC
    BE <-- API Call --> PM
    PM <-- API Call --> STP
    BE <-- API Call --> SMTP
```

### Диаграмма потока данных 
На этой диаграмме показан поток данных во время типичного сценария аукциона.

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant F as Фронтенд
    participant B as Бэкенд
    participant D as База данных
    participant R as Redis
    participant S as Stripe
    participant IO as Socket.io

    U->>+F: Сделать ставку
    F->>+B: POST /api/bids
    B->>+D: Проверить статус аукциона и валидировать ставку
    D-->>-B: Данные аукциона
    B->>+R: Обновить кэш
    R-->>-B: Кэш обновлен
    alt Валидная ставка
        B->>+D: Создать запись ставки
        D-->>-B: Ставка создана
        B->>+S: Обработать платеж
        S-->>-B: Платеж обработан
        B->>+IO: Отправить обновление ставки
        IO-->>-F: Транслировать обновление ставки
        F-->>-U: Отобразить новую ставку
    else Невалидная ставка
        B-->>-F: Вернуть ошибку
        F-->>-U: Показать сообщение об ошибке
    end
```

## Установка

1.  Клонируйте репозиторий:
    ```bash
    git clone https://github.com/your-username/global-auction-marketplace.git
    cd global-auction-marketplace
    ```

2.  Установите зависимости для фронтенда и бэкенда:
    ```bash
    npm run install:all
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
