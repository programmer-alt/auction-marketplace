import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white border-t mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} Auction Marketplace. Все права защищены.
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <Link to="/" className="hover:text-primary-600 transition-colors">
              Аукционы
            </Link>
            <span className="text-gray-400">|</span>
            <Link to="/about" className="hover:text-primary-600 transition-colors">
              О нас
            </Link>
            <span className="text-gray-400">|</span>
            <Link to="/contacts" className="hover:text-primary-600 transition-colors">
              Контакты
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
