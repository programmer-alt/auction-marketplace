/**
 * Типы для обработки ошибок
 */

import type { AxiosError } from "axios";

export interface ErrorContract {
  message: string;
  level: "info" | "warning" | "error" | "critical";
  context?: Record<string, any>;
  handled?: boolean;
  timestamp?: Date;
}

export enum ErrorCategory {
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  SERVER_ERROR = "SERVER_ERROR",
  UNKNOWN = "UNKNOWN",
}

export type PossibleError = unknown;

export interface DetailedError extends ErrorContract {
  code?: string;
  category: ErrorCategory;
  originalError?: any;
}

export interface HandledError extends Error {
  config?: {
    handled?: boolean;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export function isApiSuccess<T>(response: any): response is { success: true; data: T; message?: string } {
  return response.success === true;
}

export function isApiError(response: any): response is ApiError {
  return response.success === false;
}

export function isHandledError(error: any): error is HandledError {
  return error && typeof error === "object" && error.config?.handled === true;
}

export function isAxiosError(error: any): error is AxiosError {
  return error && typeof error === "object" && "isAxiosError" in error;
}