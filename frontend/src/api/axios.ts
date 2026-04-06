import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Получаем CSRF токен при старте и сохраняем промис
const csrfReady = api.get('/csrf-token').catch(() => {})

// Request interceptor для добавления токена и CSRF
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token')
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      // Ждём получения CSRF-токена если он ещё не установлен
      if (!getCsrfToken()) {
        await csrfReady
      }
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }
    
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.response?.data?.message || 'Произошла ошибка'
    
    if (error.response?.status === 401) {
      // Неавторизован - очищаем токен и редиректим на логин
      localStorage.removeItem('token')
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