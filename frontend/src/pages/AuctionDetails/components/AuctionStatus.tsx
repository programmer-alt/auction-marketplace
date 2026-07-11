import React from 'react';
import { Auction } from '@/types';

interface AuctionStatusProps {
  status: Auction['status'];
}

const AuctionStatus: React.FC<AuctionStatusProps> = ({ status }) => {
  const getStatusBadge = (status: Auction['status']) => {
    const map: Record<string, { label: string; cls: string }> = {
      ACTIVE: { label: 'Активен', cls: 'badge-active' },
      COMPLETED: { label: 'Завершён', cls: 'badge-completed' },
      CANCELLED: { label: 'Отменён', cls: 'badge-cancelled' },
    };
    return map[status] || { label: 'Неизвестно', cls: 'badge-default' };
  };

  const statusInfo = getStatusBadge(status);

  return (
    <span className={`badge ${statusInfo.cls}`}>
      {statusInfo.label}
    </span>
  );
};

export default React.memo(AuctionStatus);