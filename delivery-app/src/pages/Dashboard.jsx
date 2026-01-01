import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../utils/toast';
import MobileLayout from '../components/MobileLayout';
import { NotificationService } from '../utils/notificationService';

export default function Dashboard() {
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('available');
  const [deliveryPerson, setDeliveryPerson] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get delivery person from localStorage
    const person = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
    if (!person.id) {
      navigate('/login');
      return;
    }
    setDeliveryPerson(person);

    // Listen to orders in real-time
    const ordersRef = ref(db, '/orders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const acceptOrder = async (orderId) => {
    try {
      const order = orders[orderId];
      const updates = {
        [`/orders/${orderId}/status`]: 'assigned',
        [`/orders/${orderId}/deliveryPersonId`]: deliveryPerson.id,
        [`/orders/${orderId}/deliveryPersonName`]: deliveryPerson.name,
        [`/orders/${orderId}/assignedAt`]: new Date().toISOString()
      };
      
      await update(ref(db), updates);
      
      // Send notification to driver about order assignment
      await NotificationService.sendDriverNotification(
        deliveryPerson.id,
        '✅ Order Assigned!',
        `You have successfully accepted order #${orderId.slice(-6)}. Please proceed to pickup location.`,
        'order_assigned',
        orderId,
        order?.address ? `${order.address.line1}, ${order.address.city}` : null
      );
      
      // Play success sound for driver
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Success sound - ascending notes
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } catch (error) {
        console.log('Audio feedback not supported');
      }
      
      if (order?.address?.phone) {
        await NotificationService.sendCustomerNotification(
          order.address.phone,
          orderId,
          'Driver Assigned!',
          `Your order #${orderId} has been assigned to delivery partner ${deliveryPerson.name}.`
        );
      }
      
      showToast('Order accepted successfully!', 'success');
    } catch (error) {
      console.error('Error accepting order:', error);
      showToast('Failed to accept order', 'error');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = orders[orderId];
      const statusUpdates = {
        [`/orders/${orderId}/status`]: newStatus
      };

      const timestamp = new Date().toISOString();
      switch (newStatus) {
        case 'picked':
          statusUpdates[`/orders/${orderId}/pickedAt`] = timestamp;
          break;
        case 'in-transit':
          statusUpdates[`/orders/${orderId}/inTransitAt`] = timestamp;
          break;
        case 'delivered':
          statusUpdates[`/orders/${orderId}/deliveredAt`] = timestamp;
          break;
      }

      await update(ref(db), statusUpdates);
      
      if (order?.address?.phone) {
        let title, message;
        
        switch (newStatus) {
          case 'picked':
            title = 'Order Picked Up!';
            message = `Your order #${orderId} has been picked up and is on its way to you.`;
            break;
          case 'in-transit':
            title = 'Order Out for Delivery!';
            message = `Your order #${orderId} is out for delivery. Estimated arrival time: 30 mins.`;
            break;
          case 'delivered':
            title = 'Order Delivered!';
            message = `Your order #${orderId} has been successfully delivered. Thank you for your order!`;
            break;
          default:
            title = 'Order Update';
            message = `Your order #${orderId} status has been updated to ${newStatus}.`;
        }
        
        await NotificationService.sendCustomerNotification(
          order.address.phone,
          orderId,
          title,
          message
        );
      }
      
      showToast(`Order marked as ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error updating order status:', error);
      showToast('Failed to update order status', 'error');
    }
  };

  // Filter orders based on current filter and delivery person
  const filteredOrders = Object.entries(orders).filter(([id, order]) => {
    switch (filter) {
      case 'available':
        return order.status === 'pending' || order.status === 'confirmed';
      case 'assigned':
        return order.deliveryPersonId === deliveryPerson?.id && 
               (order.status === 'assigned' || order.status === 'picked' || order.status === 'in-transit');
      default:
        return true;
    }
  }).sort((a, b) => {
    const timeA = new Date(a[1].createdAt || 0).getTime();
    const timeB = new Date(b[1].createdAt || 0).getTime();
    return timeB - timeA;
  });

  // Current active orders (for prominent display)
  const currentOrders = Object.entries(orders).filter(([id, order]) => 
    order.deliveryPersonId === deliveryPerson?.id && 
    (order.status === 'assigned' || order.status === 'picked' || order.status === 'in-transit')
  );

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
      case 'confirmed': 
        return { 
          class: 'status-available', 
          emoji: '🔍', 
          text: 'Available'
        };
      case 'assigned': 
        return { 
          class: 'status-assigned', 
          emoji: '📋', 
          text: 'Assigned'
        };
      case 'picked': 
        return { 
          class: 'status-picked', 
          emoji: '📦', 
          text: 'Picked Up'
        };
      case 'in-transit': 
        return { 
          class: 'status-in-transit', 
          emoji: '🚚', 
          text: 'In Transit'
        };
      case 'delivered': 
        return { 
          class: 'status-delivered', 
          emoji: '✅', 
          text: 'Delivered'
        };
      case 'cancelled': 
        return { 
          class: 'status-cancelled', 
          emoji: '❌', 
          text: 'Cancelled'
        };
      default: 
        return { 
          class: 'status-available', 
          emoji: '🔍', 
          text: status
        };
    }
  };

  if (loading) {
    return (
      <MobileLayout activeTab="dashboard">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-6 animate-pulse-glow"></div>
            <p className="text-surface-600 text-lg">Loading orders...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout activeTab="dashboard">
      <div className="px-4 py-6 space-y-6">
        {/* Current Orders Section (if any) */}
        {currentOrders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="mobile-title text-primary-600">🚚 Current Orders</h2>
              <span className="bg-primary-100 text-primary-600 text-xs font-bold px-3 py-1 rounded-full">
                {currentOrders.length}
              </span>
            </div>
            
            <div className="space-y-3">
              {currentOrders.map(([orderId, order]) => {
                const statusConfig = getStatusConfig(order.status);
                return (
                  <div key={orderId} className="bg-gradient-to-r from-primary-500 to-fresh-500 p-4 rounded-3xl text-white shadow-glow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">#{orderId.slice(-6)}</h3>
                        <p className="text-white/90 text-sm">{order.address?.name}</p>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-sm font-semibold">{statusConfig.emoji} {statusConfig.text}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{formatINR(order.total || order.subtotal || 0)}</span>
                      
                      <div className="flex space-x-2">
                        {order.status === 'assigned' && (
                          <button
                            onClick={() => updateOrderStatus(orderId, 'picked')}
                            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                          >
                            📦 Pick Up
                          </button>
                        )}
                        
                        {order.status === 'picked' && (
                          <button
                            onClick={() => updateOrderStatus(orderId, 'in-transit')}
                            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                          >
                            🚚 Start Delivery
                          </button>
                        )}
                        
                        {order.status === 'in-transit' && (
                          <button
                            onClick={() => updateOrderStatus(orderId, 'delivered')}
                            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                          >
                            ✅ Delivered
                          </button>
                        )}
                        
                        <Link
                          to={`/order/${orderId}`}
                          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
                        >
                          👀 Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">
              {Object.entries(orders).filter(([id, order]) => 
                order.status === 'pending' || order.status === 'confirmed'
              ).length}
            </div>
            <p className="text-sm font-medium text-surface-600">Available Orders</p>
          </div>
          
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold text-fresh-600">
              {Object.entries(orders).filter(([id, order]) => 
                order.deliveryPersonId === deliveryPerson?.id && order.status === 'delivered' &&
                new Date(order.deliveredAt).toDateString() === new Date().toDateString()
              ).length}
            </div>
            <p className="text-sm font-medium text-surface-600">Today's Deliveries</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-1 border border-surface-200">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setFilter('available')}
              className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                filter === 'available' 
                  ? 'bg-primary-500 text-white shadow-soft' 
                  : 'text-surface-600 hover:text-primary-600'
              }`}
            >
              🔍 Available ({Object.entries(orders).filter(([id, order]) => 
                order.status === 'pending' || order.status === 'confirmed'
              ).length})
            </button>
            <button
              onClick={() => setFilter('assigned')}
              className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                filter === 'assigned' 
                  ? 'bg-primary-500 text-white shadow-soft' 
                  : 'text-surface-600 hover:text-primary-600'
              }`}
            >
              📋 My Orders ({currentOrders.length})
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-surface-100 to-surface-200 rounded-3xl flex items-center justify-center">
              <svg className="w-10 h-10 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-3a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
            <h3 className="mobile-title mb-3">No orders found</h3>
            <p className="mobile-subtitle max-w-sm mx-auto">
              {filter === 'available' && 'No new orders available for pickup'}
              {filter === 'assigned' && 'No orders currently assigned to you'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold text-surface-800 text-lg">
              {filter === 'available' ? '🔍 Available Orders' : '📝 My Orders'}
            </h3>
            
            <div className="space-y-3">
              {filteredOrders.map(([orderId, order]) => {
                const statusConfig = getStatusConfig(order.status);
                return (
                  <div key={orderId} className="card-order animate-fade-in">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-surface-900">#{orderId.slice(-6)}</h3>
                        <p className="text-sm text-surface-500">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`${statusConfig.class} status-badge`}>
                        {statusConfig.emoji} {statusConfig.text}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                        <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide mb-1">Customer</p>
                        <p className="font-semibold text-surface-900">{order.address?.name || 'N/A'}</p>
                        <p className="text-sm text-surface-600">{order.address?.phone || 'N/A'}</p>
                      </div>

                      <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                        <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide mb-1">Delivery Address</p>
                        <p className="text-sm text-surface-700 leading-relaxed">
                          {order.address?.line1}, {order.address?.city} - {order.address?.pincode}
                        </p>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-primary-50 to-fresh-50 rounded-xl border border-primary-200">
                        <span className="text-sm font-semibold text-surface-700">Total Amount</span>
                        <span className="text-xl font-bold text-primary-600">
                          {formatINR(order.total || order.subtotal || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {filter === 'available' && (
                        <>
                          <button
                            onClick={() => acceptOrder(orderId)}
                            className="btn-primary flex-1"
                          >
                            ✅ Accept Order
                          </button>
                          <Link
                            to={`/order/${orderId}`}
                            className="btn-ghost flex-shrink-0 text-center"
                          >
                            👀 View Details
                          </Link>
                        </>
                      )}

                      {filter === 'assigned' && (
                        <>
                          {order.status === 'assigned' && (
                            <button
                              onClick={() => updateOrderStatus(orderId, 'picked')}
                              className="btn-warning flex-1"
                            >
                              📦 Mark as Picked
                            </button>
                          )}

                          {order.status === 'picked' && (
                            <button
                              onClick={() => updateOrderStatus(orderId, 'in-transit')}
                              className="btn-primary flex-1"
                            >
                              🚚 Start Delivery
                            </button>
                          )}

                          {order.status === 'in-transit' && (
                            <button
                              onClick={() => updateOrderStatus(orderId, 'delivered')}
                              className="btn-fresh flex-1"
                            >
                              ✅ Mark as Delivered
                            </button>
                          )}

                          <Link
                            to={`/order/${orderId}`}
                            className="btn-ghost flex-shrink-0 text-center"
                          >
                            Details
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}