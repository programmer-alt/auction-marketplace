import "dotenv/config";
import { exec, type ExecException } from "child_process";
import { prisma, pool } from "./config/db";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis as pubClient } from "./config/redis";
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
} from "./middleware/csrf";
import { validateEnv } from "./config/env";
import { corsOriginHandler } from "./config/cors";
import logger from "./config/logger";
import { metricsMiddleware, register } from "./config/metrics";
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

validateEnv();

// Настройка управления ресурсами
setResourceLimits();

// Периодическая проверка на утечку памяти
let leakCheckInterval: NodeJS.Timeout | undefined = setInterval(() => {
  if (checkMemoryLeak()) {
    logger.warn("Возможна утечка памяти");
  }
}, 10 * 60 * 1000); // Каждые 10 минут


const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;


export { prisma };

// Redis клиенты для Socket.io адаптера (теперь используем ioredis)


if (!pubClient) {
  throw new Error('Redis client is not available');
}

// Для Socket.IO адаптера используем ioredis.duplicate()
const subClient = pubClient.duplicate();

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CSRF токен эндпоинт — фронтенд вызывает при старте
app.get("/api/csrf-token", generateCsrfToken, (_req, res) => {
  // generateCsrfToken middleware already set the cookie
  // Extract the token from the Set-Cookie header
  const setCookieHeader = res.getHeader('set-cookie');
  const csrfToken = Array.isArray(setCookieHeader)
    ? setCookieHeader.find(c => c.startsWith('csrfToken'))?.split(';')[0].split('=')[1]
    : '';
  res.json({ csrfToken });
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
    logger.info(`Клиент подключен: ${socket.id} (пользователь ${user.id})`);
    socket.join(`user:${user.id}`);
  } else {
    logger.info(`Гость подключен: ${socket.id}`);
  }

  socket.on('auction:join', (data: unknown) => {
    if (!data || typeof data !== 'object' || typeof (data as Record<string, unknown>).auctionId !== 'number') return;
    const { auctionId } = data as { auctionId: number };
    socket.join(`auction:${auctionId}`);
    logger.info(`Клиент ${socket.id} присоединился к аукциону:${auctionId}`);
  });

  socket.on('auction:leave', (auctionId: unknown) => {
    if (typeof auctionId !== 'number') return;
    socket.leave(`auction:${auctionId}`);
    logger.info(`Клиент ${socket.id} покинул аукцион:${auctionId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Клиент отключен: ${socket.id} (пользователь ${user?.id ?? 'гость'})`);
  });
});

// Flag to prevent recursive shutdown calls
let isShuttingDown = false;

// Функция корректного завершения работы
async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.info(`Завершение уже в процессе. Сигнал ${signal} игнорируется.`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Получен сигнал ${signal}. Корректное завершение...`);

  // Закрываем соединения HTTP сервера
  httpServer.closeAllConnections();
  httpServer.close();

  // Останавливаем периодическую проверку на утечки памяти
  try {
    if (leakCheckInterval) {
      clearInterval(leakCheckInterval);
    }
  } catch (error) {
    logger.error('Ошибка очистки интервала проверки утечки памяти:', error);
  }

  // Сначала останавливаем Bull queue + закрываем bull redis клиенты.
  try {
    const { gracefulShutdown } = await import("./queues/auctionCompletionQueue");
    await gracefulShutdown();
  } catch (error) {
    logger.error('Ошибка во время завершения Bull queue:', error);
  }

  // Затем закрываем Redis клиенты для Socket.io адаптера.
  // Важно: ошибки Connection is closed при shutdown — не критичны.
  try {
    if (subClient && typeof subClient.quit === 'function') {
      await subClient.quit();
    }
  } catch (error) {
    logger.warn('Ошибка закрытия Redis subClient (игнорируем при shutdown):', error);
  }
  try {
    if (pubClient && typeof pubClient.quit === 'function') {
      await pubClient.quit();
    }
  } catch (error) {
    logger.warn('Ошибка закрытия Redis pubClient (игнорируем при shutdown):', error);
  }


  // Закрываем подключение Prisma и пул PostgreSQL
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    logger.error('Ошибка отключения от базы данных:', error);
  }

  logger.info('Приложение успешно завершено');
  process.exit(0);
}

// Запуск сервера
httpServer.listen(PORT, async () => {
  logger.info(`Сервер запущен на http://localhost:${PORT}`);
  logger.info(`Среда: ${process.env.NODE_ENV}`);

  try {
    await prisma.$connect();
    logger.info('База данных подключена');
  } catch (error) {
    logger.error('Ошибка подключения к базе данных:', error);
  }

  try {
    if (pubClient) {
      await pubClient.ping();
      logger.info('Redis подключен');
    } else {
      logger.warn('Redis недоступен');
    }
  } catch (error) {
    logger.error('Ошибка подключения к Redis:', error);
  }

  const { scheduleExistingAuctions } = await import('./queues/auctionCompletionQueue');
  await scheduleExistingAuctions();
});

// Обработка ошибки EADDRINUSE
httpServer.on('error', async (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Порт ${PORT} уже занят. Пожалуйста, остановите процесс, который использует этот порт, прежде чем продолжить.`);
    logger.info(`Попытка найти и завершить процесс на порту ${PORT}...`);
    
    if (process.platform === 'win32') {
      // Используем PowerShell для более надежного определения процесса
      exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`, undefined, (err: ExecException | null, stdout: string | NonSharedBuffer) => {
        if (err) {
          logger.error('Не удалось выполнить команду PowerShell для поиска процесса:', err);
          logger.info('Пожалуйста, вручную проверьте процессы, использующие порт 5000.');
          logger.info(`Вы можете попробовать выполнить: Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue`);
          process.exit(1);
        }
        
        const pids = (stdout as string).trim().split(/\r?\n/).map(pid => pid.trim()).filter(pid => pid !== '' && pid !== '0');
        
        if (pids.length === 0) {
          // Проверяем, нет ли TIME_WAIT состояния (сокет еще не освободился после завершения процесса)
          exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Format-Table -AutoSize"`, undefined, (checkErr: ExecException | null, checkStdout: string | NonSharedBuffer) => {
            if (!checkErr) {
              const hasTimeWait = (checkStdout as string).includes('TimeWait');
              if (hasTimeWait) {
                logger.warn(`Порт ${PORT} находится в состоянии TIME_WAIT (ожидание освобождения после закрытия соединения).`);
                logger.info('Это нормально, процесс уже завершился, но сокет еще не освободился системой.');
                logger.info('Пожалуйста, подождите 30-60 секунд и попробуйте снова.');
                process.exit(1);
              }
            }
            logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
            logger.info('Это может быть связано с устаревшим сокетом или другой сетевой проблемой.');
            logger.info('Пожалуйста, подождите немного и попробуйте перезапустить приложение.');
            process.exit(1);
          });
        } else {
          // Найдены активные процессы
          let foundPid = false;
          for (const pid of pids) {
            if (pid && !isNaN(parseInt(pid))) {
              foundPid = true;
              logger.info(`Найден процесс с PID: ${pid}`);
              logger.info(`Попытка завершить процесс ${pid}...`);
              
              exec(`powershell -Command "Stop-Process -Id ${pid} -Force"`, undefined, (killErr: ExecException | null) => {
                if (killErr) {
                  logger.error(`Не удалось завершить процесс ${pid}:`, killErr);
                  logger.info(`ВНИМАНИЕ: Не удалось завершить процесс ${pid}. Это может потребовать прав администратора.`);
                  logger.info(`Пожалуйста, вручную завершите процесс, использующий порт ${PORT}, и перезапустите приложение.`);
                  logger.info(`Вы можете попробовать выполнить: Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue`);
                  logger.info(`Затем попробуйте: Stop-Process -Id ${pid} -Force (от имени администратора)`);
                  process.exit(1);
                } else {
                  logger.info(`Процесс ${pid} успешно завершен. Пожалуйста, перезапустите приложение.`);
                  process.exit(1);
                }
              });
              // Прерываем цикл после первого PID, чтобы не завершать несколько процессов
              break;
            }
          }
          
          if (!foundPid) {
            logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
            logger.info('Это может быть связано с устаревшим сокетом или другой сетевой проблемой.');
            logger.info('Пожалуйста, подождите немного и попробуйте перезапустить приложение.');
            process.exit(1);
          }
        }
      });
    } else {
      // For Unix-like systems
      exec(`lsof -i :${PORT} | grep LISTEN | awk '{print $2}'`, undefined, (err: ExecException | null, stdout: string | NonSharedBuffer) => {
        if (err) {
          logger.error('Не удалось найти процесс, использующий порт:', err);
          logger.info('Пожалуйста, вручную проверьте процессы, использующие порт 5000.');
          process.exit(1);
        }
        
        const pid = (stdout as string).trim();
        if (pid) {
          logger.info(`Найден процесс с PID: ${pid}`);
          logger.info(`Попытка завершить процесс ${pid}...`);
          
          exec(`kill -9 ${pid}`, undefined, (killErr: ExecException | null) => {
            if (killErr) {
              logger.error(`Не удалось завершить процесс ${pid}:`, killErr);
              logger.info(`ВНИМАНИЕ: Не удалось завершить процесс ${pid}. Это может потребовать прав sudo.`);
              logger.info('Пожалуйста, вручную завершите процесс, использующий порт 5000, и перезапустите приложение.');
              logger.info(`Вы можете попробовать выполнить: lsof -i :${PORT} для определения процесса`);
              logger.info(`Затем попробуйте: kill -9 ${pid} (с sudo при необходимости)`);
              process.exit(1);
            } else {
              logger.info(`Процесс ${pid} успешно завершен. Пожалуйста, перезапустите приложение.`);
              process.exit(1);
            }
          });
        } else {
          logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
          logger.info('Это может быть связ��но с устаревшим сокетом или другой сетевой проблемой.');
          logger.info(`Пожалуйста, подождите немного и попробуйте перезапустить приложение, или проверьте вручную: lsof -i :${PORT}`);
          process.exit(1);
        }
      });
    }
  } else {
    logger.error('Ошибка сервера:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  if (!isShuttingDown) {
    logger.info("Получен сигнал SIGINT. Инициируется корректное завершение...");
    shutdown("SIGINT");
  } else {
    logger.info("Завершение уже в процессе. SIGINT игнорируется.");
  }
});
process.on("SIGTERM", () => {
  if (!isShuttingDown) {
    logger.info("Получен сигнал SIGTERM. Инициируется корректное завершение...");
    shutdown("SIGTERM");
  } else {
    logger.info("Завершение уже в процессе. SIGTERM игнорируется.");
  }
});

// Обработка нажатия Ctrl+C в Windows
process.on('SIGBREAK', () => {
  if (!isShuttingDown) {
    logger.info("Получен сигнал SIGBREAK (Ctrl+C в Windows). Инициируется корректное завершение...");
    shutdown("SIGBREAK");
  } else {
    logger.info("Завершение уже в процессе. SIGBREAK игнорируется.");
  }
});

// Необработанные отклонения промисов
process.on('unhandledRejection', (reason: unknown) => {
  // Если unhandledRejection произошёл на фоне shutdown — не запускаем shutdown заново,
  // просто логируем, чтобы не получить каскад ошибок от закрытых соединений.
  if (isShuttingDown) {
    logger.error('Необработанное отклонение промиса во время завершения:', reason);
    return;
  }

  logger.error('Необработанное отклонение промиса:', reason);
  shutdown('unhandledRejection').catch(() => process.exit(1));
});

// Необработанные исключения (синхронные)
process.on('uncaughtException', (error: Error) => {
  if (!isShuttingDown) {
    logger.error('Необработанное исключение:', error);
    shutdown('uncaughtException').catch(() => process.exit(1));
  } else {
    logger.error('Необработанное исключение во время завершения:', error);
  }
});
