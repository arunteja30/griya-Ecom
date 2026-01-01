import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../utils/toast';
import NotificationBell from './NotificationBell';
import IosSwitch from './IosSwitch';

export default function MobileLayout({ children, activeTab = 'dashboard' }) {
  const [deliveryPerson, setDeliveryPerson] = useState(() => {
    return JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
  });
  const [isOnline, setIsOnline] = useState(deliveryPerson.status === 'available');
  const navigate = useNavigate();

  useEffect(() => {
    if (!deliveryPerson.id) {
      navigate('/login');
    }
  }, [deliveryPerson.id, navigate]);

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = isOnline ? 'offline' : 'available';
      const updates = {
        [`/drivers/${deliveryPerson.firebaseKey}/status`]: newStatus
      };
      
      await update(ref(db), updates);
      
      // Update local state
      setIsOnline(!isOnline);
      const updatedPerson = { ...deliveryPerson, status: newStatus };
      setDeliveryPerson(updatedPerson);
      localStorage.setItem('deliveryPerson', JSON.stringify(updatedPerson));
      
      showToast(
        `You are now ${newStatus === 'available' ? 'online' : 'offline'}`,
        newStatus === 'available' ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('deliveryPerson');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 flex flex-col">
      {/* Top Status Bar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-surface-200 safe-area-top sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-fresh-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {deliveryPerson.name?.charAt(0) || 'D'}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 text-sm">
                {deliveryPerson.name || 'Driver'}
              </h2>
              <p className="text-xs text-surface-600">
                ID: {deliveryPerson.id}
              </p>
            </div>
          </div>
          
          {/* Online/Offline Toggle */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <IosSwitch checked={isOnline} onChange={() => toggleOnlineStatus()} />
              <span className="text-sm font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Notification Bell */}
            <NotificationBell type="drivers" />
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 safe-area-bottom">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-item ${
            isActive ? 'active' : ''
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0M8 5v4h8V5" />
          </svg>
          <span className="text-xs font-semibold">Orders</span>
        </NavLink>
        
        <NavLink
          to="/earnings"
          className={({ isActive }) => `nav-item ${
            isActive ? 'active' : ''
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
          <span className="text-xs font-semibold">Earnings</span>
        </NavLink>
        
        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${
            isActive ? 'active' : ''
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs font-semibold">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}