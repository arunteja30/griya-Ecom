import { useState } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'
import { showToast } from '../components/Toast'

const MerchantLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ id: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Fetch merchants from Firebase
      const merchantsRef = ref(db, '/merchants')
      const snapshot = await get(merchantsRef)
      
      if (!snapshot.exists()) {
        showToast('No merchants found. Please contact admin.', 'error')
        setLoading(false)
        return
      }

      const merchants = snapshot.val()
      let foundMerchant = null
      let merchantKey = null

      // Search for merchant by ID and password
      Object.entries(merchants).forEach(([key, merchant]) => {
        if (merchant.id === credentials.id && merchant.password === credentials.password) {
          foundMerchant = merchant
          merchantKey = key
        }
      })

      if (foundMerchant && foundMerchant.status === 'active') {
        // Store merchant info
        const merchantData = {
          ...foundMerchant,
          firebaseKey: merchantKey,
          loginTime: new Date().toISOString()
        }
        
        onLogin(merchantData)
        showToast(`Welcome ${foundMerchant.name}!`, 'success')
      } else if (foundMerchant && foundMerchant.status !== 'active') {
        showToast('Your account is not active. Please contact admin.', 'error')
      } else {
        showToast('Invalid credentials. Please try again.', 'error')
      }
    } catch (error) {
      console.error('Login error:', error)
      showToast('Login failed. Please try again.', 'error')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-blue-600 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Merchant Portal</h1>
            <p className="text-white/70 text-sm">Access requires admin-assigned credentials</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Merchant ID</label>
              <input
                type="text"
                value={credentials.id}
                onChange={(e) => setCredentials({...credentials, id: e.target.value.toUpperCase()})}
                className="w-full px-4 py-4 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-base"
                placeholder="Enter your merchant ID"
                required
              />
            </div>
            
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full px-4 py-4 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-base"
                placeholder="Enter your password"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-primary-600 font-semibold py-4 px-6 rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default MerchantLogin