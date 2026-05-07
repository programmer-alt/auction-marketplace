import { useMemo } from 'react';
import { Auction } from '../../../types';
import { useStatusBadge } from '../../../hooks/useStatusBadge';

export interface UseAuctionStateResult {
  isOwner: boolean;
  isActive: boolean;
  isEnded: boolean;
  statusInfo: { label: string; cls: string };
  showBidForm: boolean;
  showLoginPrompt: boolean;
  showOwnerMessage: boolean;
  showAuctionActions: boolean;
}

/**
 * Хук для вычисления производных состояний аукциона
 * Упрощает логику компонента AuctionDetails, снижая цикломатическую сложность
 */
export function useAuctionState(
  auction: Auction | null,
  user: { id: number } | null,
  isAuthenticated: boolean,
): UseAuctionStateResult {
  const { getStatusBadge } = useStatusBadge();

  // Базовые состояния
  const isOwner = useMemo(() => user?.id === auction?.sellerId, [user, auction]);
  const isActive = useMemo(() => auction?.status === 'ACTIVE', [auction]);
  const isEnded = useMemo(() => {
    if (!auction?.endsAt) return false;
    return new Date(auction.endsAt) < new Date();
  }, [auction]);
  const statusInfo = useMemo(() => 
    auction ? getStatusBadge(auction.status) : { label: '', cls: '' },
    [auction, getStatusBadge]
  );

  // Логика отображения компонентов
  const showBidForm = useMemo(() => 
    isAuthenticated && isActive && !isEnded && !isOwner,
    [isAuthenticated, isActive, isEnded, isOwner]
  );

  const showLoginPrompt = useMemo(() => 
    !isAuthenticated && isActive && !isEnded,
    [isAuthenticated, isActive, isEnded]
  );

  const showOwnerMessage = useMemo(() => 
    isOwner && isActive,
    [isOwner, isActive]
  );

  const showAuctionActions = useMemo(() => 
    !!auction,
    [auction]
  );

  return {
    isOwner,
    isActive,
    isEnded,
    statusInfo,
    showBidForm,
    showLoginPrompt,
    showOwnerMessage,
    showAuctionActions,
  };
}