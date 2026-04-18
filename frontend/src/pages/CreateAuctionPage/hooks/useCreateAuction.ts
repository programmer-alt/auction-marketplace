import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { auctionsApi } from '../../../api/auctions';
import toast from 'react-hot-toast';

interface FormData {
  title: string;
  description: string;
  startingPrice: string;
  endsAt: string;
}

export const useCreateAuction = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    defaultValues: { title: '', description: '', startingPrice: '', endsAt: '' },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const imageUrl = imageFile ? await auctionsApi.uploadImage(imageFile) : undefined;
      await auctionsApi.createAuction({
        title: data.title,
        description: data.description || undefined,
        imageUrl,
        startingPrice: parseFloat(data.startingPrice),
        endsAt: new Date(data.endsAt).toISOString(),
      });
      toast.success('Аукцион успешно создан!');
      navigate('/');
    } catch {
      toast.error('Не удалось создать аукцион');
    } finally {
      setIsLoading(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return { form, isLoading, imagePreview, handleImageChange, removeImage, onSubmit, minDate };
};
