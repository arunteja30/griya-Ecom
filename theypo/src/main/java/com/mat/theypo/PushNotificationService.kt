package com.mat.theypo

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PushNotificationService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "PushNotificationService"
        const val ACTION_FOREGROUND_NOTIFICATION =
            "com.example.customerhybrid.FOREGROUND_NOTIFICATION"
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed FCM token: $token")

        // Save token to Firestore
        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId != null) {
            saveFCMToken(userId, token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "Message received from: ${remoteMessage.from}")

        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "New Update"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""
        val orderId = remoteMessage.data["orderId"]

        // Check if app is in foreground
        if (isAppInForeground()) {
            Log.d(TAG, "App in foreground - sending to WebView")
            sendToWebView(title, body, orderId)
        }

        // Always show system notification (with heads-up for foreground)
        sendNotification(title, body, orderId, isAppInForeground())
    }

    private fun isAppInForeground(): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val appProcesses = activityManager.runningAppProcesses ?: return false

        val packageName = applicationContext.packageName
        for (appProcess in appProcesses) {
            if (appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
                appProcess.processName == packageName
            ) {
                return true
            }
        }
        return false
    }

    private fun sendToWebView(title: String, body: String, orderId: String?) {
        val intent = Intent(ACTION_FOREGROUND_NOTIFICATION).apply {
            putExtra("title", title)
            putExtra("body", body)
            putExtra("orderId", orderId)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun sendNotification(
        title: String,
        messageBody: String,
        orderId: String?,
        isForeground: Boolean
    ) {
        val intent = Intent(this, HybridWebActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            if (orderId != null) {
                putExtra("orderId", orderId)
                putExtra("deepLink", "/track-order/$orderId")
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "order_updates"
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Replace with your app icon
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(if (isForeground) null else defaultSoundUri) // No sound if foreground
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVibrate(
                if (isForeground) longArrayOf(0, 200, 100, 200) else longArrayOf(
                    0,
                    500,
                    200,
                    500
                )
            )
        
        // Enable heads-up notification for foreground
        if (isForeground) {
            notificationBuilder
                .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        }

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Order Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for order status updates"
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    private fun saveFCMToken(userId: String, token: String) {
        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection("customers").document(userId)

        userRef.update(
            mapOf(
                "fcmToken" to token,
                "fcmTokenUpdatedAt" to System.currentTimeMillis()
            )
        ).addOnSuccessListener {
            Log.d(TAG, "FCM token saved successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Error saving FCM token", e)
        }
    }
}
