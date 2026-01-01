import React, { useState, useEffect } from 'react';
import MobileLayout from '../components/MobileLayout';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';

export default function DeliveryHistory() {
  const [history, setHistory] = useState([]);
  const person = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Fetch regular orders
        const ordersSnapshot = await get(ref(db, '/orders'));
        const orders = ordersSnapshot.val() || {};
        const regularOrders = Object.entries(orders)
          .filter(([id, o]) => o.deliveryPersonId === person.id)
          .map(([id, o]) => ({ id, ...o, orderType: 'regular' }));

        // Fetch merchant orders
        const merchantOrdersSnapshot = await get(ref(db, '/merchantOrders'));
        const merchantOrdersData = merchantOrdersSnapshot.val() || {};
        const merchantOrders = [];
        
        // Flatten merchant orders from all merchants
        Object.entries(merchantOrdersData).forEach(([merchantId, orders]) => {
          Object.entries(orders || {}).forEach(([orderId, order]) => {
            if (order.deliveryPersonId === person.id) {
              merchantOrders.push({
                id: orderId,
                ...order,
                orderType: 'merchant',
                merchantId
              });
            }
          });
        });

        // Combine all orders and sort by date
        const allOrders = [...regularOrders, ...merchantOrders]
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        
        setHistory(allOrders);
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [person.id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateEarnings = (order) => {
    // For merchant orders, show delivery fee only
    if (order.orderType === 'merchant') {
      return order.fees?.deliveryFee || order.deliveryFee || 50; // Default delivery fee
    }
    
    // For regular orders, show delivery fee or a portion of total
    const deliveryFee = order.deliveryFee || order.fees?.deliveryFee;
    if (deliveryFee) {
      return deliveryFee;
    }
    
    // Fallback: calculate a percentage of total order value
    const orderTotal = order.total || order.subtotal || 0;
    return Math.min(orderTotal * 0.1, 100); // 10% capped at ₹100
  };

  return (
    <MobileLayout activeTab="profile">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Delivery History</h2>
        <div className="space-y-3">
          {history.length === 0 && <p className="text-sm text-surface-600">No deliveries yet.</p>}
          {history.map(order => {
            const earnings = calculateEarnings(order);
            return (
              <div key={order.id} className="card p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold">Order #{order.id}</div>
                      {order.orderType === 'merchant' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Merchant
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-surface-600 mb-1">
                      {order.customer?.name || order.customerName || 'Customer'}
                    </div>
                    <div className="text-sm text-surface-600">
                      {new Date(order.updatedAt || order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600 mb-1">
                      {formatCurrency(earnings)}
                    </div>
                    <div className="text-xs text-surface-500 mb-1">Earnings</div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'delivered' 
                        ? 'bg-green-100 text-green-800' 
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}
