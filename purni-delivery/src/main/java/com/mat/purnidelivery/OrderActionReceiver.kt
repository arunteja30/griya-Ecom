package com.mat.purnidelivery

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue

class OrderActionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "OrderActionReceiver"
        private const val ORDER_REQUEST_NOTIFICATION_ID = 3001
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val orderId = intent.getStringExtra("orderId") ?: return

        Log.d(TAG, "🎯 Order action received: $action for order: $orderId")

        when (action) {
            "ACCEPT_ORDER" -> acceptOrder(context, orderId)
            "DECLINE_ORDER" -> declineOrder(context, orderId)
        }

        // Clear the order request notification
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(ORDER_REQUEST_NOTIFICATION_ID)
    }

    private fun acceptOrder(context: Context, orderId: String) {
        Log.d(TAG, "✅ Accepting order: $orderId")

        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId == null) {
            Log.e(TAG, "❌ User not authenticated")
            return
        }

        val database = FirebaseDatabase.getInstance()

        // Prepare order updates
        val orderUpdates = mapOf(
            "orders/$orderId/status" to "accepted",
            "orders/$orderId/deliveryPartnerId" to userId,
            "orders/$orderId/acceptedAt" to ServerValue.TIMESTAMP,
            "orders/$orderId/acceptedBy" to userId,
            "orders/$orderId/deliveryPartnerAcceptedAt" to ServerValue.TIMESTAMP,

            // Update delivery partner status
            "deliveryPartners/$userId/status" to "busy",
            "deliveryPartners/$userId/currentOrderId" to orderId,
            "deliveryPartners/$userId/lastOrderAcceptedAt" to ServerValue.TIMESTAMP,
            "deliveryPartners/$userId/isAvailable" to false
        )

        // Execute batch update to RTDB
        database.reference.updateChildren(orderUpdates)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Order accepted successfully in Firebase RTDB")

                // Send acceptance confirmation to app
                sendOrderActionToApp(context, orderId, "accepted")

                // Open app to show order details
                openAppToOrderDetails(context, orderId)

                // Show success notification
                showActionResultNotification(
                    context,
                    "Order Accepted! 🎉",
                    "Order $orderId accepted. Navigate to restaurant to pick up.",
                    isSuccess = true
                )
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Error accepting order", e)
                showActionResultNotification(
                    context,
                    "Error Accepting Order",
                    "Failed to accept order. Please try again.",
                    isSuccess = false
                )
            }
    }

    private fun declineOrder(context: Context, orderId: String) {
        Log.d(TAG, "❌ Declining order: $orderId")

        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId == null) {
            Log.e(TAG, "❌ User not authenticated")
            return
        }

        val database = FirebaseDatabase.getInstance()

        // First, get current declined list and add new user
        val orderRef = database.getReference("orders").child(orderId)

        // Get current declinedBy array and add this user
        orderRef.child("declinedBy").get().addOnSuccessListener { snapshot ->
            val currentDeclined = snapshot.value as? List<String> ?: listOf()
            val updatedDeclined = currentDeclined.toMutableList()
            if (!updatedDeclined.contains(userId)) {
                updatedDeclined.add(userId)
            }

            // Prepare order updates
            val orderUpdates = mapOf(
                "orders/$orderId/declinedBy" to updatedDeclined,
                "orders/$orderId/declinedAt" to ServerValue.TIMESTAMP,

                // Update delivery partner activity
                "deliveryPartners/$userId/lastOrderDeclinedAt" to ServerValue.TIMESTAMP,
                "deliveryPartners/$userId/lastActive" to ServerValue.TIMESTAMP
            )

            // Execute batch update to RTDB
            database.reference.updateChildren(orderUpdates)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Order declined successfully")

                    // Send decline confirmation to app
                    sendOrderActionToApp(context, orderId, "declined")

                    // Show brief decline notification
                    showActionResultNotification(
                        context,
                        "Order Declined",
                        "Order declined. Waiting for new orders...",
                        isSuccess = true
                    )
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "❌ Error declining order", e)
                    showActionResultNotification(
                        context,
                        "Error Declining Order",
                        "Failed to decline order. Please try again.",
                        isSuccess = false
                    )
                }
        }.addOnFailureListener { e ->
            Log.e(TAG, "❌ Error getting current declined list", e)
            showActionResultNotification(
                context,
                "Error Declining Order",
                "Failed to decline order. Please try again.",
                isSuccess = false
            )
        }
    }

    private fun openAppToOrderDetails(context: Context, orderId: String) {
        val intent = Intent(context, HybridWebActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("deep_link", "/order-details/$orderId")
            putExtra("order_id", orderId)
            putExtra("auto_navigate", true)
            putExtra("show_order_accepted", true)
        }

        try {
            context.startActivity(intent)
            Log.d(TAG, "✅ App opened to order details: $orderId")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening app", e)
        }
    }

    private fun sendOrderActionToApp(context: Context, orderId: String, action: String) {
        // Send broadcast to app if it's open
        val intent = Intent("ORDER_ACTION_COMPLETED").apply {
            putExtra("orderId", orderId)
            putExtra("action", action)
            putExtra("timestamp", System.currentTimeMillis())
        }
        context.sendBroadcast(intent)
        Log.d(TAG, "📡 Order action broadcast sent: $action for $orderId")
    }

    private fun showActionResultNotification(
        context: Context,
        title: String,
        body: String,
        isSuccess: Boolean
    ) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(context, HybridWebActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            context,
            System.currentTimeMillis().toInt(),
            intent,
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification =
            androidx.core.app.NotificationCompat.Builder(context, "general_notifications")
                .setSmallIcon(if (isSuccess) android.R.drawable.ic_dialog_info else android.R.drawable.ic_dialog_alert)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setTimeoutAfter(5_000) // Auto-dismiss after 5 seconds
                .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}