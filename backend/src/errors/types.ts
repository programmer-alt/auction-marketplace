export type AppErrorType =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "INTERNAL";

export interface AppError extends Error {
  errorType: AppErrorType;
  statusCode: number;
}
