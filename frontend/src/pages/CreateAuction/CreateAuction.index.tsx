import ImageUploader from "@/components/shared/ImageUploader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ArrowLeft, Calendar, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useCreateAuction } from "./hooks/useCreateAuction";

export default function CreateAuction() {
  const { form, isLoading, imagePreview, handleImageChange, removeImage, onSubmit, minDate } = useCreateAuction();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Назад к аукционам
      </Link>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary-100 p-3 rounded-full">
            <Plus className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Создать аукцион</h1>
            <p className="text-gray-600 text-sm">Заполните информацию о вашем товаре</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              type="text"
              className="input-field"
              placeholder="Например: iPhone 15 Pro Max 256GB"
              {...register("title", { required: "Название обязательно" })}
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Подробное описание товара..."
              {...register("description")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Фотография</label>
            <ImageUploader preview={imagePreview} onFileChange={handleImageChange} onRemove={removeImage} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-startingPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Начальная цена ($) *
              </label>
              <input
                id="create-startingPrice"
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                placeholder="100"
                {...register("startingPrice", {
                  required: "Начальная цена обязательна",
                  min: { value: 0.01, message: "Минимальная цена $0.01" },
                })}
              />
              {errors.startingPrice && <p className="mt-1 text-sm text-red-600">{errors.startingPrice.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="datetime-local"
                  className="input-field pl-10"
                  min={minDate}
                  {...register("endsAt", { required: "Дата окончания обязательна" })}
                />
              </div>
              {errors.endsAt && <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner /> Создание...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" /> Создать аукцион
                </>
              )}
            </button>
            <Link to="/" className="btn-secondary">
              Отмена
            </Link>
          