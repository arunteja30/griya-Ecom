import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import AdminCard from './AdminCard';
import Loader from '../../components/Loader';

export default function DriverDetailsAdmin() {
  const { driverId } = useParams();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalEarnings: 0,
    totalDeliveries: 0,
    averageEarningsPerDelivery: 0,
    regularOrders: 0,
    merchantOrders: 0,
    statusBreakdown: {},
    monthlyData: [],
    recentDeliveries: []
  });

  useEffect(() => {
    if (!driverId) return;

    const unsubscribeFunctions = [];

    // Load driver info
    const driversRef = ref(db, '/drivers');
    const unsubscribeDriver = onValue(driversRef, (snapshot) => {
      if (snapshot.exists()) {
        const drivers = snapshot.val();
        const driverData = Object.values(drivers).find(d => d.id === driverId);
        setDriver(driverData);
      }
    });
    unsubscribeFunctions.push(unsubscribeDriver);

    // Load all orders to find driver's deliveries
    loadDriverDeliveries();

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [driverId]);

  const loadDriverDeliveries = async () => {
    try {
      // Load regular orders
      const ordersRef = ref(db, '/orders');
      const ordersSnapshot = await new Promise((resolve) => {
        onValue(ordersRef, resolve, { onlyOnce: true });
      });

      // Load merchant orders  
      const merchantOrdersRef = ref(db, '/merchantOrders');
      const merchantOrdersSnapshot = await new Promise((resolve) => {
        onValue(merchantOrdersRef, resolve, { onlyOnce: true });
      });

      const regularOrders = Object.entries(ordersSnapshot.val() || {})
        .filter(([_, order]) => order.deliveryPersonId === driverId)
        .map(([id, order]) => ({ id, ...order, orderType: 'regular' }));

      const allMerchantOrders = merchantOrdersSnapshot.val() || {};
      const merchantOrders = [];
      
      Object.entries(allMerchantOrders).forEach(([merchantId, orders]) => {
        Object.entries(orders || {}).forEach(([orderId, order]) => {
          if (order.deliveryPersonId === driverId) {
            merchantOrders.push({
              id: orderId,
              ...order,
              orderType: 'merchant',
              merchantId
            });
          }
        });
      });

      const allDeliveries = [...regularOrders, ...merchantOrders];
      setDeliveries(allDeliveries);
      calculateAnalytics(allDeliveries, regularOrders, merchantOrders);
      setLoading(false);
    } catch (error) {
      console.error('Error loading driver deliveries:', error);
      setLoading(false);
    }
  };

  const calculateAnalytics = (allDeliveries, regularOrders, merchantOrders) => {
    // Calculate earnings
    const totalEarnings = allDeliveries.reduce((sum, delivery) => {
      const fee = delivery.fees?.deliveryFee || delivery.deliveryFee || 50;
      return sum + fee;
    }, 0);

    const totalDeliveries = allDeliveries.length;
    const averageEarningsPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

    // Status breakdown
    const statusBreakdown = allDeliveries.reduce((acc, delivery) => {
      const status = delivery.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Monthly data (last 12 months)
    const monthlyData = {};
    const now = new Date();
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[key] = { deliveries: 0, earnings: 0 };
    }

    // Fill with actual data
    allDeliveries.forEach(delivery => {
      const deliveryDate = new Date(delivery.updatedAt || delivery.createdAt);
      const key = deliveryDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const fee = delivery.fees?.deliveryFee || delivery.deliveryFee || 50;
      
      if (monthlyData[key]) {
        monthlyData[key].deliveries += 1;
        monthlyData[key].earnings += fee;
      }
    });

    // Recent deliveries
    const recentDeliveries = allDeliveries
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 20);

    setAnalytics({
      totalEarnings,
      totalDeliveries,
      averageEarningsPerDelivery,
      regularOrders: regularOrders.length,
      merchantOrders: merchantOrders.length,
      statusBreakdown,
      monthlyData: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
      recentDeliveries
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <Loader />;

  if (!driver) {
    return (
      <AdminCard title="Driver Not Found">
        <div className="text-center py-8">
          <p className="text-gray-600">Driver with ID {driverId} not found.</p>
          <Link to="/admin/analytics" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Back to Analytics
          </Link>
        </div>
      </AdminCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/admin/analytics" className="text-blue-600 hover:text-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>📞 {driver.phone}</span>
            <span>🆔 {driver.id}</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              driver.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {driver.status}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Earnings</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(analytics.totalEarnings)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Deliveries</p>
              <p className="text-2xl font-bold text-blue-900">{analytics.totalDeliveries}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Avg per Delivery</p>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(analytics.averageEarningsPerDelivery)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Success Rate</p>
              <p className="text-2xl font-bold text-orange-900">
                {analytics.totalDeliveries > 0 ? 
                  `${((analytics.statusBreakdown.delivered || 0) / analytics.totalDeliveries * 100).toFixed(1)}%` 
                  : '0%'}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Order Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminCard title="Order Type Distribution" subtitle="Regular vs Merchant orders breakdown">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="font-medium">Regular Orders</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-900">{analytics.regularOrders}</div>
                <div className="text-sm text-blue-600">
                  {analytics.totalDeliveries > 0 ? 
                    `${(analytics.regularOrders / analytics.totalDeliveries * 100).toFixed(1)}%` 
                    : '0%'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span className="font-medium">Merchant Orders</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-purple-900">{analytics.merchantOrders}</div>
                <div className="text-sm text-purple-600">
                  {analytics.totalDeliveries > 0 ? 
                    `${(analytics.merchantOrders / analytics.totalDeliveries * 100).toFixed(1)}%` 
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Status Breakdown */}
        <AdminCard title="Delivery Status Breakdown" subtitle="Distribution of delivery statuses">
          <div className="space-y-3">
            {Object.entries(analytics.statusBreakdown).map(([status, count]) => {
              const percentage = analytics.totalDeliveries > 0 ? (count / analytics.totalDeliveries * 100).toFixed(1) : 0;
              const colors = {
                pending: 'bg-yellow-500',
                confirmed: 'bg-blue-500',
                'picked-up': 'bg-purple-500',
                'out-for-delivery': 'bg-indigo-500',
                delivered: 'bg-green-600',
                cancelled: 'bg-red-500'
              };
              
              return (
                <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-500'}`}></div>
                    <span className="font-medium capitalize">{status.replace('-', ' ')}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{count}</div>
                    <div className="text-sm text-gray-600">{percentage}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </AdminCard>
      </div>

      {/* Monthly Performance */}
      <AdminCard title="Monthly Performance" subtitle="Delivery and earnings trends over the last 12 months">
        <div className="space-y-4">
          {analytics.monthlyData.map((month, index) => (
            <div key={month.month} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{month.month}</div>
                <div className="text-sm text-gray-600">{month.deliveries} deliveries</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">{formatCurrency(month.earnings)}</div>
                <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ 
                      width: `${Math.max(5, (month.earnings / Math.max(...analytics.monthlyData.map(m => m.earnings))) * 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Recent Deliveries */}
      <AdminCard title="Recent Deliveries" subtitle="Latest delivery activity">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.recentDeliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    #{delivery.id?.substring(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(delivery.updatedAt || delivery.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {delivery.customer?.name || delivery.customerName || 'Guest'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      delivery.orderType === 'merchant' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {delivery.orderType === 'merchant' ? 'Merchant' : 'Regular'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {formatCurrency(delivery.fees?.deliveryFee || delivery.deliveryFee || 50)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      delivery.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      delivery.status === 'out-for-delivery' ? 'bg-indigo-100 text-indigo-800' :
                      delivery.status === 'picked-up' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {delivery.status || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}