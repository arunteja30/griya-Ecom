import React, { useState, useEffect } from 'react';
import { NotificationService } from '../utils/notificationService';
import { SoundNotification } from '../utils/soundNotification';

export default function NotificationBell({ merchant }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!merchant?.id) return;

    const unsubscribe = NotificationService.subscribeToMerchantNotifications(
      merchant.id,
      (newNotifications) => {
        const prevUnreadCount = unreadCount;
        const newUnreadCount = newNotifications.filter(n => !n.read).length;
        
        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);
        
        // Trigger sound for new notifications
        if (newUnreadCount > prevUnreadCount && prevUnreadCount >= 0) {
          // Play sound based on notification type
          const latestNotification = newNotifications.find(n => !n.read);
          const soundType = latestNotification?.type || 'default';
          
          SoundNotification.playNotificationSound(soundType);
          
          // Add vibration for mobile devices
          if (latestNotification?.type === 'new_order') {
            SoundNotification.vibrate([300, 100, 300, 100, 300]);
          } else {
            SoundNotification.vibrate([150, 50, 150]);
          }
          
          // Show browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            if (latestNotification) {
              const notification = new Notification(latestNotification.title, {
                body: latestNotification.message,
                icon: '/favicon.ico',
                tag: 'merchant-notification',
                requireInteraction: latestNotification.type === 'new_order',
                silent: false
              });
              
              // Auto close after 6 seconds for non-urgent notifications
              if (latestNotification.type !== 'new_order') {
                setTimeout(() => notification.close(), 6000);
              }
            }
          }
        }
      }
    );

    return unsubscribe;
  }, [merchant?.id, unreadCount]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    await NotificationService.markAsRead(notificationId, 'merchants');
  };

  const handleMarkAllAsRead = async () => {
    await NotificationService.markAllAsRead('merchants');
    setShowNotifications(false);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_order':
        return '📋';
      case 'order_update':
        return '🔄';
      case 'payment_received':
        return '💰';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          unreadCount > 0 
            ? 'text-primary-600 hover:text-primary-800 bg-primary-50' 
            : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 17h5l-3.5-3.5a7 7 0 01-1.5-4.5V9a6 6 0 10-12 0v0c0 1.677-.46 3.346-1.5 4.5L0 17h5m5 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowNotifications(false)}
          />
          <div className="card absolute right-0 top-full mt-2 w-80 max-w-sm bg-white/95 backdrop-blur-md border border-surface-200 rounded-2xl shadow-float z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="font-semibold text-surface-900 text-lg">🏪 Store Alerts</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-surface-500">
                  <div className="text-4xl mb-3">🔔</div>
                  <p className="font-medium">No notifications yet</p>
                  <p className="text-sm mt-1">Order and payment alerts will appear here</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-50 cursor-pointer transition-colors ${
                      notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          notification.read ? 'text-gray-900' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-1 ${
                          notification.read ? 'text-gray-500' : 'text-gray-600'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {notifications.length > 10 && (
              <div className="p-2 border-t border-gray-100 text-center">
                <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}