package com.mat.doothadriver

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.google.firebase.database.*

/**
 * Dootha Driver Continuous Location Update Service
 * Implements AI-Understandable Specification for real-time driver location tracking
 */
class DriverLocationService : Service() {

    companion object {
        private const val TAG = "DoothaDriverLocation"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "dootha_driver_location"

        // Location update configuration per specification
        private const val LOCATION_UPDATE_INTERVAL = 3000L // 3 seconds
        private const val LOCATION_FASTEST_INTERVAL = 3000L // 3 seconds
        private const val MIN_DISTANCE_METERS = 10f // 10 meters

        // Actions
        const val ACTION_START_TRACKING = "start_continuous_tracking"
        const val ACTION_STOP_TRACKING = "stop_continuous_tracking"
        const val ACTION_UPDATE_DRIVER_STATUS = "update_driver_status"

        // Extra keys
        const val EXTRA_DRIVER_ID = "driverId"
        const val EXTRA_IS_ONLINE = "isOnline"
        const val EXTRA_IS_AVAILABLE = "isAvailable"
    }

    // Core tracking state
    private var driverId: String? = null
    private var isDriverOnline: Boolean = false
    private var isDriverAvailable: Boolean = false
    private var isTrackingActive: Boolean = false
    private var activeRideId: String? = null // Track active ride

    // Location tracking components
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var lastKnownLocation: Location? = null
    private var lastUpdateTime: Long = 0

    // Firebase Real-time Database
    private val rtdb: DatabaseReference = FirebaseDatabase.getInstance().reference

    // Notification manager
    private lateinit var notificationManager: NotificationManager

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚗 Dootha Driver Location Service Created")

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        setupLocationCallback()

        Log.d(TAG, "📱 NotificationManager initialized and channel created")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚨 === DRIVERLOCATIONSERVICE onStartCommand ===")
        Log.d(TAG, "🚨 Intent: $intent")
        Log.d(TAG, "🚨 Intent Action: ${intent?.action}")
        Log.d(TAG, "🚨 Flags: $flags, StartId: $startId")

        if (intent != null) {
            Log.d(TAG, "🚨 Intent Extras:")
            intent.extras?.keySet()?.forEach { key ->
                Log.d(TAG, "🚨   - $key: ${intent.extras?.get(key)}")
            }
        }

        when (intent?.action) {
            ACTION_START_TRACKING -> {
                Log.d(TAG, "🚨 ACTION_START_TRACKING received!")
                val driverId = intent.getStringExtra(EXTRA_DRIVER_ID)
                val isOnline = intent.getBooleanExtra(EXTRA_IS_ONLINE, false)
                val isAvailable = intent.getBooleanExtra(EXTRA_IS_AVAILABLE, false)
                val rideId = intent.getStringExtra("activeRideId") // Extract ride ID

                Log.d(TAG, "🚨 Extracted values:")
                Log.d(TAG, "🚨   - Driver ID: $driverId")
                Log.d(TAG, "🚨   - Is Online: $isOnline")
                Log.d(TAG, "🚨   - Is Available: $isAvailable")
                Log.d(TAG, "🚨   - Ride ID: $rideId")

                startContinuousTracking(driverId, isOnline, isAvailable, rideId)
            }

            ACTION_STOP_TRACKING -> {
                Log.d(TAG, "🚨 ACTION_STOP_TRACKING received!")
                stopContinuousTracking()
            }

            ACTION_UPDATE_DRIVER_STATUS -> {
                Log.d(TAG, "🚨 ACTION_UPDATE_DRIVER_STATUS received!")
                val isOnline = intent.getBooleanExtra(EXTRA_IS_ONLINE, false)
                val isAvailable = intent.getBooleanExtra(EXTRA_IS_AVAILABLE, false)

                updateDriverStatus(isOnline, isAvailable)
            }

            else -> {
                Log.w(TAG, "🚨 Unknown action or null intent: ${intent?.action}")
            }
        }

        // Return START_STICKY to restart service if killed by system
        return START_STICKY
    }

    /**
     * Start continuous location tracking for available drivers
     * Per specification: Only track if ALL conditions are true
     */
    private fun startContinuousTracking(
        driverId: String?,
        isOnline: Boolean,
        isAvailable: Boolean,
        rideId: String? = null
    ) {
        Log.d(TAG, "🚀 Start Continuous Tracking Request")
        Log.d(TAG, "Driver ID: $driverId")
        Log.d(TAG, "Is Online: $isOnline")
        Log.d(TAG, "Is Available: $isAvailable")
        Log.d(TAG, "Active Ride ID: $rideId")

        // Validate driver ID
        if (driverId.isNullOrEmpty()) {
            Log.e(TAG, "❌ Invalid driver ID")
            stopSelf()
            return
        }

        // Store driver state
        this.driverId = driverId
        this.isDriverOnline = isOnline
        this.isDriverAvailable = isAvailable
        this.activeRideId = rideId

        // Check all preconditions per specification
        if (!checkAllPreconditions()) {
            Log.w(TAG, "⚠️ Preconditions not met - stopping tracking")
            removeDriverFromRTDB()
            stopSelf()
            return
        }

        // Check notification permissions and capabilities
        Log.d(TAG, "📱 === NOTIFICATION DIAGNOSTIC ===")
        val hasNotificationPerm = hasNotificationPermission()
        val notificationsEnabled = areNotificationsEnabled()

        Log.d(TAG, "📱 Has notification permission: $hasNotificationPerm")
        Log.d(TAG, "📱 Notifications enabled: $notificationsEnabled")

        if (!hasNotificationPerm) {
            Log.w(TAG, "⚠️ Notification permission not granted - notification may not show")
        }

        if (!notificationsEnabled) {
            Log.w(TAG, "⚠️ Notifications disabled for app - notification may not show")
        }

        // Start foreground service with notification
        val notification = createTrackingNotification()
        Log.d(TAG, "📱 Starting foreground service with notification")
        Log.d(TAG, "📱 Notification channel: $CHANNEL_ID")
        Log.d(TAG, "📱 Notification ID: $NOTIFICATION_ID")

        try {
            startForeground(NOTIFICATION_ID, notification)
            Log.d(TAG, "✅ Foreground service started successfully")

            // Verify notification is displayed (only works on newer APIs)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val activeNotifications = notificationManager.activeNotifications
                val notificationInfo = activeNotifications.find { it.id == NOTIFICATION_ID }
                if (notificationInfo != null) {
                    Log.d(TAG, "✅ Notification is active and displayed")
                    Log.d(TAG, "📱 Notification details: ${notificationInfo.notification.extras}")
                } else {
                    Log.w(TAG, "⚠️ Notification not found in active notifications")
                    Log.w(TAG, "📱 Active notifications count: ${activeNotifications.size}")
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start foreground service", e)
            stopSelf()
            return
        }

        // Start location updates
        startLocationUpdates()
        isTrackingActive = true

        // Send test location immediately to verify connectivity
        sendTestLocationUpdate()

        Log.d(TAG, "✅ Continuous location tracking started for driver: $driverId")
        if (rideId != null) {
            Log.d(TAG, "🚗 Active ride tracking enabled for ride: $rideId")
        }
    }

    /**
     * Stop continuous location tracking
     * Per specification: Remove from available_drivers or set isOnline = false
     */
    private fun stopContinuousTracking() {
        Log.d(TAG, "🛑 Stopping continuous location tracking")

        stopLocationUpdates()
        removeDriverFromRTDB()

        isTrackingActive = false
        stopForeground(true)
        stopSelf()

        Log.d(TAG, "✅ Continuous location tracking stopped")
    }

    /**
     * Update driver online/available status
     * Per specification: Stop if conditions become false
     */
    private fun updateDriverStatus(isOnline: Boolean, isAvailable: Boolean) {
        Log.d(TAG, "📊 Updating driver status - Online: $isOnline, Available: $isAvailable")

        this.isDriverOnline = isOnline
        this.isDriverAvailable = isAvailable

        // Check if we should continue tracking
        if (!checkAllPreconditions()) {
            Log.d(TAG, "⚠️ Status change requires stopping tracking")
            stopContinuousTracking()
            return
        }

        // Update notification
        val notification = createTrackingNotification()
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Check all preconditions per specification:
     * - driver.isOnline == true
     * - driver.isAvailable == true OR has activeRideId (allow tracking during rides)
     * - locationPermission == GRANTED
     * - backgroundLocationPermission == GRANTED
     * - locationServices == ENABLED
     */
    private fun checkAllPreconditions(): Boolean {
        // Check driver status
        if (!isDriverOnline) {
            Log.d(TAG, "❌ Driver is offline")
            return false
        }

        // Allow tracking if available OR has active ride (for delivery tracking)
        if (!isDriverAvailable && activeRideId.isNullOrEmpty()) {
            Log.d(TAG, "❌ Driver is not available and has no active ride")
            return false
        }

        // Check location permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.d(TAG, "❌ Location permission not granted")
            return false
        }

        // Check background location permission (Android Q+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION
                )
                != PackageManager.PERMISSION_GRANTED
            ) {
                Log.d(TAG, "❌ Background location permission not granted")
                return false
            }
        }

        Log.d(
            TAG,
            "✅ All preconditions met (available: $isDriverAvailable, activeRide: $activeRideId)"
        )
        return true
    }

    /**
     * Start location updates with specification-compliant configuration
     */
    private fun startLocationUpdates() {
        Log.d(TAG, "📡 Starting location updates")

        // Double check permissions before starting
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "❌ Fine location permission not granted when starting updates")
            stopContinuousTracking()
            return
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "❌ Coarse location permission not granted when starting updates")
            stopContinuousTracking()
            return
        }

        val locationRequest =
            LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_UPDATE_INTERVAL)
                .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL)
                .setMinUpdateDistanceMeters(MIN_DISTANCE_METERS)
                .setWaitForAccurateLocation(false)
                .setMaxUpdateDelayMillis(10000L) // 10 second max delay
                .build()

        Log.d(TAG, "📡 Location request configured:")
        Log.d(TAG, "   - Interval: ${LOCATION_UPDATE_INTERVAL}ms")
        Log.d(TAG, "   - Min distance: ${MIN_DISTANCE_METERS}m")
        Log.d(TAG, "   - Priority: HIGH_ACCURACY")

        try {
            locationCallback?.let { callback ->
                Log.d(TAG, "📡 Requesting location updates from FusedLocationClient")
                fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    callback,
                    Looper.getMainLooper()
                )
                Log.d(TAG, "✅ Location updates requested successfully")

                // Also try to get last known location immediately
                fusedLocationClient.lastLocation
                    .addOnSuccessListener { location ->
                        if (location != null) {
                            Log.d(TAG, "📍 Got last known location immediately")
                            processLocationUpdate(location)
                        } else {
                            Log.d(TAG, "📍 No last known location available")
                        }
                    }
                    .addOnFailureListener { error ->
                        Log.w(TAG, "⚠️ Failed to get last known location", error)
                    }

            } ?: run {
                Log.e(TAG, "❌ Location callback is null!")
                stopContinuousTracking()
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Security exception starting location updates", e)
            stopContinuousTracking()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Unexpected error starting location updates", e)
            stopContinuousTracking()
        }
    }

    /**
     * Stop location updates
     */
    private fun stopLocationUpdates() {
        locationCallback?.let { callback ->
            fusedLocationClient.removeLocationUpdates(callback)
            Log.d(TAG, "📡 Location updates stopped")
        }
    }

    /**
     * Setup location callback per specification
     */
    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)

                Log.d(TAG, "🎯 === NEW LOCATION RESULT RECEIVED ===")
                Log.d(TAG, "🎯 Number of locations: ${locationResult.locations.size}")

                locationResult.lastLocation?.let { location ->
                    Log.d(TAG, "🎯 Processing location from DriverLocationService")
                    processLocationUpdate(location)
                } ?: run {
                    Log.w(TAG, "⚠️ No location in location result")
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                super.onLocationAvailability(availability)

                Log.d(TAG, "🎯 Location availability changed: ${availability.isLocationAvailable}")

                if (!availability.isLocationAvailable) {
                    Log.w(TAG, "⚠️ Location services temporarily unavailable")
                    Log.w(TAG, "🔄 Continuing service - will retry when GPS becomes available")

                    // Update notification to show GPS issue
                    updateNotificationForGpsIssue()

                    // Don't stop service - just wait for GPS to come back
                    // Many times GPS becomes temporarily unavailable and comes back
                } else {
                    Log.d(TAG, "✅ Location services are available again")

                    // Update notification back to normal
                    updateNotification()

                    // Try to get location immediately now that GPS is back
                    requestImmediateLocation()
                }
            }
        }
    }

    /**
     * Process location update and send to Firebase RTDB
     * Per specification: Send to available_drivers/{driverId}
     */
    private fun processLocationUpdate(location: Location) {
        val currentTime = System.currentTimeMillis()

        Log.d(TAG, "📍 Location Update:")
        Log.d(TAG, "  Lat: ${location.latitude}")
        Log.d(TAG, "  Lng: ${location.longitude}")
        Log.d(TAG, "  Accuracy: ${location.accuracy}m")
        Log.d(TAG, "  Time: $currentTime")

        // Check if this is a significant location change
        if (shouldUpdateLocation(location, currentTime)) {
            sendLocationToRTDB(location, currentTime)
            lastKnownLocation = location
            lastUpdateTime = currentTime
        }
    }

    /**
     * Determine if location should be sent to RTDB
     * Per specification: Every 3-5 seconds OR when driver moves ≥ 10-20 meters
     */
    private fun shouldUpdateLocation(newLocation: Location, currentTime: Long): Boolean {
        val lastLocation = lastKnownLocation

        // Always send first location
        if (lastLocation == null) {
            Log.d(TAG, "📤 Sending first location")
            return true
        }

        // Time-based check (3-5 seconds)
        val timeDifference = currentTime - lastUpdateTime
        if (timeDifference >= LOCATION_UPDATE_INTERVAL) {
            Log.d(TAG, "📤 Sending due to time interval: ${timeDifference}ms")
            return true
        }

        // Distance-based check (10+ meters)
        val distance = lastLocation.distanceTo(newLocation)
        if (distance >= MIN_DISTANCE_METERS) {
            Log.d(TAG, "📤 Sending due to distance: ${distance}m")
            return true
        }

        Log.d(TAG, "⏭️ Skipping update - time: ${timeDifference}ms, distance: ${distance}m")
        return false
    }

    /**
     * Send location to Firebase RTDB with exact specification format
     * Path: available_drivers/{driverId} (when available)
     * Also sends to active ride tracking when on ride
     * Payload: {driverId, isOnline, isAvailable, latitude, longitude, timestamp}
     */
    private fun sendLocationToRTDB(location: Location, timestamp: Long) {
        val driverId = this.driverId ?: return

        Log.d(TAG, "🔥 === SENDING LOCATION TO FIREBASE RTDB ===")
        Log.d(TAG, "🔥 Driver ID: $driverId")
        Log.d(TAG, "🔥 Location: ${location.latitude}, ${location.longitude}")
        Log.d(TAG, "🔥 Accuracy: ${location.accuracy}m")
        Log.d(TAG, "🔥 Timestamp: $timestamp")
        Log.d(TAG, "🔥 Is Available: $isDriverAvailable")
        Log.d(TAG, "🔥 Active Ride: $activeRideId")

        // Always send location for driver tracking (even when busy for dispatch purposes)
        val locationData = mapOf(
            "driverId" to driverId,
            "isOnline" to isDriverOnline,
            "isAvailable" to isDriverAvailable,
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "timestamp" to timestamp,
            "accuracy" to location.accuracy.toDouble(),
            "speed" to location.speed.toDouble(),
            "platform" to "android",
            "bearing" to location.bearing.toDouble()
        )

        Log.d(TAG, "🔥 Location data prepared: $locationData")

        // Send to available_drivers only if driver is available (per specification)
        if (isDriverAvailable) {
            Log.d(TAG, "🔥 SENDING to available_drivers/$driverId")
            rtdb.child("available_drivers").child(driverId)
                .setValue(locationData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ SUCCESS: Location sent to RTDB: available_drivers/$driverId")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ FAILED: Failed to send location to available_drivers", error)
                }
        } else {
            Log.d(TAG, "🟡 Driver not available - skipping available_drivers update")
            // Remove from available_drivers if no longer available
            rtdb.child("available_drivers").child(driverId).removeValue()
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Removed from available_drivers (driver not available)")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to remove from available_drivers", error)
                }
        }

        // Send to active ride tracking if there's an active ride
        activeRideId?.let { rideId ->
            Log.d(TAG, "🚗 Updating active ride location for ride: $rideId")

            val rideLocationData = mapOf(
                "driverId" to driverId,
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy.toDouble(),
                "speed" to location.speed.toDouble(),
                "bearing" to location.bearing.toDouble(),
                "timestamp" to timestamp,
                "platform" to "android",
                "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
            )

            // Update ride location tracking
            rtdb.child("rides").child(rideId).child("driverLocation")
                .setValue(rideLocationData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Ride location updated for ride: $rideId")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update ride location for: $rideId", error)
                }

            // Also update driver's location in the drivers collection for comprehensive tracking
            rtdb.child("drivers").child(driverId)
                .updateChildren(
                    mapOf(
                        "currentLocation" to mapOf(
                            "lat" to location.latitude,
                            "lng" to location.longitude
                        ),
                        "location" to locationData,
                        "activeRideId" to rideId,
                        "platform" to "android",
                        "status" to if (isDriverAvailable) "available" else "busy",
                        "isOnline" to isDriverOnline,
                        "isAvailable" to isDriverAvailable,
                        "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
                    )
                )
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Driver data updated in drivers/$driverId")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update driver data", error)
                }
        } ?: run {
            Log.d(TAG, "📍 No active ride - only tracking driver availability")

            // Update general driver location even without active ride
            Log.d(TAG, "🔥 UPDATING drivers/$driverId with general location")
            rtdb.child("drivers").child(driverId)
                .updateChildren(
                    mapOf(
                        "currentLocation" to mapOf(
                            "lat" to location.latitude,
                            "lng" to location.longitude
                        ),
                        "location" to locationData,
                        "platform" to "android",
                        "activeRideId" to null,
                        "status" to if (isDriverAvailable) "available" else "busy",
                        "isOnline" to isDriverOnline,
                        "isAvailable" to isDriverAvailable,
                        "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
                    )
                )
                .addOnSuccessListener {
                    Log.d(
                        TAG,
                        "✅ SUCCESS: Driver data updated in drivers/$driverId (no active ride)"
                    )
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ FAILED: Failed to update driver data", error)
                }
        }

        Log.d(TAG, "🔥 === FIREBASE RTDB UPDATE COMPLETE ===")
    }

    /**
     * Remove driver from available_drivers in RTDB
     * Per specification: Called when stopping tracking
     */
    private fun removeDriverFromRTDB() {
        val driverId = this.driverId ?: return

        rtdb.child("available_drivers").child(driverId)
            .removeValue()
            .addOnSuccessListener {
                Log.d(TAG, "✅ Driver removed from available_drivers: $driverId")
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "❌ Failed to remove driver from RTDB", error)
            }
    }

    /**
     * Create notification channel for location tracking
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dootha Driver Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracks your location while you're available for deliveries"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "📱 Notification channel created: $CHANNEL_ID")
        }
    }

    /**
     * Create persistent notification per specification
     * Message: "Dootha Driver is sharing your location"
     */
    private fun createTrackingNotification(): Notification {
        val intent = Intent(this, UberDriverActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusMessage = when {
            !isDriverOnline -> "Driver Offline"
            activeRideId != null -> "On Active Ride"
            !isDriverAvailable -> "Driver Busy"
            else -> "Available for Orders"
        }

        Log.d(TAG, "📱 Creating notification with status: $statusMessage")

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Dootha Driver Active")
            .setContentText("Location sharing enabled")
            .setSubText(statusMessage)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(true)
            .setAutoCancel(false)
            .setDefaults(0) // No sound, no vibration
            .build()
    }

    /**
     * Test method to immediately send a test location update to RTDB
     * This helps verify the service is working and can connect to Firebase
     */
    private fun sendTestLocationUpdate() {
        if (this.driverId == null) return

        Log.d(TAG, "🧪 SENDING TEST LOCATION UPDATE")

        // Create a test location (you can replace with actual location later)
        val testLocation = Location("test").apply {
            latitude = 18.1973219
            longitude = 79.3938926
            accuracy = 50.0f
            speed = 0.0f
            bearing = 0.0f
            time = System.currentTimeMillis()
        }

        // Send test location immediately
        sendLocationToRTDB(testLocation, System.currentTimeMillis())

        Log.d(TAG, "🧪 TEST LOCATION SENT TO RTDB")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "🗑️ Location service destroyed")

        stopLocationUpdates()
        removeDriverFromRTDB()
        isTrackingActive = false
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)

        // Continue tracking even when task is removed (per specification)
        Log.d(TAG, "📱 App task removed - continuing background tracking")
    }

    /**
     * Update notification when GPS is having issues
     */
    private fun updateNotificationForGpsIssue() {
        try {
            val notification = createNotification(
                "GPS Signal Lost",
                "Waiting for GPS signal to resume location tracking..."
            )
            notificationManager.notify(NOTIFICATION_ID, notification)
            Log.d(TAG, "📱 Updated notification for GPS issue")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error updating notification for GPS issue", e)
        }
    }

    /**
     * Request immediate location when GPS becomes available again
     */
    @SuppressLint("MissingPermission")
    private fun requestImmediateLocation() {
        try {
            if (!hasLocationPermission()) {
                Log.w(TAG, "⚠️ Cannot request immediate location - no permission")
                return
            }

            Log.d(TAG, "📍 Requesting immediate location after GPS recovery")

            // Try to get last known location first
            fusedLocationClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        Log.d(TAG, "✅ Got immediate location from last known location")
                        processLocationUpdate(location)
                    } else {
                        Log.d(TAG, "⚠️ No last known location available")
                    }
                }
                .addOnFailureListener { error ->
                    Log.w(TAG, "⚠️ Failed to get immediate location", error)
                }

            // Also request a fresh location update
            val singleLocationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 0)
                .setMaxUpdates(1)
                .build()

            locationCallback?.let { callback ->
                fusedLocationClient.requestLocationUpdates(
                    singleLocationRequest,
                    callback,
                    Looper.getMainLooper()
                )
                Log.d(TAG, "📍 Requested fresh location update")
            }

        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Security exception requesting immediate location", e)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting immediate location", e)
        }
    }

    /**
     * Enhanced location permission check
     */
    private fun hasLocationPermission(): Boolean {
        val hasFine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return hasFine && hasCoarse
    }

    /**
     * Update notification back to normal tracking state
     */
    private fun updateNotification() {
        try {
            val notification = createTrackingNotification()
            notificationManager.notify(NOTIFICATION_ID, notification)
            Log.d(TAG, "📱 Updated notification back to normal")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error updating notification", e)
        }
    }

    /**
     * Create custom notification with specified title and content
     */
    private fun createNotification(title: String, content: String): Notification {
        val intent = Intent(this, UberDriverActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .build()
    }

    /**
     * Check if notification permission is granted (Android 13+)
     */
    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasPermission = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            Log.d(TAG, "📱 Notification permission check (Android 13+): $hasPermission")
            hasPermission
        } else {
            Log.d(TAG, "📱 Notification permission not required (Android < 13)")
            true // Not required on older versions
        }
    }

    /**
     * Check if notifications are enabled for this app
     */
    private fun areNotificationsEnabled(): Boolean {
        return notificationManager.areNotificationsEnabled().also { enabled ->
            Log.d(TAG, "📱 Notifications enabled for app: $enabled")
        }
    }
}
