import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Auction } from '@/types';

interface AuctionHeaderProps {
  auction: Auction;
  statusInfo: {
    label: string;
    cls: string;
  };
}

const AuctionHeader: React.FC<AuctionHeaderProps> = ({ auction, statusInfo }) => {
  return (
    <>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к аукционам
      </Link>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {auction.title}
          </h1>
          <span className={`badge ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>
    </>
  );
};

export default React.memo(AuctionHeader);