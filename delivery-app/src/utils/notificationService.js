import { ref, push, update, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';

export class NotificationService {
  // Send driver-specific notification
  static async sendDriverNotification(driverId, title, message, type = 'order_update', orderId = null, deliveryAddress = null) {
    try {
      const notification = {
        type,
        title,
        message,
        orderId,
        deliveryAddress,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'high'
      };

      await push(ref(db, `/notifications/drivers/${driverId}`), notification);
      console.log(`Notification sent to driver ${driverId}`);
    } catch (error) {
      console.error('Error sending driver notification:', error);
    }
  }

  // Send general driver notifications (all drivers)
  static async sendGeneralDriverNotification(title, message, type = 'system_update') {
    try {
      const notification = {
        type,
        title,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'medium'
      };

      await push(ref(db, `/notifications/drivers/general`), notification);
      console.log('General notification sent to all drivers');
    } catch (error) {
      console.error('Error sending general driver notification:', error);
    }
  }

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

  // Send merchant-specific notification for order delivery
  static async notifyMerchantOrderDelivered(merchantId, orderId) {
    try {
      const notification = {
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `Order #${orderId} has been delivered to the customer.`,
        orderId,
        merchantId,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'medium'
      };

      await push(ref(db, '/notifications/merchants'), notification);
      console.log(`Delivery notification sent to merchant ${merchantId}`);
    } catch (error) {
      console.error('Error sending merchant delivery notification:', error);
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