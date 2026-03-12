import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { type AuthRequest, authMiddleware } from '../middleware/auth';
import { io } from '../index';

const router = Router();

// Схемы валидации
// Схема для создания нового аукциона
const createAuctionSchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  imageUrl: z.string().url('Некорректный URL изображения').optional().or(z.literal('')),
  startingPrice: z.number().positive('Начальная цена должна быть положительной'),
  currency: z.string().length(3, 'Валюта должна быть трёхбуквенным кодом (например, USD, RUB)').optional(),
  endsAt: z.string().datetime('Некорректная дата окончания'),
});
 // Схема для обновления аукциона
const updateAuctionSchema = z.object({
  title: z.string().min(1, 'Название обязательно').optional(),
  description: z.string().optional(),
  imageUrl: z.string().url('Некорректный URL изображения').optional().or(z.literal('')).optional(),
  startingPrice: z.number().positive('Начальная цена должна быть положительной').optional(),
  currency: z.string().length(3, 'Валюта должна быть трёхбуквенным кодом (например, USD, RUB)').optional(),
  endsAt: z.string().datetime('Некорректная дата окончания').optional(),
});

// GET /api/auctions — получение списка аукционов с возможностью фильтрации по статусу и продавцу, а также пагинации
router.get('/', async (req, res) => {
  try {
    const { status, sellerId, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (sellerId) where.sellerId = parseInt(sellerId as string, 10);

    const auctions = await prisma.auction.findMany({
      where,
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
        winner: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    const total = await prisma.auction.count({ where });

    res.json({
      auctions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Ошибка получения списка аукционов:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/auctions/:id — получение подробной информации о конкретном аукционе, включая данные о продавце, победителе (если есть) и всех ставках, отсортированных по размеру
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Некорректный ID аукциона' });
      return;
    }

    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
        winner: {
          select: { id: true, email: true, name: true },
        },
        bids: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
          orderBy: { amount: 'desc' },
        },
      },
    });

    if (!auction) {
      res.status(404).json({ error: 'Аукцион не найден' });
      return;
    }

    res.json({ auction });
  } catch (error) {
    console.error('Ошибка получения аукциона:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auctions — создание нового аукциона (доступно только авторизованным пользователям)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, description, imageUrl, startingPrice, currency, endsAt } = createAuctionSchema.parse(req.body);

    const endsAtDate = new Date(endsAt);
    if (endsAtDate <= new Date()) {
      res.status(400).json({ error: 'Дата окончания должна быть в будущем' });
      return;
    }

    // Валюта по умолчанию — usd
    const auctionCurrency = currency ? currency.toLowerCase() : 'usd';

    const auction = await prisma.auction.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || null,
        startingPrice,
        currentPrice: startingPrice,
        currency: auctionCurrency,
        sellerId: req.user!.id,
        endsAt: endsAtDate,
        status: 'ACTIVE',
      },
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Отправка уведомления о создании нового аукциона через WebSocket всем подключённым клиентам
    io.emit('auction:new', auction);

    res.status(201).json({
      message: 'Аукцион успешно создан',
      auction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Ошибка создания аукциона:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/auctions/:id — обновление существующего аукциона (доступно только продавцу аукциона, при условии, что аукцион активен)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Некорректный ID аукциона' });
      return;
    }

    const data = updateAuctionSchema.parse(req.body);
    const updateData: any = { ...data };
    if (data.endsAt) {
      const endsAtDate = new Date(data.endsAt);
      if (endsAtDate <= new Date()) {
        res.status(400).json({ error: 'Дата окончания должна быть в будущем' });
        return;
      }
      updateData.endsAt = endsAtDate;
    }
    if (data.currency) {
      updateData.currency = data.currency.toLowerCase();
    }

    // Условное обновление для предотвращения гонки условий (TOCTOU): обновляем только если ID совпадает, пользователь является продавцом и статус аукциона — АКТИВНЫЙ
    const result = await prisma.auction.updateMany({
      where: { id, sellerId: req.user!.id, status: 'ACTIVE' },
      data: updateData,
    });

    if (result.count === 0) {
      // Определяем точную причину ошибки, чтобы вернуть соответствующее сообщение
      const existingAuction = await prisma.auction.findUnique({ where: { id } });
      if (!existingAuction) {
        res.status(404).json({ error: 'Аукцион не найден' });
        return;
      }
      if (existingAuction.sellerId !== req.user!.id) {
        res.status(403).json({ error: 'Недостаточно прав для редактирования этого аукциона' });
        return;
      }
      if (existingAuction.status !== 'ACTIVE') {
        res.status(400).json({ error: 'Можно редактировать только активные аукционы' });
        return;
      }

      // Fallback
      res.status(409).json({ error: 'Не удалось обновить аукцион' });
      return;
    }

    // Получение обновлённого аукциона с информацией о продавце
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Отправка уведомления об обновлении через WebSocket только пользователям, подключённым к комнате данного аукциона
    io.to(`auction:${id}`).emit('auction:updated', auction);

    res.json({
      message: 'Аукцион успешно обновлён',
      auction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Ошибка обновления аукциона:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/auctions/:id — удаление аукциона (доступно только продавцу)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Некорректный ID аукциона' });
      return;
    }

    const existingAuction = await prisma.auction.findUnique({
      where: { id },
    });

    if (!existingAuction) {
      res.status(404).json({ error: 'Аукцион не найден' });
      return;
    }

    if (existingAuction.sellerId !== req.user!.id) {
      res.status(403).json({ error: 'Недостаточно прав для удаления этого аукциона' });
      return;
    }

    await prisma.auction.delete({
      where: { id },
    });

    // Отправка уведомления об удалении через WebSocket только пользователям, подключённым к комнате данного аукциона
    io.to(`auction:${id}`).emit('auction:deleted', { id });

    res.json({ message: 'Аукцион успешно удалён' });
  } catch (error) {
    console.error('Ошибка удаления аукциона:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;