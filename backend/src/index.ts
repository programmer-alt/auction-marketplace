import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Routes
import authRouter from './routes/auth.js';

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

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Auction Marketplace API', version: '1.0.0' });
});

app.use('/api/auth', authRouter);

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
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Завершение работы...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Сервер закрыт');
    process.exit(0);
  });
});
