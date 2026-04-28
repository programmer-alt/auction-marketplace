export function getAllowedOrigins(): string[] {
  // ВНИМАНИЕ: В продакшене используйте HTTPS протокол для всех origin.
  // Пример: "https://ваш-домен.com,https://другой-домен.com"
  return (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");
}

export function corsOriginHandler(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
  label = "CORS",
): void {
  const allowedOrigins = getAllowedOrigins();
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`${label}: Origin ${origin} not allowed`));
  }
}
