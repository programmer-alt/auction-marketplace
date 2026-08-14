import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/api/auth'
import { loginSchema, LoginFormData } from '@/utils/validation/auth.schema'
import { LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import ScanLine from '@/components/effects/ScanLine'

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      const { token, user } = await authApi.login(data)
      login(token, user)
      toast.success('Вход выполнен успешно!')
      navigate('/')
    } catch (error) {
      console.error('Login error')
      toast.error('Ошибка входа. Проверьте email и пароль.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto relative">
      <ScanLine
        color="#0f0"
        thickness={3}
        duration={8}
        delay={0}
        highlightIntensity={0.7}
        highlightWidth={200}
      />
      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.005);
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .animate-pulse-button {
          animation: pulse-slow 2.5s ease-in-out infinite;
        }
      `}</style>
      <div className="card animate-pulse-slow">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-primary-100 p-3 rounded-full">
            <LogIn className="h-8 w-8 text-primary-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">Вход в аккаунт</h1>
        <p className="text-gray-600 text-center mb-8">
          Введите свои данные для входа
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              data-testid="login-email"
              type="email"
              className="input-field animate-pulse-glow"
              placeholder="your@email.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              id="password"
              data-testid="login-password"
              type="password"
              className="input-field animate-pulse-glow"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            data-testid="login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary flex items-center justify-center animate-pulse-button"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Вход...
              </span>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
