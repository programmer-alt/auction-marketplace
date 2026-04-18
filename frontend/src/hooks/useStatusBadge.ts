import { Auction } from '../types';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Активен', cls: 'badge-active' },
  COMPLETED: { label: 'Завершён', cls: 'badge-completed' },
  CANCELLED: { label: 'Отменён', cls: 'badge-cancelled' },
};

export const useStatusBadge = () => {
  const getStatusBadge = (status: Auction['status']) =>
    STATUS_MAP[status] || { label: 'Неизвестно', cls: 'badge-default' };

  return { getStatusBadge };
};
