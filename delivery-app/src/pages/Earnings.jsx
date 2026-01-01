import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import MobileLayout from '../components/MobileLayout';

export default function Earnings() {
  const [deliveryPerson] = useState(() => {
    return JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
  });
  const [orders, setOrders] = useState({});
  const [earnings, setEarnings] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
    ordersToday: 0,
    ordersThisWeek: 0,
    ordersThisMonth: 0,
    totalOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryPerson.id) return;

    const ordersRef = ref(db, '/orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setOrders(data);
      calculateEarnings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deliveryPerson.id]);

  const calculateEarnings = (ordersData) => {
    const myOrders = Object.entries(ordersData).filter(([id, order]) => 
      order.deliveryPersonId === deliveryPerson.id && order.status === 'delivered'
    );

    const now = new Date();
    const today = now.toDateString();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayEarnings = 0, todayOrders = 0;
    let weekEarnings = 0, weekOrders = 0;
    let monthEarnings = 0, monthOrders = 0;
    let totalEarnings = 0, totalOrders = 0;

    myOrders.forEach(([id, order]) => {
      const deliveryDate = new Date(order.deliveredAt);
      const orderEarning = Math.max((order.total || 0) * 0.05, 20);
      
      totalEarnings += orderEarning;
      totalOrders += 1;

      if (deliveryDate.toDateString() === today) {
        todayEarnings += orderEarning;
        todayOrders += 1;
      }
      
      if (deliveryDate >= startOfWeek) {
        weekEarnings += orderEarning;
        weekOrders += 1;
      }
      
      if (deliveryDate >= startOfMonth) {
        monthEarnings += orderEarning;
        monthOrders += 1;
      }
    });

    setEarnings({
      today: todayEarnings,
      thisWeek: weekEarnings,
      thisMonth: monthEarnings,
      total: totalEarnings,
      ordersToday: todayOrders,
      ordersThisWeek: weekOrders,
      ordersThisMonth: monthOrders,
      totalOrders: totalOrders
    });
  };

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <MobileLayout activeTab="earnings">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-surface-600">Loading earnings...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout activeTab="earnings">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="mobile-title">💰 Earnings</h1>
          <p className="mobile-subtitle mt-2">Track your delivery earnings</p>
        </div>

        {/* Today's Earnings - Highlighted */}
        <div className="card p-6 bg-gradient-to-r from-fresh-500 to-fresh-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-fresh-100 text-sm font-medium">Today's Earnings</p>
              <p className="text-3xl font-bold">{formatINR(earnings.today)}</p>
              <p className="text-fresh-200 text-sm mt-1">
                {earnings.ordersToday} deliveries completed
              </p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Earnings Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-surface-900">{formatINR(earnings.thisWeek)}</p>
            <p className="text-sm text-surface-600 font-medium">This Week</p>
            <p className="text-xs text-surface-500">{earnings.ordersThisWeek} orders</p>
          </div>

          <div className="card p-4 text-center">
            <div className="w-12 h-12 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-surface-900">{formatINR(earnings.thisMonth)}</p>
            <p className="text-sm text-surface-600 font-medium">This Month</p>
            <p className="text-xs text-surface-500">{earnings.ordersThisMonth} orders</p>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="card p-6 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-600 text-sm font-semibold uppercase tracking-wide">Total Earnings</p>
              <p className="text-3xl font-bold text-primary-700">{formatINR(earnings.total)}</p>
              <p className="text-primary-500 text-sm mt-1">
                From {earnings.totalOrders} total deliveries
              </p>
            </div>
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Earning Rate Info */}
        <div className="card p-4">
          <h3 className="font-semibold text-surface-900 mb-3">💡 How Earnings Work</h3>
          <div className="space-y-2 text-sm text-surface-600">
            <p>• You earn 5% commission on each order value</p>
            <p>• Minimum earning per delivery: ₹20</p>
            <p>• Bonus incentives for completing more deliveries</p>
            <p>• Weekly payouts to your registered account</p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}