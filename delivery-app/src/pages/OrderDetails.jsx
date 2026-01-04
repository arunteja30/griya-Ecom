import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ref, get, update, push } from 'firebase/database';
import { db } from '../firebase';
import { showToast } from '../utils/toast';
import { loadPricingConfig } from '../utils/deliveryFeeCalculator';
import { updateDriverEarnings, calculateDriverEarning } from '../utils/driverEarnings';
import locationService from '../utils/locationService';

export default function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliveryPerson, setDeliveryPerson] = useState(null);
  const [pricingConfig, setPricingConfig] = useState({ driverEarningsPercentage: 80 });
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);

  useEffect(() => {
    const person = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
    if (!person.id) {
      navigate('/login');
      return;
    }
    setDeliveryPerson(person);

    // Load pricing configuration
    loadPricingConfig().then(config => {
      setPricingConfig(config);
    }).catch(error => {
      console.error('Error loading pricing config:', error);
    });

    // Fetch order details
    const fetchOrder = async () => {
      try {
        const orderRef = ref(db, `/orders/${orderId}`);
        const snapshot = await get(orderRef);
        
        if (snapshot.exists()) {
          const orderData = snapshot.val();
          setOrder(orderData);
          
          // Start location tracking for assigned/picked/in-transit orders
          if (orderData.deliveryPersonId === person.id && 
              ['assigned', 'picked', 'in-transit'].includes(orderData.status) &&
              !isTrackingLocation) {
            startLocationTracking(person.firebaseKey);
          }
        } else {
          showToast('Order not found', 'error');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        showToast('Failed to load order details', 'error');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, navigate]);

  // Location tracking for active deliveries
  const startLocationTracking = async (firebaseKey) => {
    if (!firebaseKey || isTrackingLocation) return;
    
    try {
      const success = await locationService.startTracking(
        firebaseKey,
        (locationData) => {
          console.log('Location updated during delivery:', locationData);
        },
        (error) => {
          console.error('Location tracking error during delivery:', error);
        }
      );
      
      if (success) {
        setIsTrackingLocation(true);
        console.log('Started location tracking for delivery');
      }
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  };

  const stopLocationTracking = () => {
    if (isTrackingLocation) {
      locationService.stopTracking();
      setIsTrackingLocation(false);
      console.log('Stopped location tracking');
    }
  };

  // Stop location tracking when component unmounts or order is delivered/cancelled
  useEffect(() => {
    if (order && ['delivered', 'cancelled'].includes(order.status)) {
      stopLocationTracking();
    }
    
    return () => {
      stopLocationTracking();
    };
  }, [order?.status]);

  const updateOrderStatus = async (newStatus) => {
    try {
      const statusUpdates = {
        [`/orders/${orderId}/status`]: newStatus
      };

      const timestamp = new Date().toISOString();
      switch (newStatus) {
        case 'assigned':
          statusUpdates[`/orders/${orderId}/deliveryPersonId`] = deliveryPerson.id;
          statusUpdates[`/orders/${orderId}/deliveryPersonName`] = deliveryPerson.name;
          statusUpdates[`/orders/${orderId}/assignedAt`] = timestamp;
          break;
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

      // Update main order in /orders path
      await update(ref(db), statusUpdates);
      
      // Also update merchant-specific orders if they exist
      if (order?.merchantOrders && Array.isArray(order.merchantOrders)) {
        const merchantUpdates = {};
        
        // Update each merchant order
        for (const merchantOrder of order.merchantOrders) {
          if (merchantOrder.merchantId && merchantOrder.id) {
            merchantUpdates[`/merchantOrders/${merchantOrder.merchantId}/${merchantOrder.id}/status`] = newStatus;
            merchantUpdates[`/merchantOrders/${merchantOrder.merchantId}/${merchantOrder.id}/updatedAt`] = timestamp;
            
            if (newStatus === 'delivered') {
              merchantUpdates[`/merchantOrders/${merchantOrder.merchantId}/${merchantOrder.id}/deliveredAt`] = timestamp;
            }
          }
        }
        
        if (Object.keys(merchantUpdates).length > 0) {
          await update(ref(db), merchantUpdates);
          console.log('Updated merchant orders:', merchantUpdates);
        }
      }
      
      // Update delivery person earnings when delivered
      if (newStatus === 'delivered') {
        try {
          // Calculate and update delivery person earnings
          const deliveryFeeTotal = order.fees?.deliveryFeeApplied || order.fees?.deliveryFee || 0;
          const driverEarning = calculateDriverEarning(deliveryFeeTotal, pricingConfig.driverEarningsPercentage);
          
          if (driverEarning > 0 && deliveryPerson.firebaseKey) {
            await updateDriverEarnings(deliveryPerson.firebaseKey, driverEarning, orderId);
          }
          
          // Notify customer
          if (order?.address?.phone) {
            const customerNotification = {
              type: 'order_delivered',
              title: 'Order Delivered',
              message: `Your order #${orderId} has been delivered successfully. Thank you for your order!`,
              orderId: orderId,
              timestamp: timestamp,
              read: false,
              priority: 'high'
            };
            
            await ref(db, `/notifications/customers/${order.address.phone}`).push(customerNotification);
            console.log('Customer notification sent for delivery');
          }
          
          // Notify merchants
          if (order?.merchantOrders && Array.isArray(order.merchantOrders)) {
            for (const merchantOrder of order.merchantOrders) {
              if (merchantOrder.merchantId) {
                const merchantNotification = {
                  type: 'order_delivered',
                  title: 'Order Delivered',
                  message: `Order #${merchantOrder.id} has been delivered to the customer.`,
                  orderId: merchantOrder.id,
                  timestamp: timestamp,
                  read: false,
                  priority: 'medium'
                };
                
                await ref(db, '/notifications/merchants').push(merchantNotification);
                console.log(`Merchant notification sent for delivery to merchant ${merchantOrder.merchantId}`);
              }
            }
          }
        } catch (notificationError) {
          console.error('Error sending delivery notifications:', notificationError);
        }
      }

      await update(ref(db), statusUpdates);
      
      // Update local state
      setOrder(prev => ({ ...prev, status: newStatus }));
      showToast(`Order marked as ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error updating order status:', error);
      showToast('Failed to update order status', 'error');
    }
  };

  const callCustomer = () => {
    const phone = order?.address?.phone;
    if (phone) {
      window.open(`tel:${phone}`);
    } else {
      showToast('Customer phone number not available', 'error');
    }
  };

  const openMaps = () => {
    const address = order?.address;
    if (address) {
      const query = encodeURIComponent(`${address.line1}, ${address.city}, ${address.pincode}`);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(mapsUrl, '_blank');
    } else {
      showToast('Address not available', 'error');
    }
  };

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

  const getNextAction = () => {
    switch (order?.status) {
      case 'ready':
        return { action: 'assigned', label: 'Accept Order', color: 'btn-primary' };
      case 'assigned':
        return { action: 'picked', label: 'Mark as Picked', color: 'btn-warning' };
      case 'picked':
        return { action: 'in-transit', label: 'Start Delivery', color: 'btn-primary' };
      case 'in-transit':
        return { action: 'delivered', label: 'Mark as Delivered', color: 'btn-success' };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Order Not Found</h2>
          <Link to="/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const nextAction = getNextAction();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                Order #{orderId.slice(-6)}
              </h1>
            </div>
            <span className={`status-badge ${getStatusColor(order.status)}`}>
              {order.status || 'pending'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <div className="card p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-sm text-gray-900">{order.address?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-900 mr-2">{order.address?.phone || 'N/A'}</p>
                    {order.address?.phone && (
                      <button onClick={callCustomer} className="text-blue-600 hover:text-blue-800">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Delivery Address</h2>
                <button onClick={openMaps} className="text-blue-600 hover:text-blue-800 text-sm">
                  Open in Maps
                </button>
              </div>
              <div className="text-sm text-gray-900">
                <p>{order.address?.line1}</p>
                {order.address?.line2 && <p>{order.address.line2}</p>}
                <p>{order.address?.city} - {order.address?.pincode}</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="card p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Order Items</h2>
              <div className="space-y-3">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.variantLabel && (
                        <p className="text-xs text-gray-600">{item.variantLabel}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatINR(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="space-y-2">
                  {order.distance && (
                    <div className="flex justify-between text-sm text-green-600 bg-green-50 p-2 rounded">
                      <span>Distance: {order.distance.toFixed(1)} km</span>
                      <span className="font-medium">Your Earnings: {formatINR((order.fees?.deliveryFeeApplied * (pricingConfig.driverEarningsPercentage / 100)) || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-medium pt-2 border-t border-gray-200">
                    <span>Order Value:</span>
                    <span>{formatINR(order.total || order.subtotal || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Earnings Breakdown */}
              {order.fees?.deliveryFeeApplied > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 mt-6">
                  <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Your Earnings
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Total Delivery Fee</span>
                      <span className="font-medium text-gray-900">{formatINR(order.fees.deliveryFeeApplied)}</span>
                    </div>
                    
                    {order.distance && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Distance</span>
                        <span className="font-medium text-gray-900">{order.distance.toFixed(1)} km</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Your Share ({pricingConfig.driverEarningsPercentage}%)</span>
                      <span className="font-semibold text-green-700 text-lg">{formatINR((order.fees.deliveryFeeApplied * (pricingConfig.driverEarningsPercentage / 100)) || 0)}</span>
                    </div>

                    {order.distance && (
                      <div className="flex justify-between items-center pt-2 border-t border-green-200">
                        <span className="text-xs text-gray-600">Earnings per km</span>
                        <span className="text-xs font-medium text-green-700">
                          {formatINR(((order.fees.deliveryFeeApplied * (pricingConfig.driverEarningsPercentage / 100)) / order.distance) || 0)}/km
                        </span>
                      </div>
                    )}
                    
                    <div className="bg-white/50 rounded-lg p-3 mt-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">Platform Fee ({100 - pricingConfig.driverEarningsPercentage}%)</span>
                        <span className="text-gray-600">{formatINR((order.fees.deliveryFeeApplied * ((100 - pricingConfig.driverEarningsPercentage) / 100)) || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Order Status Timeline */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium">Order Placed</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                
                {order.assignedAt && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-400 rounded-full mr-3"></div>
                    <div>
                      <p className="text-sm font-medium">Assigned to {order.deliveryPersonName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.assignedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}

                {order.pickedAt && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-purple-400 rounded-full mr-3"></div>
                    <div>
                      <p className="text-sm font-medium">Picked from Store</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.pickedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}

                {order.inTransitAt && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-indigo-400 rounded-full mr-3"></div>
                    <div>
                      <p className="text-sm font-medium">Out for Delivery</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.inTransitAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}

                {order.deliveredAt && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                    <div>
                      <p className="text-sm font-medium">Delivered</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.deliveredAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {nextAction && (
                  <button
                    onClick={() => updateOrderStatus(nextAction.action)}
                    className={`w-full ${nextAction.color}`}
                  >
                    {nextAction.label}
                  </button>
                )}

                <button onClick={callCustomer} className="w-full btn-ghost">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Customer
                </button>

                <button onClick={openMaps} className="w-full btn-ghost">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Open in Maps
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}