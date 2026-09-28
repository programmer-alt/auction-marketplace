// Временный скрипт для проверки формата метрик
import { register } from './src/config/metrics';

async function checkMetrics() {
  try {
    // Имитируем несколько вызовов для генерации метрик
    console.log('=== Все метрики ===');
    const metrics = await register.metrics();
    console.log(metrics);
    console.log('=== Конец всех метрик ===');
  } catch (error) {
    console.error('Ошибка при получении метрик:', error);
  }
}

// Запускаем проверку
checkMetrics();