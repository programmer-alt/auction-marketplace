export type AppErrorType = "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "INTERNAL";

export interface AppError extends Error {
  errorType: AppErrorType;
  statusCode: number;
}

// Тип для ошибки Zod
export interface ZodError extends Error {
  name: "ZodError";
  message: string;
}

// Тип для ошибки Prisma
export interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}
