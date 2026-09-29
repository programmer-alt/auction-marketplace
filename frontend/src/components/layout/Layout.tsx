import { useEffect } from "react";
import { createSocketConnection } from "@/utils/websocket";
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/auth.store";
import Footer from "./Footer";
import Header from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const token = useAuthStore((s) => s.token);

  // Инициализация WebSocket подключения
  useEffect(() => {
    const socket = createSocketConnection(token || undefined);
    return () => { socket.disconnect(); void 0; };
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
