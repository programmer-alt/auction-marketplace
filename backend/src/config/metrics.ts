/**
 * Конфигурация для сбора метрик Prometheus
 */

import promClient from 'prom-client';

// Создаем реестр метрик
export const register = new promClient.Registry();

// Добавляем метрики по умолчанию (CPU, память и т.д.)
promClient.collectDefaultMetrics({ register });

// ========================================
// HTTP метрики
// ========================================

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5],
  registers: [register],
});

export const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ========================================
// База данных метрики
// ========================================

export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbQueryCounter = new promClient.Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table'],
  registers: [register],
});

// ========================================
// WebSocket метрики
// ========================================

export const websocketConnections = new promClient.Gauge({
  name: 'websocket_connections_current',
  help: 'Current number of WebSocket connections',
  registers: [register],
});

export const websocketMessagesTotal = new promClient.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event', 'direction'],
  registers: [register],
});

// ========================================
// Очереди метрики
// ========================================

export const queueJobsTotal = new promClient.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobsDuration = new promClient.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue jobs in seconds',
  labelNames: ['queue'],
  buckets: [1, 5, 10, 30, 60, 300],
  registers: [register],
});

// ========================================
// Бизнес метрики
// ========================================

export const auctionsCreatedTotal = new promClient.Counter({
  name: 'auctions_created_total',
  help: 'Total number of auctions created',
  registers: [register],
});

export const bidsCreatedTotal = new promClient.Counter({
  name: 'bids_created_total',
  help: 'Total number of bids created',
  labelNames: ['auction_id'],
  registers: [register],
});

export const paymentsProcessedTotal = new promClient.Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status'],
  registers: [register],
});

import type { Request, Response, NextFunction } from 'express';

// ========================================
// Middleware для Express
// ========================================

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;

    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      duration / 1000
    );
  });

  next();
};
