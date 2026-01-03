package com.griyaecom.deliveryapp.services

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.firebase.database.*
import com.griyaecom.deliveryapp.DriverMainActivity

/**
 * Live delivery tracking service for foreground notifications
 */
class LiveDeliveryTrackingService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 2001
        private const val CHANNEL_ID = "live_delivery_tracking"
        private const val CHANNEL_NAME = "Live Delivery Tracking"

        fun startService(context: Context, orderId: String) {
            val intent = Intent(context, LiveDeliveryTrackingService::class.java)
            intent.putExtra("order_id", orderId)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, LiveDeliveryTrackingService::class.java)
            context.stopService(intent)
        }
    }

    private var database: FirebaseDatabase? = null
    private var orderRef: DatabaseReference? = null
    private var orderListener: ValueEventListener? = null

    private var currentOrderId: String? = null
    private var notificationManager: NotificationManager? = null

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        database = FirebaseDatabase.getInstance()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val orderId = intent?.getStringExtra("order_id")

        if (orderId != null) {
            currentOrderId = orderId
            startForegroundTracking()
            setupOrderTracking(orderId)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundTracking() {
        val notification = createPersistentNotification(
            "Active Delivery",
            "Tracking delivery in progress...",
            NotificationCompat.PRIORITY_LOW
        )

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun setupOrderTracking(orderId: String) {
        orderRef = database?.getReference("orders")?.child(orderId)
        orderListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val order = snapshot.getValue(DeliveryOrder::class.java)
                if (order != null) {
                    handleOrderUpdate(order)
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Handle error
            }
        }
        orderRef?.addValueEventListener(orderListener!!)
    }

    private fun handleOrderUpdate(order: DeliveryOrder) {
        updatePersistentNotification(order)
        sendLiveUpdateToWebApp(order)

        if (shouldStopTracking(order.status)) {
            stopSelf()
        }
    }

    private fun updatePersistentNotification(order: DeliveryOrder) {
        val statusMessage = getDeliveryStatusMessage(order.status)
        val title = "Delivery #${order.id}"

        val notification = createPersistentNotification(
            title,
            statusMessage,
            NotificationCompat.PRIORITY_DEFAULT
        )

        notificationManager?.notify(NOTIFICATION_ID, notification)
    }

    private fun createPersistentNotification(
        title: String,
        message: String,
        priority: Int
    ): Notification {
        val intent = Intent(this, DriverMainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("action", "view_active_delivery")
            putExtra("order_id", currentOrderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(priority)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)

        // Add action buttons based on order status
        when (getCurrentOrderStatus()) {
            "ASSIGNED" -> {
                addActionButton(builder, "Accept", "accept_order")
                addActionButton(builder, "Decline", "decline_order")
            }
            "ACCEPTED" -> {
                addActionButton(builder, "Reached Store", "reached_store")
            }
            "READY_FOR_PICKUP" -> {
                addActionButton(builder, "Picked Up", "picked_up")
            }
            "ON_THE_WAY" -> {
                addActionButton(builder, "Delivered", "mark_delivered")
            }
        }

        return builder.build()
    }

    private fun addActionButton(
        builder: NotificationCompat.Builder,
        label: String,
        action: String
    ) {
        val intent = Intent(this, DriverMainActivity::class.java).apply {
            putExtra("action", action)
            putExtra("order_id", currentOrderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        builder.addAction(0, label, pendingIntent)
    }

    private fun sendLiveUpdateToWebApp(order: DeliveryOrder) {
        val jsCode = """
            if (window.handleLiveDeliveryUpdate) {
                window.handleLiveDeliveryUpdate({
                    orderId: '${order.id}',
                    status: '${order.status}',
                    customerName: '${order.customerName}',
                    customerPhone: '${order.customerPhone}',
                    pickupAddress: '${order.pickupAddress}',
                    dropAddress: '${order.dropAddress}',
                    timestamp: ${System.currentTimeMillis()}
                });
            }
        """.trimIndent()

        // Send to DriverMainActivity if available
        // You'll need to implement a way to access the current activity
    }

    private fun getCurrentOrderStatus(): String {
        // Return current order status - you'll need to implement this
        return "ASSIGNED" // placeholder
    }

    private fun getDeliveryStatusMessage(status: String): String {
        return when (status) {
            "ASSIGNED" -> "New delivery assigned to you"
            "ACCEPTED" -> "Accepted - Go to pickup location"
            "PREPARING" -> "Order being prepared"
            "READY_FOR_PICKUP" -> "Ready for pickup"
            "PICKED_UP" -> "Order picked up - Deliver to customer"
            "ON_THE_WAY" -> "On the way to customer"
            "REACHED_CUSTOMER" -> "Reached customer location"
            "DELIVERED" -> "Delivery completed"
            else -> "Delivery status: $status"
        }
    }

    private fun shouldStopTracking(status: String): Boolean {
        return status in listOf("DELIVERED", "CANCELLED")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Live delivery tracking notifications"
                setSound(null, null)
                enableVibration(true)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        orderRef?.removeEventListener(orderListener!!)
    }

    data class DeliveryOrder(
        val id: String = "",
        val status: String = "",
        val customerName: String = "",
        val customerPhone: String = "",
        val pickupAddress: String = "",
        val dropAddress: String = "",
        val amount: Double = 0.0
    )
}
