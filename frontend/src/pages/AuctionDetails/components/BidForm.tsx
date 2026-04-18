import React from 'react';
import { Send } from 'lucide-react';
import { Auction } from '../../../types';

interface BidFormProps {
  auction: Auction;
  onSubmit: (amount: number) => Promise<boolean>;
  isSubmitting: boolean;
  bidAmount: string;
  setBidAmount: (value: string) => void;
  error?: string | null;
}

const BidForm: React.FC<BidFormProps> = ({
  auction,
  onSubmit,
  isSubmitting,
  bidAmount,
  setBidAmount,
  error,
}) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (!isNaN(amount)) {
      await onSubmit(amount);
    }
  };

  return (
    <div className="card sticky top-4">
      <h3 className="text-lg font-bold mb-4">Сделать ставку</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Минимальная ставка
          </label>
          <div className="text-2xl font-bold text-primary-600 mb-2">
            ${(auction.currentPrice + 1).toFixed(2)}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ваша ставка
          </label>
          <input
            type="number"
            step="0.01"
            className={`input-field ${error ? 'border-red-500' : ''}`}
            placeholder="Введите сумму"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            min={auction.currentPrice + 0.01}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !bidAmount || !!error}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Размещение...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Разместить ставку
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default React.memo(BidForm);