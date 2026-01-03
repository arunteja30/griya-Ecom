# JavaScript Bridge Documentation for GriyaMart Apps

This document explains how to use the native notification features from your web applications running in the WebView for all three GriyaMart apps: Main App, Seller App, and Delivery App.

## Available JavaScript Interfaces

### Main App (`window.AndroidInterface`)
- Used for customer-facing web application
- URL: https://hungrimart.onrender.com

### Seller App (`window.SellerApp`)
- Used for seller/vendor web application
- URL: https://seller.hungrimart.onrender.com

### Delivery App (`window.DeliveryApp`)
- Used for delivery driver web application
- URL: https://delivery.hungrimart.onrender.com

## Common Methods for All Apps

### 1. Get FCM Token
```javascript
// Get the Firebase Cloud Messaging token
const token = window.SellerApp.getFCMToken(); // For Seller App
const token = window.DeliveryApp.getFCMToken(); // For Delivery App
const token = window.AndroidInterface.getFCMToken(); // For Main App

console.log('FCM Token:', token);
```

### 2. Subscribe/Unsubscribe to Topics
```javascript
// Subscribe to notification topics
window.SellerApp.subscribeToTopic("seller_updates");
window.SellerApp.subscribeToTopic("order_notifications");

// Unsubscribe from topics
window.SellerApp.unsubscribeFromTopic("order_notifications");
```

### 3. Send Token to Server
```javascript
// Send token to your backend server
const userId = "seller123"; // or driverId, customerId
window.SellerApp.sendTokenToServer(token, userId);
```

### 4. Show Toast Messages
```javascript
// Show native toast message
window.SellerApp.showToast("Order accepted successfully!");
```

### 5. Log Messages
```javascript
// Log messages to native console
window.SellerApp.logMessage("User action: Order viewed");
```

## Seller App Specific Methods

### Update Seller Status
```javascript
// Update seller availability status
window.SellerApp.updateSellerStatus("open"); // "open", "closed", "busy"
```

### Set Inventory Alerts
```javascript
// Configure inventory alert settings
window.SellerApp.setInventoryAlerts(true, 10); // enabled=true, threshold=10
```

### Request Camera Permission
```javascript
// Check and request camera permission for product photos
const hasPermission = window.SellerApp.requestCameraPermission();
if (hasPermission) {
    console.log("Camera permission granted");
} else {
    console.log("Camera permission requested");
}
```

### Get Seller Preferences
```javascript
// Get stored seller preferences
const preferences = window.SellerApp.getSellerPreferences();
const data = JSON.parse(preferences);
console.log('Inventory alerts enabled:', data.inventoryAlertsEnabled);
console.log('Inventory threshold:', data.inventoryThreshold);
```

## Delivery App Specific Methods

### Update Driver Status
```javascript
// Update driver availability status
window.DeliveryApp.updateDriverStatus("online"); // "online", "offline", "busy"
```

### Request Location Permission
```javascript
// Check and request location permission for delivery tracking
const hasPermission = window.DeliveryApp.requestLocationPermission();
if (hasPermission) {
    console.log("Location permission granted");
} else {
    console.log("Location permission requested");
}
```

## Notification Initialization

### Auto-initialization
When your web page loads, the native app will automatically inject the FCM token and call the initialization function if it exists:

```javascript
// This function will be called automatically by the native app
function initializeNotifications(token, appType) {
    console.log('Notifications initialized');
    console.log('FCM Token:', token);
    console.log('App Type:', appType); // 'main', 'seller', or 'delivery'
    
    // Send token to your server
    // Subscribe to relevant topics
    // Initialize your notification handling
}
```

### Manual initialization
```javascript
// You can also manually get the token after page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const token = window.SellerApp.getFCMToken();
        if (token) {
            initializeNotifications(token, 'seller');
        }
    }, 1000);
});
```

## Handling Notification Actions

When a user taps on a notification, your web app can handle the action:

```javascript
// This function will be called when user taps notification action buttons
function handleNotificationAction(action, data) {
    console.log('Notification action:', action, data);
    
    switch(action) {
        case 'accept_order':
            // Navigate to order acceptance page
            window.location.hash = '#/orders/' + data + '/accept';
            break;
            
        case 'view_order':
            // Navigate to order details page
            window.location.hash = '#/orders/' + data;
            break;
            
        case 'decline_order':
            // Handle order decline
            declineOrder(data);
            break;
            
        case 'restock_product':
            // Navigate to inventory management
            window.location.hash = '#/inventory/' + encodeURIComponent(data);
            break;
            
        case 'view_reviews':
            // Navigate to reviews page
            window.location.hash = '#/reviews';
            break;
            
        case 'share_location':
            // Share location for delivery
            shareCurrentLocation();
            break;
    }
}
```

## Notification Topics by App

### Main App Topics
- `customer_updates` - General customer notifications
- `order_updates` - Order status changes
- `promotions` - Promotional offers
- `delivery_updates` - Delivery status updates

### Seller App Topics
- `seller_updates` - General seller notifications
- `admin_announcements` - Messages from admin
- `order_notifications` - New orders (when status = "open")
- `payment_notifications` - Payment confirmations
- `inventory_alerts` - Low stock alerts (when enabled)

### Delivery App Topics
- `delivery_updates` - General delivery notifications
- `emergency_alerts` - Emergency messages
- `available_orders` - New delivery orders (when status = "online")

## Example: Complete Seller App Integration

```javascript
class SellerNotificationManager {
    constructor() {
        this.token = null;
        this.sellerId = null;
    }
    
    async initialize(sellerId) {
        this.sellerId = sellerId;
        
        // Get FCM token
        this.token = window.SellerApp.getFCMToken();
        
        if (this.token) {
            // Send token to your server
            await this.registerTokenWithServer();
            
            // Subscribe to default topics
            this.subscribeToDefaultTopics();
            
            // Setup seller preferences
            this.loadSellerPreferences();
        }
    }
    
    async registerTokenWithServer() {
        try {
            const response = await fetch('/api/register-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: this.token,
                    sellerId: this.sellerId,
                    appType: 'seller'
                })
            });
            
            if (response.ok) {
                window.SellerApp.showToast('Notifications enabled');
                window.SellerApp.logMessage('Token registered successfully');
            }
        } catch (error) {
            console.error('Failed to register token:', error);
        }
    }
    
    subscribeToDefaultTopics() {
        window.SellerApp.subscribeToTopic('seller_updates');
        window.SellerApp.subscribeToTopic('admin_announcements');
    }
    
    updateStatus(status) {
        window.SellerApp.updateSellerStatus(status);
        
        // Update UI to reflect status change
        this.updateStatusUI(status);
    }
    
    loadSellerPreferences() {
        const prefs = JSON.parse(window.SellerApp.getSellerPreferences());
        
        // Update UI based on preferences
        document.getElementById('inventory-alerts').checked = prefs.inventoryAlertsEnabled;
        document.getElementById('inventory-threshold').value = prefs.inventoryThreshold;
    }
    
    updateInventorySettings(enabled, threshold) {
        window.SellerApp.setInventoryAlerts(enabled, threshold);
        window.SellerApp.showToast('Inventory settings updated');
    }
}

// Initialize notification manager when page loads
window.initializeNotifications = function(token, appType) {
    if (appType === 'seller') {
        const notificationManager = new SellerNotificationManager();
        notificationManager.initialize(getCurrentSellerId());
    }
};

// Handle notification actions
window.handleNotificationAction = function(action, data) {
    // Handle based on your app's routing system
    router.navigate(`/${action}/${data}`);
};
```

## Testing Notifications

You can test notifications using Firebase Console:
1. Go to Firebase Console → Cloud Messaging
2. Create a new campaign
3. Add the FCM token from your app
4. Send test notifications

## Important Notes

1. **Permissions**: Make sure to request notification permissions on Android 13+
2. **Topics**: Subscribe only to relevant topics to avoid spam
3. **Token Updates**: Handle token refresh in your web app
4. **Error Handling**: Always wrap JavaScript bridge calls in try-catch
5. **Background**: Notifications work even when the app is in background
6. **Deep Linking**: Use notification actions to deep link to specific app sections

## Troubleshooting

### FCM Token is Empty
- Check if Firebase is properly configured
- Ensure internet connection
- Wait a moment after page load before getting token

### JavaScript Interface Not Available
- Check if the correct interface name is used
- Ensure WebView has loaded completely
- Verify JavaScript is enabled in WebView settings

### Notifications Not Received
- Check if notification permissions are granted
- Verify FCM token is sent to server correctly
- Check if subscribed to correct topics
