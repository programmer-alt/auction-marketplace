import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { auctionsApi } from '../api/auctions'
import { Auction } from '../types'
import { ArrowLeft, CreditCard, CheckCircle, XCircle, DollarSign, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Payment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [auction, setAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  useEffect(() => {
    const fetchAuction = async () => {
      if (!id) return
      setLoading(true)
      try {
        const data = await auctionsApi.getAuctionById(Number(id))
        if (data.status !== 'COMPLETED') {
          toast.error('Оплата доступна только для завершённых аукционов')
          navigate(`/auctions/${id}`)
          return
        }
        if (data.winnerId !== user?.id) {
          toast.error('Вы не являетесь победителем этого аукциона')
          navigate(`/auctions/${id}`)
          return
        }
        setAuction(data)
      } catch {
        toast.error('Не удалось загрузить аукцион')
        navigate('/')
      } finally {
        setLoading(false)
      }
    }

    fetchAuction()
  }, [id, user, navigate])

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auction || !id) return

    setProcessing(true)
    try {
      // В реальном приложении здесь был бы вызов Stripe Elements
      // Имитация оплаты
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast.success('Платёж успешно обработан!')
      navigate('/profile')
    } catch {
      toast.error('Ошибка оплаты. Попробуйте ещё раз.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-10 bg-gray-200 rounded w-full" />
        </div>
      </div>
    )
  }

  if (!auction) return null

  return (
    <div className="max-w-lg mx-auto">
      <Link
        to={`/auctions/${id}`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к аукциону
      </Link>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-100 p-3 rounded-full">
            <CreditCard className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Оплата</h1>
            <p className="text-gray-600 text-sm">Безопасная оплата через Stripe</p>
          </div>
        </div>

        {/* Auction summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShoppingBag className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{auction.title}</h3>
              <p className="text-sm text-gray-500">
                Продавец: {auction.seller.name || auction.seller.email}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-gray-600 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Итого к оплате:
            </span>
            <span className="text-2xl font-bold text-primary-600">
              ${auction.currentPrice}
            </span>
          </div>
        </div>

        {/* Payment form (demo) */}
        <form onSubmit={handlePayment} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер карты
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                setCardNumber(v.replace(/(.{4})/g, '$1 ').trim())
              }}
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Срок действия
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 4)
                  if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2)
                  setExpiry(v)
                }}
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CVV
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="•••"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
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
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Обработка...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Оплатить ${auction.currentPrice}
              </>
            )}
          </button>
        </form>

        {/* Security info */}
        <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              SSL шифрование
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-green-500" />
              Безопасные платежи
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
