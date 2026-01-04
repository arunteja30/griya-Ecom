package com.griyaecom.seller.services

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
import com.griyaecom.seller.MainActivity
import kotlin.random.Random

class SellerFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "SellerFCMService"
        private const val CHANNEL_ID = "seller_notifications"
        private const val CHANNEL_NAME = "Seller Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for seller app"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")

        // Store the token locally
        val sharedPref = getSharedPreferences("SellerFCMPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            apply()
        }

        // Send token to your server
        sendTokenToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")

        // Check if message contains a data payload.
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: ${remoteMessage.data}")
            handleDataMessage(remoteMessage.data)
        }

        // Check if message contains a notification payload.
        remoteMessage.notification?.let { notification ->
            Log.d(TAG, "Message Notification Body: ${notification.body}")
            showNotification(
                title = notification.title ?: "Seller Update",
                body = notification.body ?: "",
                data = remoteMessage.data
            )
        }

        // If no notification payload but has data, show notification from data
        if (remoteMessage.notification == null && remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "Seller Update"
            val body = remoteMessage.data["body"] ?: "New seller notification"
            showNotification(title, body, remoteMessage.data)
        }
    }

    private fun handleDataMessage(data: Map<String, String>) {
        // Handle different types of data messages specific to sellers
        when (data["type"]) {
            "new_order" -> handleNewOrder(data)
            "order_update" -> handleOrderUpdate(data)
            "inventory_alert" -> handleInventoryAlert(data)
            "payment_received" -> handlePaymentReceived(data)
            "review_received" -> handleReviewReceived(data)
            "promotion_update" -> handlePromotionUpdate(data)
            "admin_message" -> handleAdminMessage(data)
            else -> {
                // Generic notification
                val title = data["title"] ?: "Seller Update"
                val body = data["body"] ?: "New notification"
                showNotification(title, body, data)
            }
        }
    }

    private fun handleNewOrder(data: Map<String, String>) {
        val orderId = data["order_id"]
        val customerName = data["customer_name"]
        val amount = data["amount"]
        val title = "New Order Received!"
        val body = "Order #$orderId from $customerName - Amount: $$amount"

        showNotification(title, body, data, "new_order_$orderId")
    }

    private fun handleOrderUpdate(data: Map<String, String>) {
        val orderId = data["order_id"]
        val status = data["status"]
        val title = "Order Update"
        val body = "Order #$orderId status updated to: $status"

        showNotification(title, body, data, "order_update_$orderId")
    }

    private fun handleInventoryAlert(data: Map<String, String>) {
        val productName = data["product_name"]
        val quantity = data["quantity"]
        val title = "Inventory Alert"
        val body = "$productName is running low (${quantity} left)"

        showNotification(title, body, data, "inventory_${productName?.hashCode()}")
    }

    private fun handlePaymentReceived(data: Map<String, String>) {
        val orderId = data["order_id"]
        val amount = data["amount"]
        val title = "Payment Received"
        val body = "Payment of $$amount received for order #$orderId"

        showNotification(title, body, data, "payment_$orderId")
    }

    private fun handleReviewReceived(data: Map<String, String>) {
        val rating = data["rating"]
        val customerName = data["customer_name"]
        val title = "New Review"
        val body = "$customerName left a $rating star review"

        showNotification(title, body, data, "review_${System.currentTimeMillis()}")
    }

    private fun handlePromotionUpdate(data: Map<String, String>) {
        val title = data["title"] ?: "Promotion Update"
        val body = data["message"] ?: "Your promotion has been updated"

        showNotification(title, body, data, "promotion_${System.currentTimeMillis()}")
    }

    private fun handleAdminMessage(data: Map<String, String>) {
        val title = "Message from Admin"
        val body = data["message"] ?: "You have a new message from admin"

        showNotification(title, body, data, "admin_${System.currentTimeMillis()}")
    }

    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>,
        tag: String? = null
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
            // Add notification data as extras
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            Random.nextInt(),
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Use system icon for now
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        // Add big text style for longer messages
        if (body.length > 50) {
            notificationBuilder.setStyle(
                NotificationCompat.BigTextStyle().bigText(body)
            )
        }

        // Add action buttons based on notification type
        addActionButtons(notificationBuilder, data)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = tag?.hashCode() ?: Random.nextInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    private fun addActionButtons(
        builder: NotificationCompat.Builder,
        data: Map<String, String>
    ) {
        when (data["type"]) {
            "new_order" -> {
                val orderId = data["order_id"]
                val acceptIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "accept_order")
                    putExtra("order_id", orderId)
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val acceptPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    acceptIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "Accept", acceptPendingIntent)

                val viewOrderIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "view_order")
                    putExtra("order_id", orderId)
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val viewOrderPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    viewOrderIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "View Details", viewOrderPendingIntent)
            }
            "inventory_alert" -> {
                val restockIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "restock_product")
                    putExtra("product_name", data["product_name"])
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val restockPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    restockIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "Restock", restockPendingIntent)
            }
            "review_received" -> {
                val viewReviewIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "view_reviews")
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val viewReviewPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    viewReviewIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "View Review", viewReviewPendingIntent)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
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

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun sendTokenToServer(token: String) {
        // Send token to your backend server
        Log.d(TAG, "Sending seller app token to server: $token")

        // Store token with app identifier
        val sharedPref = getSharedPreferences("SellerFCMPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            putString("app_type", "seller")
            apply()
        }
    }

    // Helper function to get stored FCM token
    fun getStoredToken(): String? {
        val sharedPref = getSharedPreferences("SellerFCMPrefs", Context.MODE_PRIVATE)
        return sharedPref.getString("fcm_token", null)
    }
}
