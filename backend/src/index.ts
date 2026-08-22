import "dotenv/config";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { compressionOptions } from "@/config/compression";
import { corsOriginHandler } from "@/config/cors";
import { pool, prisma } from "@/config/db";
import { validateEnv } from "@/config/env";
import logger from "@/config/logger";
import { metricsMiddleware, register } from "@/config/metrics";
import { checkMemoryLeak, setResourceLimits } from "@/config/resources";
import { authMiddleware, parseAuthToken } from "@/middleware/auth";
import { generateCsrfToken, verifyCsrfToken } from "@/middleware/csrf";
import { rateLimit } from "@/middleware/rateLimit";
import { socketConnectionRateLimit } from "@/middleware/socketRateLimit";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import hpp from "hpp";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { upload } from "@/config/upload";

// Таймаут для async операций
function timeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

import adminRouter from "@/routes/admin.routes";
import auctionsRouter from "@/routes/auctions.routes";
// Routes
import authRouter from "@/routes/auth.routes";
import bidsRouter from "@/routes/bids.routes";
import paymentsRouter from "@/routes/payments.routes";

// Import error handler
import { errorHandler } from "@/errors/handler";
import { securityHeaders } from "@/middleware/securityHeaders";

validateEnv();

// Настройка управления ресурсами
setResourceLimits();

// Периодическая проверка на утечку памяти
const leakCheckInterval: NodeJS.Timeout | undefined = setInterval(
  () => {
    if (checkMemoryLeak()) {
      logger.warn("Возможна утечка памяти");
    }
  },
  10 * 60 * 1000,
); // Каждые 10 минут

const app = express();
const httpServer = createServer(app);

/**
 * Валидирует PORT: исключает NaN, NaN-строки, вне диапазона 1-65535.
 * Возвращает safe number или бросает ошибку.
 */
function validatePort(input: string | number): number {
  const port = Number(input);
  if (!Number.isFinite(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${input} (должен быть integer 1-65535)`);
  }
  return port;
}

const PORT = validatePort(process.env.PORT ?? 5000);

export { prisma };

import { initSocket } from "@/config/socket";
const io = initSocket(httpServer, corsOriginHandler);
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
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
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

// Debug endpoint для диагностики подключения к БД
app.get("/api/debug/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS test`;
    res.json({ status: "connected", message: "База данных доступна" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", message });
  }
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Статические файлы (загруженные изображения)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// CSRF токен эндпоинт — фронтенд вызывает при старте
app.get("/api/csrf-token", generateCsrfToken, (_req, res) => {
  // generateCsrfToken middleware already set the cookie
  // Extract the token from the Set-Cookie header
  const setCookieHeader = res.getHeader("set-cookie");
  const csrfToken = Array.isArray(setCookieHeader)
    ? setCookieHeader
        .find((c) => c.startsWith("csrfToken"))
        ?.split(";")[0]
        .split("=")[1]
    : "";
  res.json({ csrfToken });
});

// Загрузка изображений
app.post("/api/upload", authMiddleware, upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
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

  socket.on("auction:join", (data: unknown) => {
    if (!data || typeof data !== "object" || typeof (data as Record<string, unknown>).auctionId !== "number") return;
    const { auctionId } = data as { auctionId: number };
    socket.join(`auction:${auctionId}`);
    logger.info(`Клиент ${socket.id} присоединился к аукциону:${auctionId}`);
  });

  socket.on("auction:leave", (auctionId: unknown) => {
    if (typeof auctionId !== "number") return;
    socket.leave(`auction:${auctionId}`);
    logger.info(`Клиент ${socket.id} покинул аукцион:${auctionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Клиент отключен: ${socket.id} (пользователь ${user?.id ?? "гость"})`);
  });
});

// Flag to prevent recursive shutdown calls — НЕ сбрасываем, т.к. процесс выходит
let isShuttingDown = false;
let shutdownFailed = false;
let shutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Graceful shutdown: закрывает соединения, очищает ресурсы, завершает процесс.
 * Гарантии:
 *   - isShuttingDown остаётся true до самого process.exit() — защищает от рекурсии.
 *   - Принудительный exit через таймаут происходит ПОСЛЕ завершения cleanup
 *     (если cleanup не уложится в 10с — kill происходит, но ресурсы уже закрыты).
 *   - isShuttingDown НЕ сбрасывается до process.exit() — предотвращает race-conditions.
 */
async function shutdown(signal: string) {
  if (isShuttingDown) {
    // Второй сигнал — планируем принудительный выход, но НЕ запускаем cleanup заново
    if (shutdownTimeout) return; // уже запланирован

    logger.info(`Получен повторный сигнал ${signal}. Планируется принудительное завершение.`);
    shutdownTimeout = setTimeout(() => {
      logger.warn("Принудительное завершение (повторный сигнал).");
      shutdownFailed = true;
      process.exit(130);
    }, 5000); // 5с на повторный сигнал — меньше, т.к. cleanup уже частично выполнен
    return;
  }

  isShuttingDown = true;

  // Таймер: если cleanup зависнет — kill через 10с
  shutdownTimeout = setTimeout(() => {
    logger.warn("Таймаут 10с превышен. Принудительное завершение.");
    shutdownFailed = true;
    process.exit(130);
  }, 10000);

  logger.info(`Получен сигнал ${signal}. Корректное завершение...`);

  try {
    // 1. Закрываем HTTP-соединения (новые запросы не принимаем)
    httpServer.closeAllConnections();
    httpServer.close();

    // 2. Останавливаем таймеры
    if (leakCheckInterval) {
      clearInterval(leakCheckInterval);
    }

    // 3. Закрываем БД
    await timeout(prisma.$disconnect(), 5000, "Таймаут отключения Prisma");
  } catch (error) {
    logger.error("Ошибка отключения от базы данных:", error);
    shutdownFailed = true;
  }

  // Таймер уже сработает сам, если мы не завершимся — но мы завершаемся ниже.
  if (shutdownTimeout) {
    clearTimeout(shutdownTimeout);
    shutdownTimeout = null;
  }

  // isShuttingDown НЕ сбрасываем — process.exit() завершит процесс.
  // Если бы мы хотели re-entrance (например, в тестах), сбросили бы здесь.

  if (shutdownFailed) {
    logger.error("Приложение завершено с ошибками");
    process.exit(1);
  }

  logger.info("Приложение успешно завершено");
  process.exit(0);
}

// Запуск сервера
httpServer.listen(PORT, async () => {
  logger.info(`Сервер запущен на http://localhost:${PORT}`);
  logger.info(`Среда: ${process.env.NODE_ENV}`);

  try {
    await prisma.$connect();
    logger.info("✅ Database connection established");

    // ✅ Auto-reconnect при ошибках pool
    pool.on("error", async (err) => {
      logger.error("❌ Pool error, attempting reconnect...", err.message);
      try {
        await prisma.$disconnect();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await prisma.$connect();
        logger.info("✅ Reconnected to database");
      } catch (reconnectErr) {
        logger.error("❌ Reconnect failed:", reconnectErr);
      }
    });
  } catch (error) {
    logger.error("❌ Error connecting to database:", error);
    process.exit(1);
  }
});

// Обработка ошибки EADDRINUSE
httpServer.on("error", async (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger.error(
      `Порт ${PORT} уже занят. Пожалуйста, остановите процесс, который использует этот порт, прежде чем продолжить.`,
    );
    logger.info(`Попытка найти и завершить процесс на порту ${PORT}...`);

    const spawnChild = (command: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
      return new Promise((resolve, reject) => {
        // No shell: use direct command execution for better security
        const child = spawn(command, args);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
        child.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
        child.on("close", (code) => {
          if (code === 0) resolve({ stdout, stderr });
          else reject(new Error(`Process exited with code ${code}: ${stderr}`));
        });
        child.on("error", reject);
      });
    };

    if (process.platform === "win32") {
      // PowerShell with native commands — PORT is validated as number, injection impossible
      try {
        const result = await spawnChild("powershell", [
          "-Command",
          `Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
        ]);
        const pids = result.stdout
          .trim()
          .split(/\r?\n/)
          .map((pid) => pid.trim())
          .filter((pid) => pid !== "" && pid !== "0");

        if (pids.length === 0) {
          // Check TIME_WAIT state
          try {
            const checkResult = await spawnChild("powershell", [
              "-Command",
              `Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Format-Table -AutoSize`,
            ]);
            if (checkResult.stdout.includes("TimeWait")) {
              logger.warn(
                `Порт ${PORT} находится в состоянии TIME_WAIT (ожидание освобождения после закрытия соединения).`,
              );
              logger.info("Это нормально, процесс уже завершился, но сокет еще не освободился системой.");
              logger.info("Пожалуйста, подождите 30-60 секунд и попробуйте снова.");
              process.exit(1);
            }
          } catch {
            /* ignore format errors */
          }
          logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
          logger.info("Это может быть связано с устаревшим сокетом или другой сетевой проблемой.");
          process.exit(1);
        } else {
          for (const pid of pids) {
            if (pid && !Number.isNaN(Number.parseInt(pid))) {
              logger.info(`Найден процесс с PID: ${pid}. Попытка завершить...`);
              try {
                await spawnChild("powershell", ["-Command", `Stop-Process -Id ${pid} -Force`]);
                logger.info(`Процесс ${pid} успешно завершен. Пожалуйста, перезапустите приложение.`);
                process.exit(1);
              } catch (killErr: unknown) {
                const msg = killErr instanceof Error ? killErr.message : String(killErr);
                logger.error(`Не удалось завершить процесс ${pid}: ${msg}`);
                logger.info("ВНИМАНИЕ: Может потребоваться запуск от имени администратора.");
                process.exit(1);
              }
              break;
            }
          }
          logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
          process.exit(1);
        }
      } catch (err: unknown) {
        logger.error("Не удалось выполнить команду PowerShell для поиска процесса:", err);
        logger.info("Пожалуйста, вручную проверьте процессы, использующие порт 5000.");
        process.exit(1);
      }
    } else {
      // Unix-like systems — lsof + kill через spawn
      try {
        const result = await spawnChild("lsof", ["-i", `:${PORT}`, "-t"]);
        const pid = result.stdout.trim();
        if (pid) {
          logger.info(`Найден процесс с PID: ${pid}. Попытка завершить...`);
          try {
            await spawnChild("kill", ["-9", pid]);
            logger.info(`Процесс ${pid} успешно завершен. Пожалуйста, перезапустите приложение.`);
            process.exit(1);
          } catch (killErr: unknown) {
            const msg = killErr instanceof Error ? killErr.message : String(killErr);
            logger.error(`Не удалось завершить процесс ${pid}: ${msg}`);
            logger.info("ВНИМАНИЕ: Может потребоваться sudo.");
            process.exit(1);
          }
        } else {
          logger.warn(`Процессы на порту ${PORT} не найдены, но порт все еще занят.`);
          logger.info("Это может быть связано с устаревшим сокетом или другой сетевой проблемой.");
          process.exit(1);
        }
      } catch (err: unknown) {
        logger.error("Не удалось найти процесс, использующий порт:", err);
        logger.info("Пожалуйста, вручную проверьте процессы, использующие порт 5000.");
        process.exit(1);
      }
    }
  } else {
    logger.error("Ошибка сервера:", error);
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
process.on("SIGBREAK", () => {
  if (!isShuttingDown) {
    logger.info("Получен сигнал SIGBREAK (Ctrl+C в Windows). Инициируется корректное завершение...");
    shutdown("SIGBREAK");
  } else {
    logger.info("Завершение уже в процессе. SIGBREAK игнорируется.");
  }
});

// Необработанные отклонения промисов
process.on("unhandledRejection", (reason: unknown) => {
  // Если unhandledRejection произошёл на фоне shutdown — не запускаем shutdown заново,
  // просто логируем, чтобы не получить каскад ошибок от закрытых соединений.
  if (isShuttingDown) {
    logger.error("Необработанное отклонение промиса во время завершения:", reason);
    return;
  }

  logger.error("Необработанное отклонение промиса:", reason);
  shutdown("unhandledRejection").catch(() => process.exit(1));
});

// Необработанные исключения (синхронные)
process.on("uncaughtException", (error: Error) => {
  if (!isShuttingDown) {
    logger.error("Необработанное исключение:", error);
    shutdown("uncaughtException").catch(() => process.exit(1));
  } else {
    logger.error("Необработанное исключение во время завершения:", error);
  }
});
