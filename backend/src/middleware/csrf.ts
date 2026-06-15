import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Простой CSRF-токен на основе double-submit cookie pattern
// Генерируем случайный токен и проверяем его в заголовке/cookie

const { CSRF_SECRET } = process.env;

function getCsrfSecret(): string {
  if (!CSRF_SECRET || CSRF_SECRET.trim() === '') {
    
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return 'test-csrf-secret';
    }
    throw new Error('CSRF_SECRET is required for CSRF protection');
  }
  return CSRF_SECRET;
}


export function generateToken(): string {
  const secret = getCsrfSecret();
  const nonce = crypto.randomBytes(32).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(nonce).digest('base64url');
  return `${nonce}.${signature}`;
}

function verifyToken(token: string): boolean {
  try {
    const secret = getCsrfSecret();
    const [nonce, signature] = token.split('.');
    if (!nonce || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(nonce)
      .digest('base64url');

    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length) return false;

    return crypto.timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

// Middleware для генерации CSRF-токена
export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Для GET-запросов генерируем токен только для /api/csrf-token эндпоинта
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    // Если это /api/csrf-token эндпоинт, генерируем токен
    if ((req as any).path === '/api/csrf-token') {
      const existingToken = (req as any).cookies?.csrfToken;
      if (!existingToken || !verifyToken(existingToken)) {
        const token = generateToken();
        res.cookie('csrfToken', token, {
          httpOnly: true, // Не доступен для JavaScript (защита от XSS)
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 2 * 60 * 60 * 1000, // 2 часа
        });
      }
    }
    return next();
  }

  // Пропускаем генерацию токена для аутентификационных маршрутов, так как они защищены JWT
  if ((req as any).path?.startsWith('/api/auth') || (req as any).path?.startsWith('/auth')) {
    return next();
  }

  // Проверяем, есть ли уже токен в cookie
  const existingToken = (req as any).cookies?.csrfToken;
  
  if (!existingToken || !verifyToken(existingToken)) {
    // Генерируем новый токен
    const token = generateToken();
    res.cookie('csrfToken', token, {
      httpOnly: true, // Не доступен для JavaScript (защита от XSS)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000, // 2 часа
    });
  }
  
  next();
}

// Middleware для проверки CSRF-токена (кроме GET/OPTIONS)
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Пропускаем webhook-маршруты и загрузки файлов (Stripe и другие)
  if ((req as any).path?.includes('/webhook') || (req as any).path?.includes('/uploads')) {
    return next();
  }

  // Пропускаем auth маршруты — они защищены JWT
  if ((req as any).path === '/api/auth/login' || (req as any).path === '/api/auth/register' || (req as any).path === '/api/auth/refresh' || (req as any).path === '/api/auth/logout' || (req as any).path === '/api/auth/me') {
    return next();
  }
  
  // Альтернативно: проверяем, если путь содержит '/api/auth' как отдельный сегмент
  if ((req as any).path?.startsWith('/api/auth') && ['/login', '/register', '/refresh', '/logout', '/me'].some(endpoint => (req as any).path?.endsWith(endpoint))) {
    return next();
  }

  const tokenFromCookie = (req as any).cookies?.csrfToken;
  const tokenFromHeader = (req.headers as any)['x-csrf-token'] as string;

  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({ error: 'CSRF токен не найден' });
  }

  if (tokenFromCookie !== tokenFromHeader || !verifyToken(tokenFromHeader)) {
    return res.status(403).json({ error: 'Неверный CSRF токен' });
  }

  next();
}
