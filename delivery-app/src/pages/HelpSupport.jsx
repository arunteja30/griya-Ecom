import React, { useState } from 'react';
import MobileLayout from '../components/MobileLayout';
import { ref, push } from 'firebase/database';
import { db } from '../firebase';

export default function HelpSupport() {
  const [message, setMessage] = useState('');
  const person = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');

  const sendSupport = async () => {
    try {
      const payload = {
        from: person.id || 'unknown',
        message,
        createdAt: new Date().toISOString(),
        status: 'open'
      };
      await push(ref(db, '/support/tickets'), payload);
      alert('Support request sent');
      setMessage('');
    } catch (e) {
      console.error(e);
      alert('Failed to send support request');
    }
  };

  return (
    <MobileLayout activeTab="profile">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Help & Support</h2>
        <p className="text-sm text-surface-600">Describe the issue and our support team will get back to you.</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input" rows={6} />
        <div className="flex space-x-2">
          <button onClick={sendSupport} className="btn btn-primary">Send</button>
        </div>
      </div>
    </MobileLayout>
  );
}
