import { useState, useCallback } from 'react';
import { bidsApi } from '../../../api/bids';
import toast from 'react-hot-toast';
import type { 
  AsyncState, 
  Bid
} from '../../../types/advanced';
import { markErrorAsHandled } from '../../../utils/errorHandler';

export interface BidFormData {
  amount: number;
}

export const useBidForm = (auctionId: number | undefined, currentPrice: number | undefined) => {
  const [bidState, setBidState] = useState<AsyncState<Bid>>({ status: 'idle' });
  const [bidAmount, setBidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateBid = useCallback((amount: string): string | null => {
    if (!auctionId) {
      return 'Аукцион не выбран';
    }
    if (!currentPrice) {
      return 'Неизвестна текущая цена';
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return 'Введите корректную сумму';
    }
    if (numAmount <= currentPrice) {
      return `Ставка должна быть больше ${currentPrice}`;
    }
    if (numAmount > currentPrice * 10) {
      return 'Ставка слишком велика (превышает текущую цену более чем в 10 раз)';
    }
    return null;
  }, [auctionId, currentPrice]);

  const submitBid = useCallback(async (amount: number): Promise<boolean> => {
    if (!auctionId) {
      setError('Аукцион не выбран');
      return false;
    }

    const amountStr = String(amount);
    const validationError = validateBid(amountStr);
    if (validationError) {
      setError(validationError);
      return false;
    }

    setIsSubmitting(true);
    setError(null);
    setBidState({ status: 'loading' });

    try {
      if (!auctionId) {
        throw new Error('Аукцион не выбран');
      }
      const bid = await bidsApi.createBid(auctionId, { amount });
      setBidState({ status: 'success', data: bid, updatedAt: new Date() });
      toast.success('Ставка принята!');
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Ошибка при размещении ставки';
      setError(errorMessage);
      setBidState({ status: 'error', error: errorMessage, retryCount: 0 });
      toast.error(errorMessage);
      // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
      markErrorAsHandled(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [auctionId, validateBid]);

  const resetForm = useCallback(() => {
    setBidAmount('');
    setError(null);
    setBidState({ status: 'idle' });
  }, []);

  return {
    bidAmount,
    setBidAmount,
    isSubmitting,
    submitBid,
    error,
    bidState,
    resetForm,
    validateBid
  };
};