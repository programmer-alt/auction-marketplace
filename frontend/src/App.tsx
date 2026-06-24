import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import { useAuthStore } from './store/auth.store'
import LoadingSpinner from './components/shared/LoadingSpinner'

// Lazy loaded components for code splitting
const Home = lazy(() => import('./pages/Home/Home.index'))
const AuctionDetails = lazy(() => import('./pages/AuctionDetails/AuctionDetails.index'))
const CreateAuction = lazy(() => import('./pages/CreateAuction/CreateAuction.index'))
const EditAuction = lazy(() => import('./pages/EditAuction/EditAuction.index'))
const Login = lazy(() => import('./pages/Login/Login.index'))
const Register = lazy(() => import('./pages/Register/Register.index'))
const Profile = lazy(() => import('./pages/Profile/Profile.index'))
const Payment = lazy(() => import('./pages/Payment/Payment.index'))
const PaymentResult = lazy(() => import('./pages/Payment/PaymentResult'))
const About = lazy(() => import('./pages/About/About.index'))
const Contacts = lazy(() => import('./pages/Contacts/Contacts.index'))

// Компонент для инициализации аутентификации
function AuthInitializer() {
  const { login, setLoading } = useAuthStore();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
   

    // Проверяем аутентификацию при запуске приложения
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        // Пытаемся получить данные текущего пользователя
        // Если пользователь был залогинен ранее, и refresh токен все еще валиден,
        // сервер вернет данные пользователя
        const { authApi } = await import('./api/auth');
        
        // Пробуем получить данные пользователя
        const userData = await authApi.getMe();
        
        if (userData) {
          // Пользователь аутентифицирован, пробуем обновить токен через refresh
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include', // важно для отправки HTTP-only cookies
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const { accessToken } = await response.json();
            // Обновляем состояние с новым токеном и данными пользователя
            login(accessToken, userData);
          } else {
            // Если refresh не удался, но мы получили данные пользователя,
            // возможно, access токен еще не истек, просто обновляем данные
            // без обновления токена
            login(useAuthStore.getState().token || '', userData);
          }
        }
      } catch (error) {
        // Если бэкенд еще не запущен или другая ошибка - просто отмечаем инициализацию как завершенную
        // и пользователь останется неавторизованным, что нормально
        console.debug('Проверка аутентификации завершена, пользователь не авторизован');
      } finally {
        setLoading(false);
        setHasInitialized(true);
      }
    };
    
    initializeAuth();
   
  }, [hasInitialized]); // Добавляем hasInitialized в зависимости, чтобы предотвратить лишние вызовы

  return null; 
}

function App() {
  const { isAuthenticated, isLoading } = useAuthStore()

  // Показываем загрузку, пока проверяем аутентификацию
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
      {/* Инициализация аутентификации */}
      <AuthInitializer />
      <Layout>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auctions/:id" element={<AuctionDetails />} />
          <Route
            path="/auctions/new"
            element={isAuthenticated ? <CreateAuction /> : <Navigate to="/login" />}
          />
          <Route
            path="/auctions/:id/edit"
            element={isAuthenticated ? <EditAuction /> : <Navigate to="/login" />}
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" />}
          />
          <Route
            path="/payment/result"
            element={isAuthenticated ? <PaymentResult /> : <Navigate to="/login" />}
          />
          <Route
            path="/payment/:id"
            element={isAuthenticated ? <Payment /> : <Navigate to="/login" />}
          />
          <Route path="/about" element={<About />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  )
}

export default App
