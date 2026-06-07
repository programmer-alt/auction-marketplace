import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Получаем CSRF токен при старте и сохраняем промис
let csrfReady: Promise<any> | null = api.get('/csrf-token').catch((err) => {
  console.error('CSRF token fetch failed:', err)
})

// Request interceptor для добавления токена и CSRF
api.interceptors.request.use(
  async (config) => {
    const { token } = useAuthStore.getState()
    
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    
    // Не добавляем CSRF токен для auth endpoints (они защищены JWT)
    const isAuthEndpoint = config.url?.startsWith('/auth') || config.url?.startsWith('/api/auth');
    
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '') && !isAuthEndpoint) {
      if (!getCsrfToken()) {
        await csrfReady
      }
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers.set('X-CSRF-Token', csrfToken)
      }
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

let isRedirecting = false

// Response interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.response?.data?.message || 'Произошла ошибка'
    
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true
      useAuthStore.getState().logout()
      window.location.href = '/login'
    } else if (error.response?.status === 403) {
      toast.error('Доступ запрещен')
    } else if (error.response?.status === 429) {
      toast.error('Слишком много запросов. Попробуйте позже.')
    } else if (error.response?.status >= 500) {
      toast.error('Ошибка сервера. Пожалуйста, попробуйте позже.')
    } else {
      toast.error(message)
    }
    
    return Promise.reject(error)
  }
)

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrfToken='))
  if (!match) return null
  return decodeURIComponent(match.substring('csrfToken='.length))
}

export default api
