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
        const snapshot = await get(ref(db, '/orders'));
        const orders = snapshot.val() || {};
        const list = Object.entries(orders)
          .filter(([id, o]) => o.deliveryPersonId === person.id)
          .map(([id, o]) => ({ id, ...o }))
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setHistory(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [person.id]);

  return (
    <MobileLayout activeTab="profile">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Delivery History</h2>
        <div className="space-y-3">
          {history.length === 0 && <p className="text-sm text-surface-600">No deliveries yet.</p>}
          {history.map(order => (
            <div key={order.id} className="card p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold">Order #{order.id}</div>
                  <div className="text-sm text-surface-600">{order.customerName || 'Customer'}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{order.status}</div>
                  <div className="text-sm text-surface-600">{new Date(order.updatedAt || order.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
