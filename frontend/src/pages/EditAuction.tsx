import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Calendar } from 'lucide-react';
import ImageUploader from '../components/shared/ImageUploader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useEditAuction } from './EditAuctionPage/hooks/useEditAuction';

export default function EditAuction() {
  const { id } = useParams<{ id: string }>();
  const { form, isLoading, displayImage, handleImageChange, handleRemoveImage, onSubmit, minDate } = useEditAuction(id);
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/auctions/${id}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Назад к аукциону
      </Link>

      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Редактировать аукцион</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input type="text" className="input-field" {...register('title', { required: 'Название обязательно' })} />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea className="input-field" rows={4} {...register('description')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Фотография</label>
            <ImageUploader preview={displayImage} onFileChange={handleImageChange} onRemove={handleRemoveImage} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Начальная цена ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                {...register('startingPrice', {
                  required: 'Цена обязательна',
                  min: { value: 0.01, message: 'Минимум $0.01' },
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
                  {...register('endsAt', { required: 'Дата обязательна' })}
                />
              </div>
              {errors.endsAt && <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isLoading ? <><LoadingSpinner /> Сохранение...</> : <><Save className="h-5 w-5" /> Сохранить</>}
            </button>
            <Link to={`/auctions/${id}`} className="btn-secondary">Отмена</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
