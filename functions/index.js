/**
 * Firebase Cloud Functions for GriyaMart Notification Triggers
 *
 * This file contains Firebase Cloud Functions that automatically trigger push notifications
 * when specific database routes are updated.
 *
 * Setup Instructions:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Initialize functions: firebase init functions
 * 3. Install dependencies: npm install firebase-functions firebase-admin
 * 4. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const messaging = admin.messaging();

// Import live notification functions
const liveNotifications = require('./live-notifications');

// Export live notification functions
exports.onLiveOrderUpdate = liveNotifications.onLiveOrderUpdate;
exports.onLiveRiderLocationUpdate = liveNotifications.onLiveRiderLocationUpdate;
exports.onEnhancedRiderLocationUpdate = liveNotifications.onEnhancedRiderLocationUpdate;
exports.onEnhancedLiveOrderUpdate = liveNotifications.onEnhancedLiveOrderUpdate;
exports.onDriverOrderAssignment = liveNotifications.onDriverOrderAssignment;
exports.cleanupLiveOrders = liveNotifications.cleanupLiveOrders;
exports.sendBatchLiveUpdates = liveNotifications.sendBatchLiveUpdates;

/**
 * Trigger notifications when order status changes
 */
exports.onOrderStatusChange = functions.database
  .ref('/orders/{orderId}/orderStatusHistory/{statusId}')
  .onCreate(async (snapshot, context) => {
    const { orderId } = context.params;
    const statusData = snapshot.val();

    console.log(`Order ${orderId} status changed to: ${statusData.status}`);

    try {
      // Get order details
      const orderSnapshot = await db.ref(`/orders/${orderId}`).once('value');
      const order = orderSnapshot.val();

      if (!order) {
        console.log('Order not found');
        return null;
      }

      // Send notifications based on status
      switch (statusData.status) {
        case 'ASSIGNED':
          await sendNotificationToDeliveryDriver(order);
          await sendNotificationToCustomer(order, 'Order assigned to delivery partner');
          break;

        case 'ACCEPTED':
          await sendNotificationToCustomer(order, 'Delivery partner accepted your order');
          await sendNotificationToMerchant(order, 'Order accepted by delivery partner');
          break;

        case 'PREPARING':
          await sendNotificationToCustomer(order, 'Your order is being prepared');
          await sendNotificationToDeliveryDriver(order, 'Order is being prepared');
          break;

        case 'READY_FOR_PICKUP':
          await sendNotificationToDeliveryDriver(order, 'Order is ready for pickup');
          break;

        case 'PICKED_UP':
          await sendNotificationToCustomer(order, 'Your order has been picked up');
          break;

        case 'ON_THE_WAY':
          await sendNotificationToCustomer(order, 'Your order is on the way');
          break;

        case 'DELIVERED':
          await sendNotificationToCustomer(order, 'Order delivered successfully');
          await sendNotificationToMerchant(order, 'Order delivered successfully');
          break;

        case 'CANCELLED':
          await sendNotificationToCustomer(order, 'Your order has been cancelled');
          await sendNotificationToMerchant(order, 'Order has been cancelled');
          break;
      }

      return null;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  });

/**
 * Trigger notifications for new orders
 */
exports.onNewOrder = functions.database
  .ref('/orders/{orderId}')
  .onCreate(async (snapshot, context) => {
    const { orderId } = context.params;
    const order = snapshot.val();

    console.log(`New order created: ${orderId}`);

    try {
      // Send notification to merchant
      await sendNotificationToMerchant(order, 'New order received!');

      // Send confirmation to customer
      await sendNotificationToCustomer(order, 'Order placed successfully');

      return null;
    } catch (error) {
      console.error('Error sending new order notification:', error);
      return null;
    }
  });

/**
 * Send notification to customer (Main App)
 */
async function sendNotificationToCustomer(order, message) {
  // Get customer FCM token from users collection
  const customerPhone = order.customerPhone;

  // You'll need to implement a way to map phone numbers to FCM tokens
  // For now, we'll use a topic-based approach
  const topicName = `customer_${customerPhone.replace(/[^0-9]/g, '')}`;

  const notification = {
    title: 'GriyaMart Order Update',
    body: message,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'order_update',
    order_id: order.id,
    status: order.status,
    amount: order.amount?.toString() || '0',
    customer_name: order.customerName,
    click_action: 'FLUTTER_NOTIFICATION_CLICK'
  };

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topicName,
    android: {
      priority: 'high',
      notification: {
        channelId: 'griyamart_notifications',
        sound: 'default',
        priority: 'high'
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Customer notification sent: ${response}`);
  } catch (error) {
    console.error('Error sending customer notification:', error);
  }
}

/**
 * Send notification to delivery driver (Delivery App)
 */
async function sendNotificationToDeliveryDriver(order, message = null) {
  const riderId = order.riderId;

  if (!riderId) {
    console.log('No rider assigned to order');
    return;
  }

  // Get rider FCM token
  const riderSnapshot = await db.ref(`/riders/${riderId}`).once('value');
  const rider = riderSnapshot.val();

  if (!rider) {
    console.log('Rider not found');
    return;
  }

  const defaultMessage = message || `New order assignment #${order.id}`;

  const notification = {
    title: 'Delivery Update',
    body: defaultMessage,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'new_order',
    order_id: order.id,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    pickup_address: order.pickupAddress,
    drop_address: order.dropAddress,
    amount: order.amount?.toString() || '0',
    click_action: 'FLUTTER_NOTIFICATION_CLICK'
  };

  // Use topic-based messaging for now
  const topicName = `delivery_${riderId}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topicName,
    android: {
      priority: 'high',
      notification: {
        channelId: 'delivery_notifications',
        sound: 'default',
        priority: 'high'
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Delivery notification sent: ${response}`);
  } catch (error) {
    console.error('Error sending delivery notification:', error);
  }
}

/**
 * Send notification to merchant (Seller App)
 */
async function sendNotificationToMerchant(order, message) {
  // Get merchant FCM token
  const merchantTokensSnapshot = await db.ref('/merchantPushTokens').once('value');
  const merchantTokens = merchantTokensSnapshot.val();

  if (!merchantTokens) {
    console.log('No merchant tokens found');
    return;
  }

  const notification = {
    title: 'Seller Update',
    body: message,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'new_order',
    order_id: order.id,
    customer_name: order.customerName,
    amount: order.amount?.toString() || '0',
    status: order.status,
    click_action: 'FLUTTER_NOTIFICATION_CLICK'
  };

  // Send to all merchants (you can filter by specific merchant if needed)
  for (const [merchantId, tokenData] of Object.entries(merchantTokens)) {
    const token = typeof tokenData === 'string' ? tokenData : tokenData.token;

    if (!token) continue;

    const messagePayload = {
      notification: notification,
      data: data,
      token: token,
      android: {
        priority: 'high',
        notification: {
          channelId: 'seller_notifications',
          sound: 'default',
          priority: 'high'
        }
      }
    };

    try {
      const response = await messaging.send(messagePayload);
      console.log(`Merchant notification sent to ${merchantId}: ${response}`);
    } catch (error) {
      console.error(`Error sending merchant notification to ${merchantId}:`, error);
    }
  }
}

/**
 * Trigger notifications when rider location updates
 */
exports.onRiderLocationUpdate = functions.database
  .ref('/riderLocations/{riderId}')
  .onUpdate(async (change, context) => {
    const { riderId } = context.params;
    const newLocation = change.after.val();

    console.log(`Rider ${riderId} location updated:`, newLocation);

    try {
      // Find active orders for this rider
      const ordersSnapshot = await db.ref('/orders')
        .orderByChild('riderId')
        .equalTo(riderId)
        .once('value');

      const orders = ordersSnapshot.val();

      if (!orders) {
        console.log('No active orders for this rider');
        return null;
      }

      // Send location update to customers with active orders
      for (const [orderId, order] of Object.entries(orders)) {
        if (order.status === 'ON_THE_WAY' || order.status === 'PICKED_UP') {
          await sendNotificationToCustomer(order, 'Your delivery partner is nearby');
        }
      }

      return null;
    } catch (error) {
      console.error('Error sending location update notification:', error);
      return null;
    }
  });

/**
 * Trigger notifications when merchant comes online/offline
 */
exports.onMerchantStatusChange = functions.database
  .ref('/merchants/{merchantId}/isOnline')
  .onUpdate(async (change, context) => {
    const { merchantId } = context.params;
    const isOnline = change.after.val();

    console.log(`Merchant ${merchantId} is now ${isOnline ? 'online' : 'offline'}`);

    try {
      const message = isOnline ?
        'You are now online and can receive orders' :
        'You are now offline';

      // Send notification to specific merchant
      const merchantTokensSnapshot = await db.ref(`/merchantPushTokens/${merchantId}`).once('value');
      const tokenData = merchantTokensSnapshot.val();

      if (!tokenData) {
        console.log('No token found for merchant');
        return null;
      }

      const token = typeof tokenData === 'string' ? tokenData : tokenData.token;

      const notification = {
        title: 'Status Update',
        body: message,
        icon: 'ic_notification',
        sound: 'default'
      };

      const data = {
        type: 'status_update',
        status: isOnline ? 'online' : 'offline',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      };

      const messagePayload = {
        notification: notification,
        data: data,
        token: token,
        android: {
          priority: 'normal',
          notification: {
            channelId: 'seller_notifications',
            sound: 'default'
          }
        }
      };

      const response = await messaging.send(messagePayload);
      console.log(`Merchant status notification sent: ${response}`);

      return null;
    } catch (error) {
      console.error('Error sending merchant status notification:', error);
      return null;
    }
  });

/**
 * Trigger notifications for inventory alerts
 */
exports.onInventoryLowStock = functions.database
  .ref('/products/{productId}/stock')
  .onUpdate(async (change, context) => {
    const { productId } = context.params;
    const newStock = change.after.val();
    const oldStock = change.before.val();

    // Only trigger if stock went below threshold
    const threshold = 10; // You can make this configurable

    if (oldStock > threshold && newStock <= threshold) {
      console.log(`Product ${productId} stock is low: ${newStock}`);

      try {
        // Get product details
        const productSnapshot = await db.ref(`/products/${productId}`).once('value');
        const product = productSnapshot.val();

        if (!product) {
          console.log('Product not found');
          return null;
        }

        const message = `${product.name} is running low (${newStock} left)`;

        // Get all merchant tokens
        const merchantTokensSnapshot = await db.ref('/merchantPushTokens').once('value');
        const merchantTokens = merchantTokensSnapshot.val();

        if (!merchantTokens) {
          console.log('No merchant tokens found');
          return null;
        }

        const notification = {
          title: 'Inventory Alert',
          body: message,
          icon: 'ic_notification',
          sound: 'default'
        };

        const data = {
          type: 'inventory_alert',
          product_id: productId,
          product_name: product.name,
          quantity: newStock.toString(),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        };

        // Send to all merchants
        for (const [merchantId, tokenData] of Object.entries(merchantTokens)) {
          const token = typeof tokenData === 'string' ? tokenData : tokenData.token;

          if (!token) continue;

          const messagePayload = {
            notification: notification,
            data: data,
            token: token,
            android: {
              priority: 'high',
              notification: {
                channelId: 'seller_notifications',
                sound: 'default',
                priority: 'high'
              }
            }
          };

          try {
            const response = await messaging.send(messagePayload);
            console.log(`Inventory alert sent to ${merchantId}: ${response}`);
          } catch (error) {
            console.error(`Error sending inventory alert to ${merchantId}:`, error);
          }
        }

        return null;
      } catch (error) {
        console.error('Error sending inventory alert:', error);
        return null;
      }
    }

    return null;
  });

/**
 * Test function to manually send notifications
 */
exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  const { type, targetApp, message, orderId } = data;

  console.log(`Test notification: ${type} to ${targetApp}`);

  try {
    switch (targetApp) {
      case 'customer':
        // Send test notification to customer topic
        await sendTestNotificationToTopic('customer_test', message, 'order_update');
        break;

      case 'delivery':
        // Send test notification to delivery topic
        await sendTestNotificationToTopic('delivery_test', message, 'new_order');
        break;

      case 'seller':
        // Send test notification to seller topic
        await sendTestNotificationToTopic('seller_test', message, 'new_order');
        break;

      default:
        throw new Error('Invalid target app');
    }

    return { success: true, message: 'Test notification sent' };
  } catch (error) {
    console.error('Error sending test notification:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Helper function to send test notifications
 */
async function sendTestNotificationToTopic(topic, message, type) {
  const notification = {
    title: 'Test Notification',
    body: message,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: type,
    test: 'true',
    click_action: 'FLUTTER_NOTIFICATION_CLICK'
  };

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        priority: 'high'
      }
    }
  };

  const response = await messaging.send(messagePayload);
  console.log(`Test notification sent to topic ${topic}: ${response}`);
}
