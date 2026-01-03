/**
 * Live Order Tracking System for GriyaMart Apps
 *
 * This service manages real-time order updates and foreground notifications
 * across Customer, Seller, and Delivery apps when there are live orders.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const messaging = admin.messaging();

// Live order statuses that trigger real-time tracking
const LIVE_ORDER_STATUSES = [
  'ASSIGNED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP',
  'PICKED_UP', 'ON_THE_WAY', 'REACHED_CUSTOMER'
];

/**
 * Real-time order tracking for live orders
 * Triggers foreground notifications across all relevant apps
 */
exports.onLiveOrderUpdate = functions.database
  .ref('/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const { orderId } = context.params;
    const beforeData = change.before.val();
    const afterData = change.after.val();

    // Check if this is a live order
    if (!LIVE_ORDER_STATUSES.includes(afterData.status)) {
      console.log(`Order ${orderId} is not in live tracking status: ${afterData.status}`);
      return null;
    }

    console.log(`Live order update: ${orderId} - Status: ${afterData.status}`);

    try {
      // Send real-time updates to all relevant apps
      await Promise.all([
        sendLiveUpdateToCustomer(afterData, beforeData),
        sendLiveUpdateToMerchant(afterData, beforeData),
        sendLiveUpdateToDeliveryDriver(afterData, beforeData)
      ]);

      // Update live order tracking collection
      await updateLiveOrderTracking(orderId, afterData);

      return null;
    } catch (error) {
      console.error('Error sending live order update:', error);
      return null;
    }
  });

/**
 * Enhanced order assignment with driver-order relationship tracking
 */
exports.onDriverOrderAssignment = functions.database
  .ref('/orders/{orderId}/riderId')
  .onWrite(async (change, context) => {
    const { orderId } = context.params;
    const newRiderId = change.after.val();
    const previousRiderId = change.before.val();

    console.log(`Driver assignment change for order ${orderId}: ${previousRiderId} -> ${newRiderId}`);

    try {
      // Get order details
      const orderSnapshot = await db.ref(`/orders/${orderId}`).once('value');
      const order = orderSnapshot.val();

      if (!order) {
        console.log('Order not found');
        return null;
      }

      // Handle driver assignment
      if (newRiderId && newRiderId !== previousRiderId) {
        await createDriverOrderRelation(orderId, newRiderId, order);
        await sendDriverAssignmentNotification(orderId, newRiderId, order);
      }

      // Handle driver removal/reassignment
      if (previousRiderId && previousRiderId !== newRiderId) {
        await removeDriverOrderRelation(orderId, previousRiderId);
      }

      return null;
    } catch (error) {
      console.error('Error handling driver assignment:', error);
      return null;
    }
  });

/**
 * Create and manage driver-order relationship data
 */
async function createDriverOrderRelation(orderId, riderId, order) {
  const relationData = {
    orderId: orderId,
    riderId: riderId,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    pickupAddress: order.pickupAddress,
    dropAddress: order.dropAddress,
    amount: order.amount,
    status: order.status,
    assignedAt: Date.now(),
    lastUpdated: Date.now(),
    isActive: true,
    relationId: `${riderId}_${orderId}`,

    // Live tracking data
    liveTracking: {
      isEnabled: false,
      startTime: null,
      lastLocationUpdate: null,
      totalDistance: 0,
      estimatedETA: null
    },

    // Driver performance data
    performance: {
      acceptedAt: null,
      reachedStoreAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      totalDuration: null
    }
  };

  // Store in driver-order relationship collection
  await db.ref(`/driverOrderRelations/${riderId}_${orderId}`).set(relationData);

  // Add to driver's active orders list
  await db.ref(`/drivers/${riderId}/activeOrders/${orderId}`).set({
    orderId: orderId,
    assignedAt: Date.now(),
    status: order.status
  });

  // Add to order's driver tracking
  await db.ref(`/orders/${orderId}/driverRelation`).set({
    riderId: riderId,
    assignedAt: Date.now(),
    relationId: `${riderId}_${orderId}`
  });

  console.log(`Created driver-order relation: ${riderId} -> ${orderId}`);
}

/**
 * Remove driver-order relationship
 */
async function removeDriverOrderRelation(orderId, riderId) {
  const relationId = `${riderId}_${orderId}`;

  // Mark relation as inactive
  await db.ref(`/driverOrderRelations/${relationId}/isActive`).set(false);
  await db.ref(`/driverOrderRelations/${relationId}/deactivatedAt`).set(Date.now());

  // Remove from driver's active orders
  await db.ref(`/drivers/${riderId}/activeOrders/${orderId}`).remove();

  // Update order's driver relation
  await db.ref(`/orders/${orderId}/driverRelation/deactivatedAt`).set(Date.now());

  console.log(`Removed driver-order relation: ${riderId} -> ${orderId}`);
}

/**
 * Send native notification to driver app for new assignment
 */
async function sendDriverAssignmentNotification(orderId, riderId, order) {
  const notification = {
    title: 'New Delivery Assignment',
    body: `Order #${order.id} from ${order.customerName}`,
    icon: 'ic_delivery',
    sound: 'default'
  };

  const data = {
    type: 'new_order',
    order_id: orderId,
    rider_id: riderId,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    pickup_address: order.pickupAddress,
    drop_address: order.dropAddress,
    amount: order.amount?.toString() || '0',
    priority: 'high',
    is_live: 'false',
    relation_id: `${riderId}_${orderId}`,
    action_required: 'accept_or_decline'
  };

  // Send to driver-specific topic
  const topic = `delivery_${riderId}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'delivery_notifications',
        sound: 'default',
        priority: 'high',
        tag: `assignment_${orderId}`,
        actions: [
          {
            title: 'Accept',
            action: 'accept_order'
          },
          {
            title: 'Decline',
            action: 'decline_order'
          }
        ]
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Driver assignment notification sent to ${riderId}: ${response}`);

    // Update relation with notification sent timestamp
    await db.ref(`/driverOrderRelations/${riderId}_${orderId}/notificationSentAt`).set(Date.now());

  } catch (error) {
    console.error(`Error sending assignment notification to ${riderId}:`, error);
  }
}

/**
 * Enhanced live order update with driver relationship tracking
 */
exports.onEnhancedLiveOrderUpdate = functions.database
  .ref('/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const { orderId } = context.params;
    const beforeData = change.before.val();
    const afterData = change.after.val();

    // Check if this is a live order with driver relationship
    if (!LIVE_ORDER_STATUSES.includes(afterData.status) || !afterData.riderId) {
      return null;
    }

    console.log(`Enhanced live order update: ${orderId} - Status: ${afterData.status}`);

    try {
      // Update driver-order relationship
      await updateDriverOrderRelationStatus(orderId, afterData.riderId, afterData.status, afterData);

      // Send enhanced native notifications
      await Promise.all([
        sendEnhancedLiveUpdateToDriver(afterData, beforeData),
        sendLiveUpdateToCustomer(afterData, beforeData),
        sendLiveUpdateToMerchant(afterData, beforeData)
      ]);

      // Handle specific status changes
      await handleSpecificStatusChanges(afterData, beforeData);

      return null;
    } catch (error) {
      console.error('Error sending enhanced live order update:', error);
      return null;
    }
  });

/**
 * Update driver-order relationship status and performance data
 */
async function updateDriverOrderRelationStatus(orderId, riderId, status, orderData) {
  const relationId = `${riderId}_${orderId}`;
  const updateData = {
    status: status,
    lastUpdated: Date.now()
  };

  // Track performance milestones
  const performanceUpdate = {};
  const now = Date.now();

  switch (status) {
    case 'ACCEPTED':
      performanceUpdate['performance/acceptedAt'] = now;
      updateData['liveTracking/isEnabled'] = true;
      updateData['liveTracking/startTime'] = now;
      break;

    case 'REACHED_STORE':
      performanceUpdate['performance/reachedStoreAt'] = now;
      break;

    case 'PICKED_UP':
      performanceUpdate['performance/pickedUpAt'] = now;
      break;

    case 'DELIVERED':
      performanceUpdate['performance/deliveredAt'] = now;
      updateData['liveTracking/isEnabled'] = false;
      updateData['liveTracking/endTime'] = now;
      updateData['isActive'] = false;

      // Calculate total duration
      const assignedAt = (await db.ref(`/driverOrderRelations/${relationId}/assignedAt`).once('value')).val();
      if (assignedAt) {
        performanceUpdate['performance/totalDuration'] = now - assignedAt;
      }
      break;

    case 'CANCELLED':
      updateData['liveTracking/isEnabled'] = false;
      updateData['isActive'] = false;
      updateData['cancelledAt'] = now;
      break;
  }

  // Update driver-order relationship
  await db.ref(`/driverOrderRelations/${relationId}`).update({
    ...updateData,
    ...performanceUpdate
  });

  // Update driver's active orders
  if (status === 'DELIVERED' || status === 'CANCELLED') {
    await db.ref(`/drivers/${riderId}/activeOrders/${orderId}`).remove();
  } else {
    await db.ref(`/drivers/${riderId}/activeOrders/${orderId}/status`).set(status);
  }

  console.log(`Updated driver-order relation status: ${relationId} -> ${status}`);
}

/**
 * Send enhanced native notification to driver
 */
async function sendEnhancedLiveUpdateToDriver(order, previousOrder) {
  const riderId = order.riderId;
  if (!riderId) return;

  const statusMessages = {
    'ACCEPTED': 'Order accepted - Start navigation to pickup',
    'PREPARING': 'Order is being prepared - Head to store',
    'READY_FOR_PICKUP': 'Order ready for pickup',
    'PICKED_UP': 'Order picked up - Navigate to customer',
    'ON_THE_WAY': 'On the way to customer',
    'DELIVERED': 'Delivery completed successfully'
  };

  const notification = {
    title: `Live Update - Order #${order.id}`,
    body: statusMessages[order.status] || 'Order status updated',
    icon: 'ic_delivery',
    sound: 'default'
  };

  const data = {
    type: 'live_delivery_update',
    order_id: order.id,
    rider_id: riderId,
    status: order.status,
    previous_status: previousOrder?.status || '',
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    pickup_address: order.pickupAddress,
    drop_address: order.dropAddress,
    amount: order.amount?.toString() || '0',
    timestamp: Date.now().toString(),
    is_live: 'true',
    priority: 'high',
    relation_id: `${riderId}_${order.id}`,

    // Navigation data
    pickup_lat: order.pickupLocation?.lat?.toString() || '',
    pickup_lng: order.pickupLocation?.lng?.toString() || '',
    drop_lat: order.dropLocation?.lat?.toString() || '',
    drop_lng: order.dropLocation?.lng?.toString() || ''
  };

  const topic = `delivery_${riderId}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'live_delivery_notifications',
        sound: 'default',
        priority: 'high',
        tag: `live_delivery_${order.id}`,
        ongoing: ['ACCEPTED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status),
        autoCancel: false
      }
    }
  };

  // Add action buttons based on status
  addDriverActionButtons(messagePayload, order.status, order.id);

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Enhanced driver notification sent to ${riderId}: ${response}`);

    // Update relation with last notification
    await db.ref(`/driverOrderRelations/${riderId}_${order.id}/lastNotificationAt`).set(Date.now());

  } catch (error) {
    console.error(`Error sending enhanced driver notification to ${riderId}:`, error);
  }
}

/**
 * Add native action buttons to driver notifications
 */
function addDriverActionButtons(messagePayload, status, orderId) {
  const actions = [];

  switch (status) {
    case 'ACCEPTED':
      actions.push({ title: 'Navigate', action: 'navigate_pickup' });
      actions.push({ title: 'Call Customer', action: 'call_customer' });
      break;

    case 'READY_FOR_PICKUP':
      actions.push({ title: 'Picked Up', action: 'mark_picked_up' });
      break;

    case 'PICKED_UP':
      actions.push({ title: 'Navigate', action: 'navigate_customer' });
      actions.push({ title: 'Call Customer', action: 'call_customer' });
      break;

    case 'ON_THE_WAY':
      actions.push({ title: 'Delivered', action: 'mark_delivered' });
      actions.push({ title: 'Share Location', action: 'share_location' });
      break;
  }

  if (actions.length > 0) {
    messagePayload.android.notification.actions = actions;

    // Add action data
    messagePayload.data.available_actions = actions.map(a => a.action).join(',');
  }
}

/**
 * Handle specific status changes with native actions
 */
async function handleSpecificStatusChanges(afterData, beforeData) {
  const orderId = afterData.id;
  const riderId = afterData.riderId;
  const status = afterData.status;

  switch (status) {
    case 'ACCEPTED':
      // Enable live location tracking
      if (riderId) {
        await enableLiveLocationTracking(orderId, riderId);
      }
      break;

    case 'DELIVERED':
    case 'CANCELLED':
      // Disable live location tracking
      if (riderId) {
        await disableLiveLocationTracking(orderId, riderId);
      }
      break;
  }
}

/**
 * Enable live location tracking for driver
 */
async function enableLiveLocationTracking(orderId, riderId) {
  const trackingData = {
    isEnabled: true,
    orderId: orderId,
    riderId: riderId,
    startTime: Date.now(),
    trackingStatus: 'ACTIVE'
  };

  // Set tracking status in driver-order relation
  await db.ref(`/driverOrderRelations/${riderId}_${orderId}/liveTracking`).update(trackingData);

  // Send command to start location tracking
  const commandData = {
    type: 'driver_order_relation',
    action: 'start_tracking',
    order_id: orderId,
    rider_id: riderId,
    timestamp: Date.now().toString()
  };

  const messagePayload = {
    data: commandData,
    topic: `delivery_${riderId}`,
    android: { priority: 'high' }
  };

  try {
    await messaging.send(messagePayload);
    console.log(`Live tracking enabled for driver ${riderId}, order ${orderId}`);
  } catch (error) {
    console.error('Error enabling live tracking:', error);
  }
}

/**
 * Disable live location tracking for driver
 */
async function disableLiveLocationTracking(orderId, riderId) {
  // Update tracking status
  await db.ref(`/driverOrderRelations/${riderId}_${orderId}/liveTracking`).update({
    isEnabled: false,
    endTime: Date.now(),
    trackingStatus: 'COMPLETED'
  });

  // Send command to stop location tracking
  const commandData = {
    type: 'driver_order_relation',
    action: 'stop_tracking',
    order_id: orderId,
    rider_id: riderId,
    timestamp: Date.now().toString()
  };

  const messagePayload = {
    data: commandData,
    topic: `delivery_${riderId}`,
    android: { priority: 'high' }
  };

  try {
    await messaging.send(messagePayload);
    console.log(`Live tracking disabled for driver ${riderId}, order ${orderId}`);
  } catch (error) {
    console.error('Error disabling live tracking:', error);
  }
}

/**
 * Send enhanced location updates with accuracy and speed information
 */
async function sendEnhancedLocationUpdate(order, newLocation, oldLocation) {
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  // Calculate movement speed if previous location exists
  let speed = 0;
  let distance = 0;

  if (oldLocation && oldLocation.lat && oldLocation.lng && oldLocation.timestamp) {
    const timeDiff = (newLocation.timestamp - oldLocation.timestamp) / 1000; // seconds
    if (timeDiff > 0) {
      // Calculate distance using Haversine formula
      distance = calculateDistance(
        oldLocation.lat, oldLocation.lng,
        newLocation.lat, newLocation.lng
      );
      speed = (distance / timeDiff) * 3.6; // km/h
    }
  }

  // Only send update if significant movement or time passed
  if (distance < 10 && (Date.now() - (oldLocation?.timestamp || 0)) < 30000) {
    return; // Skip minor updates
  }

  const notification = {
    title: `Order #${order.id} - Live Tracking`,
    body: speed > 5 ?
      `Your delivery partner is moving at ${Math.round(speed)} km/h` :
      'Your delivery partner location updated',
    icon: 'ic_notification'
  };

  const data = {
    type: 'enhanced_location_update',
    order_id: order.id,
    rider_lat: newLocation.lat?.toString() || '0',
    rider_lng: newLocation.lng?.toString() || '0',
    accuracy: newLocation.accuracy?.toString() || '0',
    speed: speed.toString(),
    bearing: newLocation.bearing?.toString() || '0',
    distance_moved: distance.toString(),
    timestamp: newLocation.timestamp?.toString() || Date.now().toString(),
    tracking_status: newLocation.trackingStatus || 'ACTIVE',
    is_live: 'true',
    silent: speed < 1 ? 'true' : 'false' // Silent for stationary updates
  };

  const topic = `customer_${customerPhone}`;

  const messagePayload = {
    data: data, // Use data-only for silent updates
    topic: topic,
    android: {
      priority: 'high'
    }
  };

  // Add notification for significant movements
  if (speed > 5) {
    messagePayload.notification = notification;
  }

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Enhanced location update sent to customer: ${response}`);
  } catch (error) {
    console.error('Error sending enhanced location update:', error);
  }
}

/**
 * Calculate and update ETA based on current location
 */
async function calculateAndUpdateETA(order, currentLocation) {
  if (!order.dropLocation || !currentLocation.lat || !currentLocation.lng) {
    return;
  }

  const distance = calculateDistance(
    currentLocation.lat, currentLocation.lng,
    order.dropLocation.lat, order.dropLocation.lng
  );

  // Use actual speed if available, otherwise estimate based on order status
  let estimatedSpeed = currentLocation.speed || 0;

  if (estimatedSpeed === 0) {
    // Estimate speed based on order status
    switch (order.status) {
      case 'ACCEPTED':
      case 'PICKED_UP':
        estimatedSpeed = 8.33; // 30 km/h average
        break;
      case 'ON_THE_WAY':
        estimatedSpeed = 11.11; // 40 km/h average
        break;
      default:
        estimatedSpeed = 5.56; // 20 km/h average
    }
  }

  const etaMinutes = Math.ceil(distance / (estimatedSpeed * 60)); // Convert m/s to minutes

  // Update ETA in database
  const etaData = {
    distanceKm: (distance / 1000).toFixed(2),
    estimatedMinutes: etaMinutes,
    calculatedAt: Date.now(),
    currentSpeed: (estimatedSpeed * 3.6).toFixed(1), // km/h
    accuracy: currentLocation.accuracy || 0
  };

  await db.ref(`/orders/${order.id}/liveETA`).set(etaData);

  // Send ETA update to customer if significant change
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (customerPhone && etaMinutes <= 15) {
    await sendETANotification(order, etaData);
  }
}

/**
 * Send ETA notifications to customer
 */
async function sendETANotification(order, etaData) {
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  const notification = {
    title: `Order #${order.id} - ETA Update`,
    body: `Estimated arrival: ${etaData.estimatedMinutes} minutes (${etaData.distanceKm} km away)`,
    icon: 'ic_notification'
  };

  const data = {
    type: 'eta_update',
    order_id: order.id,
    eta_minutes: etaData.estimatedMinutes.toString(),
    distance_km: etaData.distanceKm,
    current_speed: etaData.currentSpeed,
    timestamp: etaData.calculatedAt.toString(),
    is_live: 'true'
  };

  const topic = `customer_${customerPhone}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'live_orders',
        tag: `eta_${order.id}`,
        sound: 'default'
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`ETA notification sent: ${response}`);
  } catch (error) {
    console.error('Error sending ETA notification:', error);
  }
}

/**
 * Send proximity alerts when driver is near pickup or delivery location
 */
async function sendProximityAlerts(order, currentLocation) {
  if (!currentLocation.lat || !currentLocation.lng) return;

  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  // Check distance to pickup location (for ACCEPTED status)
  if (order.status === 'ACCEPTED' && order.pickupLocation) {
    const pickupDistance = calculateDistance(
      currentLocation.lat, currentLocation.lng,
      order.pickupLocation.lat, order.pickupLocation.lng
    );

    if (pickupDistance <= 200 && pickupDistance > 50) { // Within 200m but not too close
      await sendProximityNotification(order, 'pickup', pickupDistance);
    }
  }

  // Check distance to delivery location (for ON_THE_WAY status)
  if (order.status === 'ON_THE_WAY' && order.dropLocation) {
    const deliveryDistance = calculateDistance(
      currentLocation.lat, currentLocation.lng,
      order.dropLocation.lat, order.dropLocation.lng
    );

    if (deliveryDistance <= 500 && deliveryDistance > 100) { // Within 500m but not too close
      await sendProximityNotification(order, 'delivery', deliveryDistance);
    }
  }
}

/**
 * Send proximity notifications
 */
async function sendProximityNotification(order, locationType, distance) {
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  const roundedDistance = Math.round(distance);
  const locationText = locationType === 'pickup' ? 'pickup location' : 'your location';

  const notification = {
    title: `Order #${order.id} - Driver Nearby`,
    body: `Your delivery partner is ${roundedDistance}m from ${locationText}`,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'proximity_alert',
    order_id: order.id,
    location_type: locationType,
    distance: roundedDistance.toString(),
    timestamp: Date.now().toString(),
    is_live: 'true'
  };

  const topic = `customer_${customerPhone}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'live_orders',
        tag: `proximity_${order.id}_${locationType}`,
        sound: 'default',
        priority: 'high'
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Proximity alert sent: ${response}`);
  } catch (error) {
    console.error('Error sending proximity alert:', error);
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Send live foreground notification to customer app
 */
async function sendLiveUpdateToCustomer(order, previousOrder) {
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  const statusMessages = {
    'ASSIGNED': 'Order assigned to delivery partner',
    'ACCEPTED': 'Delivery partner accepted your order',
    'PREPARING': 'Your order is being prepared',
    'READY_FOR_PICKUP': 'Order is ready for pickup',
    'PICKED_UP': 'Your order has been picked up',
    'ON_THE_WAY': 'Your order is on the way',
    'REACHED_CUSTOMER': 'Delivery partner has reached your location'
  };

  const notification = {
    title: `Order #${order.id}`,
    body: statusMessages[order.status] || 'Order status updated',
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'live_order_update',
    order_id: order.id,
    status: order.status,
    previous_status: previousOrder?.status || '',
    customer_name: order.customerName,
    amount: order.amount?.toString() || '0',
    timestamp: Date.now().toString(),
    is_live: 'true',
    priority: 'high'
  };

  // Send to customer-specific topic and general customer updates
  const topics = [
    `customer_${customerPhone}`,
    'live_order_updates'
  ];

  for (const topic of topics) {
    const messagePayload = {
      notification: notification,
      data: data,
      topic: topic,
      android: {
        priority: 'high',
        notification: {
          channelId: 'live_orders',
          sound: 'default',
          priority: 'high',
          tag: `live_order_${order.id}`,
          sticky: true,
          ongoing: order.status === 'ON_THE_WAY'
        }
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            mutableContent: true,
            category: 'LIVE_ORDER'
          }
        }
      }
    };

    try {
      const response = await messaging.send(messagePayload);
      console.log(`Live customer notification sent to ${topic}: ${response}`);
    } catch (error) {
      console.error(`Error sending live customer notification to ${topic}:`, error);
    }
  }
}

/**
 * Send live foreground notification to merchant/seller app
 */
async function sendLiveUpdateToMerchant(order, previousOrder) {
  const statusMessages = {
    'ASSIGNED': `Order #${order.id} assigned to delivery partner`,
    'ACCEPTED': `Order #${order.id} accepted by delivery partner`,
    'PREPARING': `Order #${order.id} is being prepared`,
    'READY_FOR_PICKUP': `Order #${order.id} ready for pickup`,
    'PICKED_UP': `Order #${order.id} picked up by delivery partner`,
    'ON_THE_WAY': `Order #${order.id} is on the way to customer`,
    'REACHED_CUSTOMER': `Order #${order.id} - Delivery partner reached customer`
  };

  const notification = {
    title: 'Live Order Update',
    body: statusMessages[order.status] || 'Order status updated',
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'live_merchant_update',
    order_id: order.id,
    status: order.status,
    previous_status: previousOrder?.status || '',
    customer_name: order.customerName,
    amount: order.amount?.toString() || '0',
    timestamp: Date.now().toString(),
    is_live: 'true',
    priority: 'high'
  };

  // Get merchant tokens
  const merchantTokensSnapshot = await db.ref('/merchantPushTokens').once('value');
  const merchantTokens = merchantTokensSnapshot.val();

  if (!merchantTokens) return;

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
          channelId: 'live_orders',
          sound: 'default',
          priority: 'high',
          tag: `live_merchant_${order.id}`,
          sticky: true
        }
      }
    };

    try {
      const response = await messaging.send(messagePayload);
      console.log(`Live merchant notification sent to ${merchantId}: ${response}`);
    } catch (error) {
      console.error(`Error sending live merchant notification to ${merchantId}:`, error);
    }
  }
}

/**
 * Send live foreground notification to delivery driver app
 */
async function sendLiveUpdateToDeliveryDriver(order, previousOrder) {
  const riderId = order.riderId;
  if (!riderId) return;

  const statusMessages = {
    'ASSIGNED': 'New order assigned to you',
    'ACCEPTED': 'Order accepted - proceed to store',
    'PREPARING': 'Order is being prepared',
    'READY_FOR_PICKUP': 'Order ready - you can pickup now',
    'PICKED_UP': 'Order picked up - deliver to customer',
    'ON_THE_WAY': 'On the way to customer',
    'REACHED_CUSTOMER': 'You have reached customer location'
  };

  const notification = {
    title: `Delivery Update - Order #${order.id}`,
    body: statusMessages[order.status] || 'Order status updated',
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'live_delivery_update',
    order_id: order.id,
    status: order.status,
    previous_status: previousOrder?.status || '',
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    pickup_address: order.pickupAddress,
    drop_address: order.dropAddress,
    amount: order.amount?.toString() || '0',
    timestamp: Date.now().toString(),
    is_live: 'true',
    priority: 'high'
  };

  // Send to rider-specific topic
  const topic = `delivery_${riderId}`;

  const messagePayload = {
    notification: notification,
    data: data,
    topic: topic,
    android: {
      priority: 'high',
      notification: {
        channelId: 'live_orders',
        sound: 'default',
        priority: 'high',
        tag: `live_delivery_${order.id}`,
        sticky: true,
        ongoing: ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'].includes(order.status)
      }
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Live delivery notification sent to ${riderId}: ${response}`);
  } catch (error) {
    console.error(`Error sending live delivery notification to ${riderId}:`, error);
  }
}

/**
 * Send live location updates to customer
 */
async function sendLiveLocationUpdate(order, newLocation, oldLocation) {
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  if (!customerPhone) return;

  // Only send if order is on the way
  if (!['PICKED_UP', 'ON_THE_WAY'].includes(order.status)) return;

  const notification = {
    title: `Order #${order.id} - Live Tracking`,
    body: 'Your delivery partner location updated',
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'live_location_update',
    order_id: order.id,
    rider_lat: newLocation.lat?.toString() || '0',
    rider_lng: newLocation.lng?.toString() || '0',
    timestamp: newLocation.ts?.toString() || Date.now().toString(),
    is_live: 'true',
    silent: 'true' // Don't show popup, just update tracking
  };

  const topic = `customer_${customerPhone}`;

  const messagePayload = {
    data: data, // Only data, no notification for silent update
    topic: topic,
    android: {
      priority: 'high'
    }
  };

  try {
    const response = await messaging.send(messagePayload);
    console.log(`Live location update sent to customer: ${response}`);
  } catch (error) {
    console.error('Error sending live location update:', error);
  }
}

/**
 * Update live order tracking collection
 */
async function updateLiveOrderTracking(orderId, orderData) {
  const liveOrderRef = db.ref(`/liveOrderTracking/${orderId}`);

  const trackingData = {
    orderId: orderId,
    status: orderData.status,
    customerName: orderData.customerName,
    customerPhone: orderData.customerPhone,
    riderId: orderData.riderId,
    amount: orderData.amount,
    lastUpdated: Date.now(),
    isActive: LIVE_ORDER_STATUSES.includes(orderData.status)
  };

  await liveOrderRef.set(trackingData);

  // Remove from live tracking if order is completed
  if (!LIVE_ORDER_STATUSES.includes(orderData.status)) {
    setTimeout(async () => {
      await liveOrderRef.remove();
    }, 60000); // Remove after 1 minute
  }
}

/**
 * Clean up completed live orders
 */
exports.cleanupLiveOrders = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async (context) => {
    console.log('Cleaning up completed live orders');

    try {
      const liveOrdersSnapshot = await db.ref('/liveOrderTracking').once('value');
      const liveOrders = liveOrdersSnapshot.val();

      if (!liveOrders) return null;

      const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago

      for (const [orderId, trackingData] of Object.entries(liveOrders)) {
        if (!trackingData.isActive || trackingData.lastUpdated < cutoffTime) {
          await db.ref(`/liveOrderTracking/${orderId}`).remove();
          console.log(`Cleaned up live tracking for order: ${orderId}`);
        }
      }

      return null;
    } catch (error) {
      console.error('Error cleaning up live orders:', error);
      return null;
    }
  });

/**
 * Send batch live updates for multiple orders
 */
exports.sendBatchLiveUpdates = functions.https.onCall(async (data, context) => {
  const { orderIds, updateType, message } = data;

  if (!orderIds || !Array.isArray(orderIds)) {
    throw new functions.https.HttpsError('invalid-argument', 'orderIds must be an array');
  }

  try {
    const updates = [];

    for (const orderId of orderIds) {
      const orderSnapshot = await db.ref(`/orders/${orderId}`).once('value');
      const order = orderSnapshot.val();

      if (order && LIVE_ORDER_STATUSES.includes(order.status)) {
        updates.push(sendBatchUpdateNotification(order, updateType, message));
      }
    }

    await Promise.all(updates);

    return {
      success: true,
      message: `Batch live updates sent to ${updates.length} orders`
    };
  } catch (error) {
    console.error('Error sending batch live updates:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Helper function for batch notifications
 */
async function sendBatchUpdateNotification(order, updateType, message) {
  const notification = {
    title: `Live Update - Order #${order.id}`,
    body: message,
    icon: 'ic_notification',
    sound: 'default'
  };

  const data = {
    type: 'batch_live_update',
    update_type: updateType,
    order_id: order.id,
    message: message,
    timestamp: Date.now().toString(),
    is_live: 'true'
  };

  // Send to all relevant parties
  const customerPhone = order.customerPhone?.replace(/[^0-9]/g, '');
  const riderId = order.riderId;

  const topics = [];
  if (customerPhone) topics.push(`customer_${customerPhone}`);
  if (riderId) topics.push(`delivery_${riderId}`);
  topics.push('live_order_updates');

  for (const topic of topics) {
    const messagePayload = {
      notification: notification,
      data: data,
      topic: topic,
      android: {
        priority: 'high',
        notification: {
          channelId: 'live_orders',
          sound: 'default',
          priority: 'high'
        }
      }
    };

    try {
      await messaging.send(messagePayload);
    } catch (error) {
      console.error(`Error sending batch notification to ${topic}:`, error);
    }
  }
}
