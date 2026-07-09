import { useState, useEffect } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { User } from '../../../types';
import toast from 'react-hot-toast';
import { markErrorAsHandled } from '../../../utils/errorHandler';
import { isApiError, isApiSuccess } from '../../../types/advanced';

export const usePaymentData = (id: string | undefined, user: User | null) => {
  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    
    const fetchAuction = async () => {
      try {
        setLoading(true);
        const data = await auctionsApi.getAuctionById(Number(id));
        
        if (isApiSuccess(data) && data.data) {
          const auctionData = data.data;
          
          // Проверяем, что пользователь является победителем аукциона
          if (auctionData.winnerId !== user.id) {
            toast.error('Только победитель аукциона может произвести оплату');
            return;
          }
          
          // Проверяем статус аукциона
          if (auctionData.status !== 'COMPLETED') {
            toast.error('Оплата возможна только за завершенные аукционы');
            return;
          }
          setAuction(data.data);
        } else if (isApiError(data)) {
          toast.error(data.error || 'Аукцион не найден');
          // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
          const errorObj = new Error(data.error || 'Аукцион не найден');
          markErrorAsHandled(errorObj);
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных аукциона для оплаты:', error);
        toast.error('Ошибка при загрузке данных аукциона');
        // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
        markErrorAsHandled(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuction();
  }, [id, user]);

  return { auction, loading };
};