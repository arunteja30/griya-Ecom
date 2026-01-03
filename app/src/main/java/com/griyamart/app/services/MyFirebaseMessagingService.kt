package com.griyaecom.app.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.griyaecom.app.MainActivity
import com.griyaecom.app.R
import kotlin.random.Random

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCMService"
        private const val CHANNEL_ID = "griyamart_notifications"
        private const val CHANNEL_NAME = "GriyaMart Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for GriyaMart app"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        
        // Store the token locally
        val sharedPref = getSharedPreferences("FCMPrefs", Context.MODE_PRIVATE)
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
                title = notification.title ?: "GriyaMart",
                body = notification.body ?: "",
                data = remoteMessage.data
            )
        }

        // If no notification payload but has data, show notification from data
        if (remoteMessage.notification == null && remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "GriyaMart"
            val body = remoteMessage.data["body"] ?: "New notification"
            showNotification(title, body, remoteMessage.data)
        }
    }

    private fun handleDataMessage(data: Map<String, String>) {
        // Handle different types of data messages
        when (data["type"]) {
            "order_update" -> handleOrderUpdate(data)
            "delivery_update" -> handleDeliveryUpdate(data)
            "promotion" -> handlePromotion(data)
            "chat_message" -> handleChatMessage(data)
            else -> {
                // Generic notification
                val title = data["title"] ?: "GriyaMart"
                val body = data["body"] ?: "New notification"
                showNotification(title, body, data)
            }
        }
    }

    private fun handleOrderUpdate(data: Map<String, String>) {
        val orderId = data["order_id"]
        val status = data["status"]
        val title = "Order Update"
        val body = "Your order #$orderId is $status"
        
        showNotification(title, body, data, "order_$orderId")
    }

    private fun handleDeliveryUpdate(data: Map<String, String>) {
        val orderId = data["order_id"]
        val status = data["status"]
        val title = "Delivery Update"
        val body = "Your delivery for order #$orderId: $status"
        
        showNotification(title, body, data, "delivery_$orderId")
    }

    private fun handlePromotion(data: Map<String, String>) {
        val title = data["title"] ?: "Special Offer!"
        val body = data["body"] ?: "Don't miss out on this amazing deal!"
        
        showNotification(title, body, data, "promotion_${System.currentTimeMillis()}")
    }

    private fun handleChatMessage(data: Map<String, String>) {
        val sender = data["sender"] ?: "Customer Support"
        val message = data["message"] ?: "You have a new message"
        val title = "Message from $sender"
        
        showNotification(title, message, data, "chat_${System.currentTimeMillis()}")
    }

    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>,
        tag: String? = null
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
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
            .setSmallIcon(R.drawable.ic_notification)
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
            "order_update" -> {
                val orderId = data["order_id"]
                val viewOrderIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "view_order")
                    putExtra("order_id", orderId)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val viewOrderPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    viewOrderIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "View Order", viewOrderPendingIntent)
            }
            "chat_message" -> {
                val replyIntent = Intent(this, MainActivity::class.java).apply {
                    putExtra("action", "open_chat")
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val replyPendingIntent = PendingIntent.getActivity(
                    this,
                    Random.nextInt(),
                    replyIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "Reply", replyPendingIntent)
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
        // TODO: Send token to your backend server
        // Example: Make API call to register/update the token
        Log.d(TAG, "Sending token to server: $token")
        
        // Store token with user phone number for customer-specific topics
        val sharedPref = getSharedPreferences("UserPrefs", Context.MODE_PRIVATE)
        val userPhone = sharedPref.getString("user_phone", "")

        if (!userPhone.isNullOrEmpty()) {
            // Subscribe to customer-specific topic
            val customerTopic = "customer_${userPhone.replace(Regex("[^0-9]"), "")}"
            FirebaseMessaging.getInstance().subscribeToTopic(customerTopic)
            Log.d(TAG, "Subscribed to customer topic: $customerTopic")
        }

        // Subscribe to general customer topics
        FirebaseMessaging.getInstance().subscribeToTopic("customer_updates")
        FirebaseMessaging.getInstance().subscribeToTopic("promotions")

        // You can implement HTTP request here to send token to your backend
        // For now, we'll just store it locally and it can be accessed via WebBridge
    }

    // Helper function to get stored FCM token
    fun getStoredToken(): String? {
        val sharedPref = getSharedPreferences("FCMPrefs", Context.MODE_PRIVATE)
        return sharedPref.getString("fcm_token", null)
    }
}