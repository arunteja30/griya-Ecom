package com.mat.theypo

import android.Manifest
import android.app.*
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresPermission
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.google.firebase.database.FirebaseDatabase

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var orderId: String? = null
    private var deliveryPartnerId: String? = null
    private val database = FirebaseDatabase.getInstance()
    private lateinit var notificationManager: NotificationManager
    private var locationUpdateCount = 0

    companion object {
        private const val TAG = "LocationService"
        const val ACTION_START_TRACKING = "START_TRACKING"
        const val ACTION_STOP_TRACKING = "STOP_TRACKING"
        const val ACTION_STOP_FROM_NOTIFICATION = "STOP_FROM_NOTIFICATION"
        const val EXTRA_ORDER_ID = "ORDER_ID"
        const val EXTRA_DELIVERY_PARTNER_ID = "deliveryPartnerId"
        const val NOTIFICATION_CHANNEL_ID = "location_tracking_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "LocationService onCreate called")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(NotificationManager::class.java)
        createNotificationChannel()
        Log.d(
            TAG,
            "LocationService initialized successfully - notificationManager: ${::notificationManager.isInitialized}"
        )
    }

    @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called with action: ${intent?.action}, startId: $startId")
        when (intent?.action) {
            ACTION_START_TRACKING -> {
                orderId = intent.getStringExtra(EXTRA_ORDER_ID)
                deliveryPartnerId = intent.getStringExtra(EXTRA_DELIVERY_PARTNER_ID)
                    ?: intent.getStringExtra("deliveryPartnerId") // Support both key formats
                Log.d(
                    TAG,
                    "Starting location tracking for order: $orderId, partnerId: $deliveryPartnerId"
                )
                startForeground(NOTIFICATION_ID, createNotification())
                Log.d(TAG, "Foreground service started with notification")
                try {
                    startLocationUpdates()
                    Log.i(TAG, "Location updates started successfully")
                } catch (e: SecurityException) {
                    Log.e(TAG, "SecurityException while starting location updates", e)
                    stopSelf()
                }
            }

            ACTION_STOP_TRACKING, ACTION_STOP_FROM_NOTIFICATION -> {
                Log.d(
                    TAG,
                    "Stopping location tracking for order: $orderId, partnerId: $deliveryPartnerId"
                )
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.i(TAG, "Location tracking stopped successfully")
            }
        }
        Log.d(TAG, "onStartCommand returning START_STICKY")
        return START_STICKY
    }

    @RequiresPermission(anyOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun startLocationUpdates() {
        Log.d(TAG, "Setting up location request")
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            60000L // Update every 5 seconds
        ).apply {
            setMinUpdateIntervalMillis(30000L)
            setWaitForAccurateLocation(false)
        }.build()

        Log.d(TAG, "Location request configured: interval=5000ms, minInterval=3000ms")

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    locationUpdateCount++
                    Log.d(
                        TAG,
                        "Location update #$locationUpdateCount received: lat=${location.latitude}, lng=${location.longitude}, accuracy=${location.accuracy}m"
                    )
                    updateLocationToFirebase(location)
                    updateNotification(location)
                } ?: Log.w(TAG, "LocationResult contains null location")
            }
        }

        try {
            Log.d(TAG, "Requesting location updates from FusedLocationProviderClient")
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.i(TAG, "Location updates requested successfully")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException when requesting location updates", e)
            throw e
        }
    }

    private fun stopLocationUpdates() {
        Log.d(TAG, "Stopping location updates")
        if (::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
            Log.d(TAG, "Location updates removed successfully")
        } else {
            Log.w(TAG, "LocationCallback not initialized, cannot stop updates")
        }
    }

    private fun updateLocationToFirebase(location: Location) {
        Log.d(TAG, "Updating location to Firebase for order: $orderId")
        orderId?.let { id ->
            val locationData = mapOf(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy,
                "timestamp" to System.currentTimeMillis(),
                "speed" to location.speed,
                "bearing" to location.bearing
            )

            Log.d(TAG, "Firebase location data: $locationData")

            database.reference
                .child("activeOrders")
                .child(id)
                .child("location")
                .setValue(locationData)
                .addOnSuccessListener {
                    Log.d(TAG, "Location updated to Firebase successfully")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to update location to Firebase", e)
                }
        } ?: Log.w(TAG, "OrderId is null, cannot update location to Firebase")
    }

    private fun createNotification(): Notification {
        Log.d(TAG, "Creating initial notification for order: $orderId")
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Stop tracking action
        val stopIntent = Intent(this, LocationService::class.java).apply {
            action = ACTION_STOP_FROM_NOTIFICATION
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("📍 Location Tracking Active")
            .setContentText("Order ${orderId?.take(8) ?: "Unknown"} is being tracked")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setSilent(true) // Prevent sound on initial creation
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Tracking",
                stopPendingIntent
            )
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Location tracking is active for your order. Tap to open app or stop tracking when complete.")
            )
            .build()

        Log.d(TAG, "Initial notification created successfully")
        return notification
    }

    private fun updateNotification(location: Location) {
        Log.d(TAG, "Updating notification with location data")
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Stop tracking action
        val stopIntent = Intent(this, LocationService::class.java).apply {
            action = ACTION_STOP_FROM_NOTIFICATION
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val accuracy =
            if (location.accuracy < 10) "High" else if (location.accuracy < 50) "Medium" else "Low"
        val speed =
            if (location.hasSpeed()) "${(location.speed * 3.6).toInt()} km/h" else "Stationary"

        val updatedNotification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("📍 Live Location Tracking")
            .setContentText("Order ${orderId?.take(8) ?: "Unknown"} • ${locationUpdateCount} updates • $accuracy accuracy")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setSilent(true) // Prevent sound on updates
            .setOnlyAlertOnce(true) // Only alert once, not on every update
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Tracking",
                stopPendingIntent
            )
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(
                        "📱 Speed: $speed\n🎯 Accuracy: $accuracy (${location.accuracy.toInt()}m)\n⏱️ Last update: ${
                            java.text.SimpleDateFormat.getTimeInstance().format(java.util.Date())
                        }"
                    )
            )
            .build()

        if (::notificationManager.isInitialized) {
            notificationManager.notify(NOTIFICATION_ID, updatedNotification)
            Log.d(
                TAG,
                "Notification updated silently with location info: speed=$speed, accuracy=$accuracy"
            )
        } else {
            Log.e(TAG, "NotificationManager not initialized, cannot update notification")
        }
    }

    private fun createNotificationChannel() {
        Log.d(TAG, "Creating notification channel")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "📍 Location Tracking",
                NotificationManager.IMPORTANCE_LOW // LOW importance prevents sound
            ).apply {
                description = "Ongoing location tracking notifications - silent by default"
                enableLights(false) // No LED
                enableVibration(false) // No vibration
                setSound(null, null) // No sound
                setShowBadge(false) // Don't show badge count
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Silent notification channel created successfully")
        } else {
            Log.d(TAG, "Android version < O, notification channel not required")
        }
    }

    override fun onBind(intent: Intent?): IBinder? {
        Log.d(TAG, "onBind called")
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "LocationService onDestroy called for order: $orderId")

        // Stop location updates
        if (::locationCallback.isInitialized) {
            Log.d(TAG, "Removing location updates")
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } else {
            Log.w(TAG, "LocationCallback not initialized during destroy")
        }

        // Clear location from Firebase
        orderId?.let { id ->
            Log.d(TAG, "Clearing location data from Firebase for order: $id")
            database.reference
                .child("activeOrders")
                .child(id)
                .child("location")
                .removeValue()
                .addOnSuccessListener {
                    Log.d(TAG, "Location data cleared from Firebase successfully")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to clear location data from Firebase", e)
                }
        } ?: Log.w(TAG, "OrderId is null, cannot clear Firebase location data")

        // Stop foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        Log.i(TAG, "Location tracking stopped and cleaned up for order: $orderId")
    }
}
