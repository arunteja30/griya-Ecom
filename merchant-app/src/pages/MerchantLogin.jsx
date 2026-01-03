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
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/10 shadow-lg">
          {/* Mobile-first Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Merchant Portal</h1>
              <p className="text-white/70 text-xs sm:text-sm">Sign in with admin-assigned credentials</p>
            </div>
          </div>

          {/* Login Form - mobile first */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="merchant-id" className="block text-white/90 text-xs font-medium mb-1">Merchant ID</label>
              <input
                id="merchant-id"
                name="merchantId"
                inputMode="text"
                autoComplete="username"
                type="text"
                value={credentials.id}
                onChange={(e) => setCredentials({...credentials, id: e.target.value.toUpperCase()})}
                className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 text-base"
                placeholder="e.g. M12345"
                required
              />
            </div>

            <div>
              <label htmlFor="merchant-password" className="block text-white/90 text-xs font-medium mb-1">Password</label>
              <input
                id="merchant-password"
                name="password"
                autoComplete="current-password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 text-base"
                placeholder="Your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-primary-600 font-semibold py-3 rounded-lg hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/30 transition-shadow shadow-sm disabled:opacity-60 disabled:cursor-not-allowed text-base"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" aria-hidden></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center text-white/70 text-xs mt-1">
              <button
                type="button"
                onClick={() => showToast('Contact admin to reset credentials', 'info')}
                className="underline"
              >
                Forgot credentials?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default MerchantLogin