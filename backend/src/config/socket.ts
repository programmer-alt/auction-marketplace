import { Server } from "socket.io";
import { AuthContext } from "../middleware/auth";

// Расширяем типы Socket.io чтобы socket.data.user был типизирован
declare module "socket.io" {
  interface SocketData {
    user?: AuthContext;
  }
}

let io: Server;

export function initSocket(server: import("http").Server, corsOriginHandler: Function): Server {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => corsOriginHandler(origin, callback, "CORS (socket.io)"),
      credentials: true,
    },
  });
  return io;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io не инициализирован");
  return io;
}

export { io };
