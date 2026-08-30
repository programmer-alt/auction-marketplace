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

### 2. Удалить unused dependencies (knip) ⏳ ОЖИДАЕТ

2 пакета установлены, но не используются в коде:

| Пакет | Где | Действие |
|---|---|---|
| `clsx` | frontend/package.json | `npm uninstall clsx` |
| `socket.io-client` | frontend/package.json | `npm uninstall socket.io-client` |

---

## 🟠 Высокий приоритет — security (narsil)

### 3. Fix insecure data transmission (6 High findings)

`http://` обнаружен в CSP headers и конфигурации. Все 6 случаев — это `http://localhost:*` в dev-конфигурации CSP.

| Файл | Строка | Проблема | Действие |
|---|---|---|---|
| `backend/src/middleware/securityHeaders.ts` | 123 | `http://` в CSP | Заменить на `https://` или оставить только для dev |
| `backend/src/middleware/securityHeaders.ts` | 128 | `http://` в CSP | Заменить на `https://` или оставить только для dev |
| `frontend/src/pages/Login/Login.index.tsx` | 112 | `http://` в CSP | Заменить на `https://` или оставить только для dev |
| `backend/src/index.ts` | 359 | `http://` в CSP | Заменить на `https://` или оставить только для dev |
| `frontend/src/pages/Register/Register.index.tsx` | 121 | `http://` в CSP | Заменить на `https://` или оставить только для dev |
| `frontend/vite.config.ts` | 38 | `http://` в CSP | Заменить на `https://` или оставить только для dev |

**Решение:** Использовать `https://` для production, `http://` только в dev-режиме через условную логику.

### 4. Critical — Hardcoded password (1 Critical finding)

| Файл | Строка | Проблема | Действие |
|---|---|---|---|
| `frontend/src/pages/Register/Register.index.tsx` | 26 | Hardcoded password в CloudFormation | Заменить на параметр из environment |

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

### 7. Reduce cyclomatic complexity (5 hotspots)

| Файл | Функция | CC | LOC | Действие |
|---|---|---|---|---|
| `backend/src/middleware/securityHeaders.ts` | `securityHeaders` | 33 | 91 | Разбить на подфункции |
| `backend/src/middleware/csrf.ts` | `verifyCsrfToken` | 24 | 46 | Вынести логику в отдельные функции |
| ~~`backend/src/utils/json.ts`~~ | ~~`validateAuction`~~ | ~~19~~ | ~~37~~ | ~~Разбить на валидаторы~~ |
| `backend/src/middleware/rateLimit.ts` | `rateLimit` | 18 | 55 | Разделить логику |
| `backend/src/services/payments.service.ts` | `handleWebhook` | 15 | 96 | Разделить обработчики событий |

---

## 📈 Call graph — анализ зависимостей (narsil)

### 8. Review high-degree functions (3 top callers)

| Функция | Callers | Действие |
|---|---|---|
| `auth.service.ts::register` | 15 | Проверить на дублирование логики |
| `socket.ts::getIo` | 12 | Проверить на singleton паттерн |
| `index.ts::shutdown` | 7 | Проверить на graceful shutdown |

---

## ✅ Найдено, но не требует действий

| Что | Кол-во | Статус |
|---|---|---|
| Circular imports | 0 | ✅ Нет циклов |
| Injection vulnerabilities | 0 | ✅ Нет уязвимостей |
| Unused exports (knip) | 56 функций + 67 типов | ⏸️ Utility функции для тестов, игнорируем |

---

## Порядок выполнения

1. ~~**Шаг 1:** Удалить 4 unused файла + 2 unused dependencies (knip)~~ ✅ ВЫПОЛНЕНО
2. **Шаг 2:** Fix 6 High security findings (narsil)
3. **Шаг 3:** Fix 1 Critical security finding (narsil)
4. **Шаг 4:** Mask sensitive data in logs (narsil)
5. **Шаг 5:** Replace `any` types (narsil)
6. **Шаг 6:** Reduce complexity (narsil)
