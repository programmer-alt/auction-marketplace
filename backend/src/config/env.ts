const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Отсутствуют обязательные переменные окружения: ${missing.join(", ")}`);
    process.exit(1);
  }
}
