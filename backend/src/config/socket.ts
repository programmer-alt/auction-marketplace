import { Server } from "socket.io";
import type { AuthContext } from "../middleware/auth";

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
    // Используем default in-memory adapter (без Redis)
  });
  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io не инициализирован");
  return io;
}

export { io };
