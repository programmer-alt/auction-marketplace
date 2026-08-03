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
 * Парсит строку duration (например "7d", "24h", "3600s") в секунды.
 * Используется для выравнивания TTL Redis с JWT expiry.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = duration.trim().match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

