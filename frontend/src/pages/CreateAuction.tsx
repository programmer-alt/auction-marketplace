import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { auctionsApi } from '../api/auctions'
import { ArrowLeft, Plus, Calendar, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface FormData {
  title: string
  description: string
  startingPrice: string
  endsAt: string
}

export default function CreateAuction() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { title: '', description: '', startingPrice: '', endsAt: '' },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        imageUrl = await auctionsApi.uploadImage(imageFile)
      }
      await auctionsApi.createAuction({
        title: data.title,
        description: data.description || undefined,
        imageUrl,
        startingPrice: parseFloat(data.startingPrice),
        endsAt: new Date(data.endsAt).toISOString(),
      })
      toast.success('Аукцион успешно создан!')
      navigate('/')
    } catch {
      toast.error('Не удалось создать аукцион')
    } finally {
      setIsLoading(false)
    }
  }

  // Минимальная дата — завтра
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 16)

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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Например: iPhone 15 Pro Max 256GB"
              {...register('title', { required: 'Название обязательно' })}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Подробное описание товара, его состояние и комплектация..."
              {...register('description')}
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Фотография
            </label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="preview" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Нажмите для загрузки</span>
                <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP до 5MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>

          {/* Starting price + End date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Начальная цена ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                placeholder="100"
                {...register('startingPrice', {
                  required: 'Начальная цена обязательна',
                  min: { value: 0.01, message: 'Минимальная цена $0.01' },
                })}
              />
              {errors.startingPrice && (
                <p className="mt-1 text-sm text-red-600">{errors.startingPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата окончания *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="datetime-local"
                  className="input-field pl-10"
                  min={minDate}
                  {...register('endsAt', {
                    required: 'Дата окончания обязательна',
                  })}
                />
              </div>
              {errors.endsAt && (
                <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Создание...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Создать аукцион
                </>
              )}
            </button>
            <Link to="/" className="btn-secondary">
              Отмена
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
