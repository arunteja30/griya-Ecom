import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [deliveryPerson, setDeliveryPerson] = useState(() => {
    return JSON.parse(localStorage.getItem('deliveryPerson') || '{}');
  });

  const [status, setStatus] = useState(deliveryPerson.status || 'available');
  const [isEditing, setIsEditing] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('deliveryPerson');
    navigate('/login');
  };

  const updateStatus = (newStatus) => {
    const updated = { ...deliveryPerson, status: newStatus };
    localStorage.setItem('deliveryPerson', JSON.stringify(updated));
    setDeliveryPerson(updated);
    setStatus(newStatus);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
              <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Profile Information */}
          <div className="card p-6">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{deliveryPerson.name}</h2>
                <p className="text-gray-600">Delivery Partner #{deliveryPerson.id}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <p className="text-gray-900">{deliveryPerson.phone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <p className="text-gray-900">{deliveryPerson.vehicle}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className={`status-badge ${getStatusColor(status)}`}>
                  {status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login Time</label>
                <p className="text-gray-900">
                  {new Date(deliveryPerson.loginTime).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Status Management */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Availability Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                  <div>
                    <p className="font-medium">Available</p>
                    <p className="text-sm text-gray-600">Ready to accept new orders</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  value="available"
                  checked={status === 'available'}
                  onChange={() => updateStatus('available')}
                  className="h-4 w-4 text-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
                  <div>
                    <p className="font-medium">Busy</p>
                    <p className="text-sm text-gray-600">Currently on delivery</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  value="busy"
                  checked={status === 'busy'}
                  onChange={() => updateStatus('busy')}
                  className="h-4 w-4 text-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                  <div>
                    <p className="font-medium">Offline</p>
                    <p className="text-sm text-gray-600">Not accepting orders</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="status"
                  value="offline"
                  checked={status === 'offline'}
                  onChange={() => updateStatus('offline')}
                  className="h-4 w-4 text-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="card p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">0</div>
              <p className="text-sm text-gray-600">Orders Today</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">₹0</div>
              <p className="text-sm text-gray-600">Earnings Today</p>
            </div>
            <div className="card p-6 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">0</div>
              <p className="text-sm text-gray-600">Total Deliveries</p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
            <div className="space-y-3">
              <Link to="/dashboard" className="w-full btn-primary">
                Back to Dashboard
              </Link>
              <button onClick={handleLogout} className="w-full btn-danger">
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}