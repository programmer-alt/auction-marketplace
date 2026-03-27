import { Request, Response, NextFunction } from 'express';

// Простой CSRF-токен на основе double-submit cookie pattern
// Генерируем случайный токен и проверяем его в заголовке/cookie

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';

function generateToken(): string {
  const random = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const signature = Buffer.from(random + CSRF_SECRET).toString('base64');
  return `${Buffer.from(random).toString('base64')}.${signature}`;
}

function verifyToken(token: string): boolean {
  try {
    const [randomPart, signaturePart] = token.split('.');
    if (!randomPart || !signaturePart) return false;
    
    const expectedSignature = Buffer.from(
      Buffer.from(randomPart, 'base64').toString() + CSRF_SECRET
    ).toString('base64');
    
    return signaturePart === expectedSignature;
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
  if (req.path.includes('/webhook')) {
    return next();
  }

  const tokenFromCookie = req.cookies?.csrfToken;
  const tokenFromHeader = req.headers['x-csrf-token'] as string;

  // Double-submit: токен должен совпадать в cookie и заголовке
  if (!tokenFromCookie || !tokenFromHeader) {
    return res.status(403).json({ 
      error: 'CSRF токен не найден' 
    });
  }

  if (tokenFromCookie !== tokenFromHeader || !verifyToken(tokenFromHeader)) {
    return res.status(403).json({ 
      error: 'Не правильный CSRF токен' 
    });
  }

  next();
}
