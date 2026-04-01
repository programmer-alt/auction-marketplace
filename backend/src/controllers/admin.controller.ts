import { Request, Response } from "express";
import { auctionCompletionQueue } from "../queues/auctionCompletionQueue";
import { asyncHandler } from "../utils/asyncHandler";

export const getQueueStats = asyncHandler(async (_req: Request, res: Response) => {
  const counts = await auctionCompletionQueue.getJobCounts();
  res.json({
    queue: "auctionCompletion",
    stats: {
      waiting: counts.waiting,
      active: counts.active,
      delayed: counts.delayed,
      completed: counts.completed,
      failed: counts.failed,
    },
    timestamp: new Date().toISOString(),
  });
});
