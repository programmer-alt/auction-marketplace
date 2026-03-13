import { prisma } from '../index';
import { io } from '../index';

interface GetAuctionsOptions {
  status?: string;
  sellerId?: number;
  page: number;
  limit: number;
}

interface CreateAuctionData {
  title: string;
  description?: string;
  imageUrl?: string;
  startingPrice: number;
  currency?: string;
  endsAt: string;
}

interface UpdateAuctionData {
  title?: string;
  description?: string;
  imageUrl?: string;
  startingPrice?: number;
  currency?: string;
  endsAt?: string;
}

export class AuctionsService {
  // Получение списка аукционов
  async getAuctions(options: GetAuctionsOptions) {
    const { status, sellerId, page, limit } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (sellerId) where.sellerId = sellerId;

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
      take: limit,
    });

    const total = await prisma.auction.count({ where });

    return {
      auctions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Получение конкретного аукциона
  async getAuctionById(id: number) {
    return await prisma.auction.findUnique({
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
  }

  // Создание нового аукциона
  async createAuction(data: CreateAuctionData, userId: number) {
    const { title, description, imageUrl, startingPrice, currency, endsAt } = data;

    const endsAtDate = new Date(endsAt);
    if (endsAtDate <= new Date()) {
      throw new Error('Дата окончания должна быть в будущем');
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
        sellerId: userId,
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

    return auction;
  }

  // Обновление аукциона
  async updateAuction(id: number, data: UpdateAuctionData, userId: number) {
    const updateData: any = { ...data };
    if (data.endsAt) {
      const endsAtDate = new Date(data.endsAt);
      if (endsAtDate <= new Date()) {
        throw new Error('Дата окончания должна быть в будущем');
      }
      updateData.endsAt = endsAtDate;
    }
    if (data.currency) {
      updateData.currency = data.currency.toLowerCase();
    }

    // Условное обновление для предотвращения гонки условий (TOCTOU)
    const result = await prisma.auction.updateMany({
      where: { id, sellerId: userId, status: 'ACTIVE' },
      data: updateData,
    });

    if (result.count === 0) {
      // Определяем точную причину ошибки, чтобы вернуть соответствующее сообщение
      const existingAuction = await prisma.auction.findUnique({ where: { id } });
      if (!existingAuction) {
        throw new Error('Аукцион не найден');
      }
      if (existingAuction.sellerId !== userId) {
        throw new Error('Недостаточно прав для редактирования этого аукциона');
      }
      if (existingAuction.status !== 'ACTIVE') {
        throw new Error('Можно редактировать только активные аукционы');
      }
      throw new Error('Не удалось обновить аукцион');
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

    return auction;
  }

  // Удаление аукциона
  async deleteAuction(id: number, userId: number) {
    const existingAuction = await prisma.auction.findUnique({
      where: { id },
    });

    if (!existingAuction) {
      throw new Error('Аукцион не найден');
    }

    if (existingAuction.sellerId !== userId) {
      throw new Error('Недостаточно прав для удаления этого аукциона');
    }

    await prisma.auction.delete({
      where: { id },
    });

    // Отправка уведомления об удалении через WebSocket только пользователям, подключённым к комнате данного аукциона
    io.to(`auction:${id}`).emit('auction:deleted', { id });
  }
}
