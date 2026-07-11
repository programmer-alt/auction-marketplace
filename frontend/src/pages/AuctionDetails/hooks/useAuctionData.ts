import { useState, useEffect, useCallback } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { bidsApi } from '../../../api/bids';
import { Auction, Bid, isApiSuccess } from '../../../types';
import { handleError, handleBusinessLogicError } from '../../../utils/universalErrorHandler';

const isCancelError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error && typeof error === 'object') {
    const e = error as { name?: string; code?: string };
    if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return true;
  }
  return false;
};

export const useAuctionData = (id: string | undefined) => {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuction = useCallback(async (auctionId: string, signal?: AbortSignal) => {
    if (!auctionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await auctionsApi.getAuctionById(Number(auctionId), signal);
      if (signal?.aborted) return;
      
      // Используем type guard для проверки успешности ответа
      if (isApiSuccess(data)) {
        setAuction(data.data);
        try {
          const bidsData = await bidsApi.getAuctionBids(Number(auctionId), signal);
          if (signal?.aborted) return;
          setBids(bidsData?.bids || []);
        } catch (error) {
          if (isCancelError(error)) return;
          console.error('Ошибка при загрузке ставок:', error);
          setBids([]);
        }
      } else {
        throw new Error(data.error || 'Аукцион не найден');
      }
    } catch (error) {
      if (isCancelError(error)) return;
      console.error('Ошибка при загрузке аукциона (useAuctionData):', error);
      // Для диагностики: покажем что именно прилетело/какой тип ошибки
      try {
        // eslint-disable-next-line no-console
        console.log('useAuctionData error raw:', JSON.stringify(error));
      } catch {
        // eslint-disable-next-line no-console
        console.log('useAuctionData error raw (unstringifiable):', error);
      }
      setError(error instanceof Error ? error : new Error(String(error)));
      // Не показываем "Аукцион не найден", если запрос был отменён (StrictMode/AbortController)
      if (!isCancelError(error)) {
        handleBusinessLogicError(error, { auctionId, context: 'useAuctionData' });
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [setLoading, setError, setAuction, setBids]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const { signal } = controller;
    fetchAuction(id, signal);
    return () => {
      controller.abort();
    };
  }, [id, fetchAuction]);

  const refresh = useCallback(async () => {
    if (id) {
      try {
        await fetchAuction(id);
      } catch (error) {
        handleError(error, 'Не удалось обновить данные аукциона', undefined);
      }
    }
  }, [id, fetchAuction]);

  return {
    auction,
    bids,
    loading,
    error,
    refresh,
    setAuction,
    setBids,
  };
};