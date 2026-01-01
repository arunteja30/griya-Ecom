import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../utils/toast';
import NotificationBell from '../components/NotificationBell';
import { NotificationService } from '../utils/notificationService';

export default function Dashboard() {
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('available'); // available, assigned, picked, completed
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

  const handleLogout = () => {
    localStorage.removeItem('deliveryPerson');
    navigate('/login');
  };

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
      
      // Send notification to customer
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

      // Add timestamp for status changes
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
      
      // Send customer notification based on status
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
      case 'completed':
        return order.deliveryPersonId === deliveryPerson?.id && 
               (order.status === 'delivered' || order.status === 'cancelled');
      default:
        return true;
    }
  }).sort((a, b) => {
    const timeA = new Date(a[1].createdAt || 0).getTime();
    const timeB = new Date(b[1].createdAt || 0).getTime();
    return timeB - timeA;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'confirmed': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'picked': return 'bg-purple-100 text-purple-800';
      case 'in-transit': return 'bg-indigo-100 text-indigo-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Delivery Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationBell type="drivers" />
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">{deliveryPerson?.name}</span>
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  {deliveryPerson?.status}
                </span>
              </div>
              
              <Link to="/profile" className="text-gray-400 hover:text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
              
              <button onClick={handleLogout} className="text-gray-400 hover:text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setFilter('available')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'available' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Available Orders ({filteredOrders.length})
            </button>
            <button
              onClick={() => setFilter('assigned')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'assigned' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Orders ({Object.entries(orders).filter(([id, order]) => 
                order.deliveryPersonId === deliveryPerson?.id && 
                (order.status === 'assigned' || order.status === 'picked' || order.status === 'in-transit')
              ).length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'completed' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed ({Object.entries(orders).filter(([id, order]) => 
                order.deliveryPersonId === deliveryPerson?.id && 
                (order.status === 'delivered' || order.status === 'cancelled')
              ).length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-3a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">
              {filter === 'available' && 'No new orders available for pickup'}
              {filter === 'assigned' && 'No orders currently assigned to you'}
              {filter === 'completed' && 'No completed orders yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map(([orderId, order]) => (
              <div key={orderId} className="card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Order #{orderId.slice(-6)}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`status-badge ${getStatusColor(order.status)}`}>
                    {order.status || 'pending'}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Customer</p>
                    <p className="text-sm text-gray-600">{order.address?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{order.address?.phone || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                    <p className="text-sm text-gray-600">
                      {order.address?.line1}, {order.address?.city} - {order.address?.pincode}
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">Total Amount</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatINR(order.total || order.subtotal || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {filter === 'available' && (
                    <>
                      <button
                        onClick={() => acceptOrder(orderId)}
                        className="btn-primary flex-1"
                      >
                        Accept Order
                      </button>
                      <Link
                        to={`/order/${orderId}`}
                        className="btn-ghost flex-shrink-0"
                      >
                        View Details
                      </Link>
                    </>
                  )}

                  {filter === 'assigned' && order.status === 'assigned' && (
                    <>
                      <button
                        onClick={() => updateOrderStatus(orderId, 'picked')}
                        className="btn-warning flex-1"
                      >
                        Mark as Picked
                      </button>
                      <Link
                        to={`/order/${orderId}`}
                        className="btn-ghost flex-shrink-0"
                      >
                        Details
                      </Link>
                    </>
                  )}

                  {filter === 'assigned' && order.status === 'picked' && (
                    <>
                      <button
                        onClick={() => updateOrderStatus(orderId, 'in-transit')}
                        className="btn-primary flex-1"
                      >
                        Start Delivery
                      </button>
                      <Link
                        to={`/order/${orderId}`}
                        className="btn-ghost flex-shrink-0"
                      >
                        Details
                      </Link>
                    </>
                  )}

                  {filter === 'assigned' && order.status === 'in-transit' && (
                    <>
                      <button
                        onClick={() => updateOrderStatus(orderId, 'delivered')}
                        className="btn-success flex-1"
                      >
                        Mark as Delivered
                      </button>
                      <Link
                        to={`/order/${orderId}`}
                        className="btn-ghost flex-shrink-0"
                      >
                        Details
                      </Link>
                    </>
                  )}

                  {filter === 'completed' && (
                    <Link
                      to={`/order/${orderId}`}
                      className="btn-ghost w-full"
                    >
                      View Details
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}