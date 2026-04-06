import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Моки (hoisted чтобы были доступны в vi.mock) ──────────────────────────────
const {
  mockAdd,
  mockGetJob,
  mockProcess,
  mockAuctionUpdate,
  mockAuctionFindMany,
  mockAuctionFindUnique,
  mockAuctionFindSelect,
  mockBidFindFirst,
  mockRoomEmit,
  mockGlobalEmit,
  mockTo,
  mockAuctionUpdateFallback,
} = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetJob: vi.fn(),
  mockProcess: vi.fn(),
  mockAuctionUpdate: vi.fn(),
  mockAuctionFindUnique: vi.fn(),
  mockAuctionFindMany: vi.fn(),
  mockAuctionFindSelect: vi.fn(),
  mockBidFindFirst: vi.fn(),
  mockRoomEmit: vi.fn(),
  mockGlobalEmit: vi.fn(),
  mockTo: vi.fn().mockReturnValue({ emit: vi.fn() }),
  mockAuctionUpdateFallback: vi.fn(),
}));

// Мок Bull Queue
vi.mock("bull", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      getJob: mockGetJob,
      process: mockProcess,
    })),
  };
});

// Мок Prisma
vi.mock("../config/db", () => ({
  prisma: {
    auction: {
      update: mockAuctionUpdate,
      findMany: mockAuctionFindMany,
      findUnique: mockAuctionFindUnique,
    },
    bid: {
      findFirst: mockBidFindFirst,
    },
  },
}));

// Мок Socket.io
vi.mock("../config/socket", () => ({
  getIo: vi.fn().mockReturnValue({
    to: mockTo,
    emit: mockGlobalEmit,
  }),
}));

// ─── Импорт после моков ────────────────────────────────────────────────────────
const {
  scheduleAuctionCompletion,
  removeScheduledAuctionCompletion,
  scheduleExistingAuctions,
} = await import("./auctionCompletionQueue");

// Получаем process handler после импорта (он регистрируется при импорте модуля)
const processHandler = mockProcess.mock.calls[0]?.[0];

describe("auctionCompletionQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Восстанавливаем поведения после clearAllMocks
    mockTo.mockReturnValue({ emit: mockRoomEmit });
    // Дефолтные моки
    mockGetJob.mockResolvedValue(null); // нет существующих задач
    mockAuctionFindUnique.mockResolvedValue({ status: "ACTIVE" });
    mockAuctionUpdate.mockResolvedValue({
      id: 1,
      status: "COMPLETED",
      winner: null,
      winnerId: null,
      currentPrice: 100,
      endsAt: new Date(),
      title: "Test",
      sellerId: 1,
    });
    mockBidFindFirst.mockResolvedValue(null);
  });

  // ─── scheduleAuctionCompletion ───────────────────────────────────────────────

  describe("scheduleAuctionCompletion", () => {
    it("должен добавить задачу с правильным delay и jobId если endsAt в будущем", async () => {
      const auctionId = 1;
      const endsAt = new Date(Date.now() + 60_000);

      await scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledOnce();
      const [data, options] = mockAdd.mock.calls[0];
      expect(data).toEqual({ auctionId });
      expect(options.jobId).toBe("auction:1");
      expect(options.delay).toBeGreaterThan(0);
      expect(options.delay).toBeLessThanOrEqual(60_000);
    });

    it("должен добавить задачу с delay: 0 если endsAt в прошлом", async () => {
      const auctionId = 2;
      const endsAt = new Date(Date.now() - 10_000);

      await scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledWith(
        { auctionId },
        { delay: 0, jobId: "auction:2" },
      );
    });

    it("должен добавить задачу с delay: 0 если endsAt прямо сейчас", async () => {
      const auctionId = 3;
      const endsAt = new Date(Date.now());

      await scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledWith(
        { auctionId },
        { delay: 0, jobId: "auction:3" },
      );
    });

    it("jobId всегда формируется как auction:${auctionId}", async () => {
      mockAdd.mockClear();
      await scheduleAuctionCompletion(42, new Date(Date.now() + 5000));

      const [, options] = mockAdd.mock.calls[0];
      expect(options.jobId).toBe("auction:42");
    });
  });

  // ─── removeScheduledAuctionCompletion ────────────────────────────────────────

  describe("removeScheduledAuctionCompletion", () => {
    it("должен вызвать job.remove() если задача существует", async () => {
      const mockRemove = vi.fn();
      mockGetJob.mockResolvedValue({ remove: mockRemove });

      const result = await removeScheduledAuctionCompletion(1);

      expect(mockGetJob).toHaveBeenCalledWith("auction:1");
      expect(mockRemove).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it("не должен падать если задача не найдена", async () => {
      mockGetJob.mockResolvedValue(null);

      const result = await removeScheduledAuctionCompletion(99);

      expect(result).toBe(false);
    });
  });

  // ─── scheduleExistingAuctions ────────────────────────────────────────────────

  describe("scheduleExistingAuctions", () => {
    it("должен запланировать завершение для каждого активного аукциона", async () => {
      const endsAt1 = new Date(Date.now() + 30_000);
      const endsAt2 = new Date(Date.now() + 60_000);

      mockAuctionFindMany.mockResolvedValue([
        { id: 1, endsAt: endsAt1 },
        { id: 2, endsAt: endsAt2 },
      ]);

      await scheduleExistingAuctions();

      expect(mockAuctionFindMany).toHaveBeenCalledWith({
        where: { status: "ACTIVE" },
        select: { id: true, endsAt: true },
        take: 100,
        skip: 0,
        orderBy: { endsAt: "asc" },
      });
      expect(mockAdd).toHaveBeenCalledTimes(2);
      expect(mockAdd.mock.calls[0][0]).toEqual({ auctionId: 1 });
      expect(mockAdd.mock.calls[1][0]).toEqual({ auctionId: 2 });
    });

    it("не должен вызывать add если активных аукционов нет", async () => {
      mockAuctionFindMany.mockResolvedValue([]);

      await scheduleExistingAuctions();

      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  // ─── process handler ─────────────────────────────────────────────────────────

  describe("process handler", () => {
    it("должен обновить статус аукциона на COMPLETED", async () => {
      mockAuctionFindUnique.mockResolvedValue({ status: "ACTIVE" });
      mockAuctionUpdate.mockResolvedValue({
        id: 1,
        status: "COMPLETED",
        winner: null,
        winnerId: null,
        currentPrice: 100,
        endsAt: new Date(),
        title: "Test",
        sellerId: 1,
      });

      await processHandler({ data: { auctionId: 1 } });

      expect(mockAuctionUpdate).toHaveBeenCalledWith({
        where: { id: 1, status: "ACTIVE" },
        data: { status: "COMPLETED" },
        include: { winner: { select: { id: true, email: true } } },
      });
    });

    it("должен отправить auction:ended в комнату аукциона", async () => {
      mockAuctionFindUnique.mockResolvedValue({ status: "ACTIVE" });
      mockAuctionUpdate.mockResolvedValue({
        id: 1,
        status: "COMPLETED",
        winner: null,
        winnerId: 2,
        currentPrice: 100,
        endsAt: new Date(),
        title: "Test",
        sellerId: 1,
      });

      await processHandler({ data: { auctionId: 1 } });

      expect(mockTo).toHaveBeenCalledWith("auction:1");
      expect(mockRoomEmit).toHaveBeenCalledWith(
        "auction:ended",
        expect.objectContaining({ auctionId: 1, status: "COMPLETED" }),
      );
    });

    it("должен отправить auction:updated глобально", async () => {
      mockAuctionFindUnique.mockResolvedValue({ status: "ACTIVE" });
      mockAuctionUpdate.mockResolvedValue({
        id: 1,
        status: "COMPLETED",
        winner: null,
        winnerId: 2,
        currentPrice: 100,
        endsAt: new Date(),
        title: "Test",
        sellerId: 1,
      });

      await processHandler({ data: { auctionId: 1 } });

      expect(mockGlobalEmit).toHaveBeenCalledWith(
        "auction:updated",
        expect.objectContaining({ auctionId: 1, status: "COMPLETED" }),
      );
    });

    it("должен пробросить ошибку если prisma упала (Bull сделает retry)", async () => {
      mockAuctionFindUnique.mockResolvedValue({ status: "ACTIVE" });
      mockAuctionUpdate.mockRejectedValue(new Error("DB error"));

      await expect(processHandler({ data: { auctionId: 1 } })).rejects.toThrow(
        "DB error",
      );
    });

    it("должен пропустить если аукцион уже не ACTIVE", async () => {
      mockAuctionFindUnique.mockResolvedValue({ status: "COMPLETED" });

      await processHandler({ data: { auctionId: 1 } });

      expect(mockAuctionUpdate).not.toHaveBeenCalled();
    });

    it("должен пропустить если аукцион не найден", async () => {
      mockAuctionFindUnique.mockResolvedValue(null);

      await processHandler({ data: { auctionId: 999 } });

      expect(mockAuctionUpdate).not.toHaveBeenCalled();
    });
  });
});
