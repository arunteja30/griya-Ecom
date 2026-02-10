package com.mat.purni

import android.R
import android.app.Activity
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast

/**
 * Mobile notification bridge for customer app.
 * Implements window.mobileNotificationBridge interface from customer-web app.
 */
class MobileNotificationBridge(
    private val activity: Activity,
    private val webView: WebView? = null
) {

    /**
     * Show bottom sheet notification in the WebView (for order updates)
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

                // Gentle vibration for customer notifications
                triggerVibration("[100, 50, 100]")
            } catch (e: Exception) {
                // Fallback: show as system notification
                showSystemNotification(title, body)
            }
        }
    }

    /**
     * Play notification sound for order updates
     */
    @JavascriptInterface
    fun playNotificationSound(soundFile: String?) {
        try {
            // Create a notification just to play the sound, then cancel it
            val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(activity, "customer_alerts")
                    .setSmallIcon(R.drawable.ic_dialog_info)
                    .setContentTitle("")
                    .setContentText("")
                    .setDefaults(Notification.DEFAULT_SOUND)
                    .build()
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(activity)
                    .setSmallIcon(R.drawable.ic_dialog_info)
                    .setContentTitle("")
                    .setContentText("")
                    .setDefaults(Notification.DEFAULT_SOUND)
                    .build()
            }

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notificationId = 88888
            notificationManager.notify(notificationId, notification)

            // Cancel immediately to only play sound
            activity.window.decorView.postDelayed({
                notificationManager.cancel(notificationId)
            }, 100)

        } catch (e: Exception) {
            // Fallback: gentle vibrate for customers
            triggerVibration("[100]")
        }
    }

    /**
     * Trigger device vibration (gentler for customer app)
     */
    @JavascriptInterface
    fun triggerVibration(pattern: String?) {
        try {
            val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

            if (vibrator.hasVibrator()) {
                // Parse pattern like "[100, 50, 100]" or use gentle default
                val vibrationPattern = parseVibrationPattern(pattern)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(vibrationPattern, -1))
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
     * Handle order status change notifications for customers
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

                // Show system notification for customer-relevant status changes
                val customerImportantStatuses =
                    listOf("confirmed", "preparing", "picked_up", "delivered")
                if (status in customerImportantStatuses) {
                    val title = getCustomerFriendlyTitle(status)
                    val body = getCustomerFriendlyMessage(orderId, status)
                    showSystemNotification(title, body)
                    playNotificationSound("order_update")
                }

            } catch (e: Exception) {
                // Fallback: show toast
                Toast.makeText(activity, "Order update: $status", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Start order tracking for iOS bridge compatibility
     */
    @JavascriptInterface
    fun startOrderTracking(orderId: String) {
        activity.runOnUiThread {
            try {
                // Send to WebView
                val js =
                    "window.startNativeOrderTracking && window.startNativeOrderTracking('$orderId')"
                webView?.evaluateJavascript(js, null)
            } catch (e: Exception) {
                // Fallback
                Toast.makeText(activity, "Started tracking order $orderId", Toast.LENGTH_SHORT)
                    .show()
            }
        }
    }

    /**
     * Stop order tracking for iOS bridge compatibility
     */
    @JavascriptInterface
    fun stopOrderTracking() {
        activity.runOnUiThread {
            try {
                // Send to WebView
                val js = "window.stopNativeOrderTracking && window.stopNativeOrderTracking()"
                webView?.evaluateJavascript(js, null)
            } catch (e: Exception) {
                // Fallback
                Toast.makeText(activity, "Stopped order tracking", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Helper method to show system notification
     */
    private fun showSystemNotification(title: String, body: String) {
        try {
            val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(activity, "customer_alerts")
                    .setSmallIcon(R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setDefaults(Notification.DEFAULT_SOUND)
                    .setAutoCancel(true)
                    .build()
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(activity)
                    .setSmallIcon(R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setDefaults(Notification.DEFAULT_SOUND)
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
     * Get customer-friendly notification title
     */
    private fun getCustomerFriendlyTitle(status: String): String {
        return when (status) {
            "confirmed" -> "Order Confirmed! 🎉"
            "preparing" -> "Order Being Prepared 👨‍🍳"
            "picked_up" -> "Driver is on the way! 🚗"
            "delivered" -> "Order Delivered! ✅"
            else -> "Order Update"
        }
    }

    /**
     * Get customer-friendly notification message
     */
    private fun getCustomerFriendlyMessage(orderId: String, status: String): String {
        return when (status) {
            "confirmed" -> "Your order has been confirmed and will be prepared soon."
            "preparing" -> "Your order is being prepared by the restaurant."
            "picked_up" -> "Your order has been picked up and is on its way to you."
            "delivered" -> "Your order has been successfully delivered. Enjoy your meal!"
            else -> "Order $orderId status updated to ${status.replace("_", " ")}."
        }
    }

    /**
     * Parse vibration pattern from string like "[100, 50, 100]" (gentler defaults)
     */
    private fun parseVibrationPattern(pattern: String?): LongArray {
        return try {
            if (pattern.isNullOrBlank()) {
                longArrayOf(0, 100, 50, 100) // Gentle default pattern for customers
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
            longArrayOf(0, 100, 50, 100) // Gentle default pattern on error
        }
    }
}