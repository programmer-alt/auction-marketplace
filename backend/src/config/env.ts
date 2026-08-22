const REQUIRED_ENV = ["JWT_SECRET", "CSRF_SECRET", "DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];

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

  // Проверяем, что если переменные для рейт-лимита заданы, то они являются числовыми значениями
  const rateLimitVars = ["DEV_RATE_LIMIT", "PROD_RATE_LIMIT"];
  for (const key of rateLimitVars) {
    const value = process.env[key];
    if (value !== undefined && value.trim() !== "" && Number.isNaN(Number(value))) {
      console.error(`❌ Переменная окружения ${key} должна быть числом, получено: ${value}`);
      process.exit(1);
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
