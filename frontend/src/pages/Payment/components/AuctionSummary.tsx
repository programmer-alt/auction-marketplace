import React from 'react';
import { ShoppingBag, DollarSign } from 'lucide-react';
import { Auction } from '../../../types';

interface AuctionSummaryProps {
  auction: Auction;
}

const AuctionSummary: React.FC<AuctionSummaryProps> = ({ auction }) => (
  <div className="bg-gray-50 rounded-lg p-4 mb-6">
    <div className="flex items-start gap-3">
      <ShoppingBag className="h-5 w-5 text-gray-400 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{auction.title}</h3>
        <p className="text-sm text-gray-500">
          Продавец: {auction.seller.name || auction.seller.email}
        </p>
      </div>
    </div>
    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
      <span className="text-gray-600 flex items-center gap-1">
        <DollarSign className="h-4 w-4" />
        Итого к оплате:
      </span>
      <span className="text-2xl font-bold text-primary-600">${auction.currentPrice}</span>
    </div>
  </div>
);

export default AuctionSummary;
