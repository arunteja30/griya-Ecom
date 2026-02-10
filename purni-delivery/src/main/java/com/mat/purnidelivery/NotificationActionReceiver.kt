package com.mat.purnidelivery

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles notification actions (e.g., "View Order", "Accept")
 */
class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_VIEW_ORDER = "com.example.deliveryhybrid.VIEW_ORDER"
        const val ACTION_ACCEPT_ORDER = "com.example.deliveryhybrid.ACCEPT_ORDER"
        const val EXTRA_ORDER_ID = "order_id"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val orderId = intent.getStringExtra(EXTRA_ORDER_ID)
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        // Dismiss notification
        if (notificationId != -1) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(notificationId)
        }

        when (intent.action) {
            ACTION_VIEW_ORDER -> {
                // Open app to specific order
                val mainIntent = Intent(context, HybridWebActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra(EXTRA_ORDER_ID, orderId)
                }
                context.startActivity(mainIntent)
            }

            ACTION_ACCEPT_ORDER -> {
                // Could trigger auto-accept logic or just open app
                val mainIntent = Intent(context, HybridWebActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra(EXTRA_ORDER_ID, orderId)
                    putExtra("auto_accept", true)
                }
                context.startActivity(mainIntent)
            }
        }
    }
}
