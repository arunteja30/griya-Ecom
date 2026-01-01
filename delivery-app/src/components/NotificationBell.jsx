import React, { useState, useEffect } from 'react';

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
  const [playNotificationSound, setPlayNotificationSound] = useState(false);

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
      setPlayNotificationSound(true);
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        const latestNotification = notifications.find(n => !n.read);
        if (latestNotification) {
          new Notification(latestNotification.title, {
            body: latestNotification.message,
            icon: '/favicon.ico',
            tag: 'driver-order'
          });
        }
      }
    }
  }, [notifications]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Audio effect for notifications
  useEffect(() => {
    if (playNotificationSound) {
      // Create audio context for notification sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        
        setPlayNotificationSound(false);
      } catch (error) {
        console.log('Audio notification not supported');
        setPlayNotificationSound(false);
      }
    }
  }, [playNotificationSound]);

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
        return '🛍️';
      case 'order_available':
        return '🚗';
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
        className={`relative p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          unreadCount > 0 
            ? 'text-blue-600 hover:text-blue-800 bg-blue-50' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM13 3h-2l-2 2H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2-2z" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          ></div>
          
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Delivery Alerts</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="text-4xl mb-2">🚗</div>
                  <p>No delivery alerts yet</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </h4>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {getTimeAgo(notification.timestamp)}
                          </span>
                        </div>
                        <p className={`text-sm mt-1 ${
                          !notification.read ? 'text-gray-800' : 'text-gray-600'
                        }`}>
                          {notification.message}
                        </p>
                        {notification.orderId && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              Order #{notification.orderId}
                            </span>
                          </div>
                        )}
                        {notification.deliveryAddress && (
                          <div className="mt-1">
                            <p className="text-xs text-gray-500">
                              📍 {notification.deliveryAddress}
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
              <div className="p-3 border-t border-gray-200 text-center">
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  View all alerts
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}