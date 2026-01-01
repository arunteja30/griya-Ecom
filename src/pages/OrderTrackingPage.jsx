import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../components/Toast';

export default function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const [tracking, setTracking] = useState({
    orderNumber: '',
    mobileNumber: ''
  });
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-populate from URL parameters
  useEffect(() => {
    const orderParam = searchParams.get('order');
    const phoneParam = searchParams.get('phone');
    
    if (orderParam || phoneParam) {
      setTracking({
        orderNumber: orderParam || '',
        mobileNumber: phoneParam || ''
      });
      
      // Auto-search if both parameters are provided
      if (orderParam && phoneParam) {
        setTimeout(() => {
          handleSearch(null, orderParam, phoneParam);
        }, 100);
      }
    }
  }, [searchParams]);

  const handleSearch = async (e, prefilledOrderNumber = null, prefilledMobile = null) => {
    if (e) e.preventDefault();
    
    const orderNumber = prefilledOrderNumber || tracking.orderNumber;
    const mobileNumber = prefilledMobile || tracking.mobileNumber;
    
    if (!orderNumber || !mobileNumber) {
      showToast('Please enter both order number and mobile number', 'error');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Search for order by order number
      const ordersRef = ref(db, '/orders');
      const snapshot = await get(ordersRef);
      
      if (!snapshot.exists()) {
        setOrder(null);
        showToast('No orders found', 'error');
        setLoading(false);
        return;
      }

      const orders = snapshot.val();
      let foundOrder = null;
      let orderId = null;

      // Search through orders to find matching order number and mobile
      Object.entries(orders).forEach(([id, orderData]) => {
        if ((id === orderNumber || orderData.orderNumber === orderNumber) &&
            orderData.address?.phone === mobileNumber) {
          foundOrder = { ...orderData, id };
          orderId = id;
        }
      });

      if (foundOrder) {
        setOrder(foundOrder);
        showToast('Order found!', 'success');
      } else {
        setOrder(null);
        showToast('Order not found. Please check your order number and mobile number.', 'error');
      }
    } catch (error) {
      console.error('Error searching order:', error);
      showToast('Failed to search order. Please try again.', 'error');
      setOrder(null);
    }

    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'assigned': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'picked': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'in-transit': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'confirmed': return '✅';
      case 'preparing': return '👨‍🍳';
      case 'ready': return '📦';
      case 'assigned': return '🚗';
      case 'picked': return '📦➡️';
      case 'in-transit': return '🚚';
      case 'delivered': return '🏠✅';
      case 'cancelled': return '❌';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-gray-600">Enter your order details to check the status</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Number *
                </label>
                <input
                  type="text"
                  value={tracking.orderNumber}
                  onChange={(e) => setTracking({...tracking, orderNumber: e.target.value})}
                  placeholder="Enter your order number"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  value={tracking.mobileNumber}
                  onChange={(e) => setTracking({...tracking, mobileNumber: e.target.value})}
                  placeholder="Enter your mobile number"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Searching...
                </div>
              ) : (
                'Track Order'
              )}
            </button>
          </form>
        </div>

        {/* Order Details */}
        {searched && !loading && (
          <>
            {order ? (
              <div className="space-y-6">
                {/* Order Header */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Order #{order.id}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Placed on {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)} mt-3 md:mt-0`}>
                      <span className="mr-2">{getStatusIcon(order.status)}</span>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Delivery Address</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p className="font-medium">{order.address?.name}</p>
                        <p>{order.address?.line1}</p>
                        <p>{order.address?.city}, {order.address?.pincode}</p>
                        <p>📱 {order.address?.phone}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Order Summary</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Items ({order.items?.length || 0})</span>
                          <span>₹{order.subtotal || order.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Delivery Fee</span>
                          <span>₹{order.deliveryFee || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Platform Fee</span>
                          <span>₹{order.platformFee || 0}</span>
                        </div>
                        <div className="flex justify-between font-medium text-gray-900 pt-2 border-t">
                          <span>Total</span>
                          <span>₹{order.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                {order.items && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="font-medium text-gray-900 mb-4">Order Items</h3>
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-lg">🛍️</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-600">₹{item.price} x {item.quantity}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">₹{item.price * item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Timeline */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-medium text-gray-900 mb-4">Order Timeline</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Order Placed</p>
                        <p className="text-xs text-gray-600">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>
                    
                    {order.status !== 'pending' && (
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order Confirmed</p>
                          <p className="text-xs text-gray-600">
                            {order.confirmedAt ? formatDate(order.confirmedAt) : 'Confirmed by merchant'}
                          </p>
                        </div>
                      </div>
                    )}

                    {order.status === 'delivered' && (
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Order Delivered</p>
                          <p className="text-xs text-gray-600">
                            {order.deliveredAt ? formatDate(order.deliveredAt) : 'Successfully delivered'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">❌</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
                <p className="text-gray-600 mb-4">
                  We couldn't find an order with the provided details. Please check:
                </p>
                <ul className="text-sm text-gray-600 text-left inline-block space-y-1">
                  <li>• Order number is correct</li>
                  <li>• Mobile number matches the one used while placing order</li>
                  <li>• Order was placed on this platform</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}