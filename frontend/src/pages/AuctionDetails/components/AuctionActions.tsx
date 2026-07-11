import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Pencil, CreditCard } from 'lucide-react';
import { Auction, User } from '@/types';
import { Modal } from './Modal';

interface AuctionActionsProps {
  auction: Auction;
  user: User | null;
  isOwner: boolean;
  isActive: boolean;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onPayment: () => void;
  onConfirmDelete: () => Promise<void>;
}

const AuctionActions: React.FC<AuctionActionsProps> = ({
  auction,
  user,
  isOwner,
  isActive,
  onEdit,
  onPayment,
  onConfirmDelete,
}) => {
  const isAuthenticated = !!user;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => setIsModalOpen(true);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
      setIsModalOpen(false);
    }
  };

  return (
    <>
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
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="btn-secondary flex items-center gap-2 text-red-600 disabled:opacity-50"
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
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Удалить аукцион"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      >
        <p>Вы уверены, что хотите удалить этот аукцион? Это действие нельзя отменить.</p>
      </Modal>
    </>
  );
};

export default React.memo(AuctionActions);