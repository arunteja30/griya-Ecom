package com.griyaecom.seller.services

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.firebase.database.*
import com.griyaecom.seller.MainActivity

/**
 * Live order management service for seller app
 */
class LiveSellerTrackingService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 3001
        private const val CHANNEL_ID = "live_seller_tracking"
        private const val CHANNEL_NAME = "Live Order Management"

        fun startService(context: Context) {
            val intent = Intent(context, LiveSellerTrackingService::class.java)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, LiveSellerTrackingService::class.java)
            context.stopService(intent)
        }
    }

    private var database: FirebaseDatabase? = null
    private var ordersRef: DatabaseReference? = null
    private var ordersListener: ChildEventListener? = null

    private var notificationManager: NotificationManager? = null
    private var activeOrders = mutableMapOf<String, SellerOrder>()

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        database = FirebaseDatabase.getInstance()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundTracking()
        setupOrdersTracking()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundTracking() {
        val notification = createPersistentNotification(
            "Store Management",
            "Monitoring live orders...",
            NotificationCompat.PRIORITY_LOW
        )

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun setupOrdersTracking() {
        ordersRef = database?.getReference("orders")
        ordersListener = object : ChildEventListener {
            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                val order = snapshot.getValue(SellerOrder::class.java)
                if (order != null && isActiveOrder(order.status)) {
                    activeOrders[order.id] = order
                    handleNewOrder(order)
                    updatePersistentNotification()
                }
            }

            override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {
                val order = snapshot.getValue(SellerOrder::class.java)
                if (order != null) {
                    if (isActiveOrder(order.status)) {
                        activeOrders[order.id] = order
                        handleOrderUpdate(order)
                    } else {
                        activeOrders.remove(order.id)
                    }
                    updatePersistentNotification()
                }
            }

            override fun onChildRemoved(snapshot: DataSnapshot) {
                val order = snapshot.getValue(SellerOrder::class.java)
                if (order != null) {
                    activeOrders.remove(order.id)
                    updatePersistentNotification()
                }
            }

            override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
            override fun onCancelled(error: DatabaseError) {}
        }
        ordersRef?.addChildEventListener(ordersListener!!)
    }

    private fun handleNewOrder(order: SellerOrder) {
        // Send notification for new order
        sendNewOrderNotification(order)
        sendLiveUpdateToWebApp(order, "NEW_ORDER")
    }

    private fun handleOrderUpdate(order: SellerOrder) {
        sendLiveUpdateToWebApp(order, "ORDER_UPDATE")
    }

    private fun sendNewOrderNotification(order: SellerOrder) {
        val notification = NotificationCompat.Builder(this, "seller_notifications")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("New Order #${order.id}")
            .setContentText("${order.customerName} - ₹${order.amount}")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        notificationManager?.notify(order.id.hashCode(), notification)
    }

    private fun updatePersistentNotification() {
        val activeCount = activeOrders.size
        val title = "Store Management"
        val message = when (activeCount) {
            0 -> "No active orders"
            1 -> "1 active order"
            else -> "$activeCount active orders"
        }

        val notification = createPersistentNotification(
            title,
            message,
            NotificationCompat.PRIORITY_LOW
        )

        notificationManager?.notify(NOTIFICATION_ID, notification)
    }

    private fun createPersistentNotification(
        title: String,
        message: String,
        priority: Int
    ): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("action", "view_active_orders")
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

        // Add quick action for new orders
        if (activeOrders.isNotEmpty()) {
            val quickActionIntent = Intent(this, MainActivity::class.java).apply {
                putExtra("action", "quick_view_orders")
            }
            val quickActionPendingIntent = PendingIntent.getActivity(
                this,
                1,
                quickActionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(0, "View Orders", quickActionPendingIntent)
        }

        return builder.build()
    }

    private fun sendLiveUpdateToWebApp(order: SellerOrder, updateType: String) {
        val jsCode = """
            if (window.handleLiveSellerUpdate) {
                window.handleLiveSellerUpdate({
                    updateType: '$updateType',
                    orderId: '${order.id}',
                    status: '${order.status}',
                    customerName: '${order.customerName}',
                    amount: ${order.amount},
                    timestamp: ${System.currentTimeMillis()},
                    activeOrderCount: ${activeOrders.size}
                });
            }
        """.trimIndent()

        // Send to MainActivity if available
        // You'll need to implement a way to access the current activity
    }

    private fun isActiveOrder(status: String): Boolean {
        return status in listOf(
            "PLACED", "ASSIGNED", "ACCEPTED", "PREPARING",
            "READY_FOR_PICKUP", "PICKED_UP", "ON_THE_WAY"
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live order management notifications"
                setSound(null, null)
                enableVibration(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ordersRef?.removeEventListener(ordersListener!!)
    }

    data class SellerOrder(
        val id: String = "",
        val status: String = "",
        val customerName: String = "",
        val amount: Double = 0.0
    )
}
