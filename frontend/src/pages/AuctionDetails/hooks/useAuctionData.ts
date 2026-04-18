import { useState, useEffect, useCallback } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { bidsApi } from '../../../api/bids';
import { Auction, Bid } from '../../../types';
import toast from 'react-hot-toast';

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
      // Проверяем, не отменен ли запрос
      if (signal?.aborted) return;
      setAuction(data);
      try {
        const bidsData = await bidsApi.getAuctionBids(Number(auctionId), signal);
        if (signal?.aborted) return;
        setBids(bidsData?.bids || []);
      } catch (error) {
        // Игнорируем ошибку отмены запроса
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (error && typeof error === 'object' && ('name' in error || 'code' in error)) {
          const err = error as { name?: string; code?: string };
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
            return;
          }
        }
        console.error('Ошибка при загрузке ставок:', error);
        setBids([]);
      }
    } catch (error) {
      // Игнорируем ошибку отмены запроса
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Ошибка при загрузке аукциона:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      toast.error('Аукцион не найден');
    } finally {
      // Устанавливаем loading false только если запрос не был отменен
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
      } catch {
        toast.error('Не удалось обновить данные аукциона');
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