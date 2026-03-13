import { prisma } from '../index';

export class UsersRepository {
  // Поиск пользователя по email
  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  // Поиск пользователя по ID
  async findById(id: number) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        balance: true,
        createdAt: true,
      },
    });
  }

  // Создание пользователя
  async create(data: any) {
    return await prisma.user.create({
      data,
    });
  }

  // Обновление пользователя
  async update(id: number, data: any) {
    return await prisma.user.update({
      where: { id },
      data,
    });
  }

  // Удаление пользователя
  async delete(id: number) {
    return await prisma.user.delete({
      where: { id },
    });
  }
}
