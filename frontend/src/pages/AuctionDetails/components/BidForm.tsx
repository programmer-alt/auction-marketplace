import React, { useState } from 'react';
import { Auction } from '../../../types';

interface BidFormProps {
  auction: Auction;
  onSubmit: (amount: number) => Promise<boolean>;
  isSubmitting: boolean;
  bidAmount: string; // Принимаем строку
  setBidAmount: (value: string) => void; // Устанавливаем строку
  error?: string;
}

const BidForm: React.FC<BidFormProps> = ({ 
  auction, 
  onSubmit, 
  isSubmitting, 
  bidAmount, 
  setBidAmount, 
  error 
}) => {
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(undefined);

    const amount = parseFloat(bidAmount);
    if (isNaN(amount)) {
      setLocalError('Введите корректную сумму');
      return;
    }

    if (amount <= auction.currentPrice) {
      setLocalError(`Ставка должна быть больше ${auction.currentPrice}`);
      return;
    }

    const success = await onSubmit(amount);
    if (success) {
      setBidAmount(''); // Сбрасываем поле ввода
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="font-semibold mb-3">Сделать ставку</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Текущая ставка: ${auction.currentPrice}</label>
          <input
            type="number"
            step="0.01"
            min={auction.currentPrice + 0.01}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="input-field w-full"
            placeholder={`Минимум ${(auction.currentPrice + 0.01).toFixed(2)}`}
            disabled={isSubmitting}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !bidAmount}
          className="btn-primary w-full"
        >
          {isSubmitting ? 'Обработка...' : 'Сделать ставку'}
        </button>
        {(error || localError) && (
          <div className="text-red-600 text-sm">
            {error || localError}
          </div>
        )}
      </div>
    </form>
  );
};

export default BidForm;