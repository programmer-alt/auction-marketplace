import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import AuctionDetails from './pages/AuctionDetails'
import CreateAuction from './pages/CreateAuction'
import EditAuction from './pages/EditAuction'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Payment from './pages/Payment'
import About from './pages/About'
import Contacts from './pages/Contacts'
import { useAuthStore } from './store/auth.store'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
      <Layout>
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
            path="/payment/:id"
            element={isAuthenticated ? <Payment /> : <Navigate to="/login" />}
          />
          <Route path="/about" element={<About />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App