package com.mat.doothadriver

import android.R
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class RideRequestNotificationService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "RideRequestNotification"
        private const val RIDE_REQUEST_CHANNEL = "ride_requests"
        private const val GENERAL_CHANNEL = "general_notifications"
        private const val RIDE_REQUEST_NOTIFICATION_ID = 2001
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM Token refreshed: $token")

        // Save token to Firestore for this driver
        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId != null) {
            saveFCMToken(userId, token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "Message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val messageType = data["type"] ?: "general"

        when (messageType) {
            "ride_request" -> handleRideRequest(data)
            "ride_cancelled" -> handleRideCancelled(data)
            "payment_update" -> handlePaymentUpdate(data)
            else -> handleGeneralNotification(remoteMessage)
        }
    }

    private fun handleRideRequest(data: Map<String, String>) {
        val rideId = data["rideId"] ?: return
        val pickupAddress = data["pickupAddress"] ?: "Unknown location"
        val dropoffAddress = data["dropoffAddress"] ?: "Unknown destination"
        val customerName = data["customerName"] ?: "Customer"
        val estimatedFare = data["estimatedFare"] ?: "₹0"
        val distance = data["distance"] ?: "0 km"
        val timeToPickup = data["timeToPickup"] ?: "Unknown"

        Log.d(TAG, "🚗 New ride request: $rideId")

        // Create high-priority notification for ride request
        val title = "🚗 New Ride Request!"
        val body =
            "💰 $estimatedFare • 📍 $distance away\n📍 From: $pickupAddress\n📍 To: $dropoffAddress"

        showRideRequestNotification(
            rideId = rideId,
            title = title,
            body = body,
            pickupAddress = pickupAddress,
            dropoffAddress = dropoffAddress,
            fare = estimatedFare,
            distance = distance,
            timeToPickup = timeToPickup
        )

        // Also send to WebView if app is open
        sendRideRequestToWebView(rideId, data)
    }

    private fun showRideRequestNotification(
        rideId: String,
        title: String,
        body: String,
        pickupAddress: String,
        dropoffAddress: String,
        fare: String,
        distance: String,
        timeToPickup: String
    ) {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Intent to open app and show ride request
        val openAppIntent = Intent(this, UberDriverActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra("ride_request_id", rideId)
            putExtra("deep_link", "/ride-request/$rideId")
            putExtra("auto_open_request", true)
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this,
            rideId.hashCode(),
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent for accepting ride (direct action)
        val acceptIntent = Intent(this, RideActionReceiver::class.java).apply {
            action = "ACCEPT_RIDE"
            putExtra("rideId", rideId)
        }
        val acceptPendingIntent = PendingIntent.getBroadcast(
            this,
            (rideId + "_accept").hashCode(),
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent for declining ride
        val declineIntent = Intent(this, RideActionReceiver::class.java).apply {
            action = "DECLINE_RIDE"
            putExtra("rideId", rideId)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            this,
            (rideId + "_decline").hashCode(),
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Create expanded notification with actions
        val notification = NotificationCompat.Builder(this, RIDE_REQUEST_CHANNEL)
            .setSmallIcon(R.drawable.ic_menu_directions) // Use proper ride icon
            .setContentTitle(title)
            .setContentText("Tap to view details")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("$body\n\n⏱️ $timeToPickup to pickup")
            )
            .setContentIntent(openAppPendingIntent)
            .setAutoCancel(false) // Keep notification until acted upon
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL) // Highest priority
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setTimeoutAfter(30_000) // Auto-dismiss after 30 seconds
            // Action buttons
            .addAction(
                R.drawable.ic_menu_call,
                "✅ ACCEPT ($fare)",
                acceptPendingIntent
            )
            .addAction(
                R.drawable.ic_menu_close_clear_cancel,
                "❌ DECLINE",
                declinePendingIntent
            )
            .build()

        // Make notification heads-up (full screen interruption)
        notification.flags = notification.flags or Notification.FLAG_INSISTENT

        notificationManager.notify(RIDE_REQUEST_NOTIFICATION_ID, notification)

        Log.d(TAG, "✅ Ride request notification shown for: $rideId")
    }

    private fun handleRideCancelled(data: Map<String, String>) {
        val rideId = data["rideId"] ?: return
        Log.d(TAG, "❌ Ride cancelled: $rideId")

        // Clear ride request notification
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(RIDE_REQUEST_NOTIFICATION_ID)

        // Show brief cancellation message
        showGeneralNotification(
            title = "Ride Cancelled",
            body = "The customer cancelled the ride request",
            channelId = GENERAL_CHANNEL
        )
    }

    private fun handlePaymentUpdate(data: Map<String, String>) {
        val amount = data["amount"] ?: "₹0"
        val status = data["status"] ?: "completed"

        showGeneralNotification(
            title = "💰 Payment Received",
            body = "You received $amount for your recent ride",
            channelId = GENERAL_CHANNEL
        )
    }

    private fun handleGeneralNotification(remoteMessage: RemoteMessage) {
        val title =
            remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "Uber Driver Update"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""

        showGeneralNotification(title, body, GENERAL_CHANNEL)
    }

    private fun showGeneralNotification(title: String, body: String, channelId: String) {
        val intent = Intent(this, UberDriverActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun sendRideRequestToWebView(rideId: String, data: Map<String, String>) {
        // Send to WebView via broadcast if app is open
        val intent = Intent("RIDE_REQUEST_RECEIVED").apply {
            putExtra("rideId", rideId)
            putExtra("data", data.toString())
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // High priority channel for ride requests
            val rideRequestChannel = NotificationChannel(
                RIDE_REQUEST_CHANNEL,
                "Ride Requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New ride requests from customers"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000)
                setBypassDnd(true) // Override Do Not Disturb
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC

                // Set custom sound
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                setSound(
                    soundUri, AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                )
            }

            // Normal priority for general notifications
            val generalChannel = NotificationChannel(
                GENERAL_CHANNEL,
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General app notifications"
                enableLights(true)
                enableVibration(true)
            }

            notificationManager.createNotificationChannel(rideRequestChannel)
            notificationManager.createNotificationChannel(generalChannel)
        }
    }

    private fun saveFCMToken(userId: String, token: String) {
        val db = FirebaseFirestore.getInstance()
        val driverRef = db.collection("drivers").document(userId)

        driverRef.update(
            mapOf(
                "fcmToken" to token,
                "fcmTokenUpdatedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                "lastActive" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
        ).addOnSuccessListener {
            Log.d(TAG, "✅ FCM token saved successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "❌ Error saving FCM token", e)
        }
    }
}