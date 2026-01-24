package com.mat.theypodelivery

import android.R
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase

class LocationTrackingServiceNew : Service() {

    companion object {
        private const val SERVICE_ID = 1001
        private const val CHANNEL_ID = "delivery_tracking_channel"
        private const val CHANNEL_NAME = "Delivery Tracking"
        private const val LOCATION_UPDATE_INTERVAL = 10000L // 10 seconds
        private const val FASTEST_UPDATE_INTERVAL = 5000L   // 5 seconds

        const val ACTION_START_TRACKING = "START_TRACKING"
        const val ACTION_STOP_TRACKING = "STOP_TRACKING"
        const val EXTRA_PARTNER_ID = "partner_id"
        const val EXTRA_ORDER_ID = "order_id"

        fun startTracking(context: Context, partnerId: String, orderId: String? = null) {
            val intent = Intent(context, LocationTrackingServiceNew::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra(EXTRA_PARTNER_ID, partnerId)
                putExtra(EXTRA_ORDER_ID, orderId)
            }
            context.startForegroundService(intent)
        }

        fun stopTracking(context: Context) {
            val intent = Intent(context, LocationTrackingServiceNew::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private lateinit var locationCallback: LocationCallback
    private lateinit var notificationManager: NotificationManager

    private var partnerId: String? = null
    private var orderId: String? = null
    private var isTracking = false

    override fun onCreate() {
        super.onCreate()

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        createNotificationChannel()
        setupLocationRequest()
        setupLocationCallback()

        Log.d("LocationService", "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("LocationService", "onStartCommand called with action: ${intent?.action}")

        when (intent?.action) {
            ACTION_START_TRACKING -> {
                partnerId = intent.getStringExtra(EXTRA_PARTNER_ID)
                orderId = intent.getStringExtra(EXTRA_ORDER_ID)
                Log.d(
                    "LocationService",
                    "Starting tracking for partner: $partnerId, order: $orderId"
                )
                startLocationTracking()
            }

            ACTION_STOP_TRACKING -> {
                Log.d("LocationService", "Stopping tracking")
                stopLocationTracking()
                stopSelf()
            }

            else -> {
                Log.w("LocationService", "Unknown action: ${intent?.action}")
            }
        }

        // Restart service if killed by system
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Tracks delivery partner location in background"
                    setSound(null, null)
                    enableVibration(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
                Log.d("LocationService", "Notification channel created: $CHANNEL_ID")
            } catch (e: Exception) {
                Log.e("LocationService", "Error creating notification channel", e)
            }
        }
    }

    private fun setupLocationRequest() {
        locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_UPDATE_INTERVAL
        ).apply {
            setMinUpdateIntervalMillis(FASTEST_UPDATE_INTERVAL)
            setMinUpdateDistanceMeters(10f) // Update every 10 meters
            setWaitForAccurateLocation(true)
        }.build()
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)
                locationResult.lastLocation?.let { location ->
                    updateLocationInFirebase(location)
                    updateNotification(location)
                }
            }
        }
    }

    private fun startLocationTracking() {
        Log.d("LocationService", "startLocationTracking() called, isTracking: $isTracking")
        if (isTracking) return

        try {
            // Ensure notification channel exists
            createNotificationChannel()

            // Start foreground service with notification
            val notification = createTrackingNotification("Starting location tracking...")
            Log.d("LocationService", "Starting foreground service with notification")
            startForeground(SERVICE_ID, notification)

            // Request location updates
            Log.d("LocationService", "Requesting location updates")
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )

            isTracking = true
            Log.d(
                "LocationService",
                "Location tracking started successfully for partner: $partnerId"
            )

        } catch (securityException: SecurityException) {
            Log.e("LocationService", "Location permissions not granted", securityException)
            stopSelf()
        } catch (e: Exception) {
            Log.e("LocationService", "Error starting location tracking", e)
            stopSelf()
        }
    }

    private fun stopLocationTracking() {
        if (!isTracking) return

        fusedLocationClient.removeLocationUpdates(locationCallback)
        isTracking = false

        Log.d("LocationService", "Location tracking stopped")
    }

    private fun updateLocationInFirebase(location: Location) {
        val currentUser = FirebaseAuth.getInstance().currentUser
        val currentPartnerId = partnerId

        if (currentUser == null || currentPartnerId == null) {
            Log.w("LocationService", "User not authenticated or partner ID missing")
            return
        }

        val database = FirebaseDatabase.getInstance()
        val partnerRef = database.getReference("deliveryPartners").child(currentPartnerId)

        val locationData = mutableMapOf<String, Any>(
            "currentLocation" to mapOf(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy,
                "timestamp" to System.currentTimeMillis(),
                "speed" to if (location.hasSpeed()) location.speed else 0f,
                "bearing" to if (location.hasBearing()) location.bearing else 0f
            ),
            "lastLocationUpdate" to System.currentTimeMillis(),
            "isOnline" to true
        )

        // Add order ID if tracking an active delivery
        orderId?.let {
            locationData["activeOrderId"] = it
        }

        partnerRef.updateChildren(locationData)
            .addOnSuccessListener {
                Log.d("LocationService", "Location updated in Firebase")
            }
            .addOnFailureListener { exception ->
                Log.e("LocationService", "Failed to update location", exception)
            }
    }

    private fun createTrackingNotification(contentText: String): Notification {
        try {
            // Intent to open the app when notification is tapped
            val intent = Intent(this, HybridWebActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Intent to stop tracking
            val stopIntent = Intent(this, LocationTrackingServiceNew::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            val stopPendingIntent = PendingIntent.getService(
                this,
                0,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            return NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🚗 Delivery Tracking Active")
                .setContentText(contentText)
                .setSmallIcon(R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .addAction(
                    R.drawable.ic_menu_close_clear_cancel,
                    "Stop Tracking",
                    stopPendingIntent
                )
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .build()
        } catch (e: Exception) {
            Log.e("LocationService", "Error creating notification", e)
            // Fallback minimal notification
            return NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Delivery Tracking")
                .setContentText(contentText)
                .setSmallIcon(R.drawable.ic_dialog_info)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()
        }
    }

    private fun updateNotification(location: Location) {
        val accuracy = "±${location.accuracy.toInt()}m"
        val speed = if (location.hasSpeed()) {
            "${(location.speed * 3.6).toInt()} km/h" // Convert m/s to km/h
        } else "0 km/h"

        val contentText = "📍 Location: $accuracy | 🚀 Speed: $speed"

        val updatedNotification = createTrackingNotification(contentText)
        notificationManager.notify(SERVICE_ID, updatedNotification)
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocationTracking()
        Log.d("LocationService", "Service destroyed")
    }
}