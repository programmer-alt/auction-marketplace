import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Простой CSRF-токен на основе double-submit cookie pattern
// Генерируем случайный токен и проверяем его в заголовке/cookie

const CSRF_SECRET = process.env.CSRF_SECRET;

function getCsrfSecret(): string {
  if (!CSRF_SECRET || CSRF_SECRET.trim() === '') {
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
  // Не генерируем токен для GET-запросов (они только читают данные)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Проверяем, есть ли уже токен в cookie
  const existingToken = req.cookies?.csrfToken;
  
  if (!existingToken || !verifyToken(existingToken)) {
    // Генерируем новый токен
    const token = generateToken();
    res.cookie('csrfToken', token, {
      httpOnly: false, // Доступен для JavaScript (для отправки в заголовке)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
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

  // Пропускаем webhook-маршруты (Stripe и другие)
  if (req.path.includes('/webhook') || req.path.includes('/uploads')) {
    return next();
  }

  // Пропускаем auth маршруты — они защищены JWT
  if (req.path.startsWith('/auth')) {
    return next();
  }

  const tokenFromCookie = req.cookies?.csrfToken;
  const tokenFromHeader = req.headers['x-csrf-token'] as string;

  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({ error: 'CSRF токен не найден' });
  }

  if (tokenFromCookie !== tokenFromHeader || !verifyToken(tokenFromHeader)) {
    return res.status(403).json({ error: 'Неверный CSRF токен' });
  }

  next();
}
