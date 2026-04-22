export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export function getJwtAccessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN || "15m";
}

export function getJwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || "7d";
}
