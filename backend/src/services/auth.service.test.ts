import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authService from "./auth.service";

// Mocks created inline and accessed via module imports
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
  },
}));
vi.mock("../config/jwt", () => ({
  getJwtSecret: vi.fn(),
  getJwtAccessExpiresIn: vi.fn(),
  getJwtRefreshExpiresIn: vi.fn(),
  parseDurationToSeconds: vi.fn(),
  maskEmail: vi.fn(),
}));
vi.mock("../repositories/users.repository", () => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
}));
vi.mock("../config/db", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Import mocked modules to access their functions
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";
import { getJwtAccessExpiresIn, getJwtRefreshExpiresIn, getJwtSecret, maskEmail } from "../config/jwt";
import { createUser, getUserByEmail, getUserById } from "../repositories/users.repository";

// Cast to proper function types
const mockBcryptHash = bcrypt.hash as ReturnType<typeof vi.fn>;
const mockBcryptCompare = bcrypt.compare as ReturnType<typeof vi.fn>;
const mockJwtSign = jwt.sign as ReturnType<typeof vi.fn>;
const mockJwtVerify = jwt.verify as ReturnType<typeof vi.fn>;
const _mockJwtDecode = jwt.decode as ReturnType<typeof vi.fn>;

const mockGetUserByEmail = getUserByEmail as ReturnType<typeof vi.fn>;
const mockCreateUser = createUser as ReturnType<typeof vi.fn>;
const mockGetUserById = getUserById as ReturnType<typeof vi.fn>;
const mockGetJwtSecret = getJwtSecret as ReturnType<typeof vi.fn>;
const mockGetJwtAccessExpiresIn = getJwtAccessExpiresIn as ReturnType<typeof vi.fn>;
const mockGetJwtRefreshExpiresIn = getJwtRefreshExpiresIn as ReturnType<typeof vi.fn>;
const mockMaskEmail = maskEmail as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaUserUpdate = vi.mocked((prisma as any).user.update);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaUserFindUnique = vi.mocked((prisma as any).user.findUnique);

// Type for mock user, corresponding to the User model from Prisma
interface MockUser {
  id: number;
  email: string;
  name: string | null;
  password: string;
  role: string;
  balance: any;
  stripeAccountId: string | null;
  tokenVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Type for mock user returned from getUserById (limited select)
interface MockUserSelect {
  id: number;
  email: string;
  name: string | null;
  balance: any;
  createdAt: Date;
}

describe("Auth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJwtSecret.mockReturnValue("test-secret");
    mockGetJwtAccessExpiresIn.mockReturnValue("1h");
    mockGetJwtRefreshExpiresIn.mockReturnValue("7d");
    mockMaskEmail.mockImplementation((email: string) => `***@${email.split("@")[1]}`);
    mockBcryptHash.mockResolvedValue("hashed-password");
    mockBcryptCompare.mockResolvedValue(true);
    mockPrismaUserUpdate.mockResolvedValue({ tokenVersion: 1 });
    mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 0 });
  });

  describe("register", () => {
    it("should successfully register a new user", async () => {
      mockGetUserByEmail.mockResolvedValue(null);
      const mockNewUser: MockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        role: "USER",
        balance: 0,
        stripeAccountId: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreateUser.mockResolvedValue(mockNewUser);
      mockJwtSign.mockImplementationOnce(() => "fake-access-token").mockImplementationOnce(() => "fake-refresh-token");

      const result = await authService.register("test@example.com", "password123", "Test User");

      expect(mockGetUserByEmail).toHaveBeenCalled();
      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockJwtSign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        user: {
          id: 1,
          email: "test@example.com",
          name: "Test User",
        },
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      });
    });

    it("should throw an error if user already exists", async () => {
      const mockExistingUser: MockUser = {
        id: 1,
        email: "test@example.com",
        name: "Existing User",
        password: "hashed",
        role: "USER",
        balance: 0,
        stripeAccountId: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserByEmail.mockResolvedValue(mockExistingUser);

      await expect(authService.register("test@example.com", "password123", "Test User")).rejects.toThrow(
        "Пользователь уже существует",
      );
    });

    it("should register without name (optional)", async () => {
      mockGetUserByEmail.mockResolvedValue(null);
      const mockNewUser: MockUser = {
        id: 1,
        email: "test@example.com",
        name: null,
        password: "hashed-password",
        role: "USER",
        balance: 0,
        stripeAccountId: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreateUser.mockResolvedValue(mockNewUser);
      mockJwtSign.mockImplementationOnce(() => "fake-access-token").mockImplementationOnce(() => "fake-refresh-token");

      const result = await authService.register("test@example.com", "password123");

      expect(mockCreateUser).toHaveBeenCalled();
      expect(result.user.name).toBeNull();
    });
  });

  describe("login", () => {
    it("should successfully log in with correct credentials", async () => {
      const mockUser: MockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        role: "USER",
        balance: 100,
        stripeAccountId: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockJwtSign.mockImplementationOnce(() => "fake-access-token").mockImplementationOnce(() => "fake-refresh-token");

      const result = await authService.login("test@example.com", "password123");

      expect(mockGetUserByEmail).toHaveBeenCalled();
      expect(mockBcryptCompare).toHaveBeenCalledWith("password123", "hashed-password");
      expect(mockJwtSign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        user: {
          id: 1,
          email: "test@example.com",
          name: "Test User",
          balance: 100,
        },
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      });
    });

    it("should throw an error if user is not found", async () => {
      mockGetUserByEmail.mockResolvedValue(null);

      await expect(authService.login("nonexistent@example.com", "password123")).rejects.toThrow(
        "Неверные учетные данные",
      );
    });

    it("should throw an error if password is invalid", async () => {
      const mockUser: MockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        role: "USER",
        balance: 0,
        stripeAccountId: null,
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(authService.login("test@example.com", "wrongpassword")).rejects.toThrow("Неверные учетные данные");
    });
  });

  describe("refresh", () => {
    it("should throw an error if refresh token verification fails", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error();
      });

      await expect(authService.refresh("invalid-token")).rejects.toThrow("Неверный refresh токен");
    });

    it("should throw an error if token type is not 'refresh'", async () => {
      const mockPayload = { id: 1, email: "test@example.com", role: "USER", type: "access" };
      mockJwtVerify.mockReturnValue(mockPayload);

      await expect(authService.refresh("invalid-type-token")).rejects.toThrow("Токен не является refresh токеном");
    });

    it("should successfully refresh tokens", async () => {
      const oldRefreshToken = "old-refresh-token";
      const newRefreshToken = "new-refresh-token";
      const newAccessToken = "new-access-token";
      const userId = 1;
      const email = "test@example.com";
      const role = "USER";

      const mockPayload = { id: userId, email, role, type: "refresh", tokenVersion: 0, exp: 1234567890 };
      mockJwtVerify.mockReturnValue(mockPayload);
      mockJwtSign.mockImplementationOnce(() => newAccessToken).mockImplementationOnce(() => newRefreshToken);

      const result = await authService.refresh(oldRefreshToken);

      expect(mockJwtVerify).toHaveBeenCalledWith(oldRefreshToken, "test-secret");
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    });

    it("should throw revoked error if user tokenVersion was incremented (after logout)", async () => {
      const mockPayload = {
        id: 1,
        email: "test@example.com",
        role: "USER",
        type: "refresh",
        tokenVersion: 0,
        exp: 1234567890,
      };
      mockJwtVerify.mockReturnValue(mockPayload);
      mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 1 }); // incremented after logout

      await expect(authService.refresh("old-refresh-token")).rejects.toThrow("Refresh token revoked");
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { tokenVersion: true },
      });
    });

    it("should throw revoked error if user not found", async () => {
      const mockPayload = {
        id: 999,
        email: "test@example.com",
        role: "USER",
        type: "refresh",
        tokenVersion: 0,
        exp: 1234567890,
      };
      mockJwtVerify.mockReturnValue(mockPayload);
      mockPrismaUserFindUnique.mockResolvedValue(null);

      await expect(authService.refresh("old-refresh-token")).rejects.toThrow("Refresh token revoked");
    });
  });

  describe("logout", () => {
    it("should increment tokenVersion and execute without error", async () => {
      mockPrismaUserUpdate.mockResolvedValue({ tokenVersion: 1 });

      await expect(authService.logout(1)).resolves.toBeUndefined();
      expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });

  describe("getCurrentUser", () => {
    it("should return user by ID", async () => {
      const mockUser: MockUserSelect = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        balance: 0,
        createdAt: new Date(),
      };
      mockGetUserById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(1);

      expect(mockGetUserById).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });
});
