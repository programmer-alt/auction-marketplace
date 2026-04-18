import React from 'react';
import { CheckCircle } from 'lucide-react';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';

interface CardFormProps {
  cardNumber: string;
  expiry: string;
  cvv: string;
  processing: boolean;
  currentPrice: number;
  onCardNumber: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExpiry: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCvv: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const CardForm: React.FC<CardFormProps> = ({
  cardNumber, expiry, cvv, processing, currentPrice,
  onCardNumber, onExpiry, onCvv, onSubmit,
}) => (
  <form onSubmit={onSubmit} className="space-y-5">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Номер карты</label>
      <input
        type="text"
        className="input-field"
        placeholder="4242 4242 4242 4242"
        value={cardNumber}
        onChange={onCardNumber}
        maxLength={19}
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Срок действия</label>
        <input
          type="text"
          className="input-field"
          placeholder="MM/YY"
          value={expiry}
          onChange={onExpiry}
          maxLength={5}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
        <input
          type="password"
          className="input-field"
          placeholder="•••"
          value={cvv}
          onChange={onCvv}
          maxLength={3}
        />
      </div>
    </div>

    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
      <p>🔒 Тестовый режим: используйте карту <code className="bg-blue-100 px-1 rounded">4242 4242 4242 4242</code> с любой датой и CVV</p>
    </div>

    <button
      type="submit"
      disabled={processing || cardNumber.length < 19}
      className="w-full btn-primary flex items-center justify-center gap-2"
    >
      {processing ? (
        <><LoadingSpinner /> Обработка...</>
      ) : (
        <><CheckCircle className="h-5 w-5" /> Оплатить ${currentPrice}</>
      )}
    </button>
  </form>
);

export default CardForm;
