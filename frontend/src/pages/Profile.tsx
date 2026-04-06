import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { auctionsApi } from "../api/auctions";
import { Auction } from "../types";
import { User, ShoppingBag, Gavel, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "react-hot-toast";

export default function Profile() {
  const { user } = useAuthStore();
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [wonAuctions, setWonAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my" | "won">("my");

  useEffect(() => {
    const fetchMyAuctions = async () => {
      setLoading(true);
      try {
        const data = await auctionsApi.getAuctions({ page: 1, limit: 50 });
        const allAuctions = (data as any).auctions || data.items || [];
        const my = allAuctions.filter((a: Auction) => a.sellerId === user?.id);
        const won = allAuctions.filter(
          (a: Auction) => a.winnerId === user?.id && a.status === "COMPLETED",
        );
        setMyAuctions(my);
        setWonAuctions(won);
      } catch {
        toast.error("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };

    fetchMyAuctions();
  }, [user]);

  const getStatusBadge = (status: Auction["status"]) => {
    const map: Record<string, { label: string; cls: string }> = {
      ACTIVE: { label: "Активен", cls: "badge-active" },
      COMPLETED: { label: "Завершён", cls: "badge-completed" },
      CANCELLED: { label: "Отменён", cls: "badge-cancelled" },
    };
    return map[status] || { label: "Неизвестно", cls: "badge-default" };
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Мой профиль</h1>

      {/* User info card */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary-100 p-4 rounded-full">
            <User className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {user?.name || "Пользователь"}
            </h2>
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-sm text-gray-500">
              На платформе с{" "}
              {user?.createdAt
                ? formatDistanceToNow(new Date(user.createdAt), {
                    locale: ru,
                    addSuffix: true,
                  })
                : "недавно"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === "my"
              ? "text-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("my")}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Мои аукционы ({myAuctions.length})
          </span>
          {activeTab === "my" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
          )}
        </button>
        <button
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === "won"
              ? "text-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("won")}
        >
          <span className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            Выигранные ({wonAuctions.length})
          </span>
          {activeTab === "won" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
          )}
        </button>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : activeTab === "my" ? (
        myAuctions.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              У вас пока нет аукционов
            </h3>
            <p className="text-gray-500 mb-4">Создайте свой первый аукцион</p>
            <Link
              to="/auctions/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              Создать
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {myAuctions.map((auction) => {
              const statusInfo = getStatusBadge(auction.status);
              return (
                <Link
                  key={auction.id}
                  to={`/auctions/${auction.id}`}
                  className="card hover:shadow-md transition-shadow flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {auction.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className={`badge ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Gavel className="h-3 w-3" />${auction.currentPrice}
                      </span>
                      {auction.status === "ACTIVE" && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(auction.endsAt), {
                            locale: ru,
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 text-gray-400" />
                </Link>
              );
            })}
          </div>
        )
      ) : wonAuctions.length === 0 ? (
        <div className="text-center py-12">
          <Gavel className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Вы пока ничего не выиграли
          </h3>
          <p className="text-gray-500">Продолжайте участвовать в аукционах!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wonAuctions.map((auction) => (
            <Link
              key={auction.id}
              to={`/auctions/${auction.id}`}
              className="card hover:shadow-md transition-shadow flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{auction.title}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span className="badge badge-completed">Завершён</span>
                  <span className="text-primary-600 font-semibold">
                    ${auction.currentPrice}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to={`/payment/${auction.id}`}
                  className="btn-primary text-sm py-1 px-3"
                >
                  Оплатить
                </Link>
                <ExternalLink className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
