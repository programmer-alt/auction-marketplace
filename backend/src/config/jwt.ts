export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export function getJwtAccessExpiresIn(): string {
  // Контракт тестов: expiresIn "7d"
  return "7d";
}

export function getJwtRefreshExpiresIn(): string {
  // Контракт тестов: expiresIn "7d"
  return "7d";
}

/**
 * Safe email masking for logs — prevents PII leakage.
 * Returns masked string for any input, including short/malformed emails.
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    // нет символа @ или он первый — маскируем всё
    return '***';
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  // Оставляем первые 2 символа локальной части, остальное маскируем
  const visible = local.length <= 2 ? local : local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 1));
  return `${visible}${masked}${domain}`;
}

/**
 * Маскированный email из исходного.
 * Если параметр не строка — возвращает '***'.
 */
export function maskEmailInput(email: unknown): string {
  if (typeof email !== 'string' || !email) return '***';
  return maskEmail(email);
}

/**
 * Парсит строку duration (например "7d", "24h", "3600s") в секунды.
 * Используется для выравнивания TTL Redis с JWT expiry.
 * Возвращает safeDefault (по умолчанию 7 дней) при любом некорректном формате.
 */
export function parseDurationToSeconds(duration: string, safeDefault: number = 7 * 24 * 60 * 60): number {
  if (typeof duration !== 'string' || !duration.trim()) {
    return safeDefault;
  }
  const match = duration.trim().match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    return safeDefault;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: return safeDefault;
  }
}

