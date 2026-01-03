import { ref, push, update, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';

export class NotificationService {
  // Subscribe to merchant notifications
  static subscribeToMerchantNotifications(merchantId, callback) {
    const notificationsRef = ref(db, '/notifications/merchants');
    onValue(notificationsRef, (snapshot) => {
      const notifications = snapshot.val() || {};
      // Filter notifications for this merchant or general merchant notifications
      const merchantNotifications = Object.entries(notifications)
        .map(([id, notification]) => ({ id, ...notification }))
        .filter(n => !n.merchantId || n.merchantId === merchantId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(merchantNotifications);
    });
    
    return () => off(notificationsRef);
  }

  // Send notification to delivery drivers when order is ready
  static async notifyDriversOrderReady(orderData) {
    try {
      const timestamp = new Date().toISOString();
      
      const driverNotification = {
        type: 'order_ready',
        title: 'Order Ready for Pickup',
        message: `Order #${orderData.id} is ready at ${orderData.storeName || 'store'}`,
        orderId: orderData.id,
        merchantId: orderData.merchantId,
        orderTotal: orderData.subtotal || orderData.total,
        timestamp,
        read: false,
        priority: 'high'
      };

      await push(ref(db, '/notifications/drivers/broadcast'), driverNotification);
      console.log('Order ready notification sent to drivers');
    } catch (error) {
      console.error('Error sending driver notification:', error);
    }
  }

  // Send notification to customer about order status
  static async notifyCustomerOrderStatus(customerPhone, orderId, status, message) {
    try {
      const notification = {
        type: 'order_update',
        title: `Order ${status}`,
        message,
        orderId,
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'medium'
      };

      await push(ref(db, `/notifications/customers/${customerPhone}`), notification);
      console.log(`Order status notification sent to customer ${customerPhone}`);
    } catch (error) {
      console.error('Error sending customer notification:', error);
    }
  }

  static async markAsRead(notificationId, type) {
    try {
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