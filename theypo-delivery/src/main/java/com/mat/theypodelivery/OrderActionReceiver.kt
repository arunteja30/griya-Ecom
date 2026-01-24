package com.mat.theypodelivery

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

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

        val db = FirebaseFirestore.getInstance()

        // Start batch update
        val batch = db.batch()

        // Update order status to accepted
        val orderRef = db.collection("orders").document(orderId)
        batch.update(
            orderRef, mapOf(
                "status" to "accepted",
                "deliveryPartnerId" to userId,
                "acceptedAt" to FieldValue.serverTimestamp(),
                "acceptedBy" to userId,
                "deliveryPartnerAcceptedAt" to FieldValue.serverTimestamp()
            )
        )

        // Update delivery partner status to busy
        val deliveryPartnerRef = db.collection("deliveryPartners").document(userId)
        batch.update(
            deliveryPartnerRef, mapOf(
                "status" to "busy",
                "currentOrderId" to orderId,
                "lastOrderAcceptedAt" to FieldValue.serverTimestamp(),
                "isAvailable" to false
            )
        )

        // Execute batch update
        batch.commit()
            .addOnSuccessListener {
                Log.d(TAG, "✅ Order accepted successfully in Firebase")

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

        val db = FirebaseFirestore.getInstance()

        // Update order to add this delivery partner to declined list
        val orderRef = db.collection("orders").document(orderId)
        orderRef.update(
            mapOf(
                "declinedBy" to FieldValue.arrayUnion(userId),
                "declinedAt" to FieldValue.serverTimestamp()
            )
        ).addOnSuccessListener {
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
        }.addOnFailureListener { e ->
            Log.e(TAG, "❌ Error declining order", e)
            showActionResultNotification(
                context,
                "Error Declining Order",
                "Failed to decline order. Please try again.",
                isSuccess = false
            )
        }

        // Update delivery partner activity
        val deliveryPartnerRef = db.collection("deliveryPartners").document(userId)
        deliveryPartnerRef.update(
            mapOf(
                "lastOrderDeclinedAt" to FieldValue.serverTimestamp(),
                "lastActive" to FieldValue.serverTimestamp()
            )
        )
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