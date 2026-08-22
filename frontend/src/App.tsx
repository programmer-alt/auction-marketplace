import api from "@/api/axios";
import Layout from "@/components/layout/Layout";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/store/auth.store";
import { type ReactNode, Suspense, lazy, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

// Lazy loaded components for code splitting
const Home = lazy(() => import("@/pages/Home/Home.index"));
const AuctionDetails = lazy(() => import("@/pages/AuctionDetails/AuctionDetails.index"));
const CreateAuction = lazy(() => import("@/pages/CreateAuction/CreateAuction.index"));
const EditAuction = lazy(() => import("@/pages/EditAuction/EditAuction.index"));
const Login = lazy(() => import("@/pages/Login/Login.index"));
const Register = lazy(() => import("@/pages/Register/Register.index"));
const Profile = lazy(() => import("@/pages/Profile/Profile.index"));
const Payment = lazy(() => import("@/pages/Payment/Payment.index"));
const PaymentResult = lazy(() => import("@/pages/Payment/PaymentResult"));
const About = lazy(() => import("@/pages/About/About.index"));
const Contacts = lazy(() => import("@/pages/Contacts/Contacts.index"));

// Компонент для инициализации аутентификации
function AuthInitializer() {
  const { login, seedAccessToken, setLoading, isInitialized, setIsInitialized } = useAuthStore();

  useEffect(() => {
    // Если уже инициализировано, ничего не делаем
    if (isInitialized) {
      return;
    }

    // Проверяем аутентификацию при запуске приложения
    const initializeAuth = async () => {
      setLoading(true);

      try {
        const { authApi } = await import("@/api/auth");

        // 1) Сначала обновляем accessToken через refresh cookie
        const refreshResponse = await api.post("/auth/refresh");

        if (!refreshResponse) {
          // Refresh не прошёл (например 403: refresh токен не найден/устарел)
          // Значит пользователь не авторизован — сбрасываем auth state.
          const { token } = useAuthStore.getState();
          if (token) {
            useAuthStore.getState().logout();
          }
          return;
        }

        const { accessToken } = refreshResponse.data;

        // 2) Сохраняем access token в store ДО запроса /me,
        // чтобы axios interceptor добавил Authorization для authApi.getMe().
        // Типобезопасно: не поднимаем временный user, пока не получили /me.
        seedAccessToken(accessToken);

        const userData = await authApi.getMe();
        if (userData) {
          login(accessToken, userData);
        }
      } catch (error: any) {
        // Если /me упал из-за невалидного токена (обычно 401/403) — очищаем token,
        // чтобы axios interceptor больше не слал Authorization.
        // Если же проблема временная (сеть/5xx) — не выкидываем пользователя.
        const status = error?.response?.status;

        if (status === 401 || status === 403) {
          const { token } = useAuthStore.getState();
          if (token) {
            useAuthStore.getState().logout();
          }
        }
        console.debug("Проверка аутентификации завершена, пользователь не авторизован");
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };
    initializeAuth();
  }, []); // Пустой массив зависимостей для однократного выполнения

  return null;
}

// Компонент для защиты маршрутов, требующих аутентификации
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // Пока идет инициализация, показываем спиннер
  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  // Если пользователь не аутентифицирован, перенаправляем на страницу логина
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Если аутентифицирован, показываем защищенный контент
  return children;
}

function App() {
  const { isLoading } = useAuthStore();

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
              element={
                <ProtectedRoute>
                  <CreateAuction />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auctions/:id/edit"
              element={
                <ProtectedRoute>
                  <EditAuction />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/result"
              element={
                <ProtectedRoute>
                  <PaymentResult />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/:id"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;
