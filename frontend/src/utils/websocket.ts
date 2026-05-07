import type { 
  WebSocketEvent, 
  EventHandlers, 
  Auction, 
  Bid, 
  Payment,
  AuctionEvent,
  BidEvent
} from '../types';

/**
 * Утилита для регистрации обработчиков WebSocket-событий
 * @param socket WebSocket-соединение
 * @param handlers Объект с обработчиками событий
 */
export function registerWebSocketHandlers(
  socket: WebSocket,
  handlers: Partial<EventHandlers>
): () => void {
  // Сопоставление событий с обработчиками
  const eventHandlerMap: { [K in WebSocketEvent]?: (data: any) => void } = {};

  // Регистрация обработчиков на основе предоставленных
  Object.entries(handlers).forEach(([handlerKey, handlerFn]) => {
    if (typeof handlerFn === 'function') {
      // Убираем префикс "on" из названия обработчика
      const eventName = handlerKey.replace(/^on/, '').toLowerCase();
      // Ищем соответствующее WebSocket-событие
      const wsEvents = getAllWebSocketEvents();
      const matchingEvent = wsEvents.find(event => 
        event.toLowerCase() === eventName ||
        event.toLowerCase().replace(':', '') === eventName ||
        event.toLowerCase().replace(/:/g, '') === eventName
      );

      if (matchingEvent) {
        eventHandlerMap[matchingEvent as WebSocketEvent] = handlerFn;
      }
    }
  });

  // Регистрируем обработчики в WebSocket
  Object.entries(eventHandlerMap).forEach(([event, handler]) => {
    socket.addEventListener(event, (data: any) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Ошибка при обработке события ${event}:`, error);
      }
    });
  });

  // Возвращаем функцию отписки
  return () => {
    Object.entries(eventHandlerMap).forEach(([event, handler]) => {
      socket.removeEventListener(event, handler);
    });
  };
}

/**
 * Возвращает все возможные WebSocket-события
 */
function getAllWebSocketEvents(): string[] {
  const auctionEvents: string[] = ['created', 'updated', 'deleted'].map(suffix => `auction:${suffix}`);
  const bidEvents: string[] = ['created', 'updated', 'deleted', 'won'].map(suffix => `bid:${suffix}`);
  const paymentEvents: string[] = ['PENDING', 'COMPLETED', 'FAILED'].map(suffix => `payment:${suffix}`);

  return [...auctionEvents, ...bidEvents, ...paymentEvents];
}

/**
 * Типизированные действия для WebSocket
 */
export const WebSocketActions = {
  // Аукционные события
  AUCTION_CREATED: 'auction:created' as AuctionEvent,
  AUCTION_UPDATED: 'auction:updated' as AuctionEvent,
  AUCTION_DELETED: 'auction:deleted' as AuctionEvent,
  AUCTION_ENDED: 'auction:ended' as AuctionEvent,

  // События ставок
  BID_CREATED: 'bid:created' as BidEvent,
  BID_WON: 'bid:won' as BidEvent,

  // События платежей
  PAYMENT_PENDING: 'payment:PENDING' as `payment:${Payment['status']}`,
  PAYMENT_COMPLETED: 'payment:COMPLETED' as `payment:${Payment['status']}`,
  PAYMENT_FAILED: 'payment:FAILED' as `payment:${Payment['status']}`,
};

/**
 * Интерфейсы для данных WebSocket-событий
 */
export interface AuctionEventData {
  auction: Auction;
}

export interface BidEventData {
  bid: Bid;
  auction: Auction;
}

export interface PaymentEventData {
  payment: Payment;
  auction: Auction;
}

/**
 * Универсальный интерфейс WebSocket-сообщения
 */
export interface WebSocketMessage<T = any> {
  event: WebSocketEvent;
  data: T;
  timestamp: string;
}

/**
 * Отправка типизированного сообщения через WebSocket
 */
export function sendWebSocketMessage<T>(
  socket: WebSocket,
  event: WebSocketEvent,
  data: T
): void {
  if (socket.readyState === WebSocket.OPEN) {
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    socket.send(JSON.stringify(message));
  } else {
    console.warn(`Попытка отправить сообщение "${event}", но соединение закрыто`);
  }
}