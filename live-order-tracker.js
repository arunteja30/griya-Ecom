d/**
 * Live Order Tracking JavaScript Integration
 *
 * Handles real-time order updates and foreground notifications
 * across all GriyaMart web applications
 */

class LiveOrderTracker {
    constructor(appType) {
        this.appType = appType; // 'customer', 'seller', 'delivery'
        this.nativeInterface = this.getNativeInterface();
        this.activeLiveOrders = new Map();
        this.isLiveTrackingActive = false;
        this.notificationQueue = [];
        this.lastUpdate = Date.now();

        this.init();
    }

    getNativeInterface() {
        switch (this.appType) {
            case 'customer':
                return window.AndroidInterface;
            case 'seller':
                return window.SellerApp;
            case 'delivery':
                return window.DeliveryApp;
            default:
                return null;
        }
    }

    init() {
        this.setupEventListeners();
        this.createLiveNotificationArea();
        this.startHeartbeat();
    }

    /**
     * Start live tracking for an order
     */
    startLiveTracking(orderId) {
        console.log(`Starting live tracking for order: ${orderId}`);

        this.isLiveTrackingActive = true;
        this.activeLiveOrders.set(orderId, {
            id: orderId,
            startTime: Date.now(),
            lastUpdate: Date.now()
        });

        // Start foreground service in native app
        if (this.nativeInterface) {
            this.nativeInterface.startLiveOrderTracking(orderId);
        }

        this.updateLiveTrackingUI();
        this.showLiveTrackingNotification(orderId);
    }

    /**
     * Stop live tracking for an order
     */
    stopLiveTracking(orderId) {
        console.log(`Stopping live tracking for order: ${orderId}`);

        this.activeLiveOrders.delete(orderId);

        if (this.activeLiveOrders.size === 0) {
            this.isLiveTrackingActive = false;

            // Stop foreground service
            if (this.nativeInterface) {
                this.nativeInterface.stopLiveOrderTracking();
            }
        }

        this.updateLiveTrackingUI();
        this.hideLiveTrackingNotification(orderId);
    }

    /**
     * Handle live order updates from native app
     */
    handleLiveOrderUpdate(orderData) {
        console.log('Live order update received:', orderData);

        const orderId = orderData.orderId;
        this.lastUpdate = Date.now();

        // Update active orders
        if (this.activeLiveOrders.has(orderId)) {
            const order = this.activeLiveOrders.get(orderId);
            order.lastUpdate = Date.now();
            order.status = orderData.status;
            order.customerName = orderData.customerName;
        }

        // Show live notification
        this.showInAppLiveNotification(orderData);

        // Update UI based on app type
        this.updateAppSpecificUI(orderData);

        // Check if tracking should stop
        if (this.shouldStopTracking(orderData.status)) {
            this.stopLiveTracking(orderId);
        }
    }

    /**
     * Handle enhanced live location updates from rider with speed, ETA, and proximity
     */
    handleEnhancedLocationUpdate(locationData) {
        console.log('Enhanced location update received:', locationData);

        // Update delivery map with enhanced data
        if (this.appType === 'customer') {
            this.updateEnhancedDeliveryMap(locationData);
            this.updateETADisplay(locationData);

            // Handle proximity alerts
            if (locationData.type === 'proximity_alert') {
                this.showProximityAlert(locationData);
            }
        }

        // Update delivery dashboard for drivers
        if (this.appType === 'delivery') {
            this.updateDeliveryTracking(locationData);
        }

        // Show speed and accuracy information
        this.updateLocationStatusIndicator(locationData);
    }

    /**
     * Handle ETA updates
     */
    handleETAUpdate(etaData) {
        console.log('ETA update received:', etaData);

        if (this.appType === 'customer') {
            this.updateETADisplay(etaData);
            this.showETANotification(etaData);
        }
    }

    /**
     * Update enhanced delivery map with speed and direction
     */
    updateEnhancedDeliveryMap(locationData) {
        // Update map marker with new position
        const mapElement = document.getElementById('delivery-map');
        if (!mapElement) return;

        // Create or update rider marker
        const riderMarker = this.updateRiderMarker(locationData);

        // Update speed indicator
        this.updateSpeedIndicator(locationData.speed, locationData.accuracy);

        // Update direction arrow if bearing is available
        if (locationData.bearing && locationData.bearing !== '0') {
            this.updateDirectionArrow(locationData.bearing);
        }

        // Draw path trail
        this.addLocationToPath(locationData);

        // Center map on rider if moving fast
        if (parseFloat(locationData.speed) > 10) { // 10 km/h
            this.centerMapOnRider(locationData);
        }
    }

    updateRiderMarker(locationData) {
        const lat = parseFloat(locationData.rider_lat);
        const lng = parseFloat(locationData.rider_lng);
        const speed = parseFloat(locationData.speed) || 0;
        const accuracy = parseFloat(locationData.accuracy) || 0;

        // Update marker position
        const marker = document.getElementById('rider-marker');
        if (marker) {
            marker.style.transform = `translate(${lng}, ${lat})`;
            marker.setAttribute('data-speed', speed.toFixed(1));
            marker.setAttribute('data-accuracy', accuracy.toFixed(0));

            // Change marker color based on speed
            if (speed > 20) {
                marker.className = 'rider-marker fast';
            } else if (speed > 5) {
                marker.className = 'rider-marker moving';
            } else {
                marker.className = 'rider-marker stationary';
            }
        }

        return marker;
    }

    updateSpeedIndicator(speed, accuracy) {
        const speedElement = document.getElementById('rider-speed');
        if (speedElement) {
            const speedKmh = parseFloat(speed) || 0;
            speedElement.textContent = `${speedKmh.toFixed(1)} km/h`;

            // Update accuracy indicator
            const accuracyElement = document.getElementById('location-accuracy');
            if (accuracyElement) {
                const accuracyM = parseFloat(accuracy) || 0;
                accuracyElement.textContent = `±${accuracyM.toFixed(0)}m`;

                // Color code accuracy
                if (accuracyM < 10) {
                    accuracyElement.className = 'accuracy high';
                } else if (accuracyM < 50) {
                    accuracyElement.className = 'accuracy medium';
                } else {
                    accuracyElement.className = 'accuracy low';
                }
            }
        }
    }

    updateETADisplay(etaData) {
        const etaElement = document.getElementById('delivery-eta');
        if (etaElement && etaData.eta_minutes) {
            const minutes = parseInt(etaData.eta_minutes);
            const distance = parseFloat(etaData.distance_km) || 0;

            etaElement.innerHTML = `
                <div class="eta-time">${minutes} min</div>
                <div class="eta-distance">${distance.toFixed(1)} km away</div>
                <div class="eta-speed">Moving at ${etaData.current_speed || 0} km/h</div>
            `;

            // Color code based on time
            if (minutes <= 5) {
                etaElement.className = 'eta-display arriving-soon';
            } else if (minutes <= 15) {
                etaElement.className = 'eta-display nearby';
            } else {
                etaElement.className = 'eta-display distant';
            }

            // Update page title with ETA
            document.title = `${minutes} min - Order Tracking`;
        }
    }

    showProximityAlert(alertData) {
        const distance = parseInt(alertData.distance);
        const locationType = alertData.location_type;

        let message = '';
        if (locationType === 'pickup') {
            message = `Driver is ${distance}m from pickup location`;
        } else {
            message = `Driver is ${distance}m away from you!`;
        }

        // Show prominent proximity notification
        this.showInAppLiveNotification({
            orderId: alertData.order_id,
            status: 'PROXIMITY',
            message: message
        });

        // Vibrate if supported and close
        if ('vibrate' in navigator && distance <= 100) {
            navigator.vibrate([200, 100, 200]);
        }

        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
            new Notification('Driver Nearby!', {
                body: message,
                icon: '/icon-192.png',
                tag: `proximity_${alertData.order_id}`
            });
        }
    }

    showETANotification(etaData) {
        const minutes = parseInt(etaData.eta_minutes);

        // Only show notification for significant ETA changes or when close
        if (minutes <= 10 || minutes % 5 === 0) {
            const notification = {
                orderId: etaData.order_id,
                status: 'ETA_UPDATE',
                message: `Estimated arrival: ${minutes} minutes`
            };

            this.showInAppLiveNotification(notification);
        }
    }

    addLocationToPath(locationData) {
        // Store location in path array for trail visualization
        if (!this.locationPath) {
            this.locationPath = [];
        }

        this.locationPath.push({
            lat: parseFloat(locationData.rider_lat),
            lng: parseFloat(locationData.rider_lng),
            timestamp: parseInt(locationData.timestamp),
            speed: parseFloat(locationData.speed) || 0
        });

        // Keep only last 50 points to avoid memory issues
        if (this.locationPath.length > 50) {
            this.locationPath.shift();
        }

        // Update path visualization
        this.updatePathVisualization();
    }

    updatePathVisualization() {
        const pathElement = document.getElementById('delivery-path');
        if (!pathElement || !this.locationPath.length) return;

        // Create SVG path from location points
        let pathData = '';
        this.locationPath.forEach((point, index) => {
            const command = index === 0 ? 'M' : 'L';
            pathData += `${command} ${point.lng} ${point.lat} `;
        });

        pathElement.setAttribute('d', pathData);

        // Color code path based on speed
        const avgSpeed = this.locationPath.reduce((sum, point) => sum + point.speed, 0) / this.locationPath.length;
        if (avgSpeed > 20) {
            pathElement.setAttribute('class', 'delivery-path fast');
        } else if (avgSpeed > 5) {
            pathElement.setAttribute('class', 'delivery-path moving');
        } else {
            pathElement.setAttribute('class', 'delivery-path slow');
        }
    }

    updateLocationStatusIndicator(locationData) {
        const statusElement = document.getElementById('location-status');
        if (!statusElement) return;

        const trackingStatus = locationData.tracking_status;
        const accuracy = parseFloat(locationData.accuracy) || 0;
        const speed = parseFloat(locationData.speed) || 0;

        let statusText = '';
        let statusClass = '';

        switch (trackingStatus) {
            case 'ACTIVE':
                if (speed > 1) {
                    statusText = `📍 Live tracking • ${speed.toFixed(1)} km/h`;
                    statusClass = 'status-active moving';
                } else {
                    statusText = `📍 Live tracking • Stationary`;
                    statusClass = 'status-active stationary';
                }
                break;
            case 'GPS_UNAVAILABLE':
                statusText = '🔴 GPS signal lost';
                statusClass = 'status-error';
                break;
            default:
                statusText = '📍 Location tracking active';
                statusClass = 'status-active';
        }

        statusElement.textContent = statusText;
        statusElement.className = `location-status ${statusClass}`;

        // Add accuracy indicator
        if (accuracy > 0) {
            const accuracySpan = document.createElement('span');
            accuracySpan.className = 'accuracy-indicator';
            accuracySpan.textContent = ` (±${accuracy.toFixed(0)}m)`;
            statusElement.appendChild(accuracySpan);
        }
    }

    /**
     * Handle live updates for delivery drivers with native implementation
     */
    handleLiveDeliveryUpdate(deliveryData) {
        console.log('Live delivery update received:', deliveryData);

        if (this.appType === 'delivery') {
            // Update driver dashboard with native data
            this.updateEnhancedDeliveryDashboard(deliveryData);

            // Show native action buttons
            this.showNativeDeliveryActions(deliveryData);

            // Update driver-order relationship display
            this.updateDriverOrderRelation(deliveryData);

            // Handle live tracking status
            this.updateLiveTrackingStatus(deliveryData);
        }
    }

    /**
     * Update enhanced delivery dashboard with native integration
     */
    updateEnhancedDeliveryDashboard(deliveryData) {
        // Update current delivery order display
        const currentOrder = document.getElementById('current-delivery-order');
        if (currentOrder && currentOrder.dataset.orderId === deliveryData.orderId) {
            // Update order status
            const statusElement = currentOrder.querySelector('.delivery-status');
            if (statusElement) {
                statusElement.textContent = this.getStatusMessage(deliveryData.status, 'delivery');
                statusElement.className = `delivery-status status-${deliveryData.status.toLowerCase()}`;
            }

            // Update customer info
            const customerElement = currentOrder.querySelector('.customer-info');
            if (customerElement) {
                customerElement.innerHTML = `
                    <div class="customer-name">${deliveryData.customerName}</div>
                    <div class="customer-phone">${deliveryData.customerPhone}</div>
                `;
            }

            // Update addresses with navigation buttons
            const addressElement = currentOrder.querySelector('.delivery-addresses');
            if (addressElement) {
                addressElement.innerHTML = `
                    <div class="pickup-address">
                        <strong>Pickup:</strong> ${deliveryData.pickupAddress}
                        ${deliveryData.pickup_lat ? `<button onclick="liveTracker.navigateToLocation(${deliveryData.pickup_lat}, ${deliveryData.pickup_lng})" class="nav-btn">Navigate</button>` : ''}
                    </div>
                    <div class="drop-address">
                        <strong>Delivery:</strong> ${deliveryData.dropAddress}
                        ${deliveryData.drop_lat ? `<button onclick="liveTracker.navigateToLocation(${deliveryData.drop_lat}, ${deliveryData.drop_lng})" class="nav-btn">Navigate</button>` : ''}
                    </div>
                `;
            }

            // Update amount
            const amountElement = currentOrder.querySelector('.order-amount');
            if (amountElement) {
                amountElement.textContent = `₹${deliveryData.amount}`;
            }
        }

        // Update progress indicator
        this.updateDeliveryProgress(deliveryData.status);
    }

    /**
     * Show native action buttons based on delivery status
     */
    showNativeDeliveryActions(deliveryData) {
        const actionsContainer = document.getElementById('delivery-actions');
        if (!actionsContainer) return;

        const status = deliveryData.status;
        const orderId = deliveryData.orderId;

        let actionButtons = '';

        switch (status) {
            case 'ASSIGNED':
                actionButtons = `
                    <button onclick="liveTracker.acceptOrder('${orderId}')" class="action-btn accept-btn">Accept Order</button>
                    <button onclick="liveTracker.declineOrder('${orderId}')" class="action-btn decline-btn">Decline Order</button>
                `;
                break;

            case 'ACCEPTED':
                actionButtons = `
                    <button onclick="liveTracker.navigateToPickup('${orderId}')" class="action-btn navigate-btn">Navigate to Pickup</button>
                    <button onclick="liveTracker.callCustomer('${deliveryData.customerPhone}')" class="action-btn call-btn">Call Customer</button>
                    <button onclick="liveTracker.markReachedStore('${orderId}')" class="action-btn status-btn">Reached Store</button>
                `;
                break;

            case 'PREPARING':
                actionButtons = `
                    <button onclick="liveTracker.checkOrderStatus('${orderId}')" class="action-btn status-btn">Check Order Status</button>
                `;
                break;

            case 'READY_FOR_PICKUP':
                actionButtons = `
                    <button onclick="liveTracker.markPickedUp('${orderId}')" class="action-btn pickup-btn">Mark Picked Up</button>
                `;
                break;

            case 'PICKED_UP':
                actionButtons = `
                    <button onclick="liveTracker.navigateToCustomer('${orderId}')" class="action-btn navigate-btn">Navigate to Customer</button>
                    <button onclick="liveTracker.callCustomer('${deliveryData.customerPhone}')" class="action-btn call-btn">Call Customer</button>
                    <button onclick="liveTracker.shareLocation('${orderId}')" class="action-btn location-btn">Share Location</button>
                `;
                break;

            case 'ON_THE_WAY':
                actionButtons = `
                    <button onclick="liveTracker.markDelivered('${orderId}')" class="action-btn delivered-btn">Mark Delivered</button>
                    <button onclick="liveTracker.callCustomer('${deliveryData.customerPhone}')" class="action-btn call-btn">Call Customer</button>
                    <button onclick="liveTracker.shareLocation('${orderId}')" class="action-btn location-btn">Share Location</button>
                `;
                break;

            case 'DELIVERED':
                actionButtons = `
                    <div class="completion-message">✅ Order delivered successfully!</div>
                `;
                break;
        }

        actionsContainer.innerHTML = actionButtons;
    }

    /**
     * Update driver-order relationship display
     */
    updateDriverOrderRelation(deliveryData) {
        const relationElement = document.getElementById('driver-order-relation');
        if (!relationElement) return;

        const relationData = {
            orderId: deliveryData.orderId,
            riderId: deliveryData.riderId || 'current_driver',
            status: deliveryData.status,
            relationId: deliveryData.relation_id,
            isLive: deliveryData.is_live === 'true'
        };

        relationElement.innerHTML = `
            <div class="relation-info">
                <div class="relation-id">Relation: ${relationData.relationId}</div>
                <div class="relation-status ${relationData.isLive ? 'live' : 'static'}">
                    ${relationData.isLive ? '🔴 Live' : '⚪ Static'}
                </div>
            </div>
            <div class="order-tracking">
                <div class="order-id">Order: ${relationData.orderId}</div>
                <div class="driver-id">Driver: ${relationData.riderId}</div>
                <div class="current-status">${relationData.status}</div>
            </div>
        `;
    }

    /**
     * Update live tracking status for drivers
     */
    updateLiveTrackingStatus(deliveryData) {
        const trackingElement = document.getElementById('live-tracking-driver-status');
        if (!trackingElement) return;

        const isLive = deliveryData.is_live === 'true';
        const status = deliveryData.status;

        let trackingMessage = '';
        let trackingClass = '';

        if (isLive && ['ACCEPTED', 'PICKED_UP', 'ON_THE_WAY'].includes(status)) {
            trackingMessage = '📍 Live location sharing active';
            trackingClass = 'tracking-active';
        } else if (status === 'DELIVERED') {
            trackingMessage = '✅ Location sharing completed';
            trackingClass = 'tracking-completed';
        } else {
            trackingMessage = '⚪ Location sharing inactive';
            trackingClass = 'tracking-inactive';
        }

        trackingElement.innerHTML = `
            <div class="tracking-status ${trackingClass}">
                ${trackingMessage}
            </div>
        `;
    }

    /**
     * Native delivery action methods
     */
    acceptOrder(orderId) {
        if (this.nativeInterface && this.nativeInterface.acceptOrder) {
            this.nativeInterface.acceptOrder(orderId);
        }
        this.showToast('Order accepted - Live tracking starting...');
    }

    declineOrder(orderId) {
        if (this.nativeInterface && this.nativeInterface.declineOrder) {
            this.nativeInterface.declineOrder(orderId);
        }
        this.showToast('Order declined');
    }

    navigateToPickup(orderId) {
        if (this.nativeInterface && this.nativeInterface.navigateToPickup) {
            this.nativeInterface.navigateToPickup(orderId);
        } else {
            // Fallback to web navigation
            this.openMapsNavigation('pickup');
        }
    }

    navigateToCustomer(orderId) {
        if (this.nativeInterface && this.nativeInterface.navigateToCustomer) {
            this.nativeInterface.navigateToCustomer(orderId);
        } else {
            // Fallback to web navigation
            this.openMapsNavigation('customer');
        }
    }

    navigateToLocation(lat, lng) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
    }

    callCustomer(phoneNumber) {
        if (this.nativeInterface && this.nativeInterface.callCustomer) {
            this.nativeInterface.callCustomer(phoneNumber);
        } else {
            window.location.href = `tel:${phoneNumber}`;
        }
    }

    shareLocation(orderId) {
        if (this.nativeInterface && this.nativeInterface.shareCurrentLocation) {
            this.nativeInterface.shareCurrentLocation(orderId);
        }
        this.showToast('Sharing current location with customer...');
    }

    markReachedStore(orderId) {
        this.updateOrderStatus(orderId, 'REACHED_STORE');
    }

    markPickedUp(orderId) {
        this.updateOrderStatus(orderId, 'PICKED_UP');
    }

    markDelivered(orderId) {
        this.updateOrderStatus(orderId, 'DELIVERED');
    }

    updateOrderStatus(orderId, newStatus) {
        if (this.nativeInterface && this.nativeInterface.updateOrderStatus) {
            this.nativeInterface.updateOrderStatus(orderId, newStatus);
        }

        this.showToast(`Order status updated to ${newStatus}`);

        // Auto-handle live tracking
        if (newStatus === 'DELIVERED' || newStatus === 'CANCELLED') {
            if (this.nativeInterface && this.nativeInterface.stopLiveLocationTracking) {
                this.nativeInterface.stopLiveLocationTracking();
            }
        }
    }

    showToast(message) {
        if (this.nativeInterface && this.nativeInterface.showToast) {
            this.nativeInterface.showToast(message);
        } else {
            // Fallback web toast
            console.log('Toast:', message);

            // Create simple web toast
            const toast = document.createElement('div');
            toast.className = 'web-toast';
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s;
            `;

            document.body.appendChild(toast);

            setTimeout(() => toast.style.opacity = '1', 100);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => document.body.removeChild(toast), 300);
            }, 3000);
        }
    }

    /**
     * Handle live updates for sellers
     */
    handleLiveSellerUpdate(sellerData) {
        console.log('Live seller update received:', sellerData);

        if (this.appType === 'seller') {
            this.updateSellerDashboard(sellerData);
            this.playOrderNotificationSound(sellerData);
        }
    }

    /**
     * Show in-app live notification
     */
    showInAppLiveNotification(orderData) {
        const notificationArea = document.getElementById('live-notifications');
        if (!notificationArea) return;

        const notification = document.createElement('div');
        notification.className = 'live-notification';
        notification.id = `live-notif-${orderData.orderId}`;

        const statusIcon = this.getStatusIcon(orderData.status);
        const statusMessage = this.getStatusMessage(orderData.status, this.appType);

        notification.innerHTML = `
            <div class="live-notification-content">
                <div class="notification-icon">${statusIcon}</div>
                <div class="notification-text">
                    <div class="notification-title">Order #${orderData.orderId}</div>
                    <div class="notification-message">${statusMessage}</div>
                    <div class="notification-time">${new Date().toLocaleTimeString()}</div>
                </div>
                <div class="notification-actions">
                    <button onclick="liveTracker.viewOrderDetails('${orderData.orderId}')" class="btn-view">View</button>
                    <button onclick="liveTracker.dismissNotification('${orderData.orderId}')" class="btn-dismiss">×</button>
                </div>
            </div>
        `;

        notificationArea.appendChild(notification);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.dismissNotification(orderData.orderId);
        }, 10000);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }

    /**
     * Create live notification area in the DOM
     */
    createLiveNotificationArea() {
        if (document.getElementById('live-notifications')) return;

        const notificationArea = document.createElement('div');
        notificationArea.id = 'live-notifications';
        notificationArea.className = 'live-notifications-container';

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .live-notifications-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                width: 100%;
            }

            .live-notification {
                background: #fff;
                border-left: 4px solid #4CAF50;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                margin-bottom: 10px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }

            .live-notification.show {
                opacity: 1;
                transform: translateX(0);
            }

            .live-notification-content {
                display: flex;
                align-items: center;
                padding: 16px;
                gap: 12px;
            }

            .notification-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #4CAF50;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
            }

            .notification-text {
                flex: 1;
            }

            .notification-title {
                font-weight: bold;
                font-size: 14px;
                color: #333;
            }

            .notification-message {
                font-size: 13px;
                color: #666;
                margin-top: 2px;
            }

            .notification-time {
                font-size: 11px;
                color: #999;
                margin-top: 4px;
            }

            .notification-actions {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .btn-view, .btn-dismiss {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .btn-view {
                background: #2196F3;
                color: white;
            }

            .btn-dismiss {
                background: #f5f5f5;
                color: #666;
            }

            .live-tracking-status {
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: #4CAF50;
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                display: none;
            }

            .live-tracking-status.active {
                display: block;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(notificationArea);

        // Add live tracking status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'live-tracking-status';
        statusIndicator.className = 'live-tracking-status';
        statusIndicator.innerHTML = '🔴 Live tracking active';
        document.body.appendChild(statusIndicator);
    }

    /**
     * Update app-specific UI based on order data
     */
    updateAppSpecificUI(orderData) {
        switch (this.appType) {
            case 'customer':
                this.updateCustomerOrderTracker(orderData);
                break;
            case 'seller':
                this.updateSellerOrderBoard(orderData);
                break;
            case 'delivery':
                this.updateDeliveryDashboard(orderData);
                break;
        }
    }

    updateCustomerOrderTracker(orderData) {
        // Update order status in customer UI
        const orderElement = document.querySelector(`[data-order-id="${orderData.orderId}"]`);
        if (orderElement) {
            const statusElement = orderElement.querySelector('.order-status');
            if (statusElement) {
                statusElement.textContent = this.getStatusMessage(orderData.status, 'customer');
                statusElement.className = `order-status status-${orderData.status.toLowerCase()}`;
            }
        }

        // Update progress bar
        this.updateOrderProgress(orderData.orderId, orderData.status);
    }

    updateSellerOrderBoard(orderData) {
        // Update seller order board
        const orderCard = document.querySelector(`[data-order-id="${orderData.orderId}"]`);
        if (orderCard) {
            orderCard.classList.add('order-updated');
            setTimeout(() => {
                orderCard.classList.remove('order-updated');
            }, 2000);
        }

        // Update active order count
        this.updateActiveOrderCount();
    }

    updateDeliveryDashboard(orderData) {
        // Update delivery dashboard
        const currentOrder = document.getElementById('current-delivery-order');
        if (currentOrder && currentOrder.dataset.orderId === orderData.orderId) {
            const statusElement = currentOrder.querySelector('.delivery-status');
            if (statusElement) {
                statusElement.textContent = orderData.status;
            }
        }

        // Show/hide action buttons
        this.updateDeliveryActions(orderData.status);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // App went to background
                this.onAppBackgrounded();
            } else {
                // App came to foreground
                this.onAppForegrounded();
            }
        });

        // Listen for network status changes
        window.addEventListener('online', () => {
            this.onNetworkReconnected();
        });

        window.addEventListener('offline', () => {
            this.onNetworkDisconnected();
        });
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
        setInterval(() => {
            if (this.isLiveTrackingActive) {
                this.sendHeartbeat();
            }
        }, 30000); // Every 30 seconds
    }

    sendHeartbeat() {
        if (this.nativeInterface && this.nativeInterface.sendHeartbeat) {
            this.nativeInterface.sendHeartbeat();
        }
    }

    /**
     * Utility functions
     */
    getStatusIcon(status) {
        const icons = {
            'ASSIGNED': '👤',
            'ACCEPTED': '✅',
            'PREPARING': '👨‍🍳',
            'READY_FOR_PICKUP': '📦',
            'PICKED_UP': '🚚',
            'ON_THE_WAY': '🚗',
            'REACHED_CUSTOMER': '📍',
            'DELIVERED': '✅'
        };
        return icons[status] || '📱';
    }

    getStatusMessage(status, appType) {
        const messages = {
            customer: {
                'ASSIGNED': 'Order assigned to delivery partner',
                'ACCEPTED': 'Delivery partner accepted your order',
                'PREPARING': 'Your order is being prepared',
                'READY_FOR_PICKUP': 'Order is ready for pickup',
                'PICKED_UP': 'Your order has been picked up',
                'ON_THE_WAY': 'Your order is on the way',
                'REACHED_CUSTOMER': 'Delivery partner has reached',
                'DELIVERED': 'Order delivered successfully'
            },
            seller: {
                'ASSIGNED': 'Order assigned to delivery partner',
                'ACCEPTED': 'Order accepted by delivery partner',
                'PREPARING': 'Order is being prepared',
                'READY_FOR_PICKUP': 'Order ready for pickup',
                'PICKED_UP': 'Order picked up by delivery partner',
                'ON_THE_WAY': 'Order is on the way to customer',
                'DELIVERED': 'Order delivered successfully'
            },
            delivery: {
                'ASSIGNED': 'New order assigned to you',
                'ACCEPTED': 'Order accepted - go to store',
                'PREPARING': 'Order is being prepared',
                'READY_FOR_PICKUP': 'Order ready - pickup now',
                'PICKED_UP': 'Order picked up - deliver to customer',
                'ON_THE_WAY': 'On the way to customer',
                'DELIVERED': 'Delivery completed'
            }
        };

        return messages[appType]?.[status] || `Status: ${status}`;
    }

    shouldStopTracking(status) {
        return ['DELIVERED', 'CANCELLED'].includes(status);
    }

    updateLiveTrackingUI() {
        const statusIndicator = document.getElementById('live-tracking-status');
        if (statusIndicator) {
            if (this.isLiveTrackingActive) {
                statusIndicator.classList.add('active');
                statusIndicator.innerHTML = `🔴 Tracking ${this.activeLiveOrders.size} live order(s)`;
            } else {
                statusIndicator.classList.remove('active');
            }
        }
    }

    dismissNotification(orderId) {
        const notification = document.getElementById(`live-notif-${orderId}`);
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    viewOrderDetails(orderId) {
        // Navigate to order details
        window.location.hash = `#/orders/${orderId}`;
        this.dismissNotification(orderId);
    }

    onAppBackgrounded() {
        console.log('App backgrounded - live tracking continues in foreground service');
    }

    onAppForegrounded() {
        console.log('App foregrounded - syncing live updates');
        // Sync any missed updates
        this.syncMissedUpdates();
    }

    onNetworkReconnected() {
        console.log('Network reconnected - resuming live tracking');
    }

    onNetworkDisconnected() {
        console.log('Network disconnected - live tracking paused');
    }

    syncMissedUpdates() {
        // Request any missed updates from the server
        if (this.nativeInterface && this.nativeInterface.syncLiveUpdates) {
            this.nativeInterface.syncLiveUpdates(this.lastUpdate);
        }
    }
}

// Global instances and functions for native app integration
let liveTracker = null;

window.initializeLiveTracking = function(appType) {
    console.log('Initializing live tracking for:', appType);
    liveTracker = new LiveOrderTracker(appType);
    window.liveTracker = liveTracker; // Make globally accessible
};

window.handleLiveOrderUpdate = function(orderData) {
    if (liveTracker) {
        liveTracker.handleLiveOrderUpdate(orderData);
    }
};

window.handleLiveLocationUpdate = function(locationData) {
    if (liveTracker) {
        liveTracker.handleLiveLocationUpdate(locationData);
    }
};

window.handleEnhancedLocationUpdate = function(locationData) {
    if (liveTracker) {
        liveTracker.handleEnhancedLocationUpdate(locationData);
    }
};

window.handleETAUpdate = function(etaData) {
    if (liveTracker) {
        liveTracker.handleETAUpdate(etaData);
    }
};

window.handleLiveDeliveryUpdate = function(deliveryData) {
    if (liveTracker) {
        liveTracker.handleLiveDeliveryUpdate(deliveryData);
    }
};

window.handleLiveSellerUpdate = function(sellerData) {
    if (liveTracker) {
        liveTracker.handleLiveSellerUpdate(sellerData);
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize based on current app context
    if (window.appType) {
        window.initializeLiveTracking(window.appType);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LiveOrderTracker };
}
