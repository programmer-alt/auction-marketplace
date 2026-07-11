import React, { useMemo } from 'react';
import { DollarSign, Gavel, User, Clock } from 'lucide-react';
import { Auction } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AuctionDetailsInfoProps {
  auction: Auction;
  isEnded: boolean;
}

const AuctionDetailsInfo: React.FC<AuctionDetailsInfoProps> = ({ auction, isEnded }) => {
  const endsAtFormatted = useMemo(() => {
    if (!auction.endsAt || isNaN(new Date(auction.endsAt).getTime())) return '—';
    return formatDistanceToNow(new Date(auction.endsAt), { locale: ru, addSuffix: true });
  }, [auction.endsAt]);

  return (
    <div className="card">
      {auction.description && (
        <p className="text-gray-700 mb-4">{auction.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <DollarSign className="h-4 w-4" />
          <span>
            Начальная:{' '}
            <strong className="text-gray-900">${auction.startingPrice}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Gavel className="h-4 w-4" />
          <span>
            Текущая:{' '}
            <strong className="text-primary-600 text-lg">${auction.currentPrice}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <User className="h-4 w-4" />
          <span>
            Продавец:{' '}
            <strong className="text-gray-900">
              {auction.seller?.name || auction.seller?.email || 'Неизвестно'}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4" />
          <span>
            {isEnded ? (
              'Завершился'
            ) : (
              <>
                Окончание:{' '}
                <strong className="text-gray-900">
                  {endsAtFormatted}
                </strong>
              </>
            )}
          </span>
        </div>
      </div>

      {auction.winner && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <span className="text-sm text-green-800">
            🏆 Победитель:{' '}
            <strong>{auction.winner?.name || auction.winner?.email}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(AuctionDetailsInfo);