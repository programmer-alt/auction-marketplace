export class NotFoundError extends Error {
  statusCode: number;
  constructor(message: string = "Объект не найден") {
    super(message);
    this.statusCode = 404;
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  statusCode: number;
  constructor(message: string = "Недостаточно прав для выполнения операции") {
    super(message);
    this.statusCode = 403;
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.statusCode = 400;
    this.name = "ValidationError";
  }
}

// Централизованный обработчик ошибок
export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  console.error("Ошибка:", err);

  // Определение типа ошибки и соответствующий ответ
  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ForbiddenError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Обработка ошибок валидации Zod, если используется
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Ошибка валидации: ' + err.message });
  }

  // Обработка ошибок Prisma, если есть
  if (err.code === 'P2025' || err.code === 'P2001') {
    return res.status(404).json({ error: 'Запрашиваемый объект не найден' });
  }

  // Для других ошибок возвращаем общее сообщение
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
};