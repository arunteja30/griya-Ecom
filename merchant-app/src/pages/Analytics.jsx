import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { usePermissions } from '../context/PermissionContext';

const Analytics = ({ merchant }) => {
  const { merchant: contextMerchant } = usePermissions();
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    topProducts: [],
    recentOrders: [],
    monthlyRevenue: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get merchant data from props or context
    const merchantData = merchant || contextMerchant;
    const merchantId = merchantData?.id;
    
    console.log('Analytics: full merchant data:', merchantData);
    console.log('Analytics: using merchant ID:', merchantId);
    console.log('Analytics: merchant from props:', merchant);
    console.log('Analytics: merchant from context:', contextMerchant);
    
    if (!merchantId) {
      console.log('No merchant ID found, setting loading false');
      setLoading(false);
      return;
    }

    // Listen to merchant-specific orders data
    const ordersRef = ref(db, `/merchantOrders/${merchantId}`);
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const ordersData = snapshot.val();
        console.log('Merchant orders data loaded:', Object.keys(ordersData).length, 'orders');
        calculateAnalytics(ordersData, merchantId);
      } else {
        console.log('No orders data found for merchant');
        setAnalytics({
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          topProducts: [],
          recentOrders: [],
          monthlyRevenue: []
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [merchant, contextMerchant]);

  const calculateAnalytics = (ordersData, merchantId) => {
    console.log('Calculating analytics for merchant:', merchantId);
    
    const allOrders = Object.entries(ordersData);
    console.log('All orders for this merchant:', allOrders.length);
    
    // Since we're already loading from `/merchantOrders/${merchantId}`, no filtering needed
    const merchantOrders = allOrders;
    
    console.log('Processing merchant orders:', merchantOrders.length);

    const totalOrders = merchantOrders.length;
    const totalRevenue = merchantOrders.reduce((sum, [_, order]) => {
      const amount = order.subtotal || order.total || 0;
      console.log('Order amount:', amount, 'Order:', order);
      return sum + amount;
    }, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log('Calculated totals:', { totalOrders, totalRevenue, averageOrderValue });

    // Calculate top products
    const productCounts = {};
    merchantOrders.forEach(([_, order]) => {
      if (order.items) {
        order.items.forEach(item => {
          const key = `${item.name || item.id}`;
          if (!productCounts[key]) {
            productCounts[key] = { name: item.name || item.id, count: 0, revenue: 0 };
          }
          productCounts[key].count += item.quantity || 1;
          productCounts[key].revenue += (item.price || 0) * (item.quantity || 1);
        });
      }
    });

    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Get recent orders
    const recentOrders = merchantOrders
      .sort(([a], [b]) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5)
      .map(([id, order]) => ({ id, ...order }));

    // Calculate monthly revenue (last 6 months)
    const monthlyRevenue = calculateMonthlyRevenue(merchantOrders);

    setAnalytics({
      totalOrders,
      totalRevenue,
      averageOrderValue,
      topProducts,
      recentOrders,
      monthlyRevenue
    });
  };

  const calculateMonthlyRevenue = (orders) => {
    const months = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { month: date.toLocaleDateString('en-US', { month: 'short' }), revenue: 0 };
    }

    // Add order amounts to respective months
    orders.forEach(([_, order]) => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
          months[key].revenue += order.subtotal || order.total || 0;
        }
      }
    });

    return Object.values(months);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{analytics.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">₹{analytics.averageOrderValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Products</h2>
          </div>
          <div className="p-6">
            {analytics.topProducts.length > 0 ? (
              <div className="space-y-4">
                {analytics.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.count} orders</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">₹{product.revenue.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          </div>
          <div className="p-6">
            {analytics.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {analytics.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">#{order.id.slice(-6)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">₹{order.totalAmount?.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent orders</p>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Revenue (Last 6 Months)</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-6 gap-4">
            {analytics.monthlyRevenue.map((month, index) => {
              const maxRevenue = Math.max(...analytics.monthlyRevenue.map(m => m.revenue));
              const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 200 : 20;
              
              return (
                <div key={index} className="text-center">
                  <div className="relative h-56 mb-2">
                    <div 
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t"
                      style={{ height: `${height}px`, minHeight: '20px' }}
                    ></div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{month.month}</p>
                  <p className="text-xs text-gray-500">₹{month.revenue.toFixed(0)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;