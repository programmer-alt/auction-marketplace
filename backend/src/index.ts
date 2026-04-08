import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { createAdapter } from "@socket.io/redis-adapter";

import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import { compressionOptions } from "./config/compression";
import { rateLimit } from "./middleware/rateLimit";
import { parseAuthToken, authMiddleware } from "./middleware/auth";
import {
  generateCsrfToken,
  verifyCsrfToken,
  generateToken,
} from "./middleware/csrf";
import { validateEnv } from "./config/env";
import { corsOriginHandler } from "./config/cors";

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

dotenv.config();
validateEnv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

import { prisma, pool } from "./config/db";
export { prisma };

// Redis клиенты для Socket.io адаптера (переиспользуем подключение из redis.ts)
import { redis as pubClient } from "./config/redis";
const subClient = pubClient.duplicate();

subClient.on("error", (err) => console.error("Redis sub client error:", err));

import { initSocket } from "./config/socket";
const io = initSocket(httpServer, corsOriginHandler);
io.adapter(createAdapter(pubClient, subClient));
export { io };
// ========================================
// Middleware безопасности и производительности
// ========================================

// Helmet для security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          ...(process.env.NODE_ENV === "development" ? ["http://localhost:5000"] : []),
        ],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Permissions-Policy — ограничиваем доступ к браузерным API
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), fullscreen=(self)",
  );
  next();
});

// X-Request-ID — уникальный ID для трассировки каждого запроса
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

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

// Stripe webhook
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// Parse JSON for all other routes
app.use(express.json());

// Cookie parser для CSRF и других middleware
app.use(cookieParser());

// Rate limiting middleware (применяется ко всем маршрутам, кроме health)
app.use(rateLimit);

// CSRF protection
app.use(generateCsrfToken);
app.use(verifyCsrfToken);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Статические файлы (загруженные изображения) — только для авторизованных
app.use('/uploads', authMiddleware, express.static(path.join(process.cwd(), 'src', 'uploads')));

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

// Socket.io middleware — проверяет токен один раз при подключении
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const authResult = parseAuthToken(token);
  if (!authResult.success) {
    return next(new Error("Не авторизован"));
  }
  socket.data.user = authResult.user;
  next();
});

// Socket.io подключение — токен уже проверен middleware выше
io.on("connection", (socket) => {
  const { user } = socket.data;
  console.log(`⚡ [socket] Client connected: ${socket.id} (user ${user.id})`);

  socket.join(`user:${user.id}`);

  socket.on('auction:join', (data: { auctionId: number }) => {
    socket.join(`auction:${data.auctionId}`);
    console.log(`🔔 [socket] Client ${socket.id} joined auction:${data.auctionId}`);
  });

  socket.on('auction:leave', (auctionId: number) => {
    socket.leave(`auction:${auctionId}`);
    console.log(`👋 [socket] Client ${socket.id} left auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 [socket] Client disconnected: ${socket.id} (user ${user.id})`);
  });
});

// Функция корректного завершения работы
async function shutdown(signal: string) {
  console.log(`\n🛑 [shutdown] Received ${signal}. Shutting down gracefully...`);

  httpServer.closeAllConnections();
  httpServer.close();

  // Закрываем Bull queue
  try {
    const { auctionCompletionQueue } =
      await import("./queues/auctionCompletionQueue");
    await auctionCompletionQueue.close();
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
  console.log(`\n🚀 [server] Running on http://localhost:${PORT}`);
  console.log(`📝 [server] Environment: ${process.env.NODE_ENV}`);

  try {
    await prisma.$connect();
    console.log('📦 [server] Database connected');
  } catch (error) {
    console.error('❌ [server] Database connection failed:', error);
  }

  try {
    await pubClient.ping();
    console.log('🔗 [server] Redis connected');
  } catch (error) {
    console.error('❌ [server] Redis connection failed:', error);
  }

  const { scheduleExistingAuctions } = await import('./queues/auctionCompletionQueue');
  await scheduleExistingAuctions();
});

// Graceful shutdown
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Необработанные отклонения промисов
process.on('unhandledRejection', (reason: unknown) => {
  console.error('❌ [server] Unhandled promise rejection:', reason);
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

// Необработанные исключения (синхронные)
process.on('uncaughtException', (error: Error) => {
  console.error('❌ [server] Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});
