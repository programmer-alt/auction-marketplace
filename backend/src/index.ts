import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import Redis from 'ioredis';
import { rateLimit } from './middleware/rateLimit';

// Routes
import authRouter from './routes/auth.routes';
import auctionsRouter from './routes/auctions.routes';
import bidsRouter from './routes/bids.routes';
import paymentsRouter from './routes/payments.routes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Prisma 7: Создаём пул подключений к PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prisma 7: Создаём адаптер для PostgreSQL
const adapter = new PrismaPg(pool);

// Prisma клиент с адаптером
export const prisma = new PrismaClient({ adapter });

// Redis клиент для адаптера
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.error('Redis pub client error:', err));
subClient.on('error', (err) => console.error('Redis sub client error:', err));

// Socket.io с Redis адаптером
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  adapter: createAdapter(pubClient, subClient),
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook 
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json());

// Rate limiting middleware (применяется ко всем маршрутам, кроме health)

app.use(rateLimit);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Auction Marketplace API', version: '1.0.0' });
});

app.use('/api/auth', authRouter);
app.use('/api/auctions', auctionsRouter);
app.use('/api/auctions', bidsRouter); // ставки находятся под /api/auctions/:auctionId/bids
app.use('/api/payments', paymentsRouter);

// Socket.io подключение
io.on('connection', (socket) => {
  console.log(`⚡ Клиент соединился: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Клиент отключился: ${socket.id}`);
  });

  // Присоединиться к комнате аукциона
  socket.on('auction:join', (auctionId: number) => {
    socket.join(`auction:${auctionId}`);
    console.log(`Клиент ${socket.id} присоединился к аукциону:${auctionId}`);
  });

  // Покинуть комнату аукциона
  socket.on('auction:leave', (auctionId: number) => {
    socket.leave(`auction:${auctionId}`);
    console.log(`Клиент ${socket.id} покинул аукцион:${auctionId}`);
  });
});

// Экспорт io для использования в роутах
export { io };

// Функция корректного завершения работы
async function shutdown(signal: string) {
  console.log(`\n🛑 Получен сигнал ${signal}. Завершение работы...`);

  // Даём серверу 5 секунд на корректное закрытие
  const shutdownTimeout = setTimeout(() => {
    console.warn('⚠️ Принудительное завершение из-за таймаута');
    process.exit(1);
  }, 5000);

  httpServer.close(async () => {
    clearTimeout(shutdownTimeout);
    // Закрываем Redis клиенты
    try {
      await pubClient.quit();
      await subClient.quit();
      console.log('✅ Redis подключения закрыты');
    } catch (error) {
      console.warn('⚠️ Не удалось корректно закрыть Redis подключения:', error);
    }

    // Закрываем подключение Prisma и пул PostgreSQL
    try {
      await prisma.$disconnect();
      await pool.end();
      console.log('✅ Подключения к БД закрыты');
    } catch (error) {
      console.warn('⚠️ Не удалось корректно закрыть подключения к БД:', error);
    }

    console.log('✅ Все подключения закрыты');
    process.exit(0);
  });

  // Принудительно закрываем все соединения через 1 секунду
  setTimeout(() => {
    httpServer.closeAllConnections();
  }, 1000);
}

// Запуск сервера
httpServer.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📝 Окружение: ${process.env.NODE_ENV}`);

  // Проверка подключения к БД
  try {
    await prisma.$connect();
    console.log('📦 База данных подключена');
  } catch (error) {
    console.error('❌ Подключение к базе данных не удалось:', error);
  }

  // Проверка подключения к Redis
  try {
    await pubClient.ping();
    console.log('🔗 Redis подключен (облачный)');
  } catch (error) {
    console.error('❌ Подключение к Redis не удалось:', error);
  }

  // Планирование завершения существующих активных аукционов
  const { scheduleExistingAuctions } = await import('./queues/auctionCompletionQueue');
  await scheduleExistingAuctions();
});

// Graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
