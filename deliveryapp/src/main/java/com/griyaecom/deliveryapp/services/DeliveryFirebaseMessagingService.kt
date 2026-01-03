package com.griyaecom.deliveryapp.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.griyaecom.deliveryapp.DriverMainActivity
import kotlin.random.Random

class DeliveryFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "DeliveryFCMService"
        private const val CHANNEL_ID = "delivery_notifications"
        private const val LIVE_CHANNEL_ID = "live_delivery_notifications"
        private const val CHANNEL_NAME = "Delivery Notifications"
        private const val LIVE_CHANNEL_NAME = "Live Delivery Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for delivery app"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")

        // Store the token locally with driver info
        val sharedPref = getSharedPreferences("DeliveryFCMPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            putLong("token_timestamp", System.currentTimeMillis())
            apply()
        }

        // Send token to server with driver relationship
        sendTokenToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")

        // Handle data payload for live notifications
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: ${remoteMessage.data}")
            handleDataMessage(remoteMessage.data)
        }

        // Handle notification payload
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "Message Notification Body: ${notification.body}")
            showNativeNotification(
                title = notification.title ?: "Delivery Update",
                body = notification.body ?: "",
                data = remoteMessage.data,
                isLive = remoteMessage.data["is_live"] == "true"
            )
        }

        // If no notification payload but has data, create notification from data
        if (remoteMessage.notification == null && remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "Delivery Update"
            val body = remoteMessage.data["body"] ?: "New delivery notification"
            showNativeNotification(title, body, remoteMessage.data, remoteMessage.data["is_live"] == "true")
        }
    }

    private fun handleDataMessage(data: Map<String, String>) {
        when (data["type"]) {
            "live_delivery_update" -> handleLiveDeliveryUpdate(data)
            "new_order" -> handleNewOrderAssignment(data)
            "order_cancelled" -> handleOrderCancellation(data)
            "route_update" -> handleRouteUpdate(data)
            "location_request" -> handleLocationRequest(data)
            "emergency" -> handleEmergencyAlert(data)
            "driver_order_relation" -> handleDriverOrderRelation(data)
            else -> handleGenericNotification(data)
        }
    }

    private fun handleLiveDeliveryUpdate(data: Map<String, String>) {
        val orderId = data["order_id"]
        val status = data["status"]

        val title = "Live Update - Order #$orderId"
        val body = when (status) {
            "ACCEPTED" -> "Order accepted - Navigate to pickup location"
            "PREPARING" -> "Order is being prepared"
            "READY_FOR_PICKUP" -> "Order ready for pickup"
            "PICKED_UP" -> "Order picked up - Navigate to customer"
            "ON_THE_WAY" -> "Delivering to customer"
            "DELIVERED" -> "Order delivered successfully"
            else -> "Order status updated: $status"
        }

        // Start live location tracking for accepted orders
        if (status == "ACCEPTED" && orderId != null) {
            val riderId = getCurrentRiderId()
            if (riderId != null) {
                LiveLocationTrackingService.startService(this, orderId, riderId)
            }
        }

        // Stop location tracking for completed orders
        if (status in listOf("DELIVERED", "CANCELLED")) {
            LiveLocationTrackingService.stopService(this)
        }

        showNativeNotification(title, body, data, true, "live_delivery_$orderId")
    }

    private fun handleNewOrderAssignment(data: Map<String, String>) {
        val orderId = data["order_id"]
        val customerName = data["customer_name"]
        val pickupAddress = data["pickup_address"]
        val amount = data["amount"]

        val title = "New Delivery Assignment"
        val body = "Order #$orderId from $customerName\nPickup: $pickupAddress\nAmount: ₹$amount"

        // Update driver-order relationship
        updateDriverOrderRelation(orderId, "ASSIGNED")

        showNativeNotification(title, body, data, false, "new_order_$orderId")
    }

    private fun handleOrderCancellation(data: Map<String, String>) {
        val orderId = data["order_id"]
        val title = "Order Cancelled"
        val body = "Order #$orderId has been cancelled"

        // Remove driver-order relationship
        removeDriverOrderRelation(orderId)

        // Stop location tracking if active
        LiveLocationTrackingService.stopService(this)

        showNativeNotification(title, body, data, false, "cancelled_$orderId")
    }

    private fun handleRouteUpdate(data: Map<String, String>) {
        val title = "Route Update"
        val body = data["message"] ?: "Your delivery route has been updated"

        showNativeNotification(title, body, data, false)
    }

    private fun handleLocationRequest(data: Map<String, String>) {
        val title = "Location Update Requested"
        val body = "Customer has requested your current location"

        // Auto-share location if in active delivery
        val orderId = data["order_id"]
        if (orderId != null && isActiveDelivery(orderId)) {
            shareCurrentLocation(orderId)
        }

        showNativeNotification(title, body, data, false)
    }

    private fun handleEmergencyAlert(data: Map<String, String>) {
        val title = "🚨 Emergency Alert"
        val body = data["message"] ?: "Emergency notification"

        showNativeNotification(title, body, data, false, priority = NotificationCompat.PRIORITY_MAX)
    }

    private fun handleDriverOrderRelation(data: Map<String, String>) {
        val orderId = data["order_id"]
        val riderId = data["rider_id"]
        val action = data["action"] // "create", "update", "remove"

        when (action) {
            "create", "update" -> updateDriverOrderRelation(orderId, data["status"])
            "remove" -> removeDriverOrderRelation(orderId)
        }

        Log.d(TAG, "Driver-order relation $action: Order $orderId, Driver $riderId")
    }

    private fun handleGenericNotification(data: Map<String, String>) {
        val title = data["title"] ?: "Delivery Notification"
        val body = data["body"] ?: "New notification"
        showNativeNotification(title, body, data, false)
    }

    private fun showNativeNotification(
        title: String,
        body: String,
        data: Map<String, String>,
        isLive: Boolean = false,
        tag: String? = null,
        priority: Int = NotificationCompat.PRIORITY_HIGH
    ) {
        val channelId = if (isLive) LIVE_CHANNEL_ID else CHANNEL_ID

        val intent = Intent(this, DriverMainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("from_notification", true)

            // Add notification data as extras
            data.forEach { (key, value) ->
                putExtra(key, value)
            }

            // Add action based on notification type
            when (data["type"]) {
                "live_delivery_update" -> putExtra("action", "view_live_delivery")
                "new_order" -> putExtra("action", "view_new_order")
                else -> putExtra("action", "open_app")
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            Random.nextInt(),
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(!isLive)
            .setContentIntent(pendingIntent)
            .setPriority(priority)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setOngoing(isLive)

        if (body.length > 50) {
            notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
        }

        addNativeActionButtons(notificationBuilder, data)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = tag?.hashCode() ?: Random.nextInt()

        try {
            notificationManager.notify(notificationId, notificationBuilder.build())
            Log.d(TAG, "Native notification shown: $title")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to show notification - permission required", e)
        }
    }

    private fun addNativeActionButtons(
        builder: NotificationCompat.Builder,
        data: Map<String, String>
    ) {
        val orderId = data["order_id"]
        val status = data["status"]

        when (data["type"]) {
            "new_order" -> {
                addActionButton(builder, "Accept", "accept_order", orderId)
                addActionButton(builder, "Decline", "decline_order", orderId)
            }
            "live_delivery_update" -> {
                when (status) {
                    "ACCEPTED" -> addActionButton(builder, "Navigate", "navigate_pickup", orderId)
                    "READY_FOR_PICKUP" -> addActionButton(builder, "Picked Up", "mark_picked_up", orderId)
                    "PICKED_UP" -> addActionButton(builder, "Navigate", "navigate_customer", orderId)
                    "ON_THE_WAY" -> addActionButton(builder, "Delivered", "mark_delivered", orderId)
                }
            }
            "location_request" -> {
                addActionButton(builder, "Share Location", "share_location", orderId)
            }
        }
    }

    private fun addActionButton(
        builder: NotificationCompat.Builder,
        label: String,
        action: String,
        orderId: String?
    ) {
        val intent = Intent(this, DriverMainActivity::class.java).apply {
            putExtra("action", action)
            putExtra("order_id", orderId)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            "$action$orderId".hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        builder.addAction(0, label, pendingIntent)
    }

    private fun updateDriverOrderRelation(orderId: String?, status: String?) {
        if (orderId == null) return

        val riderId = getCurrentRiderId() ?: return
        val sharedPref = getSharedPreferences("DriverOrderRelation", Context.MODE_PRIVATE)

        with(sharedPref.edit()) {
            putString("current_order_id", orderId)
            putString("current_order_status", status)
            putLong("relation_timestamp", System.currentTimeMillis())
            apply()
        }

        Log.d(TAG, "Updated driver-order relation: Driver $riderId, Order $orderId, Status $status")
    }

    private fun removeDriverOrderRelation(orderId: String?) {
        val sharedPref = getSharedPreferences("DriverOrderRelation", Context.MODE_PRIVATE)

        with(sharedPref.edit()) {
            remove("current_order_id")
            remove("current_order_status")
            putLong("relation_removed_timestamp", System.currentTimeMillis())
            apply()
        }

        Log.d(TAG, "Removed driver-order relation for order: $orderId")
    }

    private fun getCurrentRiderId(): String? {
        val sharedPref = getSharedPreferences("DeliveryPrefs", Context.MODE_PRIVATE)
        return sharedPref.getString("driver_id", null)
    }

    private fun isActiveDelivery(orderId: String): Boolean {
        val sharedPref = getSharedPreferences("DriverOrderRelation", Context.MODE_PRIVATE)
        val currentOrderId = sharedPref.getString("current_order_id", null)
        val currentStatus = sharedPref.getString("current_order_status", null)

        return currentOrderId == orderId && currentStatus in listOf("ACCEPTED", "PICKED_UP", "ON_THE_WAY")
    }

    private fun shareCurrentLocation(orderId: String) {
        val riderId = getCurrentRiderId()
        if (riderId != null) {
            LiveLocationTrackingService.startService(this, orderId, riderId)
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            val liveChannel = NotificationChannel(
                LIVE_CHANNEL_ID,
                LIVE_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Live delivery tracking notifications"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }

            notificationManager.createNotificationChannel(channel)
            notificationManager.createNotificationChannel(liveChannel)
        }
    }

    private fun sendTokenToServer(token: String) {
        Log.d(TAG, "Sending delivery app token to server: $token")

        val riderId = getCurrentRiderId()
        val sharedPref = getSharedPreferences("DeliveryFCMPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            putString("app_type", "delivery")
            putString("driver_id", riderId)
            putLong("token_updated", System.currentTimeMillis())
            apply()
        }

        // TODO: Implement actual server call to register token with driver relationship
        Log.d(TAG, "Token stored locally with driver relation: $riderId")
    }
}
