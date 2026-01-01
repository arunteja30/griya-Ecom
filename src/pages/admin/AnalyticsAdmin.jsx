import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import AdminCard from './AdminCard';
import Loader from '../../components/Loader';

export default function AnalyticsAdmin() {
  const [loading, setLoading] = useState(true);
  const [merchantData, setMerchantData] = useState([]);
  const [driverData, setDriverData] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalMerchants: 0,
    totalDrivers: 0,
    todayRevenue: 0,
    monthRevenue: 0
  });
  const [timeframe, setTimeframe] = useState('month'); // today | week | month | all

  useEffect(() => {
    const unsubscribeFunctions = [];

    // Load merchants data
    const merchantsRef = ref(db, '/merchants');
    const unsubscribeMerchants = onValue(merchantsRef, (snapshot) => {
      if (snapshot.exists()) {
        const merchants = snapshot.val();
        loadMerchantAnalytics(merchants);
      }
    });
    unsubscribeFunctions.push(unsubscribeMerchants);

    // Load drivers data
    const driversRef = ref(db, '/drivers');
    const unsubscribeDrivers = onValue(driversRef, (snapshot) => {
      if (snapshot.exists()) {
        const drivers = snapshot.val();
        loadDriverAnalytics(drivers);
      }
    });
    unsubscribeFunctions.push(unsubscribeDrivers);

    // Load all merchant orders for overall stats
    const merchantOrdersRef = ref(db, '/merchantOrders');
    const unsubscribeMerchantOrders = onValue(merchantOrdersRef, (snapshot) => {
      if (snapshot.exists()) {
        calculateOverallStats(snapshot.val());
      }
      setLoading(false);
    });
    unsubscribeFunctions.push(unsubscribeMerchantOrders);

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, []);

  const loadMerchantAnalytics = async (merchants) => {
    try {
      const merchantOrdersRef = ref(db, '/merchantOrders');
      const merchantOrdersSnapshot = await new Promise((resolve) => {
        onValue(merchantOrdersRef, resolve, { onlyOnce: true });
      });

      const allMerchantOrders = merchantOrdersSnapshot.val() || {};
      const merchantAnalytics = [];

      Object.entries(merchants).forEach(([merchantKey, merchant]) => {
        const merchantId = merchant.id;
        const merchantOrders = allMerchantOrders[merchantId] || {};
        const orders = Object.values(merchantOrders);

        // Calculate metrics
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Time-based calculations
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        const weekStart = now - 7 * 24 * 60 * 60 * 1000;
        const monthStart = new Date().setDate(1);

        const todayOrders = orders.filter(o => new Date(o.createdAt).getTime() >= todayStart);
        const weekOrders = orders.filter(o => new Date(o.createdAt).getTime() >= weekStart);
        const monthOrders = orders.filter(o => new Date(o.createdAt).getTime() >= monthStart);

        const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);
        const weekRevenue = weekOrders.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);
        const monthRevenue = monthOrders.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);

        // Status breakdown
        const statusCount = orders.reduce((acc, order) => {
          const status = order.status || 'pending';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        merchantAnalytics.push({
          id: merchantId,
          name: merchant.name,
          storeName: merchant.storeName,
          phone: merchant.phone,
          status: merchant.status,
          totalOrders,
          totalRevenue,
          averageOrderValue,
          todayOrders: todayOrders.length,
          weekOrders: weekOrders.length,
          monthOrders: monthOrders.length,
          todayRevenue,
          weekRevenue,
          monthRevenue,
          statusCount,
          lastOrderDate: orders.length > 0 ? 
            Math.max(...orders.map(o => new Date(o.createdAt).getTime())) : null
        });
      });

      // Sort by total revenue descending
      merchantAnalytics.sort((a, b) => b.totalRevenue - a.totalRevenue);
      setMerchantData(merchantAnalytics);
    } catch (error) {
      console.error('Error loading merchant analytics:', error);
    }
  };

  const loadDriverAnalytics = async (drivers) => {
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

      const regularOrders = ordersSnapshot.val() || {};
      const allMerchantOrders = merchantOrdersSnapshot.val() || {};

      // Flatten merchant orders
      const merchantOrders = {};
      Object.values(allMerchantOrders).forEach(merchantOrdersList => {
        Object.entries(merchantOrdersList || {}).forEach(([orderId, order]) => {
          merchantOrders[orderId] = order;
        });
      });

      const driverAnalytics = [];

      Object.entries(drivers).forEach(([driverKey, driver]) => {
        const driverId = driver.id;
        
        // Get orders delivered by this driver
        const driverRegularOrders = Object.values(regularOrders).filter(order => 
          order.deliveryPersonId === driverId && order.status === 'delivered'
        );
        const driverMerchantOrders = Object.values(merchantOrders).filter(order => 
          order.deliveryPersonId === driverId && order.status === 'delivered'
        );

        const allDeliveredOrders = [...driverRegularOrders, ...driverMerchantOrders];

        // Calculate earnings
        const totalEarnings = allDeliveredOrders.reduce((sum, order) => {
          const deliveryFee = order.fees?.deliveryFee || order.deliveryFee || 50; // Default ₹50
          return sum + deliveryFee;
        }, 0);

        // Time-based calculations
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        const weekStart = now - 7 * 24 * 60 * 60 * 1000;
        const monthStart = new Date().setDate(1);

        const todayDeliveries = allDeliveredOrders.filter(o => new Date(o.updatedAt || o.createdAt).getTime() >= todayStart);
        const weekDeliveries = allDeliveredOrders.filter(o => new Date(o.updatedAt || o.createdAt).getTime() >= weekStart);
        const monthDeliveries = allDeliveredOrders.filter(o => new Date(o.updatedAt || o.createdAt).getTime() >= monthStart);

        const todayEarnings = todayDeliveries.reduce((sum, order) => {
          const deliveryFee = order.fees?.deliveryFee || order.deliveryFee || 50;
          return sum + deliveryFee;
        }, 0);

        const weekEarnings = weekDeliveries.reduce((sum, order) => {
          const deliveryFee = order.fees?.deliveryFee || order.deliveryFee || 50;
          return sum + deliveryFee;
        }, 0);

        const monthEarnings = monthDeliveries.reduce((sum, order) => {
          const deliveryFee = order.fees?.deliveryFee || order.deliveryFee || 50;
          return sum + deliveryFee;
        }, 0);

        driverAnalytics.push({
          id: driverId,
          name: driver.name,
          phone: driver.phone,
          status: driver.status,
          totalDeliveries: allDeliveredOrders.length,
          totalEarnings,
          averageEarningsPerDelivery: allDeliveredOrders.length > 0 ? totalEarnings / allDeliveredOrders.length : 0,
          todayDeliveries: todayDeliveries.length,
          weekDeliveries: weekDeliveries.length,
          monthDeliveries: monthDeliveries.length,
          todayEarnings,
          weekEarnings,
          monthEarnings,
          lastDeliveryDate: allDeliveredOrders.length > 0 ? 
            Math.max(...allDeliveredOrders.map(o => new Date(o.updatedAt || o.createdAt).getTime())) : null
        });
      });

      // Sort by total earnings descending
      driverAnalytics.sort((a, b) => b.totalEarnings - a.totalEarnings);
      setDriverData(driverAnalytics);
    } catch (error) {
      console.error('Error loading driver analytics:', error);
    }
  };

  const calculateOverallStats = (allMerchantOrders) => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const monthStart = new Date().setDate(1);

    Object.values(allMerchantOrders).forEach(merchantOrders => {
      Object.values(merchantOrders || {}).forEach(order => {
        const orderAmount = order.subtotal || order.total || 0;
        const orderDate = new Date(order.createdAt).getTime();

        totalRevenue += orderAmount;
        totalOrders++;

        if (orderDate >= todayStart) {
          todayRevenue += orderAmount;
        }
        if (orderDate >= monthStart) {
          monthRevenue += orderAmount;
        }
      });
    });

    setOverallStats(prev => ({
      ...prev,
      totalRevenue,
      totalOrders,
      todayRevenue,
      monthRevenue,
      totalMerchants: merchantData.length,
      totalDrivers: driverData.length
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-IN');
  };

  const getDisplayValue = (item, metric) => {
    switch(timeframe) {
      case 'today':
        return metric === 'revenue' ? item.todayRevenue : item.todayOrders || item.todayDeliveries;
      case 'week':
        return metric === 'revenue' ? item.weekRevenue || item.weekEarnings : item.weekOrders || item.weekDeliveries;
      case 'month':
        return metric === 'revenue' ? item.monthRevenue || item.monthEarnings : item.monthOrders || item.monthDeliveries;
      case 'all':
      default:
        return metric === 'revenue' ? item.totalRevenue || item.totalEarnings : item.totalOrders || item.totalDeliveries;
    }
  };

  if (loading) return <Loader />;

  return (
    <AdminCard title="Business Analytics" subtitle="Comprehensive overview of merchants, drivers, and overall business performance">
      {/* Time Filter */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'This Week' },
          { key: 'month', label: 'This Month' },
          { key: 'all', label: 'All Time' }
        ].map(period => (
          <button
            key={period.key}
            onClick={() => setTimeframe(period.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              timeframe === period.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Overall Business Stats */}
      <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Business Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(overallStats.totalRevenue)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600 mb-1">Total Orders</div>
            <div className="text-xl font-bold text-gray-900">{overallStats.totalOrders}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600 mb-1">Active Merchants</div>
            <div className="text-xl font-bold text-gray-900">{overallStats.totalMerchants}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600 mb-1">Active Drivers</div>
            <div className="text-xl font-bold text-gray-900">{overallStats.totalDrivers}</div>
          </div>
        </div>
      </div>

      {/* Merchant Analytics */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Merchant Performance</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {merchantData.map((merchant) => (
                  <Link 
                    key={merchant.id}
                    to={`/admin/merchant/${merchant.id}`}
                    className="table-row hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900 group-hover:text-blue-600">{merchant.name}</div>
                        <div className="text-sm text-gray-500">{merchant.storeName}</div>
                        <div className="text-xs text-gray-400">{merchant.phone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {getDisplayValue(merchant, 'orders')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(getDisplayValue(merchant, 'revenue'))}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatCurrency(merchant.averageOrderValue)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        merchant.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {merchant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(merchant.lastOrderDate)}
                    </td>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Driver Analytics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Performance</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliveries</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg/Delivery</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {driverData.map((driver) => (
                  <Link 
                    key={driver.id}
                    to={`/admin/driver/${driver.id}`}
                    className="table-row hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900 group-hover:text-blue-600">{driver.name}</div>
                        <div className="text-xs text-gray-400">{driver.phone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {getDisplayValue(driver, 'orders')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(getDisplayValue(driver, 'revenue'))}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatCurrency(driver.averageEarningsPerDelivery)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        driver.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(driver.lastDeliveryDate)}
                    </td>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}