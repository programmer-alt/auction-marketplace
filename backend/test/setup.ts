import { vi } from "vitest";
import { beforeEach, afterEach } from "vitest";

// Очистка после каждого теста
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Глобальная настройка
beforeEach(() => {
  vi.mock("../src/index.ts", () => ({
    prisma: {
      auction: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      bid: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
    io: {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    },
  }));
});
