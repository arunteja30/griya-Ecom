import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import AdminCard from './AdminCard';
import Loader from '../../components/Loader';

export default function MerchantDetailsAdmin() {
  const { merchantId } = useParams();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    statusBreakdown: {},
    monthlyData: [],
    topProducts: [],
    recentOrders: []
  });

  useEffect(() => {
    if (!merchantId) return;

    const unsubscribeFunctions = [];

    // Load merchant info
    const merchantsRef = ref(db, '/merchants');
    const unsubscribeMerchant = onValue(merchantsRef, (snapshot) => {
      if (snapshot.exists()) {
        const merchants = snapshot.val();
        const merchantData = Object.values(merchants).find(m => m.id === merchantId);
        setMerchant(merchantData);
      }
    });
    unsubscribeFunctions.push(unsubscribeMerchant);

    // Load merchant orders
    const ordersRef = ref(db, `/merchantOrders/${merchantId}`);
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const ordersData = Object.entries(snapshot.val()).map(([id, order]) => ({
          id,
          ...order
        }));
        setOrders(ordersData);
        calculateAnalytics(ordersData);
      } else {
        setOrders([]);
        calculateAnalytics([]);
      }
    });
    unsubscribeFunctions.push(unsubscribeOrders);

    // Load merchant products
    const productsRef = ref(db, `/merchantProducts/${merchantId}`);
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData = Object.entries(snapshot.val()).map(([id, product]) => ({
          id,
          ...product
        }));
        setProducts(productsData);
      } else {
        setProducts([]);
      }
      setLoading(false);
    });
    unsubscribeFunctions.push(unsubscribeProducts);

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [merchantId]);

  const calculateAnalytics = (ordersData) => {
    const totalRevenue = ordersData.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);
    const totalOrders = ordersData.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Status breakdown
    const statusBreakdown = ordersData.reduce((acc, order) => {
      const status = order.status || 'pending';
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
      monthlyData[key] = { orders: 0, revenue: 0 };
    }

    // Fill with actual data
    ordersData.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const key = orderDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (monthlyData[key]) {
        monthlyData[key].orders += 1;
        monthlyData[key].revenue += order.subtotal || order.total || 0;
      }
    });

    // Product sales analysis
    const productSales = {};
    ordersData.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          if (!productSales[item.name]) {
            productSales[item.name] = { quantity: 0, revenue: 0, orders: 0 };
          }
          productSales[item.name].quantity += item.quantity || 1;
          productSales[item.name].revenue += (item.price || 0) * (item.quantity || 1);
          productSales[item.name].orders += 1;
        });
      }
    });

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Recent orders
    const recentOrders = ordersData
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    setAnalytics({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      statusBreakdown,
      monthlyData: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
      topProducts,
      recentOrders
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

  if (!merchant) {
    return (
      <AdminCard title="Merchant Not Found">
        <div className="text-center py-8">
          <p className="text-gray-600">Merchant with ID {merchantId} not found.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{merchant.name}</h1>
          </div>
          <p className="text-gray-600">{merchant.storeName}</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>📞 {merchant.phone}</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              merchant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {merchant.status}
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(analytics.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-green-900">{analytics.totalOrders}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(analytics.averageOrderValue)}</p>
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
              <p className="text-orange-600 text-sm font-medium">Products</p>
              <p className="text-2xl font-bold text-orange-900">{products.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <AdminCard title="Monthly Performance" subtitle="Revenue and order trends over the last 12 months">
          <div className="space-y-4">
            {analytics.monthlyData.map((month, index) => (
              <div key={month.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{month.month}</div>
                  <div className="text-sm text-gray-600">{month.orders} orders</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(month.revenue)}</div>
                  <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.max(5, (month.revenue / Math.max(...analytics.monthlyData.map(m => m.revenue))) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* Status Breakdown */}
        <AdminCard title="Order Status Breakdown" subtitle="Distribution of order statuses">
          <div className="space-y-3">
            {Object.entries(analytics.statusBreakdown).map(([status, count]) => {
              const percentage = analytics.totalOrders > 0 ? (count / analytics.totalOrders * 100).toFixed(1) : 0;
              const colors = {
                pending: 'bg-yellow-500',
                confirmed: 'bg-blue-500',
                preparing: 'bg-purple-500',
                ready: 'bg-green-500',
                'handed-to-driver': 'bg-indigo-500',
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

      {/* Top Products */}
      <AdminCard title="Top Selling Products" subtitle="Best performing products by revenue">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.topProducts.slice(0, 10).map((product, index) => (
                <tr key={product.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{index + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{product.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{product.orders}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Recent Orders */}
      <AdminCard title="Recent Orders" subtitle="Latest order activity">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    #{order.id?.substring(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.customer?.name || order.address?.name || 'Guest'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {order.items?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(order.subtotal || order.total || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      order.status === 'preparing' ? 'bg-purple-100 text-purple-800' :
                      order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status || 'pending'}
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