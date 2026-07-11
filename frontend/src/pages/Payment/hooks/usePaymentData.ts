import { useState, useEffect } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { User, isApiSuccess, isApiError } from '../../../types';
import { handleError, handleBusinessLogicError } from '../../../utils/universalErrorHandler';

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
            handleBusinessLogicError(new Error('Только победитель аукциона может произвести оплату'), { 
              userId: user.id, 
              winnerId: auctionData.winnerId, 
              auctionId: Number(id),
              context: 'payment-authorization' 
            });
            return;
          }
          
          // Проверяем статус аукциона
          if (auctionData.status !== 'COMPLETED') {
            handleBusinessLogicError(new Error('Оплата возможна только за завершенные аукционы'), { 
              status: auctionData.status, 
              auctionId: Number(id),
              context: 'payment-status-check' 
            });
            return;
          }
          
          setAuction(data.data);
        } else if (isApiError(data)) {
          // Теперь мы уверены, что data - это ApiError, и свойство error существует
          handleBusinessLogicError(new Error(data.error || 'Аукцион не найден'), { 
            auctionId: Number(id), 
            context: 'auction-not-found' 
          });
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных аукциона для оплаты:', error);
        handleError(error, 'Ошибка при загрузке данных аукциона', undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchAuction();
  }, [id, user]);

  return { auction, loading };
};