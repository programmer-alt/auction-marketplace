import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auction } from '../../../types';
import toast from 'react-hot-toast';

export const useCardForm = (auction: Auction | null) => {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(v.replace(/(.{4})/g, '$1 ').trim());
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
    setExpiry(v);
  };

  const handleCvv = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, 3));
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction) return;
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('Платёж успешно обработан!');
      navigate('/profile');
    } catch {
      toast.error('Ошибка оплаты. Попробуйте ещё раз.');
    } finally {
      setProcessing(false);
    }
  };

  return {
    processing,
    cardNumber,
    expiry,
    cvv,
    handleCardNumber,
    handleExpiry,
    handleCvv,
    handlePayment,
  };
};
