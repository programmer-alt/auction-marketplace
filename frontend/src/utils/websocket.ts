import { type Socket, io } from "socket.io-client";
import type { Auction, AuctionEvent, Bid, BidEvent, EventHandlers, Payment, WebSocketEvent } from "../types";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Подключается к Socket.io-серверу и возвращает экземпляр сокета.
 * @param token — JWT-токен для аутентификации (необязательно, гости подключаются как анонимы).
 */
export function createSocketConnection(token?: string): Socket {
  const socket = io(SOCKET_URL, {
    auth: token ? { token } : undefined,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
}

/**
 * Утилита для регистрации обработчиков Socket.io-событий.
 * @param socket Socket.io-соединение
 * @param handlers Объект с обработчиками событий
 */
export function registerSocketHandlers(socket: Socket, handlers: Partial<EventHandlers>): () => void {
  const eventHandlerMap: { [K in WebSocketEvent]?: (data: Record<string, unknown>) => void } = {};

  Object.entries(handlers).forEach(([handlerKey, handlerFn]) => {
    if (typeof handlerFn === "function") {
      const eventName = handlerKey.replace(/^on/, "").toLowerCase();
      const wsEvents = getAllWebSocketEvents();
      const matchingEvent = wsEvents.find(
        (event) =>
          event.toLowerCase() === eventName ||
          event.toLowerCase().replace(":", "") === eventName ||
          event.toLowerCase().replace(/:/g, "") === eventName,
      );

      if (matchingEvent) {
        const safeHandler = (data: Record<string, unknown>) => {
          try {
            handlerFn(data);
          } catch (error) {
            console.error(`Ошибка при обработке события ${matchingEvent}:`, error);
          }
        };
        eventHandlerMap[matchingEvent as WebSocketEvent] = safeHandler;
        socket.on(matchingEvent as WebSocketEvent, safeHandler);
      }
    }
  });

  return () => {
    Object.entries(eventHandlerMap).forEach(([event, handler]) => {
      socket.off(event as WebSocketEvent, handler);
    });
  };
}

/**
 * Возвращает все возможные WebSocket-события
 */
function getAllWebSocketEvents(): string[] {
  const auctionEvents: string[] = ["created", "updated", "deleted"].map((suffix) => `auction:${suffix}`);
  const bidEvents: string[] = ["created", "updated", "deleted", "won"].map((suffix) => `bid:${suffix}`);
  const paymentEvents: string[] = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"].map((suffix) => `payment:${suffix}`);

  return [...auctionEvents, ...bidEvents, ...paymentEvents];
}

/**
 * Типизированные действия для Socket.io
 */
export const WebSocketActions = {
  // Аукционные события
  AUCTION_CREATED: "auction:created" as AuctionEvent,
  AUCTION_UPDATED: "auction:updated" as AuctionEvent,
  AUCTION_DELETED: "auction:deleted" as AuctionEvent,
  AUCTION_ENDED: "auction:ended" as AuctionEvent,

  // События ставок
  BID_CREATED: "bid:created" as BidEvent,
  BID_WON: "bid:won" as BidEvent,

  // События платежей
  PAYMENT_PENDING: "payment:PENDING" as `payment:${Payment["status"]}`,
  PAYMENT_COMPLETED: "payment:COMPLETED" as `payment:${Payment["status"]}`,
  PAYMENT_FAILED: "payment:FAILED" as `payment:${Payment["status"]}`,
  PAYMENT_REFUNDED: "payment:REFUNDED" as `payment:${Payment["status"]}`,
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
export interface WebSocketMessage<T = Record<string, unknown>> {
  event: WebSocketEvent;
  data: T;
  timestamp: string;
}

/**
 * Отправка типизированного сообщения через Socket.io
 */
export function sendWebSocketMessage<T>(socket: Socket, event: WebSocketEvent, data: T): void {
  socket.emit(event, data);
}
