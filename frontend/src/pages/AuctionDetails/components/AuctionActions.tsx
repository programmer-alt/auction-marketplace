import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Pencil, CreditCard } from 'lucide-react';
import { Auction, User } from '../../../types';

interface AuctionActionsProps {
  auction: Auction;
  user: User | null;
  isOwner: boolean;
  isActive: boolean;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onPayment: () => void;
}

const AuctionActions: React.FC<AuctionActionsProps> = ({
  auction,
  user,
  isOwner,
  isActive,
  onDelete,
  onEdit,
  onPayment,
}) => {
  const isAuthenticated = !!user;

  return (
    <div className="flex gap-3 mt-6">
      {isOwner && isActive && (
        <>
          <Link
            to={`/auctions/${auction.id}/edit`}
            className="btn-secondary flex items-center gap-2"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
            Редактировать
          </Link>
          <button
            onClick={onDelete}
            className="btn-secondary flex items-center gap-2 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Удалить
          </button>
        </>
      )}
      {isAuthenticated &&
        auction.status === 'COMPLETED' &&
        user?.id === auction.winnerId && (
          <Link
            to={`/payment/${auction.id}`}
            className="btn-primary flex items-center gap-2"
            onClick={onPayment}
          >
            <CreditCard className="h-4 w-4" />
            Оплатить
          </Link>
        )}
    </div>
  );
};

export default React.memo(AuctionActions);