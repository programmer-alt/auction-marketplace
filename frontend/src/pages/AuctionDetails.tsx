import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { auctionsApi } from "../api/auctions";
import { bidsApi } from "../api/bids";
import { Auction, Bid } from "../types";
import {
  ArrowLeft,
  Gavel,
  Clock,
  User,
  DollarSign,
  Send,
  Trash2,
  CreditCard,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import toast from "react-hot-toast";

export default function AuctionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);

  const fetchAuction = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await auctionsApi.getAuctionById(Number(id));
      setAuction(data);
      try {
        const bidsData = await bidsApi.getAuctionBids(Number(id));
        setBids((bidsData as any).bids || bidsData || []);
      } catch {
        setBids([]);
      }
    } catch {
      toast.error("Аукцион не найден");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuction();
  }, [id]);

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !id) return;
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= auction.currentPrice) {
      toast.error("Ставка должна быть выше текущей цены");
      return;
    }
    setBidding(true);
    try {
      await bidsApi.createBid(Number(id), { amount });
      toast.success("Ставка размещена!");
      setBidAmount("");
      await fetchAuction();
    } catch {
      toast.error("Не удалось разместить ставку");
    } finally {
      setBidding(false);
    }
  };

  const handleDelete = async () => {
    if (!auction || !id) return;
    if (!confirm("Вы уверены, что хотите удалить этот аукцион?")) return;
    try {
      await auctionsApi.deleteAuction(Number(id));
      toast.success("Аукцион удалён");
      navigate("/");
    } catch {
      toast.error("Не удалось удалить аукцион");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!auction) return null;

  const isOwner = user?.id === auction.sellerId;
  const isActive = auction.status === "ACTIVE";
  const isEnded = new Date(auction.endsAt) < new Date();

  const getStatusBadge = (status: Auction["status"]) => {
    const map: Record<string, { label: string; cls: string }> = {
      ACTIVE: { label: "Активен", cls: "badge-active" },
      COMPLETED: { label: "Завершён", cls: "badge-completed" },
      CANCELLED: { label: "Отменён", cls: "badge-cancelled" },
    };
    return map[status] || { label: "Неизвестно", cls: "badge-default" };
  };
  const statusInfo = getStatusBadge(auction.status);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к аукционам
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {auction.title}
              </h1>
              <span className={`badge ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>

            {auction.imageUrl && (
              <img
                src={auction.imageUrl}
                alt={auction.title}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}

            {auction.description && (
              <p className="text-gray-700 mb-4">{auction.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="h-4 w-4" />
                <span>
                  Начальная:{" "}
                  <strong className="text-gray-900">
                    ${auction.startingPrice}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Gavel className="h-4 w-4" />
                <span>
                  Текущая:{" "}
                  <strong className="text-primary-600 text-lg">
                    ${auction.currentPrice}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4" />
                <span>
                  Продавец:{" "}
                  <strong className="text-gray-900">
                    {auction.seller?.name || auction.seller?.email || 'Неизвестно'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  {isEnded ? (
                    "Завершился"
                  ) : (
                    <>
                      Окончание:{" "}
                      <strong className="text-gray-900">
                        {auction.endsAt && !isNaN(new Date(auction.endsAt).getTime())
                          ? formatDistanceToNow(new Date(auction.endsAt), { locale: ru, addSuffix: true })
                          : '—'}
                      </strong>
                    </>
                  )}
                </span>
              </div>
            </div>

            {auction.winner && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <span className="text-sm text-green-800">
                  🏆 Победитель:{" "}
                  <strong>{auction.winner?.name || auction.winner?.email}</strong>
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              {isOwner && isActive && (
                <button
                  onClick={handleDelete}
                  className="btn-secondary flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              )}
              {isAuthenticated &&
                auction.status === "COMPLETED" &&
                user?.id === auction.winnerId && (
                  <Link
                    to={`/payment/${auction.id}`}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Оплатить
                  </Link>
                )}
            </div>
          </div>

          {/* Bids */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Ставки ({bids.length})</h2>
            {bids.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Ставок пока нет</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bids.map((bid) => (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-100 p-2 rounded-full">
                        <User className="h-4 w-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {bid.user.name || bid.user.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {bid.createdAt && !isNaN(new Date(bid.createdAt).getTime())
                            ? formatDistanceToNow(new Date(bid.createdAt), { locale: ru, addSuffix: true })
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-primary-600">
                      ${bid.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bid form */}
        <div>
          {isAuthenticated && isActive && !isEnded && !isOwner ? (
            <div className="card sticky top-4">
              <h3 className="text-lg font-bold mb-4">Сделать ставку</h3>
              <form onSubmit={handleBid}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Минимальная ставка
                  </label>
                  <div className="text-2xl font-bold text-primary-600 mb-2">
                    ${(auction.currentPrice + 1).toFixed(2)}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ваша ставка
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="Введите сумму"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={auction.currentPrice + 0.01}
                  />
                </div>
                <button
                  type="submit"
                  disabled={bidding || !bidAmount}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {bidding ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Размещение...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Разместить ставку
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : !isAuthenticated && isActive && !isEnded ? (
            <div className="card text-center">
              <p className="text-gray-600 mb-4">Войдите, чтобы делать ставки</p>
              <Link to="/login" className="btn-primary w-full">
                Войти
              </Link>
            </div>
          ) : isOwner && isActive ? (
            <div className="card text-center">
              <p className="text-gray-500">Это ваш аукцион</p>
              <p className="text-sm text-gray-400 mt-1">
                Ожидайте ставок от участников
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
