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

// Глобальный промис для получения CSRF токена
let csrfToken: string | null = null
let csrfReady: Promise<void> | null = null

// Получаем CSRF токен при старте
function fetchCsrfToken(): Promise<void> {
  if (csrfReady) return csrfReady
  
  csrfReady = api.get<{ csrfToken: string }>('/csrf-token')
    .then(response => {
      csrfToken = response.data.csrfToken
    })
    .catch((err) => {
      console.error('CSRF token fetch failed:', err)
    })
  
  return csrfReady
}

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
      if (!csrfToken) {
        await fetchCsrfToken()
      }
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

export default api
