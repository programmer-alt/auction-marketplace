const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

export function validateEnv(): void {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const key of REQUIRED_ENV) {
    const value = process.env[key];
    if (value === undefined) {
      missing.push(key);
    } else if (value.trim() === "") {
      empty.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Отсутствуют обязательные переменные окружения: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (empty.length > 0) {
    console.error(`❌ Обязательные переменные окружения пусты: ${empty.join(", ")}`);
    process.exit(1);
  }

  console.log("✅ Все обязательные переменные окружения присутствуют и не пусты");
}
