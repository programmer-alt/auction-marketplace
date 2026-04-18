import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Search, Plus, Clock, Gavel, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import ScanLine from '../components/effects/ScanLine';
import { useAuctionList } from './HomePage/hooks/useAuctionList';
import { useStatusBadge } from '../hooks/useStatusBadge';

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const { auctions, loading, search, setSearch, statusFilter, setStatusFilter, page, setPage, totalPages } = useAuctionList();
  const { getStatusBadge } = useStatusBadge();

  return (
    <div className="relative">
      <ScanLine color="#0f0" thickness={3} duration={8} delay={0.5} highlightIntensity={0.7} highlightWidth={250} />

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Аукционы</h1>
        <p className="text-gray-600">Находите уникальные товары и делайте ставки в реальном времени</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск аукционов..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="COMPLETED">Завершённые</option>
          <option value="CANCELLED">Отменённые</option>
        </select>
        {isAuthenticated && (
          <Link to="/auctions/new" className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap">
            <Plus className="h-5 w-5" />
            Создать
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="bg-gray-200 rounded-lg h-40 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-16">
          <Gavel className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Аукционов пока нет</h3>
          <p className="text-gray-500 mb-6">Будьте первым — создайте новый аукцион</p>
          {isAuthenticated && (
            <Link to="/auctions/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Создать аукцион
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((auction) => {
              const statusInfo = getStatusBadge(auction.status);
              return (
                <Link key={auction.id} to={`/auctions/${auction.id}`} className="card hover:shadow-md transition-shadow block">
                  {auction.imageUrl ? (
                    <img src={auction.imageUrl} alt={auction.title} className="w-full h-40 object-cover rounded-lg mb-4" />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mb-4 flex items-center justify-center">
                      <Gavel className="h-10 w-10 text-primary-500" />
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">{auction.title}</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                    {auction.status === 'ACTIVE' && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Timer className="h-3 w-3" />
                        {formatDistanceToNow(new Date(auction.endsAt), { locale: ru, addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Начальная: <span className="font-medium text-gray-700">${auction.startingPrice}</span></span>
                    {auction.currentPrice > auction.startingPrice && (
                      <span className="text-primary-600 font-semibold">${auction.currentPrice}</span>
                    )}
                  </div>
                  {auction.bids && auction.bids.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ставок: {auction.bids.length}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border'}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперёд</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
