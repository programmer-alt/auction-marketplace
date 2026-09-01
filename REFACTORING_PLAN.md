# План рефакторинга

На основе анализа **knip** (dead code) и **narsil** (security, complexity, call graph).

---

## 🔴 Критические — исправить в первую очередь

### 1. Удалить unused файлы (knip) ✅ ВЫПОЛНЕНО

4 файла были удалены:

| Файл | Статус |
|---|---|
| `frontend/src/pages/AuctionDetails/components/AuctionStatus.tsx` | ✅ Удалён |
| `frontend/src/utils/validation/auction.schema.ts` | ✅ Удалён |
| `backend/src/errors/index.ts` | ✅ Удалён |
| `backend/src/utils/json.ts` | ✅ Удалён |

### 2. Удалить unused dependencies (knip) ✅ ВЫПОЛНЕНО

2 пакета удалены из `frontend/package.json`:

| Пакет | Статус |
|---|---|
| `clsx` | ✅ Удалён |
| `socket.io-client` | ✅ Удалён |

---

## 🟠 Высокий приоритет — security (narsil)

### 3. Fix insecure data transmission (6 High findings) ✅ ВЫПОЛНЕНО

**Реальные проблемы:** только `securityHeaders.ts` содержал `http://localhost:*` в CSP для production.

| Файл | Статус |
|---|---|
| `backend/src/middleware/securityHeaders.ts` | ✅ Исправлен — `http://localhost:*` удалён из `defaultCspConfig`, заменён на `https://`/`wss://` |
| `frontend/src/pages/Login/Login.index.tsx` | ❌ False positive — это SVG namespace `xmlns="http://www.w3.org/2000/svg"` |
| `frontend/src/pages/Register/Register.index.tsx` | ❌ False positive — это SVG namespace `xmlns="http://www.w3.org/2000/svg"` |
| `backend/src/index.ts` | ❌ False positive — это log message `http://localhost:${PORT}` |
| `frontend/vite.config.ts` | ❌ False positive — строка 38 не существует (файл 37 строк) |

### 4. Critical — Hardcoded password (1 Critical finding) ✅ FALSE POSITIVE

| Файл | Строка | Проблема (narsil) | Реальность |
|---|---|---|---|
| `frontend/src/pages/Register/Register.index.tsx` | 26 | Hardcoded password в CloudFormation | `confirmPassword: ""` — default value react-hook-form, не CloudFormation |

### 5. Mask sensitive data in logs (20 Medium findings) ✅ FALSE POSITIVE

Все 20 findings — false positive. Проверял каждый файл:

| Файл | Реальное состояние |
|---|---|
| `frontend/src/pages/Login/Login.index.tsx` | `console.error("Login error")` — без sensitive данных |
| `frontend/src/pages/Register/Register.index.tsx` | Нет console.log |
| `frontend/src/types/advanced.ts` | `console.log` только в JSDoc-комментарии |
| `frontend/src/components/layout/Header.tsx` | Нет console.log |
| `backend/src/controllers/auth.controller.ts` | Нет логирования |
| `backend/src/services/auth.service.ts` | ✅ Уже использует `maskedEmail` во всех logger-вызовах |

---

## 🟡 Средний приоритет — sensitive data in logs (narsil)

### 5. Mask sensitive data in logs (20 Medium findings)

Обнаружено логирование email и password. Основные файлы:

| Файл | Кол-во | Проблема | Действие |
|---|---|---|---|
| `frontend/src/pages/Login/Login.index.tsx` | 4 | Логирование email/password | Использовать maskEmail() |
| `frontend/src/pages/Register/Register.index.tsx` | 4 | Логирование email/password | Использовать maskEmail() |
| `frontend/src/types/advanced.ts` | 4 | Логирование credentials | Убрать sensitive data из логов |
| `frontend/src/components/layout/Header.tsx` | 4 | Логирование UI элементов | Убрать из логов |
| `backend/src/controllers/auth.controller.ts` | 2 | Логирование password | Использовать maskEmail() |
| `backend/src/services/auth.service.ts` | 2 | Логирование password | Использовать maskEmail() |
| `frontend/src/pages/AuctionDetails/AuctionDetails.index.tsx` | 2 | Логирование login | Убрать из логов |

---

## 🔵 Низкий приоритет — code quality (narsil)

### 6. Replace `any` types (12 Low findings)

| Файл | Строка | Проблема | Действие |
|---|---|---|---|
| `frontend/src/pages/AuctionDetails/hooks/useBidForm.ts` | 69 | `: any` | Заменить на `unknown` или конкретный тип |
| `frontend/src/api/auctions.ts` | 105 | `<any>` | Заменить на `unknown` |
| `backend/src/utils/pagination.ts` | 337 | `as any` | Заменить на конкретный тип |
| `frontend/src/types/errorTypes.ts` | 22, 77 | `: any` | Заменить на `unknown` |
| `frontend/src/pages/Payment/hooks/usePaymentData.ts` | 83 | `as any` | Заменить на конкретный тип |
| `frontend/src/types/advanced.ts` | 341, 554, 557 | `: any` | Заменить на конкретный тип |
| `frontend/src/pages/CreateAuction/hooks/useCreateAuction.ts` | 80 | `<any>` | Заменить на конкретный тип |
| `frontend/src/pages/AuctionDetails/hooks/useAuctionData.ts` | 68, 99 | `as any` | Заменить на конкретный тип |

---

## 📊 Complexity — рефакторинг сложных функций (narsil)

### 7. Reduce cyclomatic complexity (5 hotspots) ✅ ВЫПОЛНЕНО

Все 4 функции (кроме удалённого json.ts) рефакторизованы:

| Файл | Действие |
|---|---|
| `backend/src/middleware/securityHeaders.ts` | ✅ Вынесены: `setHeader()`, `buildCspHeader()`, `mergeDevCspConfig()` |
| `backend/src/middleware/csrf.ts` | ✅ Вынесена: `isAuthEndpoint()` |
| `backend/src/middleware/rateLimit.ts` | ✅ Вынесена: `shouldSkipRateLimit()` |
| `backend/src/services/payments.service.ts` | ✅ Вынесены: `handlePaymentSucceeded()`, `handlePaymentStateChangeEvent()`, `handleRefund()` |

---

## 📈 Call graph — анализ зависимостей (narsil)

### 8. Review high-degree functions (3 top callers) ✅ ВЫПОЛНЕНО

**Результат анализа:** все 3 функции не требуют рефакторинга. Counts narsil были завышены за счёт учёта type references, JSDoc, импортов.

| Функция | Callers (narsil) | Callers (реально) | Статус |
|---|---|---|---|
| `auth.service.ts::register` | 15 | 3 (1 controller + 3 теста) | ✅ Чистая, SRP, нет дублирования |
| `socket.ts::getIo` | 12 | 6 (5 auctions.service + 1 bids.service) | ✅ Корректный модуль-level singleton |
| `index.ts::shutdown` | 7 | 5 (SIGINT/SIGTERM/SIGBREAK/unhandledRejection/uncaughtException) | ✅ Graceful shutdown: guard + timeout + cleanup |

---

## ✅ Найдено, но не требует действий

| Что | Кол-во | Статус |
|---|---|---|
| Circular imports | 0 | ✅ Нет циклов |
| Injection vulnerabilities | 0 | ✅ Нет уязвимостей |
| Unused exports (knip) | 56 функций + 67 типов | ⏸️ Utility функции для тестов, игнорируем |

---

## Порядок выполнения

1. ~~**Шаг 1:** Удалить 4 unused файлы~~ ✅ ВЫПОЛНЕНО
2. ~~**Шаг 2:** Удалить 2 unused dependencies (knip)~~ ✅ ВЫПОЛНЕНО
3. ~~**Шаг 3:** Fix 6 High security findings (narsil)~~ ✅ ВЫПОЛНЕНО
4. ~~**Шаг 4:** Fix 1 Critical security finding (narsil)~~ ✅ FALSE POSITIVE — `confirmPassword: ""` в defaultValues, не CloudFormation
5. ~~**Шаг 5:** Mask sensitive data in logs (narsil)~~ ✅ FALSE POSITIVE — все 20 findings ложные, backend уже маскирует email
6. ~~**Шаг 7:** Reduce complexity (narsil)~~ ✅ ВЫПОЛНЕНО
7. ~~**Шаг 8:** Call graph analysis (narsil)~~ ✅ ВЫПОЛНЕНО — все 3 функции не требуют рефакторинга
