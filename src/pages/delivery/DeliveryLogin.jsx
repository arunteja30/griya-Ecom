import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/Toast';

export default function DeliveryLogin() {
  const [credentials, setCredentials] = useState({ id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Simple delivery person credentials - in production, use proper authentication
  const deliveryPersons = {
    'DEL001': { password: 'delivery123', name: 'John Doe', phone: '9876543210', vehicle: 'Bike' },
    'DEL002': { password: 'delivery123', name: 'Jane Smith', phone: '9876543211', vehicle: 'Bike' },
    'DEL003': { password: 'delivery123', name: 'Mike Johnson', phone: '9876543212', vehicle: 'Car' }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate login delay
    setTimeout(() => {
      const person = deliveryPersons[credentials.id];
      if (person && person.password === credentials.password) {
        // Store delivery person info in localStorage
        localStorage.setItem('deliveryPerson', JSON.stringify({
          id: credentials.id,
          ...person,
          loginTime: new Date().toISOString()
        }));
        showToast(`Welcome ${person.name}!`, 'success');
        navigate('/delivery/dashboard');
      } else {
        showToast('Invalid delivery ID or password', 'error');
      }
      setLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.removeItem('deliveryPerson');
    navigate('/delivery/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Delivery Portal</h1>
            <p className="text-white/70 text-sm">Sign in to manage your deliveries</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Delivery ID</label>
              <input
                type="text"
                value={credentials.id}
                onChange={(e) => setCredentials({...credentials, id: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                placeholder="Enter your delivery ID"
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-blue-600 font-semibold py-3 px-6 rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/70 text-xs mb-2 font-medium">Demo Credentials:</p>
            <div className="text-xs text-white/60 space-y-1">
              <p>ID: DEL001, Password: delivery123</p>
              <p>ID: DEL002, Password: delivery123</p>
              <p>ID: DEL003, Password: delivery123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}