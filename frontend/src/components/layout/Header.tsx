import { useAuthStore } from "@/store/auth.store";
import { LogIn, LogOut, ShoppingBag, User, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-primary-700">
              <ShoppingBag className="h-8 w-8" />
              <span>Auction Marketplace</span>
            </Link>

            <nav className="hidden md:flex space-x-6">
              <Link to="/" className="text-gray-700 hover:text-primary-600 font-medium">
                Аукционы
              </Link>
              {isAuthenticated && (
                <>
                  <Link to="/auctions/new" className="text-gray-700 hover:text-primary-600 font-medium">
                    Создать аукцион
                  </Link>
                  <Link to="/profile" className="text-gray-700 hover:text-primary-600 font-medium">
                    Мой профиль
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">{user?.name || user?.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-gray-700 hover:text-red-600"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center space-x-2 text-gray-700 hover:text-primary-600">
                  <LogIn className="h-5 w-5" />
                  <span className="hidden sm:inline">Войти</span>
                </Link>
                <Link to="/register" className="btn-primary flex items-center space-x-2">
                  <UserPlus className="h-5 w-5" />
                  <span>Регистрация</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
