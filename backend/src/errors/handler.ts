// Централизованный обработчик ошибок
export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  console.error("Ошибка:", err);

  // Обработка наших кастомных ошибок
  if (err?.errorType === "NOT_FOUND") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err?.errorType === "FORBIDDEN") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err?.errorType === "VALIDATION") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Обработка Zod ошибок валидации
  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Ошибка валидации: " + err.message });
  }

  // Обработка ошибок Prisma (запись не найдена)
  if (err.code === "P2025" || err.code === "P2001") {
    return res.status(404).json({ error: "Запрашиваемый объект не найден" });
  }

  // Все остальные ошибки — 500
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
};
