/**
 * Middleware для сбора метрик HTTP запросов с использованием Prometheus
 */

import { Request, Response, NextFunction } from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Создаем реестр метрик
export const register = new Registry();

// Собираем стандартные метрики Node.js (CPU, память и т.д.)
collectDefaultMetrics({ register });

// Метрики для HTTP запросов
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5],
  registers: [register],
});

const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

// Middleware для сбора метрик
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Увеличиваем счетчик активных соединений
  activeConnections.inc();

  // Перехватываем метод res.end для измерения времени ответа
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = (Date.now() - start) / 1000; // в секундах

    // Формируем метки для метрик
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Записываем метрики
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestCounter.inc({ method, route, status_code: statusCode });

    // Уменьшаем счетчик активных соединений
    activeConnections.dec();

    // Вызываем оригинальный метод
    return originalEnd.apply(this, args);
  };

  next();
};

// Функция для получения метрик в формате Prometheus
export const getMetrics = async (): Promise<string> => {
  return await register.metrics();
};
