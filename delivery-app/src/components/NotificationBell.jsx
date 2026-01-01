import React, { useState, useEffect } from 'react';
import { SoundNotification } from '../utils/soundNotification';

// Notification service for delivery app  
class NotificationService {
  static subscribeToDriverNotifications(callback) {
    // Import Firebase modules
    import('../firebase').then(({ db }) => {
      import('firebase/database').then(({ ref, onValue, off }) => {
        const notificationsRef = ref(db, '/notifications/drivers');
        onValue(notificationsRef, (snapshot) => {
          const notifications = snapshot.val() || {};
          const notificationsList = Object.entries(notifications)
            .map(([id, notification]) => ({ id, ...notification }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          callback(notificationsList);
        });
        
        return () => off(notificationsRef);
      });
    });
  }

  static async markAsRead(notificationId, type) {
    try {
      const { db } = await import('../firebase');
      const { ref, update } = await import('firebase/database');
      
      await update(ref(db, `/notifications/${type}/${notificationId}`), {
        read: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  static async markAllAsRead(type) {
    try {
      const { db } = await import('../firebase');
      const { ref, get, update } = await import('firebase/database');
      
      const snapshot = await get(ref(db, `/notifications/${type}`));
      const notifications = snapshot.val() || {};
      
      const updates = {};
      Object.keys(notifications).forEach(id => {
        if (!notifications[id].read) {
          updates[`/notifications/${type}/${id}/read`] = true;
          updates[`/notifications/${type}/${id}/readAt`] = new Date().toISOString();
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }
}

export default function NotificationBell({ type = 'drivers' }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribe;
    
    if (type === 'drivers') {
      unsubscribe = NotificationService.subscribeToDriverNotifications(setNotifications);
    }

    return unsubscribe;
  }, [type]);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    const prevUnreadCount = unreadCount;
    setUnreadCount(unread);

    // Play notification sound for new notifications
    if (unread > prevUnreadCount && prevUnreadCount >= 0) {
      // Play sound based on notification type
      const latestNotification = notifications.find(n => !n.read);
      const soundType = latestNotification?.type === 'order_available' ? 'new_order' : 
                       latestNotification?.type || 'default';
      
      SoundNotification.playNotificationSound(soundType);
      
      // Add vibration for mobile devices
      if (latestNotification?.type === 'new_order' || latestNotification?.type === 'order_available') {
        SoundNotification.vibrate([200, 100, 200, 100, 200]);
      } else {
        SoundNotification.vibrate([100, 50, 100]);
      }
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        if (latestNotification) {
          const notification = new Notification(latestNotification.title, {
            body: latestNotification.message,
            icon: '/favicon.ico',
            tag: 'driver-order',
            requireInteraction: latestNotification.type === 'new_order' || latestNotification.type === 'order_available',
            silent: false // Ensure sound plays
          });
          
          // Auto close after 8 seconds for non-urgent notifications
          if (latestNotification.type !== 'new_order' && latestNotification.type !== 'order_available') {
            setTimeout(() => notification.close(), 8000);
          }
        }
      }
    }
  }, [notifications, unreadCount]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    await NotificationService.markAsRead(notificationId, type);
  };

  const handleMarkAllAsRead = async () => {
    await NotificationService.markAllAsRead(type);
    setShowDropdown(false);
  };

  const getNotificationIcon = (notificationType) => {
    switch (notificationType) {
      case 'new_order':
      case 'order_available':
        return '📦';
      case 'order_assigned':
        return '✅';
      case 'order_picked':
        return '🚗';
      case 'order_delivered':
        return '🎉';
      case 'order_cancelled':
        return '❌';
      case 'payment_received':
        return '💰';
      case 'bonus_earned':
        return '🎁';
      case 'system_update':
        return '📢';
      case 'order_status_update':
        return '📋';
      default:
        return '🔔';
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          unreadCount > 0 
            ? 'text-primary-600 hover:text-primary-800 bg-primary-50' 
            : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          ></div>
          
          <div className="card absolute right-0 mt-2 w-80 max-w-sm bg-white/95 backdrop-blur-md border border-surface-200 rounded-2xl shadow-float z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-surface-200 flex justify-between items-center">
              <h3 className="font-semibold text-surface-900 text-lg">🚗 Delivery Alerts</h3>
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
                  <p className="font-medium">No delivery alerts yet</p>
                  <p className="text-sm mt-1">New order notifications will appear here</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-surface-100 hover:bg-surface-50 cursor-pointer transition-all ${
                      !notification.read ? 'bg-primary-50/50 border-l-4 border-l-primary-500' : ''
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-xl flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm font-semibold ${
                            !notification.read ? 'text-surface-900' : 'text-surface-700'
                          }`}>
                            {notification.title}
                          </h4>
                          <span className="text-xs text-surface-500 flex-shrink-0 ml-2">
                            {getTimeAgo(notification.timestamp)}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${
                          !notification.read ? 'text-surface-800' : 'text-surface-600'
                        }`}>
                          {notification.message}
                        </p>
                        {notification.orderId && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700 font-medium">
                              Order #{notification.orderId.slice(-6)}
                            </span>
                          </div>
                        )}
                        {notification.deliveryAddress && (
                          <div className="mt-2">
                            <p className="text-xs text-surface-600 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {notification.deliveryAddress}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              </div>

            {notifications.length > 10 && (
              <div className="p-4 border-t border-surface-200 text-center">
                <button className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                  View all {notifications.length} alerts
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}