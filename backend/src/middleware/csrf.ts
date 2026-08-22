import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Продвинутые типы для CSRF-мидлвара
type WithOptionalPath<T> = T & { path?: string };
type WithOptionalCookies<T> = T & { cookies?: { [key: string]: string } };

// Тип для расширенного запроса с CSRF-данными
type CsrfRequest = WithOptionalPath<Request> & WithOptionalCookies<Request>;

// Простой CSRF-токен на основе double-submit cookie pattern
// Генерируем случайный токен и проверяем его в заголовке/cookie

const { CSRF_SECRET } = process.env;

function getCsrfSecret(): string {
  if (!CSRF_SECRET || CSRF_SECRET.trim() === "") {
    if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
      return "test-csrf-secret";
    }
    throw new Error("CSRF_SECRET is required for CSRF protection");
  }
  return CSRF_SECRET;
}

export function generateToken(): string {
  const secret = getCsrfSecret();
  const nonce = crypto.randomBytes(32).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

function verifyToken(token: string): boolean {
  try {
    const secret = getCsrfSecret();
    const [nonce, signature] = token.split(".");
    if (!nonce || !signature) return false;

    const expectedSignature = crypto.createHmac("sha256", secret).update(nonce).digest("base64url");

    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length) return false;

    return crypto.timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

// Функция для безопасного получения пути запроса
function getRequestPath(req: Request): string {
  // Используем утилиту для безопасного доступа к свойству path
  const pathProp = (req as CsrfRequest).path;
  if (typeof pathProp === "string") {
    return pathProp;
  }

  // Альтернативный способ получения пути из URL
  return req.url.split("?")[0];
}

// Функция для безопасного получения CSRF-токена из cookies
function getCsrfTokenFromCookies(req: Request): string | undefined {
  // Обработка различных форм cookies
  const cookies = (req as CsrfRequest).cookies;
  if (cookies && typeof cookies === "object") {
    return cookies.csrfToken;
  }

  // Альтернативный способ - через заголовок cookie
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;) *csrfToken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  return undefined;
}

// Middleware для генерации CSRF-токена
export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Для GET/HEAD/OPTIONS запросов генерируем токен только для /api/csrf-token эндпоинта
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    // Если это /api/csrf-token эндпоинт, генерируем токен
    const path = getRequestPath(req);
    if (path === "/api/csrf-token") {
      const existingToken = getCsrfTokenFromCookies(req);
      if (!existingToken || !verifyToken(existingToken)) {
        const token = generateToken();
        res.cookie("csrfToken", token, {
          httpOnly: true, // Не доступен для JavaScript (защита от XSS)
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax", // Changed from 'strict' to 'lax' for better compatibility
          maxAge: 2 * 60 * 60 * 1000, // 2 часа
        });
        // Возвращаем токен в теле ответа для frontend
        res.json({ csrfToken: token });
        return;
      }
      // Если токен уже есть, возвращаем его
      res.json({ csrfToken: existingToken });
      return;
    }
    return next();
  }

  // Пропускаем генерацию токена для аутентификационных маршрутов, так как они защищены JWT
  const path = getRequestPath(req);
  if (path?.startsWith("/api/auth") || path?.startsWith("/auth")) {
    return next();
  }

  // Проверяем, есть ли уже токен в cookie
  const existingToken = getCsrfTokenFromCookies(req);

  if (!existingToken || !verifyToken(existingToken)) {
    // Генерируем новый токен
    const token = generateToken();
    res.cookie("csrfToken", token, {
      httpOnly: true, // Не доступен для JavaScript (защита от XSS)
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 2 * 60 * 60 * 1000, // 2 часа
    });
  }

  next();
}

// Middleware для проверки CSRF-токена (кроме GET/OPTIONS)
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  // Пропускаем webhook-маршруты и загрузки файлов (Stripe и другие)
  const path = getRequestPath(req);
  if (path?.includes("/webhook") || path?.includes("/uploads") || path?.endsWith("/upload")) {
    return next();
  }

  // Пропускаем auth маршруты — они защищены JWT.
  // В Express внутри router req.path иногда приходит обрезанным (например, /refresh), поэтому делаем проверку более гибкой.
  const isAuthEndpoint =
    path === "/api/auth/login" ||
    path === "/api/auth/register" ||
    path === "/api/auth/refresh" ||
    path === "/api/auth/logout" ||
    path === "/api/auth/me" ||
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/refresh" ||
    path === "/auth/logout" ||
    path === "/auth/me" ||
    path?.includes("/api/auth/") ||
    path?.includes("/auth/") ||
    ["/login", "/register", "/refresh", "/logout", "/me"].some((ep) => path?.endsWith(ep));

  if (isAuthEndpoint) {
    return next();
  }

  const tokenFromCookie = getCsrfTokenFromCookies(req);
  const tokenFromHeader = req.headers["x-csrf-token"] as string;

  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({ error: "CSRF токен не найден" });
  }

  if (tokenFromCookie !== tokenFromHeader || !verifyToken(tokenFromHeader)) {
    return res.status(403).json({ error: "Неверный CSRF токен" });
  }

  next();
}
