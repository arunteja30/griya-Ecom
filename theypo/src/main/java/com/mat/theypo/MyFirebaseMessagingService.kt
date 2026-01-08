package com.mat.theypo

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

import org.json.JSONObject

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "order_notifications"
        const val CHANNEL_NAME = "Order Notifications"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to your server or store it
        // You can also save it to SharedPreferences
        getSharedPreferences("app_prefs", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Check if message contains data payload
        if (remoteMessage.data.isNotEmpty()) {
            handleDataMessage(remoteMessage.data)
        }

        // Check if message contains notification payload
        remoteMessage.notification?.let {
            showNotification(
                title = it.title ?: "New Notification",
                message = it.body ?: "",
                data = remoteMessage.data
            )
        }
    }

    private fun handleDataMessage(data: Map<String, String>) {
        val title = data["title"] ?: "New Notification"
        val message = data["message"] ?: ""

        // Show notification
        showNotification(title, message, data)

        // If app is in foreground, send to WebView
        sendToWebView(data)
    }

    private fun showNotification(title: String, message: String, data: Map<String, String>) {
        createNotificationChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            // Pass notification data to MainActivity
            putExtra("notificationData", JSONObject(data).toString())
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVibrate(longArrayOf(0, 500, 200, 500))

        // Add custom styling for different notification types
        when (data["type"]) {
            "new_order" -> {
                notificationBuilder.color = resources.getColor(R.color.colorAccent, null)
            }

            "order_update" -> {
                notificationBuilder.color = resources.getColor(R.color.colorPrimary, null)
            }
        }

        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(
            System.currentTimeMillis().toInt(),
            notificationBuilder.build()
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for order updates and new orders"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    @SuppressLint("UnusedParameter")
    private fun sendToWebView(data: Map<String, String>) {
        // If you want to send data to WebView when app is in foreground
        // You would need to use a BroadcastReceiver or EventBus pattern
        // For simplicity, MainActivity will handle this when it's in foreground
    }
}
