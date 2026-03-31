import { Request, Response } from 'express';
import { auctionCompletionQueue } from '../queues/auctionCompletionQueue';

export async function getQueueStats(_req: Request, res: Response): Promise<void> {
  const counts = await auctionCompletionQueue.getJobCounts();
  res.json({
    queue: 'auctionCompletion',
    stats: {
      waiting:   counts.waiting,   // ждут выполнения
      active:    counts.active,    // выполняются прямо сейчас
      delayed:   counts.delayed,   // запланированы на будущее
      completed: counts.completed, // успешно завершены
      failed:    counts.failed,    // упали с ошибкой
    },
    timestamp: new Date().toISOString(),
  });
}
