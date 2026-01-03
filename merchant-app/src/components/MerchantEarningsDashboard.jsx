import React, { useState, useEffect } from 'react';
import { ref, get, onValue } from 'firebase/database';
import { db } from '../firebase';
import { 
  subscribeMerchantEarnings, 
  calculateMerchantEarnings, 
  calculateQualityBonus,
  isPayoutEligible,
  getNextPayoutDate,
  formatEarningsDisplay 
} from '../utils/merchantEarnings';

const EarningsCard = ({ title, amount, subtitle, icon, color = "green" }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium">{title}</p>
        <p className={`text-2xl font-bold text-${color}-600 mt-1`}>{amount}</p>
        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50`}>
        <span className="text-xl">{icon}</span>
      </div>
    </div>
  </div>
);

const OrderEarningCard = ({ order, earningsConfig }) => {
  const earnings = calculateMerchantEarnings(order, earningsConfig);
  const display = formatEarningsDisplay(earnings);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900">Order #{order.id.slice(-8)}</h4>
            <span className={`px-2 py-1 text-xs rounded-full ${
              order.status === 'delivered' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {order.status}
            </span>
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <p>Order Value: ₹{earnings.orderValue}</p>
            <p className="text-red-600">Commission ({earnings.breakdown.commissionRate}%): -{display.commission}</p>
            {earnings.deliveryFeeShare > 0 && (
              <p className="text-green-600">Delivery Share: {display.deliveryShare}</p>
            )}
            {earnings.peakHourBonus > 0 && (
              <p className="text-purple-600">Peak Hour Bonus: +₹{earnings.peakHourBonus.toFixed(2)}</p>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">{display.primary}</p>
          <p className="text-sm text-gray-600">{display.secondary}</p>
        </div>
      </div>
    </div>
  );
};

export default function MerchantEarningsDashboard() {
  const [merchant, setMerchant] = useState(null);
  const [earningsConfig, setEarningsConfig] = useState(null);
  const [orders, setOrders] = useState([]);
  const [earningsData, setEarningsData] = useState({
    today: 0,
    week: 0,
    month: 0,
    pending: 0,
    totalOrders: 0,
    averageRating: 4.5
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');

  useEffect(() => {
    // Get merchant from localStorage
    const merchantData = JSON.parse(localStorage.getItem('merchant') || '{}');
    if (!merchantData.id) {
      // Redirect to login if no merchant data
      return;
    }
    setMerchant(merchantData);
    
    // Subscribe to earnings config changes
    const unsubscribeConfig = subscribeMerchantEarnings(merchantData.id, (config) => {
      setEarningsConfig(config);
    });
    
    // Load orders and calculate earnings
    loadOrdersAndEarnings(merchantData.id);
    
    return unsubscribeConfig;
  }, []);

  const loadOrdersAndEarnings = async (merchantId) => {
    try {
      // Load orders for this merchant
      const ordersRef = ref(db, '/orders');
      onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
          const allOrders = snapshot.val();
          const merchantOrders = Object.entries(allOrders)
            .map(([id, order]) => ({ id, ...order }))
            .filter(order => order.merchantId === merchantId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          setOrders(merchantOrders);
          
          // Calculate earnings data
          if (earningsConfig) {
            calculateEarningsData(merchantOrders, earningsConfig);
          }
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('Error loading orders:', error);
      setLoading(false);
    }
  };

  const calculateEarningsData = (orders, config) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayEarnings = 0;
    let weekEarnings = 0;
    let monthEarnings = 0;
    let pendingEarnings = 0;
    let totalOrders = 0;
    let ratingSum = 0;
    let ratedOrders = 0;

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const earnings = calculateMerchantEarnings(order, config);
      
      totalOrders++;
      
      // Add to period totals
      if (orderDate >= todayStart) {
        todayEarnings += earnings.totalEarning;
      }
      if (orderDate >= weekStart) {
        weekEarnings += earnings.totalEarning;
      }
      if (orderDate >= monthStart) {
        monthEarnings += earnings.totalEarning;
      }
      
      // Add to pending if not paid out yet
      if (order.status === 'delivered' && !order.merchantPaid) {
        pendingEarnings += earnings.totalEarning;
      }
      
      // Calculate average rating
      if (order.rating) {
        ratingSum += order.rating;
        ratedOrders++;
      }
    });

    const averageRating = ratedOrders > 0 ? ratingSum / ratedOrders : 4.5;

    setEarningsData({
      today: todayEarnings,
      week: weekEarnings,
      month: monthEarnings,
      pending: pendingEarnings,
      totalOrders,
      averageRating
    });
  };

  const getFilteredOrders = () => {
    const now = new Date();
    let startDate;
    
    switch (activeTab) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return orders;
    }
    
    return orders.filter(order => new Date(order.createdAt) >= startDate);
  };

  const qualityBonus = earningsConfig ? calculateQualityBonus({
    totalOrders: earningsData.totalOrders,
    averageRating: earningsData.averageRating,
    totalEarnings: earningsData.month
  }, earningsConfig) : { totalBonus: 0, eligible: false };

  const nextPayoutDate = earningsConfig ? getNextPayoutDate(earningsConfig.payoutSchedule) : new Date();
  const isEligibleForPayout = earningsConfig ? isPayoutEligible(earningsData.pending, earningsConfig) : false;

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-48 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Earnings Dashboard</h1>
          <p className="text-gray-600">Track your earnings like Swiggy merchant partner</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Earnings Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EarningsCard
            title="Today's Earnings"
            amount={`₹${earningsData.today.toFixed(2)}`}
            subtitle={`${orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString()).length} orders`}
            icon="📊"
            color="blue"
          />
          
          <EarningsCard
            title="This Week"
            amount={`₹${earningsData.week.toFixed(2)}`}
            subtitle="Last 7 days"
            icon="📈"
            color="green"
          />
          
          <EarningsCard
            title="This Month"
            amount={`₹${earningsData.month.toFixed(2)}`}
            subtitle={`${earningsData.totalOrders} total orders`}
            icon="💰"
            color="purple"
          />
          
          <EarningsCard
            title="Pending Payout"
            amount={`₹${earningsData.pending.toFixed(2)}`}
            subtitle={isEligibleForPayout ? "Ready for payout" : `Min ₹${earningsConfig?.minimumPayout || 100}`}
            icon={isEligibleForPayout ? "✅" : "⏳"}
            color={isEligibleForPayout ? "green" : "orange"}
          />
        </div>

        {/* Payout Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Next Payout</h3>
              <p className="text-gray-600">
                {nextPayoutDate.toLocaleDateString()} • {earningsConfig?.payoutSchedule || 'weekly'} schedule
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">₹{earningsData.pending.toFixed(2)}</p>
              <p className="text-sm text-gray-600">
                {isEligibleForPayout ? 'Ready for payout' : 'Below minimum threshold'}
              </p>
            </div>
          </div>
        </div>

        {/* Quality Bonus */}
        {qualityBonus.eligible && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <h3 className="font-semibold text-orange-900">Quality Bonus Eligible!</h3>
                <p className="text-orange-700">
                  Earn extra ₹{qualityBonus.totalBonus.toFixed(2)} this month for excellent service
                </p>
                <div className="flex gap-4 mt-2 text-sm text-orange-600">
                  <span>⭐ {earningsData.averageRating.toFixed(1)} rating</span>
                  <span>📦 {earningsData.totalOrders} orders</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Orders & Earnings</h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['today', 'week', 'month'].map(period => (
                <button
                  key={period}
                  onClick={() => setActiveTab(period)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    activeTab === period
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getFilteredOrders().map(order => (
              <OrderEarningCard
                key={order.id}
                order={order}
                earningsConfig={earningsConfig}
              />
            ))}
            
            {getFilteredOrders().length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">📦</div>
                <p className="text-gray-600">No orders found for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Platform Commission</p>
              <p className="font-semibold text-red-600">{earningsConfig?.commissionPercentage || 15}%</p>
            </div>
            <div>
              <p className="text-gray-600">Delivery Fee Share</p>
              <p className="font-semibold text-green-600">{earningsConfig?.deliveryFeeShare || 10}%</p>
            </div>
            <div>
              <p className="text-gray-600">Minimum Payout</p>
              <p className="font-semibold">₹{earningsConfig?.minimumPayout || 100}</p>
            </div>
            <div>
              <p className="text-gray-600">Payout Schedule</p>
              <p className="font-semibold">{earningsConfig?.payoutSchedule || 'Weekly'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}