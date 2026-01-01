import { ref, push, update, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';

export class NotificationService {
  static async sendOrderNotification(orderData) {
    try {
      const timestamp = new Date().toISOString();
      
      // Send notification only to merchants initially
      const merchantNotification = {
        type: 'new_order',
        title: 'New Order Received',
        message: `Order #${orderData.id} for ₹${orderData.total}`,
        orderId: orderData.id,
        orderTotal: orderData.total,
        customerName: orderData.customer.name,
        timestamp,
        read: false,
        priority: 'high'
      };

      // Add to merchant notifications only
      await push(ref(db, '/notifications/merchants'), merchantNotification);

      console.log('Order notification sent to merchants');
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  static async sendOrderToDrivers(orderData) {
    try {
      const timestamp = new Date().toISOString();
      
      // Send notification to available drivers after merchant accepts
      const driverNotification = {
        type: 'order_available',
        title: 'New Delivery Available',
        message: `Order #${orderData.id} ready for pickup`,
        orderId: orderData.id,
        orderTotal: orderData.total,
        pickupAddress: orderData.storeAddress || 'Store Location',
        deliveryAddress: orderData.shippingAddress?.fullAddress || orderData.address?.line1,
        timestamp,
        read: false,
        priority: 'high'
      };

      // Add to driver notifications
      await push(ref(db, '/notifications/drivers'), driverNotification);

      console.log('Order notification sent to drivers');
    } catch (error) {
      console.error('Error sending driver notifications:', error);
    }
  }

  static async sendOrderStatusUpdate(orderId, status, message, targetType = 'both', customerPhone = null) {
    try {
      const timestamp = new Date().toISOString();
      
      const notification = {
        type: 'order_status_update',
        title: `Order ${status}`,
        message,
        orderId,
        status,
        timestamp,
        read: false,
        priority: 'medium'
      };

      const promises = [];
      
      if (targetType === 'merchant' || targetType === 'both') {
        promises.push(push(ref(db, '/notifications/merchants'), notification));
      }
      
      if (targetType === 'driver' || targetType === 'both') {
        promises.push(push(ref(db, '/notifications/drivers'), notification));
      }

      // Send customer-specific notification if phone number is provided
      if (customerPhone && (targetType === 'customer' || targetType === 'both')) {
        const customerNotification = {
          ...notification,
          type: 'order_update',
          title: `Order Update`,
          customerPhone,
          priority: 'high'
        };
        promises.push(push(ref(db, `/notifications/customers/${customerPhone}`), customerNotification));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error sending status update:', error);
    }
  }

  // New method for customer-specific notifications
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

  static subscribeToMerchantNotifications(callback) {
    const notificationsRef = ref(db, '/notifications/merchants');
    onValue(notificationsRef, (snapshot) => {
      const notifications = snapshot.val() || {};
      const notificationsList = Object.entries(notifications)
        .map(([id, notification]) => ({ id, ...notification }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(notificationsList);
    });
    
    return () => off(notificationsRef);
  }

  static subscribeToDriverNotifications(callback) {
    const notificationsRef = ref(db, '/notifications/drivers');
    onValue(notificationsRef, (snapshot) => {
      const notifications = snapshot.val() || {};
      const notificationsList = Object.entries(notifications)
        .map(([id, notification]) => ({ id, ...notification }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(notificationsList);
    });
    
    return () => off(notificationsRef);
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