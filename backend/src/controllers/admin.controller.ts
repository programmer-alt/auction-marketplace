import type { Request, Response } from "express";
import logger from "../config/logger";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Статистика очереди отключена (Bull удалён).
 * TODO: реализовать worker/queue для автозавершения истёкших аукционов
 *       и вернуть реальные данные или 501 Not Implemented.
 */
export const getQueueStats = asyncHandler(async (_req: Request, res: Response) => {
  logger.warn("[TODO] getQueueStats — stub: очередь auctionCompletion отключена после удаления Bull");
  res.json({
    queue: "auctionCompletion",
    stats: {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    },
    timestamp: new Date().toISOString(),
    note: "Queue disabled — Bull removed. Auction completion not yet implemented.",
  });
});
