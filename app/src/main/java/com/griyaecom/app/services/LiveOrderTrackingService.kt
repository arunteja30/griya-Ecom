package com.griyaecom.app.services

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.firebase.database.*
import com.griyaecom.app.MainActivity
import com.griyaecom.app.R

/**
 * Foreground service for live order tracking
 * Provides persistent notifications and real-time updates
 */
class LiveOrderTrackingService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "live_order_tracking"
        private const val CHANNEL_NAME = "Live Order Tracking"

        fun startService(context: Context, orderId: String) {
            val intent = Intent(context, LiveOrderTrackingService::class.java)
            intent.putExtra("order_id", orderId)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, LiveOrderTrackingService::class.java)
            context.stopService(intent)
        }
    }

    private var database: FirebaseDatabase? = null
    private var orderRef: DatabaseReference? = null
    private var riderLocationRef: DatabaseReference? = null
    private var orderListener: ValueEventListener? = null
    private var locationListener: ValueEventListener? = null

    private var currentOrderId: String? = null
    private var currentRiderId: String? = null
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
            "Live Order Tracking",
            "Tracking your order in real-time...",
            NotificationCompat.PRIORITY_LOW
        )

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun setupOrderTracking(orderId: String) {
        // Listen to order updates
        orderRef = database?.getReference("orders")?.child(orderId)
        orderListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val order = snapshot.getValue(Order::class.java)
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

    private fun setupRiderTracking(riderId: String) {
        if (currentRiderId == riderId) return // Already tracking this rider

        // Remove previous listener
        riderLocationRef?.removeEventListener(locationListener!!)

        currentRiderId = riderId
        riderLocationRef = database?.getReference("riderLocations")?.child(riderId)
        locationListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val location = snapshot.getValue(RiderLocation::class.java)
                if (location != null) {
                    handleLocationUpdate(location)
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Handle error
            }
        }
        riderLocationRef?.addValueEventListener(locationListener!!)
    }

    private fun handleOrderUpdate(order: Order) {
        // Update rider tracking if rider changed
        if (order.riderId != null && order.riderId != currentRiderId) {
            setupRiderTracking(order.riderId!!)
        }

        // Update persistent notification
        updatePersistentNotification(order)

        // Send live update to web app
        sendLiveUpdateToWebApp(order)

        // Check if tracking should stop
        if (shouldStopTracking(order.status)) {
            stopSelf()
        }
    }

    private fun handleLocationUpdate(location: RiderLocation) {
        // Send location update to web app
        sendLocationUpdateToWebApp(location)
    }

    private fun updatePersistentNotification(order: Order) {
        val statusMessage = getStatusMessage(order.status)
        val title = "Order #${order.id}"

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
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("action", "view_live_order")
            putExtra("order_id", currentOrderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(priority)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(
                android.R.drawable.ic_menu_view,
                "Track Order",
                pendingIntent
            )
            .build()
    }

    private fun sendLiveUpdateToWebApp(order: Order) {
        val jsCode = """
            if (window.handleLiveOrderUpdate) {
                window.handleLiveOrderUpdate({
                    orderId: '${order.id}',
                    status: '${order.status}',
                    customerName: '${order.customerName}',
                    riderId: '${order.riderId ?: ""}',
                    timestamp: ${System.currentTimeMillis()}
                });
            }
        """.trimIndent()

        // Send to MainActivity if available
        MainActivity.getInstance()?.runOnUiThread {
            MainActivity.getInstance()?.evaluateJavascript(jsCode)
        }
    }

    private fun sendLocationUpdateToWebApp(location: RiderLocation) {
        val jsCode = """
            if (window.handleLiveLocationUpdate) {
                window.handleLiveLocationUpdate({
                    riderId: '$currentRiderId',
                    lat: ${location.lat},
                    lng: ${location.lng},
                    timestamp: ${location.ts}
                });
            }
        """.trimIndent()

        MainActivity.getInstance()?.runOnUiThread {
            MainActivity.getInstance()?.evaluateJavascript(jsCode)
        }

    }

    private fun getStatusMessage(status: String): String {
        return when (status) {
            "ASSIGNED" -> "Order assigned to delivery partner"
            "ACCEPTED" -> "Delivery partner accepted your order"
            "PREPARING" -> "Your order is being prepared"
            "READY_FOR_PICKUP" -> "Order is ready for pickup"
            "PICKED_UP" -> "Your order has been picked up"
            "ON_THE_WAY" -> "Your order is on the way"
            "REACHED_CUSTOMER" -> "Delivery partner has reached"
            "DELIVERED" -> "Order delivered successfully"
            else -> "Order status: $status"
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
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live order tracking notifications"
                setSound(null, null)
                enableVibration(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        orderRef?.removeEventListener(orderListener!!)
        riderLocationRef?.removeEventListener(locationListener!!)
    }

    // Data classes
    data class Order(
        val id: String = "",
        val status: String = "",
        val customerName: String = "",
        val riderId: String? = null,
        val amount: Double = 0.0
    )

    data class RiderLocation(
        val lat: Double = 0.0,
        val lng: Double = 0.0,
        val ts: Long = 0
    )
}