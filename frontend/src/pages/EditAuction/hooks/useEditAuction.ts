import { useState, useEffect } from 'react';
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

export const useEditAuction = (id: string | undefined) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const form = useForm<FormData>();

  useEffect(() => {
    if (!id) return;
    auctionsApi.getAuctionById(Number(id)).then((auction) => {
      if (!auction) return;
      const endsAt = new Date(auction.endsAt);
      const localEndsAt = new Date(endsAt.getTime() - endsAt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      form.reset({
        title: auction.title,
        description: auction.description || '',
        startingPrice: String(auction.startingPrice),
        endsAt: localEndsAt,
      });
      setCurrentImageUrl(auction.imageUrl);
    }).catch(() => {
      toast.error('Аукцион не найден');
      navigate('/');
    });
  }, [id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const onSubmit = async (data: FormData) => {
    if (!id) return;
    setIsLoading(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (imageFile) imageUrl = await auctionsApi.uploadImage(imageFile);
      else if (removeImage) imageUrl = null;

      await auctionsApi.updateAuction(Number(id), {
        title: data.title,
        description: data.description || undefined,
        ...(imageUrl !== undefined && { imageUrl: imageUrl ?? undefined }),
        startingPrice: parseFloat(data.startingPrice),
        endsAt: new Date(data.endsAt).toISOString(),
      });
      toast.success('Аукцион обновлён!');
      navigate(`/auctions/${id}`);
    } catch {
      toast.error('Не удалось обновить аукцион');
    } finally {
      setIsLoading(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  const displayImage = imagePreview || (removeImage ? null : currentImageUrl);

  return { form, isLoading, displayImage, handleImageChange, handleRemoveImage, onSubmit, minDate };
};
