import React, { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';
import { OrderTrackingService } from '../utils/orderTrackingService';

export default function FloatingOrderTracker() {
  const [activeOrders, setActiveOrders] = useState([]);
  const [showTracker, setShowTracker] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Load orders from localStorage on mount
  useEffect(() => {
    const orders = OrderTrackingService.getActiveOrders();
    setActiveOrders(orders);
    
    // Initialize cleanup service
    OrderTrackingService.initCleanup();
  }, []);

  // Set up Firebase listeners for active orders
  useEffect(() => {
    const unsubscribes = [];

    activeOrders.forEach(order => {
      const orderRef = ref(db, `/orders/${order.id}`);
      
      const unsubscribe = onValue(orderRef, (snapshot) => {
        if (snapshot.exists()) {
          const updatedOrder = { ...snapshot.val(), id: order.id };
          
          // Update order status in tracking service
          OrderTrackingService.updateOrderStatus(order.id, updatedOrder.status, {
            total: updatedOrder.total,
            items: updatedOrder.items?.slice(0, 3),
            address: {
              name: updatedOrder.address?.name,
              line1: updatedOrder.address?.line1,
              city: updatedOrder.address?.city,
              phone: updatedOrder.address?.phone
            }
          });
          
          // Update local state
          setActiveOrders(OrderTrackingService.getActiveOrders());
        }
      });

      unsubscribes.push(() => off(orderRef, 'value', unsubscribe));
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeOrders.map(o => o.id).join(',')]);

  // Function to add new order to tracking
  const addOrderToTracking = (order) => {
    const trackedOrder = OrderTrackingService.addOrder(order);
    if (trackedOrder) {
      setActiveOrders(OrderTrackingService.getActiveOrders());
    }
  };

  // Expose function globally for other components to use
  useEffect(() => {
    window.addOrderToTracking = addOrderToTracking;
    
    // Periodic refresh of orders from tracking service
    const interval = setInterval(() => {
      try {
        setActiveOrders(OrderTrackingService.getActiveOrders());
      } catch (error) {
        console.error('Error refreshing orders:', error);
      }
    }, 30000); // Refresh every 30 seconds
    
    // Listen for custom events to update orders
    const handleOrderUpdate = (event) => {
      try {
        setActiveOrders(OrderTrackingService.getActiveOrders());
      } catch (error) {
        console.error('Error handling order update:', error);
      }
    };
    
    window.addEventListener('activeOrdersUpdate', handleOrderUpdate);
    
    return () => {
      delete window.addOrderToTracking;
      clearInterval(interval);
      window.removeEventListener('activeOrdersUpdate', handleOrderUpdate);
    };
  }, []);

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
      default: return '📋';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'preparing': return 'bg-purple-500';
      case 'ready': return 'bg-green-500';
      case 'assigned': return 'bg-indigo-500';
      case 'picked': return 'bg-orange-500';
      case 'in-transit': return 'bg-cyan-500';
      case 'delivered': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  const formatOrderId = (id) => {
    return id.length > 8 ? `${id.substring(0, 8)}...` : id;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Don't show if no active orders
  if (activeOrders.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Tracker Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowTracker(!showTracker)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:scale-110 ${getStatusColor(activeOrders[0]?.status)} relative`}
        >
          <span className="text-xl">{getStatusIcon(activeOrders[0]?.status)}</span>
          {activeOrders.length > 1 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {activeOrders.length}
            </div>
          )}
        </button>
      </div>

      {/* Tracker Panel */}
      {showTracker && (
        <div className="fixed bottom-24 right-6 z-40 w-80 max-h-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Order Tracking</h3>
              <button
                onClick={() => setShowTracker(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm opacity-90">{activeOrders.length} active order(s)</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {activeOrders.map((order, index) => (
              <div
                key={order.id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${currentOrder?.id === order.id ? 'bg-blue-50' : ''}`}
                onClick={() => setCurrentOrder(currentOrder?.id === order.id ? null : order)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getStatusIcon(order.status)}</span>
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        #{formatOrderId(order.id)}
                      </p>
                      <p className="text-xs text-gray-600">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-gray-900">₹{order.total}</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs text-white ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Order Details Expansion */}
                {currentOrder?.id === order.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Items:</p>
                        {order.items?.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-gray-600">
                            {item.name} × {item.quantity}
                          </p>
                        ))}
                        {order.items?.length > 2 && (
                          <p className="text-xs text-gray-500">
                            +{order.items.length - 2} more items
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Delivery to:</p>
                        <p className="text-xs text-gray-600">
                          {order.address?.name}<br />
                          {order.address?.line1}, {order.address?.city}
                        </p>
                      </div>

                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/track-order?order=${order.id}&phone=${order.address?.phone}`;
                          }}
                          className="flex-1 bg-blue-500 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Track Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.address?.phone) {
                              window.open(`tel:${order.address.phone}`, '_self');
                            }
                          }}
                          className="bg-green-500 text-white text-xs py-2 px-3 rounded-md hover:bg-green-600 transition-colors"
                        >
                          📞
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="p-3 bg-gray-50 border-t">
            <button
              onClick={() => window.location.href = '/track-order'}
              className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
            >
              Track by Order Number
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {showTracker && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-20"
          onClick={() => setShowTracker(false)}
        />
      )}
    </>
  );
}