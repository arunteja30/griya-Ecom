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

      // Add to driver broadcast channel (drivers should subscribe to broadcast + their inbox)
      await push(ref(db, '/notifications/drivers/broadcast'), driverNotification);

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
        // Push to driver broadcast channel so drivers subscribed to broadcast receive status updates
        promises.push(push(ref(db, '/notifications/drivers/broadcast'), notification));
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

  // Send notification to a specific driver inbox
  static async sendDriverNotification(driverId, title, message, type = 'order_update', orderId = null, deliveryAddress = null) {
    try {
      if (!driverId) {
        throw new Error('driverId required');
      }
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

  // Subscribe to driver notifications; if driverId provided subscribes to both broadcast and inbox
  static subscribeToDriverNotifications(callback, driverId = null) {
    const broadcastRef = ref(db, '/notifications/drivers/broadcast');
    const inboxRef = driverId ? ref(db, `/notifications/drivers/${driverId}`) : null;

    const handleBoth = async () => {
      const bSnap = (await get(broadcastRef));
      const iSnap = inboxRef ? (await get(inboxRef)) : null;
      const bVal = bSnap.val() || {};
      const iVal = (iSnap && iSnap.val()) || {};
      const combined = [
        ...Object.entries(bVal).map(([id, n]) => ({ id, ...n })),
        ...Object.entries(iVal).map(([id, n]) => ({ id, ...n }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      callback(combined);
    };

    // Initial read
    handleBoth();

    // subscribe to updates
    onValue(broadcastRef, () => handleBoth());
    if (inboxRef) onValue(inboxRef, () => handleBoth());

    return () => {
      off(broadcastRef);
      if (inboxRef) off(inboxRef);
    };
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