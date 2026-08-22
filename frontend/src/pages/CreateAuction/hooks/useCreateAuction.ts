import { auctionsApi } from "@/api/auctions";
import type { ApiResponse, AsyncState } from "@/types/advanced";
import { isApiSuccess } from "@/types/advanced";
import { markErrorAsHandled } from "@/utils/errorHandler";
import { useCallback, useRef, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

type CreateAuctionData = {
  title: string;
  description: string;
  startingPrice: string;
  endsAt: string;
};

export const useCreateAuction = () => {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<AsyncState<string>>({ status: "idle" });

  const form = useForm<CreateAuctionData>({
    defaultValues: {
      title: "",
      description: "",
      startingPrice: "",
      endsAt: "",
    },
  });

  const formState = useFormState(form);
  const isLoading = uploadState.status === "loading";

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const isSubmittingRef = useRef(false);

  const onSubmit = useCallback(
    async (data: CreateAuctionData): Promise<boolean> => {
      if (!formState.isValid) {
        toast.error("Заполните все обязательные поля корректно");
        return false;
      }

      if (isSubmittingRef.current) {
        return false;
      }

      isSubmittingRef.current = true;
      setUploadState({ status: "loading" });

      try {
        let imageUrl: string | undefined;
        if (imageFile) {
          const uploadResult = await auctionsApi.uploadImage(imageFile);
          if (isApiSuccess(uploadResult)) {
            imageUrl = uploadResult.data;
          }
        }

        const result = (await auctionsApi.createAuction({
          title: data.title,
          description: data.description || undefined,
          imageUrl,
          startingPrice: Number.parseFloat(data.startingPrice),
          endsAt: new Date(data.endsAt).toISOString(),
        })) as ApiResponse<any>;

        if (isApiSuccess(result)) {
          toast.success("Аукцион успешно создан!");
          navigate("/");
          return true;
        }
        toast.error(result.error || "Не удалось создать аукцион");
        return false;
      } catch (error: any) {
        toast.error(error.message || "Не удалось создать аукцион");
        // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
        markErrorAsHandled(error);
        return false;
      } finally {
        setUploadState({ status: "idle" });
        isSubmittingRef.current = false;
      }
    },
    [formState.isValid, imageFile, navigate],
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return {
    form,
    isLoading,
    imagePreview,
    handleImageChange,
    removeImage,
    onSubmit,
    minDate,
    uploadState,
  };
};
