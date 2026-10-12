import { Server } from "socket.io";
import type { AuthContext } from "../middleware/auth";
import logger from "../config/logger";
import { websocketConnections } from "./metrics";

// Расширяем типы Socket.io чтобы socket.data.user был типизирован
declare module "socket.io" {
  interface SocketData {
    user?: AuthContext;
  }
}

let io: Server;

export function initSocket(
  server: import("http").Server,
  corsOriginHandler: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
    source: string,
  ) => void,
): Server {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => corsOriginHandler(origin, callback, "CORS (socket.io)"),
      credentials: true,
    },
    // Используем default in-memory adapter
  });

  // Отслеживаем WebSocket подключения
  io.on("connection", (socket) => {
    websocketConnections.inc();
    
    socket.on("disconnect", (reason: string) => {
      websocketConnections.dec();
      logger.debug(`Socket ${socket.id} отключен, причина: ${reason}`);
      
      // Очищаем rate limit записи при disconnect
      const user = socket.data.user;
      if (user) {
        // Импортируем динамически чтобы избежать circular dependency
        import("../middleware/socketRateLimit").then(({ clearUserRateLimits }) => {
          clearUserRateLimits(user.id);
        }).catch(() => {
          // Игнорируем ошибки импорта
        });
      }
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io не инициализирован");
  return io;
}

export { io };
