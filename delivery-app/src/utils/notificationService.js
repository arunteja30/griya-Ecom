import { ref, push, update, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';

export class NotificationService {
  // Send customer-specific notification
  static async sendCustomerNotification(customerPhone, orderId, title, message, type = 'order_update') {
    try {
      const notification = {
        type,
        title,
        message,
        orderId,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'high'
      };

      await push(ref(db, `/notifications/customers/${customerPhone}`), notification);
      console.log(`Notification sent to customer ${customerPhone}`);
    } catch (error) {
      console.error('Error sending customer notification:', error);
    }
  }

  static subscribeToCustomerNotifications(customerPhone, callback) {
    const notificationsRef = ref(db, `/notifications/customers/${customerPhone}`);
    onValue(notificationsRef, (snapshot) => {
      const notifications = snapshot.val() || {};
      const notificationsList = Object.entries(notifications)
        .map(([id, notification]) => ({ id, ...notification }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(notificationsList);
    });
    
    return () => off(notificationsRef);
  }

  static async markAsRead(notificationId, type, customerPhone = null) {
    try {
      let path;
      if (type === 'customers' && customerPhone) {
        path = `/notifications/customers/${customerPhone}/${notificationId}`;
      } else {
        path = `/notifications/${type}/${notificationId}`;
      }
      
      await update(ref(db, path), {
        read: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}