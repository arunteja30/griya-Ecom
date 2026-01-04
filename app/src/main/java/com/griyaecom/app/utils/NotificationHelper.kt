package com.griyaecom.app.utils

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.griyaecom.app.MainActivity
import com.griyaecom.app.R
import kotlin.random.Random

class NotificationHelper(private val activity: MainActivity) {

    private val notificationManager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val vibrator = getVibrator()

    companion object {
        private const val TAG = "NotificationHelper"
        private const val CHANNEL_ID = "griyamart_notifications"
        private const val CHANNEL_NAME = "GriyaMart Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications for order updates and promotions"
    }

    init {
        createNotificationChannel()
    }

    private fun getVibrator(): Vibrator {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            // Notifications are enabled by default on older versions
            true
        }
    }

    fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
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
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showNotification(
        title: String,
        message: String,
        notificationId: Int = Random.nextInt(),
        autoCancel: Boolean = true,
        priority: Int = NotificationCompat.PRIORITY_HIGH,
        actionData: Map<String, String>? = null
    ) {
        if (!hasNotificationPermission()) {
            Log.w(TAG, "Notification permission not granted")
            return
        }

        try {
            val intent = Intent(activity, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                
                // Add action data if provided
                actionData?.forEach { (key, value) ->
                    putExtra(key, value)
                }
            }

            val pendingIntent = PendingIntent.getActivity(
                activity,
                notificationId,
                intent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )

            val notificationBuilder = NotificationCompat.Builder(activity, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setAutoCancel(autoCancel)
                .setContentIntent(pendingIntent)
                .setPriority(priority)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))

            // Add custom actions based on notification type
            actionData?.let { data ->
                addNotificationActions(notificationBuilder, data, notificationId)
            }

            notificationManager.notify(notificationId, notificationBuilder.build())

        } catch (e: Exception) {
            Log.e(TAG, "Error showing notification", e)
        }
    }

    private fun addNotificationActions(
        builder: NotificationCompat.Builder,
        actionData: Map<String, String>,
        notificationId: Int
    ) {
        when (actionData["type"]) {
            "order" -> {
                // View Order Action
                val viewOrderIntent = Intent(activity, MainActivity::class.java).apply {
                    putExtra("action", "view_order")
                    putExtra("order_id", actionData["order_id"])
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val viewOrderPendingIntent = PendingIntent.getActivity(
                    activity,
                    notificationId + 1,
                    viewOrderIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "View Order", viewOrderPendingIntent)

                // Track Order Action
                val trackOrderIntent = Intent(activity, MainActivity::class.java).apply {
                    putExtra("action", "track_order")
                    putExtra("order_id", actionData["order_id"])
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val trackOrderPendingIntent = PendingIntent.getActivity(
                    activity,
                    notificationId + 2,
                    trackOrderIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "Track", trackOrderPendingIntent)
            }
            
            "chat" -> {
                // Reply Action
                val replyIntent = Intent(activity, MainActivity::class.java).apply {
                    putExtra("action", "open_chat")
                    putExtra("chat_id", actionData["chat_id"])
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val replyPendingIntent = PendingIntent.getActivity(
                    activity,
                    notificationId + 1,
                    replyIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "Reply", replyPendingIntent)
            }
            
            "promotion" -> {
                // View Offer Action
                val offerIntent = Intent(activity, MainActivity::class.java).apply {
                    putExtra("action", "view_offer")
                    putExtra("offer_id", actionData["offer_id"])
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val offerPendingIntent = PendingIntent.getActivity(
                    activity,
                    notificationId + 1,
                    offerIntent,
                    PendingIntent.FLAG_IMMUTABLE
                )
                builder.addAction(0, "View Offer", offerPendingIntent)
            }
        }
    }

    fun cancelNotification(notificationId: Int) {
        notificationManager.cancel(notificationId)
    }

    fun cancelAllNotifications() {
        notificationManager.cancelAll()
    }

    fun vibrate(duration: Long = 200) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(duration)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error vibrating", e)
        }
    }

    fun vibratePattern(pattern: LongArray) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(pattern, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error vibrating pattern", e)
        }
    }

    fun getFCMToken(callback: (String?) -> Unit) {
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                    callback(null)
                    return@addOnCompleteListener
                }

                // Get new FCM registration token
                val token = task.result
                Log.d(TAG, "FCM Registration Token: $token")

                // Store the token in SharedPreferences
                if (token != null) {
                    storeToken(token)
                }

                callback(token)
            }
    }

    fun getStoredToken(): String? {
        val sharedPref = activity.getSharedPreferences("FCMTokenStorage", Context.MODE_PRIVATE)
        return sharedPref.getString("fcm_token", null)
    }

    private fun storeToken(token: String) {
        val sharedPref = activity.getSharedPreferences("FCMTokenStorage", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            apply()
        }
        Log.d(TAG, "FCM token stored successfully")
    }

    fun refreshFCMToken() {
        FirebaseMessaging.getInstance().deleteToken()
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d(TAG, "FCM token deleted successfully")
                    // Get a new token
                    getFCMToken { newToken ->
                        Log.d(TAG, "New FCM token generated: $newToken")
                    }
                } else {
                    Log.w(TAG, "Failed to delete FCM token", task.exception)
                }
            }
    }

    fun subscribeToNotificationTopic(topic: String, callback: (Boolean) -> Unit) {
        FirebaseMessaging.getInstance().subscribeToTopic(topic)
            .addOnCompleteListener { task ->
                val success = task.isSuccessful
                if (success) {
                    Log.d(TAG, "Subscribed to topic: $topic")
                } else {
                    Log.w(TAG, "Failed to subscribe to topic: $topic", task.exception)
                }
                callback(success)
            }
    }

    fun subscribeToTopic(topic: String, callback: (Boolean) -> Unit) {
        subscribeToNotificationTopic(topic, callback)
    }

    fun unsubscribeFromTopic(topic: String, callback: (Boolean) -> Unit) {
        FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
            .addOnCompleteListener { task ->
                val success = task.isSuccessful
                if (success) {
                    Log.d(TAG, "Unsubscribed from topic: $topic")
                } else {
                    Log.w(TAG, "Failed to unsubscribe from topic: $topic", task.exception)
                }
                callback(success)
            }
    }

    // Network utility functions
    fun isNetworkConnected(): Boolean {
        val connectivityManager = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val networkCapabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            networkInfo?.isConnected == true
        }
    }

    fun getNetworkType(): String {
        val connectivityManager = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return "none"
            val networkCapabilities = connectivityManager.getNetworkCapabilities(network) ?: return "none"
            
            return when {
                networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                networkCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "unknown"
            }
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            return when (networkInfo?.type) {
                ConnectivityManager.TYPE_WIFI -> "wifi"
                ConnectivityManager.TYPE_MOBILE -> "cellular"
                ConnectivityManager.TYPE_ETHERNET -> "ethernet"
                else -> "none"
            }
        }
    }

    // Badge count management (for launchers that support it)
    fun updateBadgeCount(count: Int) {
        try {
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                putExtra("badge_count", count)
                putExtra("badge_count_package_name", activity.packageName)
                putExtra("badge_count_class_name", MainActivity::class.java.name)
            }
            activity.sendBroadcast(intent)
        } catch (e: Exception) {
            Log.d(TAG, "Badge count not supported on this launcher")
        }
    }

    fun clearBadgeCount() {
        updateBadgeCount(0)
    }
}