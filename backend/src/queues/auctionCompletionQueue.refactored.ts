import Queue from 'bull';
import { prisma } from '../config/db';
import { getIo } from '../config/socket';
import { AuctionStatus } from '@prisma/client';

// Типы для данных задачи
interface AuctionCompletionJobData {
  auctionId: number;
}

interface ScheduledJobInfo {
  jobId: string;
  delay: number;
  endsAt: Date;
}

// Константы для имён событий WebSocket
const WS_AUCTION_ENDED = 'auction:ended';
const WS_AUCTION_UPDATED = 'auction:updated';

// Конфигурация очереди
export const auctionCompletionQueue = new Queue<AuctionCompletionJobData>('auctionCompletion', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Логгер (можно заменить на структурированный логгер в будущем)
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[${new Date().toISOString()}] INFO: ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[${new Date().toISOString()}] WARN: ${message}`, ...args),
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] DEBUG: ${message}`, ...args);
    }
  },
};

/**
 * Валидация данных задачи
 */
function validateJobData(data: any): data is AuctionCompletionJobData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid job data: data must be an object');
  }
  
  if (typeof data.auctionId !== 'number' || data.auctionId <= 0) {
    throw new Error(`Invalid auctionId: ${data.auctionId}`);
  }
  
  return true;
}

/**
 * Обработчик задачи завершения аукциона
 */
auctionCompletionQueue.process(async (job) => {
  const { auctionId } = job.data;
  
  logger.info(`🔄 Начато завершение аукциона ${auctionId}`, { jobId: job.id });
  
  try {
    // Валидация данных
    validateJobData(job.data);
    
    // Проверяем, существует ли аукцион и его текущий статус
    const existingAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true }
    });
    
    if (!existingAuction) {
      logger.warn(`Аукцион ${auctionId} не найден, пропускаем завершение`);
      return; // Не выбрасываем ошибку, чтобы задача не повторялась
    }
    
    if (existingAuction.status !== 'ACTIVE') {
      logger.warn(`Аукцион ${auctionId} уже имеет статус ${existingAuction.status}, пропускаем завершение`);
      return;
    }
    
    // Атомарно обновляем статус только если аукцион ещё активен
    const auction = await prisma.auction.update({
      where: { 
        id: auctionId,
        status: 'ACTIVE' // Оптимистичная блокировка
      },
      data: { 
        status: 'COMPLETED' as AuctionStatus,
      },
      include: {
        seller: {
          select: { id: true, email: true, name: true }
        },
        winner: {
          select: { id: true, email: true, name: true }
        },
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      },
    });
    
    if (!auction) {
      // Кто-то уже изменил статус параллельно
      logger.warn(`Не удалось обновить статус аукциона ${auctionId}, возможно уже завершён`);
      return;
    }
    
    // Определяем победителя из последней ставки, если winner не установлен
    const winner = auction.winner || auction.bids[0]?.user;
    const finalPrice = auction.currentPrice;
    
    // Отправляем WebSocket уведомления
    const io = getIo();
    const roomName = `auction:${auctionId}`;
    
    // Отправляем только в комнату аукциона
    io.to(roomName).emit(WS_AUCTION_ENDED, {
      auctionId: auction.id,
      status: auction.status,
      winner: winner ? { id: winner.id, email: winner.email, name: winner.name } : null,
      finalPrice: finalPrice.toString(),
      endedAt: new Date().toISOString()
    });
    
    // Глобальное обновление (только основные данные)
    io.emit(WS_AUCTION_UPDATED, {
      auctionId: auction.id,
      status: auction.status,
      endedAt: new Date().toISOString()
    });
    
    logger.info(`✅ Аукцион ${auctionId} успешно завершён`, { 
      winnerId: winner?.id,
      finalPrice: finalPrice.toString()
    });
    
  } catch (error) {
    logger.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
    
    // Преобразуем ошибку для лучшего логирования
    const enhancedError = error instanceof Error 
      ? error 
      : new Error(`Unknown error completing auction ${auctionId}`);
    
    // Пробрасываем ошибку для повторных попыток Bull
    throw enhancedError;
  }
});

/**
 * Добавляет задачу на завершение аукциона
 * @returns Информация о запланированной задаче или null если аукцион уже завершён
 */
export async function scheduleAuctionCompletion(
  auctionId: number, 
  endsAt: Date
): Promise<ScheduledJobInfo | null> {
  const delay = endsAt.getTime() - Date.now();
  const jobId = `auction:${auctionId}`;
  
  // Проверяем, существует ли уже задача
  const existingJob = await auctionCompletionQueue.getJob(jobId);
  
  if (existingJob) {
    // Если задача уже существует и время окончания изменилось, обновляем её
    // В Bull нет метода getDelay, используем timestamp из данных задачи
    const jobTimestamp = existingJob.timestamp;
    const existingDelay = jobTimestamp ? jobTimestamp - Date.now() : 0;
    
    if (Math.abs(existingDelay - delay) > 1000) { // Разница более 1 секунды
      logger.debug(`Обновление существующей задачи для аукциона ${auctionId}`, {
        oldDelay: existingDelay,
        newDelay: delay
      });
      await existingJob.remove();
    } else {
      logger.debug(`Задача для аукциона ${auctionId} уже запланирована`);
      return {
        jobId,
        delay,
        endsAt
      };
    }
  }
  
  // Если время уже прошло, выполняем немедленно
  if (delay <= 0) {
    logger.info(`Аукцион ${auctionId} уже должен быть завершён, добавляем задачу без задержки`);
    
    // Добавляем задачу с минимальной задержкой
    await auctionCompletionQueue.add(
      { auctionId }, 
      { 
        delay: 0, 
        jobId,
        priority: 1 // Высокий приоритет для просроченных
      }
    );
    
    return {
      jobId,
      delay: 0,
      endsAt
    };
  }
  
  // Планируем задачу с задержкой
  await auctionCompletionQueue.add(
    { auctionId }, 
    { 
      delay, 
      jobId,
      priority: 2 // Нормальный приоритет
    }
  );
  
  const seconds = Math.round(delay / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  
  let timeString = `${seconds} сек`;
  if (minutes > 0) timeString = `${minutes} мин`;
  if (hours > 0) timeString = `${hours} ч`;
  
  logger.info(`⏰ Запланировано завершение аукциона ${auctionId} через ${timeString} (${delay}ms)`);
  
  return {
    jobId,
    delay,
    endsAt
  };
}

/**
 * Удаляет запланированную задачу завершения аукциона
 * @returns true если задача была удалена, false если не найдена
 */
export async function removeScheduledAuctionCompletion(auctionId: number): Promise<boolean> {
  const jobId = `auction:${auctionId}`;
  const job = await auctionCompletionQueue.getJob(jobId);
  
  if (!job) {
    logger.debug(`Задача для аукциона ${auctionId} не найдена`);
    return false;
  }
  
  // Проверяем состояние задачи
  const state = await job.getState();
  
  if (state === 'active' || state === 'completed' || state === 'failed') {
    logger.warn(`Задача для аукциона ${auctionId} находится в состоянии ${state}, удаление может быть невозможно`);
  }
  
  try {
    await job.remove();
    logger.info(`🗑️ Удалена запланированная задача для аукциона ${auctionId}`);
    return true;
  } catch (error) {
    logger.error(`Ошибка удаления задачи для аукциона ${auctionId}:`, error);
    return false;
  }
}

/**
 * Планирует завершение для всех активных аукционов при запуске сервера
 * @param batchSize Размер пачки для обработки (для оптимизации памяти)
 */
export async function scheduleExistingAuctions(batchSize: number = 100): Promise<void> {
  logger.info('🔍 Поиск активных аукционов для планирования завершения...');
  
  let skip = 0;
  let totalScheduled = 0;
  let totalProcessed = 0;
  
  try {
    while (true) {
      const activeAuctions = await prisma.auction.findMany({
        where: {
          status: 'ACTIVE',
          endsAt: { gt: new Date() },
        },
        select: {
          id: true,
          endsAt: true,
        },
        take: batchSize,
        skip,
        orderBy: { endsAt: 'asc' }
      });
      
      if (activeAuctions.length === 0) {
        break;
      }
      
      logger.debug(`Обработка пачки из ${activeAuctions.length} аукционов (skip=${skip})`);
      
      // Планируем каждый аукцион параллельно для производительности
      const schedulingResults = await Promise.allSettled(
        activeAuctions.map(auction => 
          scheduleAuctionCompletion(auction.id, auction.endsAt)
        )
      );
      
      // Подсчитываем результаты
      const successful = schedulingResults.filter(r => r.status === 'fulfilled').length;
      totalScheduled += successful;
      totalProcessed += activeAuctions.length;
      
      // Логируем ошибки
      schedulingResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const auction = activeAuctions[index];
          logger.error(`Ошибка планирования аукциона ${auction.id}:`, result.reason);
        }
      });
      
      skip += batchSize;
      
      // Если получили меньше записей, чем batchSize, значит это последняя пачка
      if (activeAuctions.length < batchSize) {
        break;
      }
    }
    
    logger.info(`📋 Запланировано завершение ${totalScheduled} из ${totalProcessed} активных аукционов`);
    
  } catch (error) {
    logger.error('Критическая ошибка при планировании существующих аукционов:', error);
    throw error;
  }
}

/**
 * Получает информацию о запланированной задаче
 */
export async function getScheduledAuctionCompletion(auctionId: number) {
  const jobId = `auction:${auctionId}`;
  const job = await auctionCompletionQueue.getJob(jobId);
  
  if (!job) {
    return null;
  }
  
  const state = await job.getState();
  const delay = job.opts.delay || 0;
  const processedOn = job.processedOn;
  const finishedOn = job.finishedOn;
  
  return {
    jobId,
    state,
    delay,
    processedOn,
    finishedOn,
    data: job.data
  };
}

/**
 * Очищает очередь (для тестов и обслуживания)
 */
export async function cleanQueue(): Promise<void> {
  logger.info('🧹 Очистка очереди завершения аукционов...');
  
  // Удаляем завершённые задачи
  await auctionCompletionQueue.clean(0, 'completed');
  
  // Удаляем проваленные задачи старше 7 дней
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await auctionCompletionQueue.clean(weekAgo, 'failed');
  
  logger.info('✅ Очередь очищена');
}