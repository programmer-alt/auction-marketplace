import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Routes
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Prisma 7: Создаём адаптер для PostgreSQL
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

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
  console.log(`⚡ Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });

  // Присоединиться к комнате аукциона
  socket.on('auction:join', (auctionId: number) => {
    socket.join(`auction:${auctionId}`);
    console.log(`Client ${socket.id} joined auction:${auctionId}`);
  });

  // Покинуть комнату аукциона
  socket.on('auction:leave', (auctionId: number) => {
    socket.leave(`auction:${auctionId}`);
    console.log(`Client ${socket.id} left auction:${auctionId}`);
  });
});

// Экспорт io для использования в роутах
export { io };

// Запуск сервера
httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);

  // Проверка подключения к БД
  try {
    await prisma.$connect();
    console.log('📦 Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
