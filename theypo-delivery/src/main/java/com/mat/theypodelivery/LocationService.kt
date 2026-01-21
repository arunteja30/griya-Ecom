package com.mat.theypodelivery

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
    private var currentOrderId: String? = null
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
        private const val LOCATION_UPDATE_INTERVAL = 5000L // 5 seconds
        private const val FASTEST_LOCATION_UPDATE_INTERVAL = 3000L // 3 seconds
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "=== onStartCommand ===")
        Log.d(TAG, "Intent action: ${intent?.action}")
        Log.d(TAG, "Intent extras: ${intent?.extras?.keySet()?.joinToString(", ") ?: "none"}")

        when (intent?.action) {
            ACTION_START_TRACKING -> {
                currentOrderId = intent.getStringExtra("orderId")
                deliveryPartnerId = intent.getStringExtra("deliveryPartnerId")
                    ?: intent.getStringExtra(EXTRA_DELIVERY_PARTNER_ID) // Support both key formats

                Log.d(TAG, "Extracted parameters:")
                Log.d(TAG, "  - deliveryPartnerId: '$deliveryPartnerId'")
                Log.d(TAG, "  - currentOrderId: '$currentOrderId'")

                if (deliveryPartnerId == null) {
                    Log.w(
                        TAG,
                        "⚠️ WARNING: deliveryPartnerId is null - Firebase updates will fail!"
                    )
                }

                Log.d(TAG, "Starting foreground service with notification")
                startForeground(NOTIFICATION_ID, createNotification())
                
                try {
                    startLocationUpdates()
                    Log.i(TAG, "✅ Location updates started successfully")
                } catch (e: SecurityException) {
                    Log.e(TAG, "❌ SecurityException while starting location updates", e)
                    stopSelf()
                }
            }
            ACTION_STOP_TRACKING, ACTION_STOP_FROM_NOTIFICATION -> {
                Log.d(
                    TAG,
                    "Stopping tracking - Partner: $deliveryPartnerId, Order: $currentOrderId"
                )
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.i(TAG, "Location tracking stopped successfully")
            }
        }
        return START_STICKY
    }

    @RequiresPermission(anyOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun startLocationUpdates() {
        Log.d(TAG, "=== Starting Location Updates ===")
        Log.d(TAG, "Setting up location request with:")
        Log.d(TAG, "  - Priority: HIGH_ACCURACY")
        Log.d(TAG, "  - Interval: 5000ms")
        Log.d(TAG, "  - Min Interval: 3000ms")

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            5000L // Update every 5 seconds
        ).apply {
            setMinUpdateIntervalMillis(3000L)
            setWaitForAccurateLocation(false)
        }.build()

        Log.d(TAG, "Location request configured successfully")

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                Log.d(TAG, "=== Location Result Received ===")
                Log.d(TAG, "Number of locations: ${locationResult.locations.size}")

                locationResult.lastLocation?.let { location ->
                    locationUpdateCount++
                    Log.d(TAG, "Location Update #$locationUpdateCount:")
                    Log.d(TAG, "  - lat: ${location.latitude}")
                    Log.d(TAG, "  - lng: ${location.longitude}")
                    Log.d(TAG, "  - accuracy: ${location.accuracy}m")
                    Log.d(TAG, "  - provider: ${location.provider}")
                    Log.d(TAG, "  - time: ${location.time} (${java.util.Date(location.time)})")

                    updateLocationToFirebase(location)
                } ?: Log.w(TAG, "❌ LocationResult contains null location")
            }

            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                Log.d(TAG, "=== Location Availability Changed ===")
                Log.d(TAG, "Available: ${locationAvailability.isLocationAvailable}")
                if (!locationAvailability.isLocationAvailable) {
                    Log.w(TAG, "⚠️ Location is not available - GPS might be disabled")
                }
            }
        }

        try {
            Log.d(TAG, "=== Requesting Location Updates ===")
            Log.d(TAG, "Using FusedLocationProviderClient to request updates")
            Log.d(TAG, "Looper: Main")

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.i(TAG, "✅ Location updates requested successfully")
            Log.i(TAG, "Expecting location updates every 5 seconds...")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ SecurityException when requesting location updates", e)
            Log.e(TAG, "Check if location permissions are properly granted")
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "❌ Unexpected exception when requesting location updates", e)
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
        Log.d(TAG, "=== Firebase Update Attempt ===")
        Log.d(TAG, "Current deliveryPartnerId: $deliveryPartnerId")
        Log.d(TAG, "Current orderId: $currentOrderId")
        Log.d(
            TAG,
            "Location: lat=${location.latitude}, lng=${location.longitude}, accuracy=${location.accuracy}m"
        )

        val partnerId = deliveryPartnerId
        if (partnerId == null) {
            Log.e(TAG, "❌ CRITICAL: deliveryPartnerId is null - cannot update Firebase!")
            Log.e(TAG, "❌ Location updates will be skipped until deliveryPartnerId is provided")
            return
        }

        val locationData = hashMapOf<String, Any?>(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "accuracy" to location.accuracy,
            "speed" to location.speed,
            "heading" to location.bearing,
            "timestamp" to com.google.firebase.database.ServerValue.TIMESTAMP,
            "activeOrderId" to currentOrderId,
            "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
        )

        Log.d(TAG, "Preparing to update Firebase with data: $locationData")

        // Always update partner's current location (while online)
        val partnerPath = "deliveryPartners/$partnerId/currentLocation"
        Log.d(TAG, "Updating partner location at: $partnerPath")
        
        database.reference
            .child("deliveryPartners")
            .child(partnerId)
            .child("currentLocation")
            .setValue(locationData)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Partner location updated successfully at $partnerPath")
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "❌ Failed to update partner location at $partnerPath", error)
            }

        // If on active delivery, also update order location
        currentOrderId?.let { orderId ->
            val orderPath = "activeOrders/$orderId/location"
            Log.d(TAG, "Updating order location at: $orderPath")

            database.reference
                .child("activeOrders")
                .child(orderId)
                .child("location")
                .setValue(locationData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Order location updated successfully at $orderPath")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update order location at $orderPath", error)
                }
        } ?: Log.d(TAG, "No active order - skipping order location update")
    }

    private fun createNotification(): Notification {
        Log.d(TAG, "Creating notification for partner: $deliveryPartnerId, order: $currentOrderId")

        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val message = if (currentOrderId != null) {
            "Tracking delivery location"
        } else {
            "You are online - Location tracking active"
        }

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Delivery Partner Active")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Use your own icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true) // Prevent sound on initial creation
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        Log.d(TAG, "Notification created: $message")
        return notification
    }

    private fun createNotificationChannel() {
        Log.d(TAG, "Creating notification channel")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW // LOW importance prevents sound
            ).apply {
                description = "Tracks your location during deliveries"
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
        Log.d(
            TAG,
            "LocationService onDestroy called for partner: $deliveryPartnerId, order: $currentOrderId"
        )

        // Stop location updates
        if (::locationCallback.isInitialized) {
            Log.d(TAG, "Removing location updates")
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } else {
            Log.w(TAG, "LocationCallback not initialized during destroy")
        }

        // Clear location from Firebase for delivery partner
        deliveryPartnerId?.let { partnerId ->
            Log.d(TAG, "Clearing partner currentLocation from Firebase for partner: $partnerId")
            database.reference
                .child("deliveryPartners")
                .child(partnerId)
                .child("currentLocation")
                .removeValue()
                .addOnSuccessListener {
                    Log.d(TAG, "Partner currentLocation cleared from Firebase successfully")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to clear partner currentLocation from Firebase", e)
                }
        } ?: Log.w(TAG, "DeliveryPartnerId is null, cannot clear partner currentLocation")

        // Stop foreground service
        stopForeground(STOP_FOREGROUND_REMOVE)

        Log.i(
            TAG,
            "Location tracking stopped and cleaned up for partner: $deliveryPartnerId, order: $currentOrderId"
        )
    }

}
