import { prisma } from '../index';

export class PaymentsRepository {
  // Создание платежа
  async create(data: any) {
    return await prisma.payment.create({
      data,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true, currency: true },
        },
      },
    });
  }

  // Поиск платежа по stripePaymentId
  async findByStripePaymentId(stripePaymentId: string) {
    return await prisma.payment.findFirst({
      where: { stripePaymentId },
    });
  }

  // Обновление платежа
  async update(id: number, data: any) {
    return await prisma.payment.update({
      where: { id },
      data,
    });
  }

  // Получение списка платежей пользователя
  async findByUserId(userId: number, skip: number, take: number) {
    return await prisma.payment.findMany({
      where: { userId },
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            seller: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  // Подсчет количества платежей пользователя
  async countByUserId(userId: number) {
    return await prisma.payment.count({ where: { userId } });
  }

  // Получение платежа по ID
  async findById(id: number) {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true, currency: true },
        },
      },
    });
  }

  // Удаление платежа
  async delete(id: number) {
    return await prisma.payment.delete({
      where: { id },
    });
  }
}
