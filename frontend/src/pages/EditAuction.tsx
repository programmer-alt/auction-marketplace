import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { auctionsApi } from '../api/auctions'
import { ArrowLeft, Save, Calendar, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface FormData {
  title: string
  description: string
  startingPrice: string
  endsAt: string
}

export default function EditAuction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (!id) return
    auctionsApi.getAuctionById(Number(id)).then((auction) => {
      if (!auction) return
      const endsAt = new Date(auction.endsAt)
      const localEndsAt = new Date(endsAt.getTime() - endsAt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      reset({
        title: auction.title,
        description: auction.description || '',
        startingPrice: String(auction.startingPrice),
        endsAt: localEndsAt,
      })
      setCurrentImageUrl(auction.imageUrl)
    }).catch(() => {
      toast.error('Аукцион не найден')
      navigate('/')
    })
  }, [id])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!id) return
    setIsLoading(true)
    try {
      let imageUrl: string | null | undefined = undefined

      if (imageFile) {
        imageUrl = await auctionsApi.uploadImage(imageFile)
      } else if (removeImage) {
        imageUrl = null
      }

      await auctionsApi.updateAuction(Number(id), {
        title: data.title,
        description: data.description || undefined,
        ...(imageUrl !== undefined && { imageUrl: imageUrl ?? undefined }),
        startingPrice: parseFloat(data.startingPrice),
        endsAt: new Date(data.endsAt).toISOString(),
      })
      toast.success('Аукцион обновлён!')
      navigate(`/auctions/${id}`)
    } catch {
      toast.error('Не удалось обновить аукцион')
    } finally {
      setIsLoading(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 16)

  const displayImage = imagePreview || (!removeImage ? currentImageUrl : null)

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
            <input
              type="text"
              className="input-field"
              {...register('title', { required: 'Название обязательно' })}
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea className="input-field" rows={4} {...register('description')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Фотография</label>
            {displayImage ? (
              <div className="relative">
                <img src={displayImage} alt="preview" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
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
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Сохранить
                </>
              )}
            </button>
            <Link to={`/auctions/${id}`} className="btn-secondary">Отмена</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
