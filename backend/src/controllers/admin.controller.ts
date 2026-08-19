import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";

// Статистика очереди отключена (Bull удалён)
export const getQueueStats = asyncHandler(async (_req: Request, res: Response) => {
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
  });
});
