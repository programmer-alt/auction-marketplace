import { useStatusBadge } from "@/hooks/useStatusBadge";
import type { Auction } from "@/types";
import { useMemo } from "react";

export interface UseAuctionStateResult {
  isOwner: boolean;
  isActive: boolean;
  isEnded: boolean;
  isTimeEnded: boolean;
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

  // Время вышло по таймеру (независимо от статуса в БД)
  const isTimeEnded = useMemo(() => {
    if (!auction?.endsAt) return false;
    return new Date(auction.endsAt) < new Date();
  }, [auction]);

  // Фактическое состояние: неактивен если статус не ACTIVE ИЛИ время вышло
  const isActive = useMemo(
    () => auction?.status === "ACTIVE" && !isTimeEnded,
    [auction?.status, isTimeEnded],
  );

  // Завершён если время вышло ИЛИ статус COMPLETED
  const isEnded = useMemo(
    () => isTimeEnded || auction?.status === "COMPLETED",
    [isTimeEnded, auction?.status],
  );

  // Статус-бейдж: приоритет time-based, затем DB status
  const statusInfo = useMemo(() => {
    if (!auction) return { label: "", cls: "" };

    // Если время вышло — показываем "Завершён" независимо от статуса БД
    if (isTimeEnded) {
      return { label: "Завершён", cls: "badge-completed" };
    }

    // Если статус COMPLETED в БД
    if (auction.status === "COMPLETED") {
      return { label: "Завершён", cls: "badge-completed" };
    }

    // Если статус CANCELLED в БД
    if (auction.status === "CANCELLED") {
      return { label: "Отменён", cls: "badge-cancelled" };
    }

    // По умолчанию — ACTIVE
    return getStatusBadge(auction.status);
  }, [auction, isTimeEnded, getStatusBadge]);

  // Логика отображения компонентов
  const showBidForm = useMemo(
    () => isAuthenticated && isActive && !isOwner,
    [isAuthenticated, isActive, isOwner],
  );

  const showLoginPrompt = useMemo(() => !isAuthenticated && isActive, [isAuthenticated, isActive]);

  const showOwnerMessage = useMemo(() => isOwner && isActive, [isOwner, isActive]);

  const showAuctionActions = useMemo(() => !!auction, [auction]);

  return {
    isOwner,
    isActive,
    isEnded,
    isTimeEnded,
    statusInfo,
    showBidForm,
    showLoginPrompt,
    showOwnerMessage,
    showAuctionActions,
  };
}
