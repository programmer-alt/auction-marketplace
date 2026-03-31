import { describe, it, expect, vi, beforeEach } from "vitest";

// Мок Bull Queue
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockProcess = vi.fn();

vi.mock("bull", () => {
  function MockQueue() {
    return { add: mockAdd, getJob: mockGetJob, process: mockProcess };
  }
  MockQueue.prototype = {};
  return { default: MockQueue };
});

// Мок Prisma
const mockAuctionUpdate = vi.fn();
const mockAuctionFindMany = vi.fn();

vi.mock("../config/db", () => ({
  prisma: {
    auction: {
      update: mockAuctionUpdate,
      findMany: mockAuctionFindMany,
    },
  },
}));

// Мок Socket.io
const mockRoomEmit = vi.fn();
const mockGlobalEmit = vi.fn();
const mockTo = vi.fn().mockReturnValue({ emit: mockRoomEmit });

vi.mock("../config/socket", () => ({
  getIo: vi.fn().mockReturnValue({
    to: mockTo,
    emit: mockGlobalEmit,
  }),
}));

// Импорт после моков
const { scheduleAuctionCompletion, removeScheduledAuctionCompletion, scheduleExistingAuctions } =
  await import("./auctionCompletionQueue");

// Сохраняем обработчик сразу после импорта — до того как clearAllMocks его сотрёт
const processHandler = mockProcess.mock.calls[0][0];

describe("auctionCompletionQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTo.mockReturnValue({ emit: mockRoomEmit });
  });

  // ─── scheduleAuctionCompletion ───────────────────────────────────────────────

  describe("scheduleAuctionCompletion", () => {
    it("должен добавить задачу с правильным delay и jobId если endsAt в будущем", () => {
      const auctionId = 1;
      const endsAt = new Date(Date.now() + 60_000); // через 1 минуту

      scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledOnce();
      const [data, options] = mockAdd.mock.calls[0];
      expect(data).toEqual({ auctionId });
      expect(options.jobId).toBe("auction:1");
      expect(options.delay).toBeGreaterThan(0);
      expect(options.delay).toBeLessThanOrEqual(60_000);
    });

    it("должен добавить задачу с delay: 0 если endsAt в прошлом", () => {
      const auctionId = 2;
      const endsAt = new Date(Date.now() - 10_000); // 10 секунд назад

      scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledWith(
        { auctionId },
        { delay: 0, jobId: "auction:2" },
      );
    });

    it("должен добавить задачу с delay: 0 если endsAt прямо сейчас", () => {
      const auctionId = 3;
      const endsAt = new Date(Date.now());

      scheduleAuctionCompletion(auctionId, endsAt);

      expect(mockAdd).toHaveBeenCalledWith(
        { auctionId },
        { delay: 0, jobId: "auction:3" },
      );
    });

    it("jobId всегда формируется как auction:${auctionId}", () => {
      scheduleAuctionCompletion(42, new Date(Date.now() + 5000));

      const [, options] = mockAdd.mock.calls[0];
      expect(options.jobId).toBe("auction:42");
    });
  });

  // ─── removeScheduledAuctionCompletion ────────────────────────────────────────

  describe("removeScheduledAuctionCompletion", () => {
    it("должен вызвать job.remove() если задача существует", async () => {
      const mockRemove = vi.fn();
      mockGetJob.mockResolvedValue({ remove: mockRemove });

      await removeScheduledAuctionCompletion(1);

      expect(mockGetJob).toHaveBeenCalledWith("auction:1");
      expect(mockRemove).toHaveBeenCalledOnce();
    });

    it("не должен падать если задача не найдена", async () => {
      mockGetJob.mockResolvedValue(null);

      await expect(removeScheduledAuctionCompletion(99)).resolves.toBeUndefined();
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
        where: {
          status: "ACTIVE",
          endsAt: { gt: expect.any(Date) },
        },
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
    async function runProcessHandler(auctionId: number) {
      return processHandler({ data: { auctionId } });
    }

    it("должен обновить статус аукциона на COMPLETED", async () => {
      const auction = { id: 1, status: "COMPLETED", seller: {}, winner: {} };
      mockAuctionUpdate.mockResolvedValue(auction);

      await runProcessHandler(1);

      expect(mockAuctionUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "COMPLETED" },
        include: { seller: true, winner: true },
      });
    });

    it("должен отправить auction:ended в комнату аукциона", async () => {
      const auction = { id: 1, status: "COMPLETED", seller: {}, winner: {} };
      mockAuctionUpdate.mockResolvedValue(auction);

      await runProcessHandler(1);

      expect(mockTo).toHaveBeenCalledWith("auction:1");
      expect(mockRoomEmit).toHaveBeenCalledWith("auction:ended", auction);
    });

    it("должен отправить auction:updated глобально", async () => {
      const auction = { id: 1, status: "COMPLETED", seller: {}, winner: {} };
      mockAuctionUpdate.mockResolvedValue(auction);

      await runProcessHandler(1);

      expect(mockGlobalEmit).toHaveBeenCalledWith("auction:updated", auction);
    });

    it("должен пробросить ошибку если prisma упала (Bull сделает retry)", async () => {
      mockAuctionUpdate.mockRejectedValue(new Error("DB error"));

      await expect(runProcessHandler(1)).rejects.toThrow("DB error");
    });
  });
});
