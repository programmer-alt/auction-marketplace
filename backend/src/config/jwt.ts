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

