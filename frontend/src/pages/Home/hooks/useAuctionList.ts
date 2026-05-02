import { useState, useEffect, useRef, useCallback } from 'react';
import { auctionsApi } from '../../../api/auctions';
import { Auction } from '../../../types';

export const useAuctionList = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchAuctions = async () => {
      setLoading(true);
      try {
        const data = await auctionsApi.getAuctions({
          page,
          limit: 12,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        });
        setAuctions(data.auctions || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch {
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAuctions();
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
