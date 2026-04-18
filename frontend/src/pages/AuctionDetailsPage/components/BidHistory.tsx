import React, { useMemo } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { User } from 'lucide-react';
import { Bid } from '../../../types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BidHistoryProps {
  bids: Bid[];
  isLoading?: boolean;
}

const BidItem: React.FC<{ bid: Bid }> = ({ bid }) => {
  const createdAtFormatted = useMemo(() => {
    if (!bid.createdAt || isNaN(new Date(bid.createdAt).getTime())) return '—';
    return formatDistanceToNow(new Date(bid.createdAt), { locale: ru, addSuffix: true });
  }, [bid.createdAt]);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="bg-primary-100 p-2 rounded-full">
          <User className="h-4 w-4 text-primary-600" />
        </div>
        <div>
          <p className="font-medium text-sm">
            {bid.user.name || bid.user.email}
          </p>
          <p className="text-xs text-gray-500">
            {createdAtFormatted}
          </p>
        </div>
      </div>
      <span className="font-bold text-primary-600">
        ${bid.amount}
      </span>
    </div>
  );
};

type BidRowProps = { bids: Bid[] };

function BidRow({ index, bids, style }: RowComponentProps<BidRowProps>) {
  return (
    <div style={style}>
      <BidItem bid={bids[index]} />
    </div>
  );
}

const VirtualizedBidList: React.FC<{ bids: Bid[] }> = ({ bids }) => {
  if (bids.length === 0) {
    return <p className="text-gray-500 text-center py-4">Ставок пока нет</p>;
  }

  return (
    <List<BidRowProps>
      rowComponent={BidRow}
      rowCount={bids.length}
      rowHeight={80}
      rowProps={{ bids }}
      defaultHeight={400}
      className="max-h-96"
    />
  );
};

const BidHistory: React.FC<BidHistoryProps> = ({ bids, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Ставки</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const useVirtualization = bids.length > 10;

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Ставки ({bids.length})</h2>
      {bids.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Ставок пока нет</p>
      ) : useVirtualization ? (
        <VirtualizedBidList bids={bids} />
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {bids.map((bid) => (
            <BidItem key={bid.id} bid={bid} />
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(BidHistory);
