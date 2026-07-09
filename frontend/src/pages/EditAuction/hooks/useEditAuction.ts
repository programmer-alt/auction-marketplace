import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFormState } from 'react-hook-form';
import { auctionsApi } from '../../../api/auctions';
import toast from 'react-hot-toast';
import type { 
  AsyncState, 
  ApiResponse, 
  AuctionDetail
} from '../../../types/advanced';
import { isApiSuccess } from '../../../types/advanced';
import { markErrorAsHandled } from '../../../utils/errorHandler';


type EditAuctionData = {
  title: string;
  description: string;
  startingPrice: string;
  endsAt: string;
};

export const useEditAuction = (id: string | undefined) => {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [auctionState, setAuctionState] = useState<AsyncState<AuctionDetail>>({ status: 'loading' });
  const [uploadState, setUploadState] = useState<AsyncState<string>>({ status: 'idle' });

  const form = useForm<EditAuctionData>();

  const formState = useFormState(form);

  useEffect(() => {
    if (!id) {
      setAuctionState({ status: 'error', error: 'ID аукциона не указан', retryCount: 0 });
      return;
    }

    const loadAuction = async () => {
      setAuctionState({ status: 'loading' });
      try {
        const result = await auctionsApi.getAuctionById(Number(id)) as ApiResponse<AuctionDetail>;
        
        if ('success' in result && result.success && result.data) {
          const auction = result.data;
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
          setAuctionState({ 
            status: 'success', 
            data: auction, 
            updatedAt: new Date() 
          });
        } else {
          const errorMessage = 'error' in result ? result.error : 'Аукцион не найден';
          throw new Error(errorMessage);
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Аукцион не найден';
        setAuctionState({ 
          status: 'error', 
          error: errorMsg, 
          retryCount: 0 
        });
        toast.error(errorMsg);
        // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
        markErrorAsHandled(error);
        navigate('/');
      }
    };

    loadAuction();
  }, [id, form, navigate]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  }, []);

  const onSubmit = useCallback(async (data: EditAuctionData): Promise<boolean> => {
    if (!id || !formState.isValid) {
      toast.error('Форма недействительна или ID отсутствует');
      return false;
    }

    setUploadState({ status: 'loading' });
    
    try {
      let imageUrl: string | null | undefined = undefined;
      if (imageFile) {
        const imageResult = await auctionsApi.uploadImage(imageFile);
        if ('success' in imageResult && imageResult.success) {
          imageUrl = imageResult.data;
        } else {
          throw new Error(imageResult.error || 'Ошибка загрузки изображения');
        }
      } else if (removeImage) {
        imageUrl = null;
      }

      // Используем обычный тип для обновления аукциона
      const updateData: Partial<EditAuctionData> = {
        title: data.title,
        description: data.description || undefined,
        ...(imageUrl !== undefined && { imageUrl }),
        startingPrice: data.startingPrice,
        endsAt: data.endsAt,
      };

      const result = await auctionsApi.updateAuction(Number(id), {
        ...data,
        startingPrice: parseFloat(data.startingPrice),
        endsAt: new Date(data.endsAt).toISOString(),
        imageUrl,
      }) as ApiResponse<any>;

      if (isApiSuccess(result)) {
        toast.success('Аукцион успешно обновлен!');
        navigate(`/auctions/${id}`);
        return true;
      } else {
        toast.error(result.error || 'Не удалось обновить аукцион');
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || 'Не удалось обновить аукцион');
      // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
      markErrorAsHandled(error);
      return false;
    } finally {
      setUploadState({ status: 'idle' });
    }
  }, [id, formState.isValid, imageFile, removeImage, navigate]);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  const displayImage = imagePreview || (removeImage ? null : currentImageUrl);

  return { 
    form, 
    formState,
    auctionState,
    uploadState,
    displayImage, 
    handleImageChange, 
    handleRemoveImage, 
    onSubmit, 
    minDate 
  };
};