import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionsApi } from '../../../api/auctions';
import { Auction } from '../../../types';
import { User } from '../../../types';
import toast from 'react-hot-toast';

export const usePaymentData = (id: string | undefined, user: User | null) => {
  const navigate = useNavigate();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await auctionsApi.getAuctionById(Number(id));
        if (data.status !== 'COMPLETED') {
          toast.error('Оплата доступна только для завершённых аукционов');
          navigate(`/auctions/${id}`);
          return;
        }
        if (data.winnerId !== user?.id) {
          toast.error('Вы не являетесь победителем этого аукциона');
          navigate(`/auctions/${id}`);
          return;
        }
        setAuction(data);
      } catch {
        toast.error('Не удалось загрузить аукцион');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, user, navigate]);

  return { auction, loading };
};
