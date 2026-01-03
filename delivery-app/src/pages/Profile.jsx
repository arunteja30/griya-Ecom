import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import MobileLayout from '../components/MobileLayout';
import { loadPricingConfig } from '../utils/deliveryFeeCalculator';

export default function Profile() {
  const navigate = useNavigate();
  const [deliveryPerson, setDeliveryPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricingConfig, setPricingConfig] = useState({ driverEarningsPercentage: 80 });
  const [stats, setStats] = useState({
    ordersToday: 0,
    earningsToday: 0,
    totalDeliveries: 0,
    totalEarnings: 0
  });

  useEffect(() => {
    // Get delivery person from localStorage
    const person = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
    if (!person.id) {
      navigate('/login');
      return;
    }
    setDeliveryPerson(person);

    // Load pricing configuration
    loadPricingConfig().then(config => {
      setPricingConfig(config);
    }).catch(error => {
      console.error('Error loading pricing config:', error);
    });

    // Listen to orders in real-time for stats
    const ordersRef = ref(db, '/orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const orders = snapshot.val() || {};
      
      // Filter orders delivered by this person
      const deliveredOrders = Object.entries(orders).filter(([id, order]) => 
        order.deliveryPersonId === person.id && order.status === 'delivered'
      );

      // Get today's date
      const today = new Date().toDateString();
      const ordersToday = deliveredOrders.filter(([id, order]) => {
        const orderDate = new Date(order.deliveredAt || order.createdAt).toDateString();
        return orderDate === today;
      });

      // Calculate total earnings based on delivery fees (configurable % to driver)
      const totalEarnings = deliveredOrders.reduce((sum, [id, order]) => {
        const deliveryFee = order.fees?.deliveryFeeApplied || 0;
        const driverEarning = deliveryFee * (pricingConfig.driverEarningsPercentage / 100);
        return sum + driverEarning;
      }, 0);
      
      const todayEarnings = ordersToday.reduce((sum, [id, order]) => {
        const deliveryFee = order.fees?.deliveryFeeApplied || 0;
        const driverEarning = deliveryFee * (pricingConfig.driverEarningsPercentage / 100);
        return sum + driverEarning;
      }, 0);
      
      setStats({
        ordersToday: ordersToday.length,
        earningsToday: todayEarnings,
        totalDeliveries: deliveredOrders.length,
        totalEarnings: totalEarnings
      });
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deliveryPerson?.id, navigate]);

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <MobileLayout activeTab="profile">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-surface-600">Loading profile...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout activeTab="profile">
      <div className="p-4 space-y-6">
        {/* Profile Header */}
        <div className="card p-6 text-center bg-gradient-to-br from-primary-500 to-fresh-500 text-white">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-2xl font-bold">
              {deliveryPerson?.name?.charAt(0) || 'D'}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{deliveryPerson?.name || 'Driver'}</h1>
          <p className="text-white/80">ID: {deliveryPerson?.id}</p>
          <p className="text-white/80">{deliveryPerson?.phone}</p>
          <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
            <div className="w-2 h-2 bg-fresh-300 rounded-full mr-2"></div>
            <span className="text-sm font-medium capitalize">{deliveryPerson?.status || 'Available'}</span>
          </div>
        </div>

        {/* Today's Performance */}
        <div className="card p-6 bg-gradient-to-r from-fresh-50 to-fresh-100 border border-fresh-200">
          <h2 className="mobile-title text-fresh-700 mb-4">📊 Today's Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-fresh-600">{stats.ordersToday}</div>
              <p className="text-sm font-medium text-fresh-700">Deliveries</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-fresh-600">{formatINR(stats.earningsToday)}</div>
              <p className="text-sm font-medium text-fresh-700">Earnings</p>
            </div>
          </div>
        </div>

        {/* Total Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-surface-900">{stats.totalDeliveries}</div>
            <p className="text-sm font-medium text-surface-600">Total Deliveries</p>
          </div>

          <div className="card p-4 text-center">
            <div className="w-12 h-12 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-surface-900">{formatINR(stats.totalEarnings)}</div>
            <p className="text-sm font-medium text-surface-600">Total Earnings</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="font-semibold text-surface-800 text-lg">🔧 Quick Actions</h3>
          
          <div className="space-y-3">
            <button onClick={() => navigate('/profile/edit')} className="card p-4 w-full flex items-center justify-between hover:shadow-float transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Edit Profile</p>
                  <p className="text-sm text-surface-600">Update your personal information</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button onClick={() => navigate('/profile/history')} className="card p-4 w-full flex items-center justify-between hover:shadow-float transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-fresh-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-fresh-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Delivery History</p>
                  <p className="text-sm text-surface-600">View all your past deliveries</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button onClick={() => navigate('/profile/help')} className="card p-4 w-full flex items-center justify-between hover:shadow-float transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Help & Support</p>
                  <p className="text-sm text-surface-600">Get help with app issues</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="card p-4 bg-surface-50">
          <h3 className="font-semibold text-surface-800 mb-3">📱 App Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-600">Version</span>
              <span className="text-surface-900 font-medium">v2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-600">Last Updated</span>
              <span className="text-surface-900 font-medium">Jan 2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-600">Support</span>
              <span className="text-surface-900 font-medium">24/7 Available</span>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}