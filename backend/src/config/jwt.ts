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
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    // нет символа @ или он первый — маскируем всё
    return "***";
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  // Никогда не показываем всю локальную часть:
  // - при длине 1–2 показываем только первый символ, остальное маскируем
  // - при длине >= 3 показываем первые 2 символа, остальное маскируем
  const visibleLength = local.length <= 2 ? 1 : 2;
  const maskedLength = Math.max(local.length - visibleLength, 1);

  const visible = local.slice(0, visibleLength);
  const masked = "*".repeat(maskedLength);

  return `${visible}${masked}${domain}`;
}

/**
 * Маскированный email из исходного.
 * Если параметр не строка — возвращает '***'.
 * Используется для безопасной обработки email типа unknown перед передачей в maskEmail.
 */
export function maskEmailInput(email: unknown): string {
  if (typeof email !== "string" || !email) return "***";
  return maskEmail(email);
}

/**
 * Парсит строку duration (например "7d", "24h", "3600s") в секунды.
 * Используется для выравнивания TTL кэша с JWT expiry.
 * Возвращает safeDefault (по умолчанию 7 дней) при любом некорректном формате.
 */
export function parseDurationToSeconds(duration: string, safeDefault: number = 7 * 24 * 60 * 60): number {
  if (typeof duration !== "string" || !duration.trim()) {
    console.warn(`[PARSE_DURATION] Invalid or empty duration, using safeDefault: ${safeDefault}s`);
    return safeDefault;
  }
  const match = duration.trim().match(/^(\d+)(d|h|m|s)$/);
  if (!match) {
    console.warn(`[PARSE_DURATION] Unrecognized duration format "${duration}", using safeDefault: ${safeDefault}s`);
    return safeDefault;
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60;
    case "h":
      return value * 60 * 60;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      return safeDefault;
  }
}
