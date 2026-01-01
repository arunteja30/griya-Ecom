import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../utils/toast';

export default function DeliveryLogin() {
  const [credentials, setCredentials] = useState({ id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Fetch drivers from Firebase
      const driversRef = ref(db, '/drivers');
      const snapshot = await get(driversRef);
      
      if (!snapshot.exists()) {
        showToast('No drivers found. Please contact admin.', 'error');
        setLoading(false);
        return;
      }

      const drivers = snapshot.val();
      let foundDriver = null;
      let driverKey = null;

      // Search for driver by ID and password
      Object.entries(drivers).forEach(([key, driver]) => {
        if (driver.id === credentials.id && driver.password === credentials.password) {
          foundDriver = driver;
          driverKey = key;
        }
      });

      if (foundDriver && foundDriver.status !== 'disabled') {
        // Store driver info in localStorage
        localStorage.setItem('deliveryPerson', JSON.stringify({
          ...foundDriver,
          firebaseKey: driverKey,
          loginTime: new Date().toISOString()
        }));
        showToast(`Welcome ${foundDriver.name}!`, 'success');
        navigate('/dashboard');
      } else if (foundDriver && foundDriver.status === 'disabled') {
        showToast('Your account is disabled. Please contact admin.', 'error');
      } else {
        showToast('Invalid credentials. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('Login failed. Please try again.', 'error');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Griya Delivery</h1>
            <p className="text-white/70 text-sm">Sign in to manage your deliveries</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">Delivery ID</label>
              <input
                type="text"
                value={credentials.id}
                onChange={(e) => setCredentials({...credentials, id: e.target.value.toUpperCase()})}
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

          {/* Login Info */}
          <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/70 text-xs mb-3 font-medium">Driver Information:</p>
            <div className="text-xs text-white/60 space-y-1">
              <p>• Use your Driver ID and password provided by admin</p>
              <p>• Contact admin if you don't have credentials</p>
              <p>• Your account must be enabled by admin to login</p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            Griya Delivery App v1.0 
          </p>
        </div>
      </div>
    </div>
  );
}