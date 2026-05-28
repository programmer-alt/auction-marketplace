import { lazy, Suspense } from 'react'
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

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
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
