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
import android.os.PowerManager
import android.util.Log
import androidx.annotation.RequiresPermission
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.database.FirebaseDatabase

class LocationService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var currentOrderId: String? = null
    private var deliveryPartnerId: String? = null
    private val database = FirebaseDatabase.getInstance()
    private lateinit var notificationManager: NotificationManager
    private var locationUpdateCount = 0
    private var wakeLock: PowerManager.WakeLock? = null
    private var isServiceRunning = false

    // Dynamic delivery zone data
    private var currentDeliveryZone: String = "pk4HklhD1kBNq1XT4KVS"
    private var currentZoneName: String = "huzurabad"
    private var currentZoneStatus: String = "in-zone"
    private var isPartnerAvailable: Boolean = true
    private var isPartnerOnline: Boolean = true

    companion object {
        private const val TAG = "LocationService"
        const val ACTION_START_TRACKING = "START_TRACKING"
        const val ACTION_STOP_TRACKING = "STOP_TRACKING"
        const val ACTION_STOP_FROM_NOTIFICATION = "STOP_FROM_NOTIFICATION"
        const val ACTION_UPDATE_ZONE = "UPDATE_ZONE"
        const val ACTION_UPDATE_AVAILABILITY = "UPDATE_AVAILABILITY"
        const val EXTRA_ORDER_ID = "ORDER_ID"
        const val EXTRA_DELIVERY_PARTNER_ID = "deliveryPartnerId"
        const val EXTRA_DELIVERY_ZONE = "deliveryZone"
        const val EXTRA_ZONE_NAME = "zoneName"
        const val EXTRA_ZONE_STATUS = "zoneStatus"
        const val EXTRA_IS_AVAILABLE = "isAvailable"
        const val EXTRA_IS_ONLINE = "isOnline"
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

        // Acquire wake lock to prevent the service from being killed
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "$TAG::LocationTracking"
        ).apply {
            acquire(10 * 60 * 1000L /*10 minutes initially, will be renewed*/)
        }

        Log.d(
            TAG,
            "LocationService initialized successfully with wake lock - notificationManager: ${::notificationManager.isInitialized}"
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "=== onStartCommand ===")
        Log.d(TAG, "Intent action: ${intent?.action}")
        Log.d(TAG, "Intent extras: ${intent?.extras?.keySet()?.joinToString(", ") ?: "none"}")

        when (intent?.action) {
            ACTION_START_TRACKING -> {
                if (isServiceRunning) {
                    Log.d(TAG, "Service already running, updating parameters if needed")
                }

                currentOrderId = intent.getStringExtra("orderId")
                deliveryPartnerId = intent.getStringExtra("deliveryPartnerId")
                    ?: intent.getStringExtra(EXTRA_DELIVERY_PARTNER_ID) // Support both key formats

                // Extract dynamic zone and availability data
                currentDeliveryZone =
                    intent.getStringExtra(EXTRA_DELIVERY_ZONE) ?: currentDeliveryZone
                currentZoneName = intent.getStringExtra(EXTRA_ZONE_NAME) ?: currentZoneName
                currentZoneStatus = intent.getStringExtra(EXTRA_ZONE_STATUS) ?: currentZoneStatus
                isPartnerAvailable = intent.getBooleanExtra(EXTRA_IS_AVAILABLE, true)
                isPartnerOnline = intent.getBooleanExtra(EXTRA_IS_ONLINE, true)

                Log.d(TAG, "Extracted parameters:")
                Log.d(TAG, "  - deliveryPartnerId: '$deliveryPartnerId'")
                Log.d(TAG, "  - currentOrderId: '$currentOrderId'")
                Log.d(TAG, "  - deliveryZone: '$currentDeliveryZone'")
                Log.d(TAG, "  - zoneName: '$currentZoneName'")
                Log.d(TAG, "  - zoneStatus: '$currentZoneStatus'")
                Log.d(TAG, "  - isAvailable: $isPartnerAvailable")
                Log.d(TAG, "  - isOnline: $isPartnerOnline")

                if (deliveryPartnerId == null) {
                    Log.w(
                        TAG,
                        "⚠️ WARNING: deliveryPartnerId is null - Firebase updates will fail!"
                    )
                }

                Log.d(TAG, "Starting foreground service with persistent notification")
                startForeground(NOTIFICATION_ID, createPersistentNotification())
                isServiceRunning = true

                try {
                    if (!::locationCallback.isInitialized) {
                        startLocationUpdates()
                    }
                    Log.i(TAG, "✅ Location updates ensured")
                } catch (e: SecurityException) {
                    Log.e(TAG, "❌ SecurityException while starting location updates", e)
                    stopSelf()
                }
            }

            ACTION_UPDATE_ZONE -> {
                // Update zone information while service is running
                currentDeliveryZone =
                    intent?.getStringExtra(EXTRA_DELIVERY_ZONE) ?: currentDeliveryZone
                currentZoneName = intent?.getStringExtra(EXTRA_ZONE_NAME) ?: currentZoneName
                currentZoneStatus = intent?.getStringExtra(EXTRA_ZONE_STATUS) ?: currentZoneStatus
                Log.d(
                    TAG,
                    "Zone updated: $currentZoneName ($currentDeliveryZone) - Status: $currentZoneStatus"
                )
            }

            ACTION_UPDATE_AVAILABILITY -> {
                // Update availability while service is running
                isPartnerAvailable = intent?.getBooleanExtra(EXTRA_IS_AVAILABLE, isPartnerAvailable)
                    ?: isPartnerAvailable
                isPartnerOnline =
                    intent?.getBooleanExtra(EXTRA_IS_ONLINE, isPartnerOnline) ?: isPartnerOnline
                Log.d(
                    TAG,
                    "Availability updated: Available=$isPartnerAvailable, Online=$isPartnerOnline"
                )
                updateNotification() // Update notification to reflect status change
            }
            ACTION_STOP_TRACKING, ACTION_STOP_FROM_NOTIFICATION -> {
                Log.d(
                    TAG,
                    "Stopping tracking - Partner: $deliveryPartnerId, Order: $currentOrderId"
                )
                stopLocationUpdates()
                isServiceRunning = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.i(TAG, "Location tracking stopped successfully")
            }

            null -> {
                // Service restarted by system, try to restart with last known parameters
                Log.w(TAG, "Service restarted by system with null intent")
                if (deliveryPartnerId != null) {
                    Log.d(TAG, "Attempting to restart with previous parameters")
                    startForeground(NOTIFICATION_ID, createPersistentNotification())
                    isServiceRunning = true
                    if (!::locationCallback.isInitialized) {
                        try {
                            startLocationUpdates()
                        } catch (e: SecurityException) {
                            Log.e(TAG, "Failed to restart location updates", e)
                            stopSelf()
                        }
                    }
                }
            }
        }
        // Return START_STICKY to ensure service restarts if killed by system
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

        // Create comprehensive delivery partner data structure
        val currentLocationData = hashMapOf<String, Any?>(
            "lat" to location.latitude,
            "lng" to location.longitude
        )

        val deliveryPartnerData = hashMapOf<String, Any?>(
            "currentLocation" to currentLocationData,
            "deliveryZone" to currentDeliveryZone,
            "isAvailable" to isPartnerAvailable,
            "isOnline" to isPartnerOnline,
            "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP,
            "lastZoneCheck" to com.google.firebase.database.ServerValue.TIMESTAMP,
            "uid" to partnerId,
            "zoneName" to currentZoneName,
            "zoneStatus" to currentZoneStatus,
            // Additional metadata for tracking
            "locationAccuracy" to location.accuracy,
            "locationSpeed" to location.speed,
            "locationBearing" to location.bearing,
            "activeOrderId" to currentOrderId
        )

        Log.d(
            TAG,
            "Preparing to update Firebase with comprehensive partner data: $deliveryPartnerData"
        )

        // Update the complete delivery partner data structure
        val partnerPath = "deliveryPartners/$partnerId"
        Log.d(TAG, "Updating delivery partner data at: $partnerPath")

        database.reference
            .child("deliveryPartners")
            .child(partnerId)
            .updateChildren(deliveryPartnerData)
            .addOnSuccessListener {
                Log.d(TAG, "✅ Delivery partner data updated successfully at $partnerPath")
                // Update notification every 10th update to show it's active
                if (locationUpdateCount % 10 == 0) {
                    updateNotification()
                }
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "❌ Failed to update delivery partner data at $partnerPath", error)
            }

        // If on active delivery, also update order location with detailed tracking
        currentOrderId?.let { orderId ->
            val orderLocationData = hashMapOf<String, Any?>(
                "lat" to location.latitude,
                "lng" to location.longitude,
                "accuracy" to location.accuracy,
                "speed" to location.speed,
                "bearing" to location.bearing,
                "timestamp" to com.google.firebase.database.ServerValue.TIMESTAMP,
                "deliveryPartnerId" to partnerId,
                "partnerZone" to currentZoneName,
                "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
            )

            val orderPath = "activeOrders/$orderId/location"
            Log.d(TAG, "Updating order location at: $orderPath")

            database.reference
                .child("activeOrders")
                .child(orderId)
                .child("location")
                .setValue(orderLocationData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Order location updated successfully at $orderPath")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update order location at $orderPath", error)
                }
        } ?: Log.d(TAG, "No active order - skipping order location update")
    }

    private fun createPersistentNotification(): Notification {
        Log.d(
            TAG,
            "Creating persistent notification for partner: $deliveryPartnerId, order: $currentOrderId"
        )

        // Intent to open the app when notification is tapped
        val appIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val appPendingIntent = PendingIntent.getActivity(
            this, 0, appIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Intent to stop tracking from notification
        val stopIntent = Intent(this, LocationService::class.java).apply {
            action = ACTION_STOP_FROM_NOTIFICATION
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val title = if (currentOrderId != null) {
            "📍 Delivering Order"
        } else {
            "📍 You're Online"
        }

        val message = if (currentOrderId != null) {
            "Tracking delivery location"
        } else {
            "Ready to receive orders"
        }

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .bigText("$message\n\nLocation updates every 5 seconds while you're working.")
            .setBigContentTitle(title)

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(bigTextStyle)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Use your own icon
            .setContentIntent(appPendingIntent)
            .setOngoing(true) // Cannot be dismissed by user
            .setAutoCancel(false) // Cannot be dismissed by tapping
            .setSilent(true) // No sound or vibration
            .setPriority(NotificationCompat.PRIORITY_HIGH) // High priority for foreground service
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Tracking",
                stopPendingIntent
            )
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .build()

        Log.d(TAG, "Persistent notification created: $title - $message")
        return notification
    }

    private fun updateNotification() {
        if (::notificationManager.isInitialized) {
            try {
                val updatedNotification = createPersistentNotification()
                notificationManager.notify(NOTIFICATION_ID, updatedNotification)
                Log.d(TAG, "Notification updated successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to update notification", e)
            }
        }
    }

    private fun createNotificationChannel() {
        Log.d(TAG, "Creating notification channel for persistent foreground service")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Delivery Location Tracking",
                NotificationManager.IMPORTANCE_HIGH // HIGH importance for persistent foreground service
            ).apply {
                description =
                    "Tracks your location while you're working to enable real-time delivery updates"
                enableLights(false) // No LED
                enableVibration(false) // No vibration for location updates
                setSound(null, null) // No sound for location updates
                setShowBadge(false) // Don't show badge count
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setBypassDnd(false) // Don't bypass do not disturb
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Persistent notification channel created successfully with HIGH importance")
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

        isServiceRunning = false

        // Stop location updates
        if (::locationCallback.isInitialized) {
            Log.d(TAG, "Removing location updates")
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } else {
            Log.w(TAG, "LocationCallback not initialized during destroy")
        }

        // Release wake lock
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d(TAG, "Wake lock released")
            }
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
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping foreground service", e)
        }

        Log.i(
            TAG,
            "Location tracking stopped and cleaned up for partner: $deliveryPartnerId, order: $currentOrderId"
        )
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "onTaskRemoved called - app removed from recent apps")

        // Only restart if we were actively tracking
        if (isServiceRunning && deliveryPartnerId != null) {
            Log.d(TAG, "Restarting service after task removal to maintain location tracking")
            val restartIntent = Intent(this, LocationService::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra("deliveryPartnerId", deliveryPartnerId)
                putExtra("orderId", currentOrderId)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent)
            } else {
                startService(restartIntent)
            }
        }

        super.onTaskRemoved(rootIntent)
    }

}
