# Firebase Database Notification Triggers - Setup Guide

## 🎯 Overview

This implementation automatically triggers push notifications to the respective apps (Customer, Seller, Delivery) whenever updates happen in your Firebase Realtime Database routes.

## 📁 Files Created

### 1. Firebase Cloud Functions
- `functions/index.js` - Main notification trigger functions
- `functions/package.json` - Dependencies and scripts
- `firebase.json` - Firebase project configuration

### 2. Web Integration Helper
- `web-notification-helper.js` - JavaScript library for web apps

### 3. Updated Android Services
- Enhanced Firebase messaging services with automatic topic subscriptions

## 🚀 Setup Instructions

### Step 1: Initialize Firebase Functions

```bash
# Navigate to your project directory
cd /Volumes/Arunteja/work/mobile/griyamart

# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase Functions (if not done before)
firebase init functions

# Install dependencies
cd functions
npm install

# Deploy functions
firebase deploy --only functions
```

### Step 2: Update Firebase Project Configuration

1. **Update `firebase.json`**: Replace `"your-firebase-project-id"` with your actual Firebase project ID.

2. **Service Account**: Ensure your Firebase project has the necessary service account permissions for:
   - Firebase Realtime Database
   - Firebase Cloud Messaging
   - Firebase Functions

### Step 3: Update Database Security Rules

Add these rules to your Firebase Realtime Database rules:

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true,
      "$orderId": {
        "orderStatusHistory": {
          ".validate": "newData.hasChildren(['status', 'ts'])"
        }
      }
    },
    "merchantPushTokens": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "riderLocations": {
      ".read": "auth != null", 
      ".write": "auth != null"
    },
    "products": {
      ".read": true,
      ".write": "auth != null",
      "$productId": {
        "stock": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        }
      }
    }
  }
}
```

## 📱 Database Triggers Implemented

### 1. Order Status Changes
**Trigger**: `/orders/{orderId}/orderStatusHistory/{statusId}`

**Notifications Sent**:
- `ASSIGNED` → Delivery driver + Customer
- `ACCEPTED` → Customer + Merchant  
- `PREPARING` → Customer + Delivery driver
- `READY_FOR_PICKUP` → Delivery driver
- `PICKED_UP` → Customer
- `ON_THE_WAY` → Customer
- `DELIVERED` → Customer + Merchant
- `CANCELLED` → Customer + Merchant

### 2. New Orders
**Trigger**: `/orders/{orderId}` (onCreate)

**Notifications Sent**:
- Merchant (Seller App) - "New order received!"
- Customer (Main App) - "Order placed successfully"

### 3. Rider Location Updates  
**Trigger**: `/riderLocations/{riderId}` (onUpdate)

**Notifications Sent**:
- Customers with active orders - "Your delivery partner is nearby"

### 4. Merchant Status Changes
**Trigger**: `/merchants/{merchantId}/isOnline` (onUpdate)

**Notifications Sent**:
- Specific merchant - "You are now online/offline"

### 5. Inventory Low Stock
**Trigger**: `/products/{productId}/stock` (onUpdate)

**Notifications Sent**:
- All merchants - "{Product name} is running low ({quantity} left)"

## 🎛️ Notification Topics Structure

### Customer App Topics
- `customer_{phoneNumber}` - User-specific notifications
- `customer_updates` - General customer notifications  
- `promotions` - Promotional offers
- `delivery_updates` - Delivery status updates

### Seller App Topics  
- `seller_updates` - General seller notifications
- `admin_announcements` - Messages from admin
- `order_notifications` - New orders (when seller is open)
- `payment_notifications` - Payment confirmations
- `inventory_alerts` - Low stock alerts

### Delivery App Topics
- `delivery_{riderId}` - Driver-specific notifications
- `delivery_updates` - General delivery notifications  
- `emergency_alerts` - Emergency messages
- `available_orders` - New delivery orders (when driver is online)

## 🌐 Web App Integration

### Include the Helper Library
```html
<!-- Add to your web app -->
<script src="/web-notification-helper.js"></script>
```

### Customer App Integration
```javascript
// In your customer web app
document.addEventListener('DOMContentLoaded', function() {
    // This will be called automatically by the native app
    window.initializeNotifications = function(token, appType) {
        console.log('Notifications initialized for customer app');
        
        // Register customer with phone number
        const userPhone = getCurrentUserPhone(); // Your function
        setupCustomerNotifications(userPhone);
    };
    
    // Handle notification actions
    window.handleNotificationAction = function(action, data) {
        switch(action) {
            case 'view_order':
                window.location.href = `/orders/${data}`;
                break;
            // Add more cases as needed
        }
    };
});
```

### Seller App Integration  
```javascript
// In your seller web app
document.addEventListener('DOMContentLoaded', function() {
    window.initializeNotifications = function(token, appType) {
        console.log('Notifications initialized for seller app');
        
        const sellerId = getCurrentSellerId(); // Your function
        setupSellerNotifications(sellerId);
    };
    
    // Update seller status
    function updateSellerStatus(isOpen) {
        const status = isOpen ? 'open' : 'closed';
        window.griyaMartNotifications.updateStatus(status);
    }
});
```

### Delivery App Integration
```javascript
// In your delivery web app  
document.addEventListener('DOMContentLoaded', function() {
    window.initializeNotifications = function(token, appType) {
        console.log('Notifications initialized for delivery app');
        
        const riderId = getCurrentRiderId(); // Your function
        setupDeliveryNotifications(riderId);
    };
    
    // Update driver status
    function updateDriverStatus(isOnline) {
        const status = isOnline ? 'online' : 'offline';
        window.griyaMartNotifications.updateStatus(status);
    }
});
```

## 🧪 Testing Notifications

### 1. Test via Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Create a new campaign
3. Add device tokens or use topics
4. Send test notifications

### 2. Test via Cloud Function
```javascript
// Call the test function
const testFunction = firebase.functions().httpsCallable('sendTestNotification');

testFunction({
    type: 'test',
    targetApp: 'seller', // or 'customer', 'delivery'
    message: 'Test notification message',
    orderId: 'test_order_123'
}).then(result => {
    console.log('Test notification result:', result.data);
});
```

### 3. Test Database Triggers
```javascript
// Simulate order status change
firebase.database().ref('/orders/test_order/orderStatusHistory').push({
    status: 'ASSIGNED',
    ts: Date.now()
});

// Simulate new order
firebase.database().ref('/orders').push({
    id: 'test_order_' + Date.now(),
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    amount: 500,
    status: 'PLACED',
    createdAt: new Date().toISOString()
});
```

## 🔴 Live Order Tracking System

### Overview
The Live Order Tracking System provides real-time foreground notifications and persistent tracking for active orders across all apps. When there are live orders, users receive continuous updates through:

- **Persistent Foreground Notifications**: Always visible notifications with order status
- **In-App Live Updates**: Real-time status updates without page refresh
- **Background Services**: Continuous tracking even when app is minimized
- **Action Buttons**: Quick actions directly from notifications

### Live Tracking Features

#### Customer App (Main App)
- **Order Progress Tracking**: Real-time status updates from order placement to delivery
- **Delivery Partner Location**: Live location tracking when order is on the way
- **Estimated Arrival**: Dynamic ETA updates based on delivery partner location
- **Persistent Notification**: Always-visible notification showing current order status

#### Delivery App
- **Active Delivery Management**: Persistent notification for current delivery
- **Quick Actions**: Accept/Decline, Mark Picked Up, Mark Delivered buttons
- **Order Queue**: Live updates of assigned orders
- **Navigation Integration**: Quick access to maps and delivery actions

#### Seller App
- **Live Order Board**: Real-time updates of all active orders
- **New Order Alerts**: Instant notifications for incoming orders
- **Order Status Monitoring**: Track preparation and pickup status
- **Active Order Counter**: Persistent count of pending orders

### Implementation Files

#### Firebase Cloud Functions
- `functions/live-notifications.js` - Live order tracking functions
- `functions/index.js` - Updated with live notification exports

#### Android Services
- `app/src/main/java/.../LiveOrderTrackingService.kt` - Customer live tracking
- `deliveryapp/src/main/java/.../LiveDeliveryTrackingService.kt` - Delivery live tracking
- `sellerapp/src/main/java/.../LiveSellerTrackingService.kt` - Seller live tracking

#### Web Integration
- `live-order-tracker.js` - JavaScript library for web apps

### Live Tracking Triggers

#### 1. Live Order Updates
**Trigger**: `/orders/{orderId}` (onUpdate)
**Condition**: Order status is in live tracking states
**Live States**: `ASSIGNED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `REACHED_CUSTOMER`

**Notifications Sent**:
- **High Priority**: Immediate foreground notifications to all relevant parties
- **Persistent**: Ongoing notifications until order completion
- **Action Buttons**: Context-specific action buttons in notifications

#### 2. Real-time Location Updates
**Trigger**: `/riderLocations/{riderId}` (onUpdate)
**Condition**: Rider has active live orders

**Updates Sent**:
- **Customer**: Silent location updates for map tracking
- **Live ETA**: Dynamic arrival time calculations
- **Proximity Alerts**: "Delivery partner is nearby" notifications

#### 3. Live Order Collection Management
**Trigger**: `/liveOrderTracking/{orderId}` (auto-managed)
**Purpose**: Centralized collection for active live orders
**Cleanup**: Automatic removal of completed orders

### Web App Integration

#### Include Live Tracker Library
```html
<!-- Add to all web apps -->
<script src="/live-order-tracker.js"></script>
```

#### Customer App Integration
```javascript
// Start live tracking when order is placed
function onOrderPlaced(orderId) {
    if (window.liveTracker) {
        window.liveTracker.startLiveTracking(orderId);
    }
}

// Handle live updates
window.handleLiveOrderUpdate = function(orderData) {
    // Update order progress UI
    updateOrderProgress(orderData.orderId, orderData.status);
    
    // Show status message
    showOrderStatusMessage(orderData);
    
    // Update delivery map if location data
    if (orderData.riderLocation) {
        updateDeliveryMap(orderData.riderLocation);
    }
};
```

#### Seller App Integration
```javascript
// Start live order monitoring
function onSellerOnline() {
    if (window.liveTracker) {
        // Start monitoring all orders
        window.liveTracker.startLiveTracking('seller_mode');
    }
}

// Handle new order notifications
window.handleLiveSellerUpdate = function(sellerData) {
    if (sellerData.updateType === 'NEW_ORDER') {
        // Show new order alert
        showNewOrderAlert(sellerData);
        
        // Play notification sound
        playNotificationSound();
        
        // Update order board
        addOrderToBoard(sellerData);
    }
    
    // Update active order count
    updateActiveOrderCount(sellerData.activeOrderCount);
};
```

#### Delivery App Integration
```javascript
// Start delivery tracking when order accepted
function onOrderAccepted(orderId) {
    if (window.liveTracker) {
        window.liveTracker.startLiveTracking(orderId);
    }
}

// Handle delivery updates
window.handleLiveDeliveryUpdate = function(deliveryData) {
    // Update delivery dashboard
    updateDeliveryDashboard(deliveryData);
    
    // Show quick actions
    showDeliveryActions(deliveryData.status);
    
    // Update navigation
    if (deliveryData.status === 'ACCEPTED') {
        showNavigationToStore(deliveryData.pickupAddress);
    } else if (deliveryData.status === 'PICKED_UP') {
        showNavigationToCustomer(deliveryData.dropAddress);
    }
};
```

### Native Integration Methods

#### Customer App JavaScript Bridge
```javascript
// Available methods
window.AndroidInterface.startLiveOrderTracking(orderId);
window.AndroidInterface.stopLiveOrderTracking(orderId);
window.AndroidInterface.syncLiveUpdates(timestamp);
window.AndroidInterface.sendHeartbeat();
```

#### Delivery App JavaScript Bridge
```javascript
// Available methods
window.DeliveryApp.startLiveOrderTracking(orderId);
window.DeliveryApp.updateDeliveryStatus(orderId, status);
window.DeliveryApp.shareCurrentLocation();
window.DeliveryApp.startNavigation(address);
```

#### Seller App JavaScript Bridge
```javascript
// Available methods
window.SellerApp.startLiveOrderMonitoring();
window.SellerApp.stopLiveOrderMonitoring();
window.SellerApp.markOrderReady(orderId);
window.SellerApp.updatePreparationTime(orderId, minutes);
```

### Testing Live Notifications

#### 1. Test Live Order Updates
```javascript
// Simulate live order progression
const orderId = 'test_live_order_' + Date.now();

// Create order
firebase.database().ref(`/orders/${orderId}`).set({
    id: orderId,
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    status: 'ASSIGNED',
    riderId: 'test_rider_123',
    amount: 500,
    createdAt: new Date().toISOString()
});

// Update status every 30 seconds
const statuses = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
let currentIndex = 0;

setInterval(() => {
    if (currentIndex < statuses.length) {
        firebase.database().ref(`/orders/${orderId}/orderStatusHistory`).push({
            status: statuses[currentIndex],
            ts: Date.now()
        });
        
        firebase.database().ref(`/orders/${orderId}/status`).set(statuses[currentIndex]);
        currentIndex++;
    }
}, 30000);
```

#### 2. Test Rider Location Updates
```javascript
// Simulate rider movement
const riderId = 'test_rider_123';
let lat = 17.4401;
let lng = 78.3489;

setInterval(() => {
    // Simulate movement
    lat += (Math.random() - 0.5) * 0.001;
    lng += (Math.random() - 0.5) * 0.001;
    
    firebase.database().ref(`/riderLocations/${riderId}`).set({
        lat: lat,
        lng: lng,
        ts: Date.now()
    });
}, 10000); // Update every 10 seconds
```

### Live Notification Channels

#### Android Notification Channels
```kotlin
// Live Order Tracking Channel
channelId: "live_orders"
importance: IMPORTANCE_HIGH
sound: enabled
vibration: enabled
lights: enabled
badge: enabled
sticky: true (for ongoing orders)
```

#### Web Notification Classes
```css
.live-notification {
    priority: high;
    persistent: true;
    actions: ['View Order', 'Dismiss'];
    badge: order_icon;
    tag: 'live_order_{orderId}';
}
```

### Performance Considerations

#### Battery Optimization
- **Efficient Updates**: Only send updates for status changes
- **Heartbeat**: Minimal 30-second heartbeat to maintain connection
- **Smart Cleanup**: Automatic cleanup of completed orders
- **Background Limits**: Respect Android background execution limits

#### Network Optimization
- **Delta Updates**: Send only changed data
- **Compression**: Minimize payload size
- **Retry Logic**: Handle network disconnections gracefully
- **Offline Queue**: Queue updates when offline

### Monitoring Live Tracking

#### Firebase Console
- Monitor function execution in Functions logs
- Check database write operations
- Review FCM delivery reports
- Track active connections

#### Android Monitoring
```bash
# Monitor foreground services
adb shell dumpsys activity services LiveOrderTrackingService
adb shell dumpsys activity services LiveDeliveryTrackingService  
adb shell dumpsys activity services LiveSellerTrackingService

# Monitor notifications
adb shell dumpsys notification
```

#### Web Console Monitoring
```javascript
// Check live tracking status
console.log('Live tracking active:', window.liveTracker?.isLiveTrackingActive);
console.log('Active orders:', window.liveTracker?.activeLiveOrders);
console.log('Last update:', new Date(window.liveTracker?.lastUpdate));
```

### Troubleshooting Live Tracking

#### Common Issues

1. **Foreground service not starting**
   - Check manifest permissions
   - Verify notification channel creation
   - Ensure proper service binding

2. **Live updates not received**
   - Verify Firebase database connection
   - Check notification permissions
   - Confirm topic subscriptions

3. **High battery usage**
   - Review update frequency
   - Check for memory leaks
   - Optimize database listeners

4. **Web app not receiving updates**
   - Verify JavaScript bridge connection
   - Check WebView JavaScript enabled
   - Confirm function binding

Your notification system is now ready to automatically trigger push notifications whenever your Firebase database routes are updated! 🎉
