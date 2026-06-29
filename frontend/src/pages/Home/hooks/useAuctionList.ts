import { useState, useEffect, useRef, useCallback } from 'react';
import { auctionsApi } from '../../../api/auctions';
import type { Auction } from '../../../types';


export const useAuctionList = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);
 
  useEffect(() => {
    const controller = new AbortController();

    const fetchAuctions = async () => {
      setLoading(true);
      try {
        const response = await auctionsApi.getAuctions({
          page,
          limit: 12,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        });

        if ('success' in response && response.success) {
          const { data } = response;
          setAuctions(data.auctions || []);
          setTotalPages(data.pagination?.totalPages || 1);
          fetchedRef.current = true;
        } else {
          throw new Error(response.error || 'Ошибка загрузки аукционов');
        }
      } catch (e) {
        // ignore abort
        setAuctions([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchAuctions();

    return () => {
      controller.abort();
    };
  }, [page, statusFilter, debouncedSearch]);


  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return {
    auctions,
    loading,
    search,
    setSearch: handleSearch,
    statusFilter,
    setStatusFilter: handleStatusFilter,
    page,
    setPage: handlePageChange,
    totalPages,
  };
};
