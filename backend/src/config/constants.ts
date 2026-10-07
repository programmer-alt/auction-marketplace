// ========================================
// Constants
// ========================================

/**
 * Валюты Stripe, которые не используют минорные единицы (центы).
 * Для этих валют сумма передаётся как есть, без умножения на 100.
 * @see https://stripe.com/docs/currencies-zero-decimal
 */
export const CURRENCY_ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
