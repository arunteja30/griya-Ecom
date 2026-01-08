package com.mat.theypodelivery

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresPermission
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.database.FirebaseDatabase

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var orderId: String? = null
    private val database = FirebaseDatabase.getInstance()
    private lateinit var notificationManager: NotificationManager
    private var locationUpdateCount = 0

    companion object {
        const val ACTION_START_TRACKING = "START_TRACKING"
        const val ACTION_STOP_TRACKING = "STOP_TRACKING"
        const val ACTION_STOP_FROM_NOTIFICATION = "STOP_FROM_NOTIFICATION"
        const val EXTRA_ORDER_ID = "ORDER_ID"
        const val NOTIFICATION_CHANNEL_ID = "location_tracking_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(NotificationManager::class.java)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRACKING -> {
                orderId = intent.getStringExtra(EXTRA_ORDER_ID)
                startForeground(NOTIFICATION_ID, createNotification())
                try {
                    startLocationUpdates()
                } catch (_: SecurityException) {
                    // Handle permission issue
                    stopSelf()
                }
            }

            ACTION_STOP_TRACKING, ACTION_STOP_FROM_NOTIFICATION -> {
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    @RequiresPermission(anyOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            5000L // Update every 5 seconds
        ).apply {
            setMinUpdateIntervalMillis(3000L)
            setWaitForAccurateLocation(false)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    locationUpdateCount++
                    updateLocationToFirebase(location)
                    updateNotification(location)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun updateLocationToFirebase(location: Location) {
        orderId?.let { id ->
            val locationData = mapOf(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy,
                "timestamp" to System.currentTimeMillis(),
                "speed" to location.speed,
                "bearing" to location.bearing
            )

            database.reference
                .child("activeOrders")
                .child(id)
                .child("location")
                .setValue(locationData)
                .addOnFailureListener { e ->
                    e.printStackTrace()
                }
        }
    }

    private fun createNotification(): Notification {
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

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("📍 Going For Delivery ")
            .setContentText("Order ${orderId?.take(8) ?: ""} ")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Tracking",
                stopPendingIntent
            )
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Your delivery location is being tracked. Tap to open app or stop tracking when delivery is complete.")
            )
            .build()
    }

    private fun updateNotification(location: Location) {
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
            .setContentTitle("📍 Live Delivery Tracking")
            .setContentText("Order ${orderId?.take(8) ?: "Unknown"} • ${locationUpdateCount} updates • $accuracy accuracy")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
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

        notificationManager.notify(NOTIFICATION_ID, updatedNotification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "🚚 Delivery Location Tracking",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description =
                    "Persistent notification shown while tracking delivery location in real-time"
                enableLights(true)
                enableVibration(false) // Don't vibrate for location updates
                setShowBadge(false) // Don't show badge count
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()

        // Stop location updates
        if (::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }

        // Clear location from Firebase
        orderId?.let { id ->
            database.reference
                .child("activeOrders")
                .child(id)
                .child("location")
                .removeValue()
        }

        // Stop foreground service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        Log.d("LocationService", "Location tracking stopped for order: $orderId")
    }

}
