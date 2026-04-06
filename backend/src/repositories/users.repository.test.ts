import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, UserRole } from "@prisma/client";
import * as usersRepo from "./users.repository";

// Мокаем PrismaClient
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserDelete = vi.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
    delete: mockUserDelete,
  },
} as any;

describe("Users Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserByEmail", () => {
    it("должен вернуть пользователя по email", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed",
        role: UserRole.USER,
        balance: new Prisma.Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await usersRepo.getUserByEmail(
        mockPrisma,
        "test@example.com",
      );

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(result).toEqual(mockUser);
    });

    it("должен вернуть null, если пользователь не найден", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await usersRepo.getUserByEmail(
        mockPrisma,
        "nonexistent@example.com",
      );

      expect(result).toBeNull();
    });
  });

  describe("getUserById", () => {
    it("должен вернуть пользователя по ID", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        balance: new Prisma.Decimal(100),
        createdAt: new Date(),
      };
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await usersRepo.getUserById(mockPrisma, 1);

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          name: true,
          balance: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("должен вернуть null, если пользователь не найден", async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await usersRepo.getUserById(mockPrisma, 999);

      expect(result).toBeNull();
    });
  });

  describe("createUser", () => {
    it("должен создать нового пользователя", async () => {
      const userData = {
        email: "new@example.com",
        password: "hashed-password",
        name: "New User",
      };
      const mockCreated = {
        id: 1,
        ...userData,
        role: UserRole.USER,
        balance: new Prisma.Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserCreate.mockResolvedValue(mockCreated);

      const result = await usersRepo.createUser(mockPrisma, userData);

      expect(mockUserCreate).toHaveBeenCalledWith({ data: userData });
      expect(result).toEqual(mockCreated);
    });
  });

  describe("updateUser", () => {
    it("должен обновить пользователя", async () => {
      const mockUpdated = {
        id: 1,
        email: "test@example.com",
        name: "Updated Name",
        balance: new Prisma.Decimal(200),
      };
      mockUserUpdate.mockResolvedValue(mockUpdated);

      const result = await usersRepo.updateUser(mockPrisma, 1, {
        name: "Updated Name",
      });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: "Updated Name" },
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("deleteUser", () => {
    it("должен удалить пользователя", async () => {
      const mockDeleted = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed",
        role: UserRole.USER,
        balance: new Prisma.Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserDelete.mockResolvedValue(mockDeleted);

      const result = await usersRepo.deleteUser(mockPrisma, 1);

      expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockDeleted);
    });
  });
});
