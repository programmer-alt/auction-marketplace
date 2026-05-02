import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";

import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import { compressionOptions } from "./config/compression";
import { rateLimit } from "./middleware/rateLimit";
import { socketConnectionRateLimit } from "./middleware/socketRateLimit";
import { parseAuthToken, authMiddleware } from "./middleware/auth";
import {
  generateCsrfToken,
  verifyCsrfToken,
  generateToken,
} from "./middleware/csrf";
import { validateEnv } from "./config/env";
import { corsOriginHandler } from "./config/cors";
import logger from "./config/logger";
import { metricsMiddleware, register } from "./middleware/metrics";
import { setResourceLimits, checkMemoryLeak } from "./config/resources";

import { upload } from './config/upload';
import path from 'path';

// Routes
import authRouter from "./routes/auth.routes";
import auctionsRouter from "./routes/auctions.routes";
import bidsRouter from "./routes/bids.routes";
import paymentsRouter from "./routes/payments.routes";
import adminRouter from "./routes/admin.routes";

// Import error handler
import { errorHandler } from "./errors/handler";
import { securityHeaders } from "./middleware/securityHeaders";

dotenv.config();
validateEnv();

// Настройка управления ресурсами
setResourceLimits();

// Периодическая проверка на утечку памяти
setInterval(() => {
  if (checkMemoryLeak()) {
    logger.warn("Possible memory leak detected");
  }
}, 10 * 60 * 1000); // Каждые 10 минут

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

import { prisma, pool } from "./config/db";
export { prisma };

// Redis клиенты для Socket.io адаптера (переиспользуем подключение из redis.ts)
import { redis as pubClient } from "./config/redis";
const subClient = pubClient.duplicate({ keepAlive: 10000 });

subClient.on("error", (err: Error & { code?: string }) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
  console.error("Redis sub client error:", err);
});

import { initSocket } from "./config/socket";
const io = initSocket(httpServer, corsOriginHandler);
io.adapter(createAdapter(pubClient, subClient));
export { io };
// ========================================
// Middleware безопасности и производительности
// ========================================

// Helmet для базовых security headers (отключаем CSP, т.к. используем кастомный middleware)
app.use(
  helmet({
    contentSecurityPolicy: false, // Будет установлен нашим securityHeaders middleware
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Защита от parameter pollution
app.use(hpp());

// Сжатие ответов
app.use(compression(compressionOptions));

app.use(
  cors({
    origin: (origin, callback) => corsOriginHandler(origin, callback, "CORS"),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

// Security headers middleware (CSP, X-Frame-Options, etc.)
app.use(securityHeaders());

// Stripe webhook
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// Parse JSON for all other routes
app.use(express.json());

// Cookie parser для CSRF и других middleware
app.use(cookieParser());

// Rate limiting middleware (применяется ко всем маршрутам, кроме health)
app.use(rateLimit);

// Metrics middleware для сбора метрик HTTP запросов
app.use(metricsMiddleware);

// CSRF protection
app.use(generateCsrfToken);
app.use(verifyCsrfToken);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Metrics endpoint для Prometheus
app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Статические файлы (загруженные изображения)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// CSRF токен эндпоинт — фронтенд вызывает при старте
app.get("/api/csrf-token", (_req, res) => {
  const token = generateToken();
  res.cookie("csrfToken", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
});

// Загрузка изображений
app.post('/api/upload', authMiddleware, upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Файл не загружен' });
    return;
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// API routes
app.get("/api", (_req, res) => {
  res.json({ message: "Auction Marketplace API", version: "1.0.0" });
});

app.use("/api/auth", authRouter);
app.use("/api/auctions", auctionsRouter);
app.use("/api/auctions", bidsRouter); // ставки находятся под /api/auctions/:auctionId/bids
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);

// Error handling middleware - должно быть последним
app.use(errorHandler);

// Socket.io middleware — токен необязателен, гости подключаются как анонимы
io.use(socketConnectionRateLimit);
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (token) {
    const authResult = await parseAuthToken(token);
    if (authResult.success) {
      socket.data.user = authResult.user;
    }
  }
  next();
});

// Socket.io подключение — токен уже проверен middleware выше
io.on("connection", (socket) => {
  const { user } = socket.data;
  if (user) {
    logger.info(`Client connected: ${socket.id} (user ${user.id})`);
    socket.join(`user:${user.id}`);
  } else {
    logger.info(`Guest connected: ${socket.id}`);
  }

  socket.on('auction:join', (data: unknown) => {
    if (!data || typeof data !== 'object' || typeof (data as Record<string, unknown>).auctionId !== 'number') return;
    const { auctionId } = data as { auctionId: number };
    socket.join(`auction:${auctionId}`);
    logger.info(`Client ${socket.id} joined auction:${auctionId}`);
  });

  socket.on('auction:leave', (auctionId: unknown) => {
    if (typeof auctionId !== 'number') return;
    socket.leave(`auction:${auctionId}`);
    logger.info(`Client ${socket.id} left auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id} (user ${user?.id ?? 'guest'})`);
  });
});

// Функция корректного завершения работы
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  httpServer.closeAllConnections();
  httpServer.close();

  // Закрываем Bull queue и его Redis клиенты
  try {
    const { auctionCompletionQueue, sharedBullClients } =
      await import("./queues/auctionCompletionQueue");
    await auctionCompletionQueue.close();
    await Promise.all(
      Object.values(sharedBullClients)
        .filter(Boolean)
        .map((c) => c!.quit())
    );
  } catch {}

  // Закрываем Redis клиенты
  try {
    await subClient.quit();
    await pubClient.quit();
  } catch {}

  // Закрываем подключение Prisma и пул PostgreSQL
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch {}

  process.exit(0);
}

// Запуск сервера
httpServer.listen(PORT, async () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error('Database connection failed:', error);
  }

  try {
    await pubClient.ping();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Redis connection failed:', error);
  }

  const { scheduleExistingAuctions } = await import('./queues/auctionCompletionQueue');
  await scheduleExistingAuctions();
});

// Graceful shutdown
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Необработанные отклонения промисов
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

// Необработанные исключения (синхронные)
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});
