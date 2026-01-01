import React, { useState, useEffect } from 'react';
import { NotificationService } from '../utils/notificationService';

export default function CustomerNotificationBell({ customerPhone }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!customerPhone) return;

    const unsubscribe = NotificationService.subscribeToCustomerNotifications(
      customerPhone,
      (newNotifications) => {
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.read).length);
      }
    );

    return unsubscribe;
  }, [customerPhone]);

  const handleMarkAsRead = async (notificationId) => {
    await NotificationService.markAsRead(notificationId, 'customers', customerPhone);
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await handleMarkAsRead(notification.id);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order_update': return '📦';
      case 'delivery_update': return '🚚';
      default: return '🔔';
    }
  };

  if (!customerPhone) return null;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-3.5-3.5a.5.5 0 010-.7l3.5-3.5H15V6a3 3 0 00-3-3H9a3 3 0 00-3 3v3.3H1l3.5 3.5a.5.5 0 010 .7L1 17h5v2a3 3 0 003 3h3a3 3 0 003-3v-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowNotifications(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Order Updates</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  {unreadCount} unread • {notifications.length} total
                </p>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    📭
                  </div>
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs mt-1">You'll receive updates about your orders here</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50' : ''}`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </h4>
                            <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-800' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-gray-500">
                                {formatDate(notification.timestamp)}
                              </p>
                              {notification.orderId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/track-order?order=${notification.orderId}&phone=${customerPhone}`;
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  Track Order
                                </button>
                              )}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    window.location.href = '/track-order';
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
                >
                  Track All Orders →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}