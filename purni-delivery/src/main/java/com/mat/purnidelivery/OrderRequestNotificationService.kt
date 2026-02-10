package com.mat.purnidelivery

import android.R
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class OrderRequestNotificationService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "OrderRequestNotification"
        private const val ORDER_REQUEST_CHANNEL = "order_requests"
        private const val GENERAL_CHANNEL = "general_notifications"
        private const val ORDER_REQUEST_NOTIFICATION_ID = 3001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM Token refreshed: $token")

        // Save token to Firestore for this delivery partner
        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId != null) {
            saveFCMToken(userId, token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "Message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val messageType = data["type"] ?: "general"

        when (messageType) {
            "order_request" -> handleOrderRequest(data)
            "order_cancelled" -> handleOrderCancelled(data)
            "order_updated" -> handleOrderUpdate(data)
            "payment_update" -> handlePaymentUpdate(data)
            else -> handleGeneralNotification(remoteMessage)
        }
    }

    private fun handleOrderRequest(data: Map<String, String>) {
        val orderId = data["orderId"] ?: return
        val restaurantName = data["restaurantName"] ?: "Restaurant"
        val restaurantAddress = data["restaurantAddress"] ?: "Unknown location"
        val deliveryAddress = data["deliveryAddress"] ?: "Unknown destination"
        val customerName = data["customerName"] ?: "Customer"
        val orderValue = data["orderValue"] ?: "₹0"
        val deliveryFee = data["deliveryFee"] ?: "₹0"
        val distance = data["distance"] ?: "0 km"
        val timeToRestaurant = data["timeToRestaurant"] ?: "Unknown"
        val itemsCount = data["itemsCount"] ?: "1"
        val items = data["items"] ?: "Food items"

        Log.d(TAG, "🍕 New order request: $orderId")

        // Create high-priority notification for order request
        val title = "🍕 New Order Available!"
        val body =
            "💰 $deliveryFee delivery fee • 📍 $distance away\n🏪 From: $restaurantName\n📍 To: $customerName\n🛍️ $itemsCount items • Order value: $orderValue"

        showOrderRequestNotification(
            orderId = orderId,
            title = title,
            body = body,
            restaurantName = restaurantName,
            restaurantAddress = restaurantAddress,
            deliveryAddress = deliveryAddress,
            customerName = customerName,
            deliveryFee = deliveryFee,
            orderValue = orderValue,
            distance = distance,
            timeToRestaurant = timeToRestaurant,
            items = items
        )

        // Also send to WebView if app is open
        sendOrderRequestToWebView(orderId, data)
    }

    private fun showOrderRequestNotification(
        orderId: String,
        title: String,
        body: String,
        restaurantName: String,
        restaurantAddress: String,
        deliveryAddress: String,
        customerName: String,
        deliveryFee: String,
        orderValue: String,
        distance: String,
        timeToRestaurant: String,
        items: String
    ) {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        // Intent to open app and show order request
        val openAppIntent = Intent(this, HybridWebActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra("order_request_id", orderId)
            putExtra("deep_link", "/order-request/$orderId")
            putExtra("auto_open_request", true)
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this,
            orderId.hashCode(),
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent for accepting order (direct action)
        val acceptIntent = Intent(this, OrderActionReceiver::class.java).apply {
            action = "ACCEPT_ORDER"
            putExtra("orderId", orderId)
        }
        val acceptPendingIntent = PendingIntent.getBroadcast(
            this,
            (orderId + "_accept").hashCode(),
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent for declining order
        val declineIntent = Intent(this, OrderActionReceiver::class.java).apply {
            action = "DECLINE_ORDER"
            putExtra("orderId", orderId)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            this,
            (orderId + "_decline").hashCode(),
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Create expanded notification with actions
        val notification = NotificationCompat.Builder(this, ORDER_REQUEST_CHANNEL)
            .setSmallIcon(R.drawable.ic_menu_agenda) // Use proper food delivery icon
            .setContentTitle(title)
            .setContentText("Tap to view order details")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("$body\n\n⏱️ $timeToRestaurant to $restaurantName\n🛍️ Items: $items")
            )
            .setContentIntent(openAppPendingIntent)
            .setAutoCancel(false) // Keep notification until acted upon
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL) // Highest priority
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setTimeoutAfter(45_000) // Auto-dismiss after 45 seconds (longer for food orders)
            // Action buttons
            .addAction(
                R.drawable.ic_menu_send,
                "✅ ACCEPT ($deliveryFee)",
                acceptPendingIntent
            )
            .addAction(
                R.drawable.ic_menu_close_clear_cancel,
                "❌ DECLINE",
                declinePendingIntent
            )
            .build()

        // Make notification heads-up (full screen interruption)
        notification.flags = notification.flags or Notification.FLAG_INSISTENT

        notificationManager.notify(ORDER_REQUEST_NOTIFICATION_ID, notification)

        Log.d(TAG, "✅ Order request notification shown for: $orderId")
    }

    private fun handleOrderCancelled(data: Map<String, String>) {
        val orderId = data["orderId"] ?: return
        val reason = data["reason"] ?: "Customer cancelled"
        Log.d(TAG, "❌ Order cancelled: $orderId")

        // Clear order request notification
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(ORDER_REQUEST_NOTIFICATION_ID)

        // Show brief cancellation message
        showGeneralNotification(
            title = "Order Cancelled",
            body = "Order was cancelled: $reason",
            channelId = GENERAL_CHANNEL
        )
    }

    private fun handleOrderUpdate(data: Map<String, String>) {
        val orderId = data["orderId"] ?: return
        val status = data["status"] ?: "updated"
        val message = data["message"] ?: "Order status changed to $status"

        showGeneralNotification(
            title = "Order Update",
            body = message,
            channelId = GENERAL_CHANNEL
        )
    }

    private fun handlePaymentUpdate(data: Map<String, String>) {
        val amount = data["amount"] ?: "₹0"
        val status = data["status"] ?: "completed"
        val orderId = data["orderId"] ?: ""

        showGeneralNotification(
            title = "💰 Payment Received",
            body = "You received $amount for order $orderId",
            channelId = GENERAL_CHANNEL
        )
    }

    private fun handleGeneralNotification(remoteMessage: RemoteMessage) {
        val title =
            remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "Delivery Update"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""

        showGeneralNotification(title, body, GENERAL_CHANNEL)
    }

    private fun showGeneralNotification(title: String, body: String, channelId: String) {
        val intent = Intent(this, HybridWebActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun sendOrderRequestToWebView(orderId: String, data: Map<String, String>) {
        // Send to WebView via broadcast if app is open
        val intent = Intent("ORDER_REQUEST_RECEIVED").apply {
            putExtra("orderId", orderId)
            putExtra("data", data.toString())
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

            // High priority channel for order requests
            val orderRequestChannel = NotificationChannel(
                ORDER_REQUEST_CHANNEL,
                "Order Requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New order requests from customers"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
                setBypassDnd(true) // Override Do Not Disturb
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC

                // Set custom sound for order requests
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                setSound(
                    soundUri, AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                )
            }

            // Normal priority for general notifications
            val generalChannel = NotificationChannel(
                GENERAL_CHANNEL,
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General delivery app notifications"
                enableLights(true)
                enableVibration(true)
            }

            notificationManager.createNotificationChannel(orderRequestChannel)
            notificationManager.createNotificationChannel(generalChannel)
        }
    }

    private fun saveFCMToken(userId: String, token: String) {
        val database = FirebaseDatabase.getInstance()

        val tokenUpdates = mapOf(
            "deliveryPartners/$userId/fcmToken" to token,
            "deliveryPartners/$userId/fcmTokenUpdatedAt" to ServerValue.TIMESTAMP,
            "deliveryPartners/$userId/lastActive" to ServerValue.TIMESTAMP
        )

        database.reference.updateChildren(tokenUpdates)
            .addOnSuccessListener {
                Log.d(TAG, "✅ FCM token saved successfully to RTDB")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Error saving FCM token to RTDB", e)
            }
    }
}