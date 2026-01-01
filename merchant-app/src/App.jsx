import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import MerchantLogin from './pages/MerchantLogin'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Help from './pages/Help'
import Support from './pages/Support'
import Privacy from './pages/Privacy'
import Layout from './components/Layout'
import Toast from './components/Toast'
import ProtectedRoute, { AccessDenied } from './components/ProtectedRoute'
import { PermissionProvider } from './context/PermissionContext'
import './index.css'

function App() {
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if merchant is logged in
    const savedMerchant = localStorage.getItem('merchant')
    if (savedMerchant) {
      try {
        setMerchant(JSON.parse(savedMerchant))
      } catch (error) {
        console.error('Error parsing saved merchant:', error)
        localStorage.removeItem('merchant')
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = (merchantData) => {
    setMerchant(merchantData)
    localStorage.setItem('merchant', JSON.stringify(merchantData))
  }

  const handleLogout = () => {
    setMerchant(null)
    localStorage.removeItem('merchant')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-6 animate-pulse-glow"></div>
          <p className="text-surface-600 text-lg font-medium">Loading Merchant Portal...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <PermissionProvider>
        <div className="min-h-screen bg-gray-50">
          <Toast />
          <Routes>
            <Route
              path="/login"
              element={
                merchant ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <MerchantLogin onLogin={handleLogin} />
                )
              }
            />
            <Route
              path="/"
              element={
                merchant ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/*"
              element={
                merchant ? (
                  <Layout merchant={merchant} onLogout={handleLogout}>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard merchant={merchant} />} />
                      <Route 
                        path="/orders" 
                        element={
                          <ProtectedRoute 
                            requiredPermission="orders"
                            fallback={<AccessDenied feature="Order Management" />}
                          >
                            <Orders merchant={merchant} />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/products" 
                        element={
                          <ProtectedRoute 
                            requiredPermission="products"
                            fallback={<AccessDenied feature="Product Management" />}
                          >
                            <Products merchant={merchant} />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/analytics" 
                        element={
                          <ProtectedRoute 
                            requiredPermission="analytics"
                            fallback={<AccessDenied feature="Analytics Dashboard" />}
                          >
                            <Analytics merchant={merchant} />
                          </ProtectedRoute>
                        } 
                      />
                      <Route path="/settings" element={<Settings merchant={merchant} onLogout={handleLogout} />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Layout>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </div>
      </PermissionProvider>
    </Router>
  )
}

export default App
