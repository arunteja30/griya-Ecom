package com.mat.purnidelivery

import android.app.Activity
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast

/**
 * Mobile notification bridge for delivery partner app.
 * Implements window.mobileNotificationBridge interface from delivery-simple web app.
 */
class MobileNotificationBridge(
    private val activity: Activity,
    private val webView: WebView? = null
) {

    /**
     * Show bottom sheet notification in the WebView
     */
    @JavascriptInterface
    fun showBottomSheet(title: String, body: String, dataJson: String?) {
        activity.runOnUiThread {
            try {
                // Send to WebView to trigger bottom sheet UI
                val jsData = dataJson ?: "{}"
                val js =
                    "window.showMobileBottomSheet && window.showMobileBottomSheet('$title', '$body', $jsData)"
                webView?.evaluateJavascript(js, null)

                // Also trigger vibration for attention
                triggerVibration("[200, 100, 200]")
            } catch (e: Exception) {
                // Fallback: show as system notification
                showSystemNotification(title, body)
            }
        }
    }

    /**
     * Play notification sound
     */
    @JavascriptInterface
    fun playNotificationSound(soundFile: String?) {
        try {
            // Create a notification just to play the sound, then cancel it
            val notification =
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    Notification.Builder(activity, "delivery_alerts")
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle("")
                        .setContentText("")
                        .setDefaults(Notification.DEFAULT_SOUND)
                        .build()
                } else {
                    @Suppress("DEPRECATION")
                    Notification.Builder(activity)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle("")
                        .setContentText("")
                        .setDefaults(Notification.DEFAULT_SOUND)
                        .build()
                }

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notificationId = 99999
            notificationManager.notify(notificationId, notification)

            // Cancel immediately to only play sound
            activity.window.decorView.postDelayed({
                notificationManager.cancel(notificationId)
            }, 100)

        } catch (e: Exception) {
            // Fallback: vibrate
            triggerVibration("[200]")
        }
    }

    /**
     * Trigger device vibration
     */
    @JavascriptInterface
    fun triggerVibration(pattern: String?) {
        try {
            val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

            if (vibrator.hasVibrator()) {
                // Parse pattern like "[200, 100, 200]" or use default
                val vibrationPattern = parseVibrationPattern(pattern)

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        android.os.VibrationEffect.createWaveform(
                            vibrationPattern,
                            -1
                        )
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(vibrationPattern, -1)
                }
            }
        } catch (e: Exception) {
            // Ignore vibration errors
        }
    }

    /**
     * Handle status change notifications
     */
    @JavascriptInterface
    fun notifyStatusChange(orderId: String, status: String, payloadJson: String?) {
        activity.runOnUiThread {
            try {
                // Send to WebView for UI updates
                val jsData = payloadJson ?: "{}"
                val js =
                    "window.onMobileStatusChange && window.onMobileStatusChange('$orderId', '$status', $jsData)"
                webView?.evaluateJavascript(js, null)

                // Show system notification for important status changes
                val importantStatuses = listOf("confirmed", "picked_up", "delivered", "cancelled")
                if (status in importantStatuses) {
                    val title = "Order Update"
                    val body = "Order $orderId is now ${status.replace("_", " ")}"
                    showSystemNotification(title, body)
                    playNotificationSound("status_change")
                }

            } catch (e: Exception) {
                // Fallback: show toast
                Toast.makeText(activity, "Order $orderId: $status", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Helper method to show system notification
     */
    private fun showSystemNotification(title: String, body: String) {
        try {
            val notification =
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    Notification.Builder(activity, "delivery_alerts")
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setDefaults(Notification.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .build()
                } else {
                    @Suppress("DEPRECATION")
                    Notification.Builder(activity)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setDefaults(Notification.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .build()
                }

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(System.currentTimeMillis().toInt(), notification)

        } catch (e: Exception) {
            Toast.makeText(activity, "$title: $body", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * Parse vibration pattern from string like "[200, 100, 200]"
     */
    private fun parseVibrationPattern(pattern: String?): LongArray {
        return try {
            if (pattern.isNullOrBlank()) {
                longArrayOf(0, 200, 100, 200) // Default pattern
            } else {
                // Remove brackets and split by comma
                val cleanPattern = pattern.trim().removeSurrounding("[", "]")
                val parts = cleanPattern.split(",").map { it.trim().toLong() }

                // Ensure pattern starts with 0 for vibration patterns
                if (parts.isNotEmpty() && parts[0] != 0L) {
                    longArrayOf(0) + parts.toLongArray()
                } else {
                    parts.toLongArray()
                }
            }
        } catch (e: Exception) {
            longArrayOf(0, 200, 100, 200) // Default pattern on error
        }
    }
}