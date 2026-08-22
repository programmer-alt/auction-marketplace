import type { Auction } from "@/types";
import type React from "react";
import { useState } from "react";

interface BidFormProps {
  auction: Auction;
  onSubmit: (amount: number) => Promise<boolean>;
  isSubmitting: boolean;
  bidAmount: string; // Принимаем строку
  setBidAmount: (value: string) => void; // Устанавливаем строку
  error?: string;
}

const BidForm: React.FC<BidFormProps> = ({ auction, onSubmit, isSubmitting, bidAmount, setBidAmount, error }) => {
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(undefined);

    const amount = Number.parseFloat(bidAmount);
    if (Number.isNaN(amount)) {
      setLocalError("Введите корректную сумму");
      return;
    }

    const currentPrice = Number(auction.currentPrice) || 0;
    if (amount <= currentPrice) {
      setLocalError(`Ставка должна быть больше ${currentPrice}`);
      return;
    }

    const success = await onSubmit(amount);
    if (success) {
      setBidAmount(""); // Сбрасываем поле ввода
    }
  };

  const currentPrice = Number(auction.currentPrice) || 0;
  const minBid = currentPrice + 0.01;

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="font-semibold mb-3">Сделать ставку</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Текущая ставка: ${currentPrice}</label>
          <input
            type="number"
            step="0.01"
            min={minBid}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="input-field w-full"
            placeholder={`Минимум ${minBid.toFixed(2)}`}
            disabled={isSubmitting}
          />
        </div>
        <button type="submit" disabled={isSubmitting || !bidAmount} className="btn-primary w-full">
          {isSubmitting ? "Обработка..." : "Сделать ставку"}
        </button>
        {(error || localError) && <div className="text-red-600 text-sm">{error || localError}</div>}
      </div>
    </form>
  );
};

export default BidForm;
