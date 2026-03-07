import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';

const router = Router();

// Схема валидации для создания ставки
const createBidSchema = z.object({
  amount: z.number().positive('Сумма ставки должна быть положительной'),
});

// POST /api/auctions/:auctionId/bids — размещение ставки
router.post('/:auctionId/bids', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);
    if (isNaN(auctionId)) {
      res.status(400).json({ error: 'Некорректный ID аукциона' });
      return;
    }

    const { amount } = createBidSchema.parse(req.body);

    // Получаем аукцион с текущей ценой
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: true,
        winner: true,
      },
    });

    if (!auction) {
      res.status(404).json({ error: 'Аукцион не найден' });
      return;
    }

    // Проверка статуса аукциона
    if (auction.status !== 'ACTIVE') {
      res.status(400).json({ error: 'Аукцион не активен' });
      return;
    }

    // Проверка, что аукцион ещё не завершился
    if (auction.endsAt < new Date()) {
      res.status(400).json({ error: 'Аукцион уже завершён' });
      return;
    }

    // Проверка, что ставка выше текущей цены
    if (amount <= auction.currentPrice.toNumber()) {
      res.status(400).json({ error: 'Ставка должна быть выше текущей цены' });
      return;
    }

    // Проверка, что пользователь не является продавцом
    if (auction.sellerId === req.user!.id) {
      res.status(400).json({ error: 'Вы не можете делать ставки на свои аукционы' });
      return;
    }

    // Создание ставки
    const bid = await prisma.bid.create({
      data: {
        auctionId,
        userId: req.user!.id,
        amount,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true },
        },
      },
    });

    // Обновление текущей цены аукциона
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
        winner: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Уведомление через WebSocket о новой ставке
    io.to(`auction:${auctionId}`).emit('bid:new', {
      bid,
      auction: updatedAuction,
    });

    res.status(201).json({
      message: 'Ставка успешно размещена',
      bid,
      auction: updatedAuction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Ошибка размещения ставки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/auctions/:auctionId/bids — история ставок по аукциону
router.get('/:auctionId/bids', async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);
    if (isNaN(auctionId)) {
      res.status(400).json({ error: 'Некорректный ID аукциона' });
      return;
    }

    const { page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Проверяем существование аукциона
    const auctionExists = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true },
    });

    if (!auctionExists) {
      res.status(404).json({ error: 'Аукцион не найден' });
      return;
    }

    const bids = await prisma.bid.findMany({
      where: { auctionId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { amount: 'desc' },
      skip,
      take: limitNum,
    });

    const total = await prisma.bid.count({ where: { auctionId } });

    res.json({
      bids,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Ошибка получения истории ставок:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;