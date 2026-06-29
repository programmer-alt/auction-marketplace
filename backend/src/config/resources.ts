/**
 * Конфигурация управления ресурсами Node.js процесса
 */

import logger from './logger';

interface ResourceLimits {
  maxOldSpaceSize?: number;
  maxHeapSize?: number;
  maxRssSize?: number;
}

/**
 * Установка лимитов памяти для Node.js процесса
 */
export function setResourceLimits(limits: ResourceLimits = {}): void {
  const defaults: ResourceLimits = {
    maxOldSpaceSize: 512, // 512MB по умолчанию
    maxHeapSize: 256,     // 256MB по умолчанию
    maxRssSize: 1024,     // 1GB по умолчанию
  };

  const config = { ...defaults, ...limits };

  // Проверяем, можем ли мы установить лимиты
  if (process.env.NODE_ENV === 'production') {
    // В продакшене используем флаги запуска для установки лимитов
    // Эти флаги должны быть установлены при запуске процесса
    const flags = [];

    if (config.maxOldSpaceSize) {
      flags.push(`--max-old-space-size=${config.maxOldSpaceSize}`);
    }

    if (flags.length > 0) {
      logger.info(`Рекомендуемые флаги запуска для продакшена: ${flags.join(' ')}`);
    }
  } else {
    // В разработке выводим информацию о текущем использовании памяти
    logMemoryUsage();

    // Устанавливаем периодический мониторинг
    setInterval(() => {
      logMemoryUsage();
    }, 5 * 60 * 1000); // Каждые 5 минут
  }
}

/**
 * Логирование текущего использования памяти
 */
function logMemoryUsage(): void {
  const usage = process.memoryUsage();
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  logger.debug('Memory usage:', {
    rss: formatBytes(usage.rss),
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external),
    arrayBuffers: formatBytes(usage.arrayBuffers || 0),
  });
}

/**
 * Проверка на утечку памяти
 */
export function checkMemoryLeak(threshold: number = 0.9): boolean {
  const usage = process.memoryUsage();
  const heapUsageRatio = usage.heapUsed / usage.heapTotal;

  if (heapUsageRatio > threshold) {
    logger.warn(`High memory usage detected: ${(heapUsageRatio * 100).toFixed(2)}%`);
    return true;
  }

  return false;
}

/**
 * Принудительный сборщик мусора (доступен только с флагом --expose-gc)
 */
export function forceGarbageCollection(): boolean {
  if (typeof global.gc === 'function') {
    global.gc();
    logger.info('Garbage collection forced');
    return true;
  } else {
    logger.warn('Garbage collection not available. Start with --expose-gc flag');
    return false;
  }
}
