/**
 * WebSocket event types
 */

import type { Auction, Payment } from "./index";

/**
 * Создает тип для ключей событий аукциона
 */
export type AuctionEvent = `auction:${Auction["status"] | "created" | "updated" | "deleted"}`;

/**
 * Создает тип для ключей событий ставок
 */
export type BidEvent = `bid:${"created" | "updated" | "deleted" | "won"}`;

/**
 * Создает тип для всех событий WebSocket
 */
export type WebSocketEvent = AuctionEvent | BidEvent | `payment:${Payment["status"]}`;

/**
 * Создает тип для обработчиков событий
 */
export type EventHandlers = {
  [K in WebSocketEvent as `on${Capitalize<K>}`]?: (data: any) => void;
};
