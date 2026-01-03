/**
 * GriyaMart Notification Helper for Web Apps
 *
 * This file provides helper functions for web applications to interact with
 * the native Android notification system through JavaScript bridges.
 */

class GriyaMartNotifications {
    constructor(appType) {
        this.appType = appType; // 'customer', 'seller', 'delivery'
        this.nativeInterface = this.getNativeInterface();
        this.token = null;
        this.userId = null;

        this.init();
    }

    /**
     * Get the appropriate native interface based on app type
     */
    getNativeInterface() {
        switch (this.appType) {
            case 'customer':
                return window.AndroidInterface;
            case 'seller':
                return window.SellerApp;
            case 'delivery':
                return window.DeliveryApp;
            default:
                console.error('Invalid app type:', this.appType);
                return null;
        }
    }

    /**
     * Initialize notifications
     */
    async init() {
        if (!this.nativeInterface) {
            console.warn('Native interface not available');
            return;
        }

        try {
            // Get FCM token
            this.token = this.nativeInterface.getFCMToken();
            console.log('FCM Token obtained:', this.token);

            // Subscribe to default topics
            await this.subscribeToDefaultTopics();

        } catch (error) {
            console.error('Error initializing notifications:', error);
        }
    }

    /**
     * Subscribe to default topics based on app type
     */
    async subscribeToDefaultTopics() {
        const defaultTopics = this.getDefaultTopics();

        for (const topic of defaultTopics) {
            try {
                this.nativeInterface.subscribeToTopic(topic);
                console.log(`Subscribed to topic: ${topic}`);
            } catch (error) {
                console.error(`Error subscribing to topic ${topic}:`, error);
            }
        }
    }

    /**
     * Get default topics for each app type
     */
    getDefaultTopics() {
        switch (this.appType) {
            case 'customer':
                return ['customer_updates', 'promotions', 'delivery_updates'];
            case 'seller':
                return ['seller_updates', 'admin_announcements'];
            case 'delivery':
                return ['delivery_updates', 'emergency_alerts'];
            default:
                return [];
        }
    }

    /**
     * Register user and subscribe to user-specific topics
     */
    async registerUser(userId, userPhone = null) {
        this.userId = userId;

        try {
            // Send token to server
            if (this.token && userId) {
                this.nativeInterface.sendTokenToServer(this.token, userId);
            }

            // Subscribe to user-specific topics
            if (userPhone) {
                const cleanPhone = userPhone.replace(/[^0-9]/g, '');
                const userTopic = `${this.appType}_${cleanPhone}`;
                this.nativeInterface.subscribeToTopic(userTopic);
                console.log(`Subscribed to user topic: ${userTopic}`);
            }

            // Additional subscriptions based on app type
            await this.subscribeBasedOnUserType(userId);

        } catch (error) {
            console.error('Error registering user:', error);
        }
    }

    /**
     * Subscribe to topics based on user type and status
     */
    async subscribeBasedOnUserType(userId) {
        if (this.appType === 'seller') {
            // Subscribe to order notifications when seller is active
            this.nativeInterface.subscribeToTopic('order_notifications');
            this.nativeInterface.subscribeToTopic('payment_notifications');
        } else if (this.appType === 'delivery') {
            // Subscribe to rider-specific topics
            const riderTopic = `delivery_${userId}`;
            this.nativeInterface.subscribeToTopic(riderTopic);
        }
    }

    /**
     * Update user status (for sellers and delivery drivers)
     */
    async updateStatus(status) {
        try {
            if (this.appType === 'seller') {
                this.nativeInterface.updateSellerStatus(status);

                // Manage topic subscriptions based on status
                if (status === 'open') {
                    this.nativeInterface.subscribeToTopic('order_notifications');
                } else if (status === 'closed') {
                    this.nativeInterface.unsubscribeFromTopic('order_notifications');
                }

            } else if (this.appType === 'delivery') {
                this.nativeInterface.updateDriverStatus(status);

                // Manage topic subscriptions based on status
                if (status === 'online') {
                    this.nativeInterface.subscribeToTopic('available_orders');
                } else if (status === 'offline') {
                    this.nativeInterface.unsubscribeFromTopic('available_orders');
                }
            }

            console.log(`Status updated to: ${status}`);
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    /**
     * Handle incoming notification actions
     */
    handleNotificationAction(action, data) {
        console.log('Notification action received:', action, data);

        switch (action) {
            case 'accept_order':
                this.navigateToOrderAcceptance(data);
                break;

            case 'view_order':
                this.navigateToOrderDetails(data);
                break;

            case 'decline_order':
                this.handleOrderDecline(data);
                break;

            case 'restock_product':
                this.navigateToInventory(data);
                break;

            case 'view_reviews':
                this.navigateToReviews();
                break;

            case 'share_location':
                this.handleLocationSharing();
                break;

            default:
                console.warn('Unknown notification action:', action);
        }
    }

    /**
     * Navigation helpers
     */
    navigateToOrderAcceptance(orderId) {
        // Implement your routing logic
        window.location.hash = `#/orders/${orderId}/accept`;
        this.showToast('Navigating to order acceptance...');
    }

    navigateToOrderDetails(orderId) {
        window.location.hash = `#/orders/${orderId}`;
        this.showToast('Opening order details...');
    }

    navigateToInventory(productName) {
        window.location.hash = `#/inventory?search=${encodeURIComponent(productName)}`;
        this.showToast('Opening inventory management...');
    }

    navigateToReviews() {
        window.location.hash = '#/reviews';
        this.showToast('Opening reviews...');
    }

    /**
     * Action handlers
     */
    async handleOrderDecline(orderId) {
        try {
            // Call your API to decline the order
            const response = await fetch(`/api/orders/${orderId}/decline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                this.showToast('Order declined');
            } else {
                this.showToast('Failed to decline order');
            }
        } catch (error) {
            console.error('Error declining order:', error);
            this.showToast('Error declining order');
        }
    }

    async handleLocationSharing() {
        try {
            if (this.nativeInterface.requestLocationPermission()) {
                // Location permission granted, start sharing
                this.showToast('Sharing location with customer...');
                // Implement your location sharing logic
            } else {
                this.showToast('Location permission required');
            }
        } catch (error) {
            console.error('Error sharing location:', error);
        }
    }

    /**
     * Utility functions
     */
    showToast(message) {
        if (this.nativeInterface && this.nativeInterface.showToast) {
            this.nativeInterface.showToast(message);
        } else {
            console.log('Toast:', message);
        }
    }

    logMessage(message) {
        if (this.nativeInterface && this.nativeInterface.logMessage) {
            this.nativeInterface.logMessage(message);
        }
        console.log('App Log:', message);
    }

    /**
     * Send custom notification (for testing)
     */
    async sendTestNotification(message) {
        try {
            const response = await fetch('/api/notifications/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'test',
                    targetApp: this.appType,
                    message: message,
                    token: this.token
                })
            });

            if (response.ok) {
                this.showToast('Test notification sent');
            } else {
                this.showToast('Failed to send test notification');
            }
        } catch (error) {
            console.error('Error sending test notification:', error);
            this.showToast('Error sending test notification');
        }
    }
}

/**
 * Auto-initialization functions called by native apps
 */
window.initializeNotifications = function(token, appType) {
    console.log('Initializing notifications for', appType, 'with token:', token);

    window.griyaMartNotifications = new GriyaMartNotifications(appType);

    // Store token globally for access
    window.fcmToken = token;
    window.appType = appType;
};

window.handleNotificationAction = function(action, data) {
    console.log('Handling notification action:', action, data);

    if (window.griyaMartNotifications) {
        window.griyaMartNotifications.handleNotificationAction(action, data);
    } else {
        console.warn('Notifications not initialized');
    }
};

/**
 * Example usage for different app types
 */

// Customer App Example
function setupCustomerNotifications(userPhone) {
    const notifications = window.griyaMartNotifications;
    if (notifications && notifications.appType === 'customer') {
        notifications.registerUser(userPhone, userPhone);
    }
}

// Seller App Example
function setupSellerNotifications(sellerId) {
    const notifications = window.griyaMartNotifications;
    if (notifications && notifications.appType === 'seller') {
        notifications.registerUser(sellerId);

        // Enable inventory alerts
        if (window.SellerApp) {
            window.SellerApp.setInventoryAlerts(true, 10);
        }
    }
}

// Delivery App Example
function setupDeliveryNotifications(riderId) {
    const notifications = window.griyaMartNotifications;
    if (notifications && notifications.appType === 'delivery') {
        notifications.registerUser(riderId);
        notifications.updateStatus('online');
    }
}

/**
 * Export for module systems
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GriyaMartNotifications };
}
