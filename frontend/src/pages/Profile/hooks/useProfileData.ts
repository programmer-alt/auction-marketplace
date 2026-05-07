import { useState, useEffect } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { Auction } from '../../../types';
import type { User } from '../../../types/advanced';
import toast from 'react-hot-toast';

export const useProfileData = (user: User | null) => {
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [wonAuctions, setWonAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await auctionsApi.getAuctions({ page: 1, limit: 50 });
        
        if ('success' in data && data.success) {
          const all = data.data?.auctions || [];
          setMyAuctions(all.filter((a: Auction) => a.sellerId === user.id));
          setWonAuctions(all.filter((a: Auction) => a.winnerId === user.id && a.status === 'COMPLETED'));
        } else {
          throw new Error(data.error || 'Ошибка загрузки аукционов');
        }
      } catch (error) {
        toast.error('Не удалось загрузить данные');
        console.error('Failed to fetch auctions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  return { myAuctions, wonAuctions, loading };
};
