package com.mat.doothadriver

import android.Manifest
import android.R
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.google.firebase.database.*
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.*
import kotlin.math.abs

class LocationTrackingService : Service() {

    companion object {
        private const val TAG = "UberDriverLocationService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "uber_driver_location"

        // Location update intervals
        private const val LOCATION_UPDATE_INTERVAL = 30000L // 30 seconds
        private const val LOCATION_FASTEST_INTERVAL = 15000L // 15 seconds
        private const val BACKGROUND_UPDATE_INTERVAL = 60000L // 1 minute when in background

        // Distance thresholds
        private const val MIN_DISTANCE_METERS = 10f
        private const val SIGNIFICANT_DISTANCE_METERS = 50f

        // Actions
        const val ACTION_START_TRACKING = "start_tracking"
        const val ACTION_STOP_TRACKING = "stop_tracking"
        const val ACTION_UPDATE_RIDE = "update_ride"
        const val ACTION_UPDATE_STATUS = "update_status"
        const val ACTION_UPDATE_DRIVER_STATUS = "update_driver_status"

        // Extra keys
        const val EXTRA_DRIVER_ID = "driverId"
        const val EXTRA_IS_ONLINE = "isOnline"
        const val EXTRA_IS_AVAILABLE = "isAvailable"
    }

    private val binder = LocationBinder()
    private var isTracking = false
    private var isInBackground = false

    // Location components
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var locationRequest: LocationRequest? = null

    // Firebase components
    private lateinit var firestore: FirebaseFirestore
    private lateinit var realtimeDb: DatabaseReference

    // Driver data
    private var driverId: String? = null
    private var currentRideId: String? = null
    private var driverStatus: String = "offline"
    private var lastKnownLocation: Location? = null

    // Coroutine scope for background tasks
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Location tracking listeners
    private val locationListeners = mutableSetOf<LocationListener>()

    interface LocationListener {
        fun onLocationUpdate(location: Location)
        fun onTrackingStatusChanged(isTracking: Boolean)
        fun onError(error: String)
    }

    inner class LocationBinder : Binder() {
        fun getService(): LocationTrackingService = this@LocationTrackingService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚗 UberDriverLocationService created")

        initializeComponents()
        createNotificationChannel()
        setupLocationCallback()
    }

    private fun initializeComponents() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        firestore = FirebaseFirestore.getInstance()
        realtimeDb = FirebaseDatabase.getInstance().reference
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Uber Driver Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracks driver location for ride requests and navigation"
                setSound(null, null)
                enableVibration(false)
            }

            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)

                locationResult.lastLocation?.let { location ->
                    Log.d(TAG, "=== Location Update Received ===")
                    Log.d(TAG, "Driver: $driverId")
                    Log.d(TAG, "Ride: $currentRideId")
                    Log.d(TAG, "Status: $driverStatus")
                    Log.d(TAG, "Location: ${location.latitude}, ${location.longitude}")
                    Log.d(TAG, "Accuracy: ${location.accuracy}m")
                    Log.d(TAG, "Speed: ${location.speed}m/s")
                    Log.d(TAG, "Bearing: ${location.bearing}°")

                    processLocationUpdate(location)
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                super.onLocationAvailability(availability)
                Log.d(TAG, "Location availability: ${availability.isLocationAvailable}")

                if (!availability.isLocationAvailable) {
                    notifyListeners { it.onError("Location services not available") }
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRACKING -> {
                val driverId = intent.getStringExtra("driverId")
                val rideId = intent.getStringExtra("rideId")
                startLocationTracking(driverId, rideId)
            }

            ACTION_STOP_TRACKING -> {
                stopLocationTracking()
            }

            ACTION_UPDATE_RIDE -> {
                val rideId = intent.getStringExtra("rideId")
                updateCurrentRide(rideId)
            }

            ACTION_UPDATE_STATUS -> {
                val status = intent.getStringExtra("status")
                updateDriverStatus(status)
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    fun startLocationTracking(driverId: String?, rideId: String? = null) {
        if (driverId == null) {
            Log.e(TAG, "❌ Cannot start tracking without driver ID")
            notifyListeners { it.onError("Driver ID required") }
            return
        }

        this.driverId = driverId
        this.currentRideId = rideId

        Log.d(TAG, "🚀 Starting location tracking for driver: $driverId, ride: $rideId")

        if (!hasLocationPermission()) {
            Log.e(TAG, "❌ Location permission not granted")
            notifyListeners { it.onError("Location permission required") }
            return
        }

        if (isTracking) {
            Log.d(TAG, "📍 Already tracking, updating parameters")
            updateLocationRequest()
            return
        }

        createLocationRequest()
        startForegroundService()
        requestLocationUpdates()

        isTracking = true
        notifyListeners { it.onTrackingStatusChanged(true) }
    }

    fun stopLocationTracking() {
        Log.d(TAG, "🛑 Stopping location tracking")

        if (!isTracking) {
            Log.d(TAG, "📍 Not currently tracking")
            return
        }

        // Remove location updates
        locationCallback?.let { callback ->
            fusedLocationClient.removeLocationUpdates(callback)
        }

        // Clear driver presence in Firebase
        clearDriverPresence()

        // Stop foreground service
        stopForeground(true)

        isTracking = false
        driverId = null
        currentRideId = null
        lastKnownLocation = null

        notifyListeners { it.onTrackingStatusChanged(false) }
    }

    fun updateCurrentRide(rideId: String?) {
        Log.d(TAG, "🚕 Updating current ride: $rideId")

        val previousRideId = currentRideId
        currentRideId = rideId

        // Update location request frequency based on ride status
        if (isTracking) {
            updateLocationRequest()
        }

        // Update Firebase with new ride info
        lastKnownLocation?.let { location ->
            updateDriverLocationInFirebase(location)
        }

        Log.d(TAG, "📦 Ride updated: $previousRideId → $rideId")
    }

    fun updateDriverStatus(status: String?) {
        if (status == null) return

        Log.d(TAG, "👤 Updating driver status: $driverStatus → $status")

        val previousStatus = driverStatus
        driverStatus = status

        // Update location request based on status
        if (isTracking) {
            updateLocationRequest()
        }

        // Update Firebase with new status
        lastKnownLocation?.let { location ->
            updateDriverLocationInFirebase(location)
        }

        Log.d(TAG, "✅ Status updated: $previousStatus → $status")
    }

    fun setBackgroundMode(inBackground: Boolean) {
        if (isInBackground != inBackground) {
            isInBackground = inBackground
            Log.d(TAG, "📱 Background mode: $inBackground")

            if (isTracking) {
                updateLocationRequest()
            }
        }
    }

    private fun createLocationRequest() {
        val interval = if (currentRideId != null) {
            LOCATION_UPDATE_INTERVAL / 2 // More frequent during rides
        } else if (isInBackground) {
            BACKGROUND_UPDATE_INTERVAL // Less frequent in background
        } else {
            LOCATION_UPDATE_INTERVAL
        }

        val fastestInterval = if (currentRideId != null) {
            LOCATION_FASTEST_INTERVAL / 2
        } else {
            LOCATION_FASTEST_INTERVAL
        }

        locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, interval)
            .setMinUpdateIntervalMillis(fastestInterval)
            .setMinUpdateDistanceMeters(if (currentRideId != null) MIN_DISTANCE_METERS / 2 else MIN_DISTANCE_METERS)
            .setMaxUpdateDelayMillis(interval * 2)
            .setWaitForAccurateLocation(false)
            .build()

        Log.d(
            TAG,
            "📍 Location request created - Interval: ${interval}ms, Distance: ${if (currentRideId != null) MIN_DISTANCE_METERS / 2 else MIN_DISTANCE_METERS}m"
        )
    }

    private fun updateLocationRequest() {
        if (!isTracking || locationCallback == null) return

        // Remove existing updates
        fusedLocationClient.removeLocationUpdates(locationCallback!!)

        // Create new request with updated parameters
        createLocationRequest()

        // Start new updates
        requestLocationUpdates()
    }

    private fun requestLocationUpdates() {
        if (!hasLocationPermission() || locationRequest == null || locationCallback == null) {
            Log.e(TAG, "❌ Cannot request location updates - missing permissions or components")
            return
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest!!,
            locationCallback!!,
            Looper.getMainLooper()
        ).addOnSuccessListener {
            Log.d(TAG, "✅ Location updates started successfully")
        }.addOnFailureListener { error ->
            Log.e(TAG, "❌ Failed to start location updates", error)
            notifyListeners { it.onError("Failed to start location updates: ${error.message}") }
        }
    }

    private fun startForegroundService() {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        Log.d(TAG, "🔔 Foreground service started")
    }

    private fun createNotification(): Notification {
        val statusText = when {
            currentRideId != null -> "On ride - Tracking active"
            driverStatus == "available" -> "Available - Location tracking"
            else -> "Location tracking active"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Uber Driver")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setShowWhen(false)
            .build()
    }

    private fun processLocationUpdate(location: Location) {
        // Check if location is significantly different from last known
        val isSignificantUpdate = lastKnownLocation?.let { lastLocation ->
            val distance = location.distanceTo(lastLocation)
            distance > SIGNIFICANT_DISTANCE_METERS ||
                    abs(location.speed - lastLocation.speed) > 2.0 ||
                    System.currentTimeMillis() - lastLocation.time > LOCATION_UPDATE_INTERVAL
        } ?: true

        if (isSignificantUpdate) {
            lastKnownLocation = location

            // Update Firebase
            updateDriverLocationInFirebase(location)

            // Notify listeners
            notifyListeners { it.onLocationUpdate(location) }

            // Update notification if needed
            if (currentRideId != null) {
                val notification = createNotification()
                val notificationManager =
                    getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(NOTIFICATION_ID, notification)
            }
        } else {
            Log.d(TAG, "📍 Location update skipped - not significant enough")
        }
    }

    private fun updateDriverLocationInFirebase(location: Location) {
        val driverId = this.driverId ?: return

        serviceScope.launch {
            try {
                val timestamp = System.currentTimeMillis()

                val locationData = mapOf(
                    "latitude" to location.latitude,
                    "longitude" to location.longitude,
                    "accuracy" to location.accuracy.toDouble(),
                    "speed" to location.speed.toDouble(),
                    "bearing" to location.bearing.toDouble(),
                    "platform" to "android",
                    "timestamp" to timestamp,
                    "lastUpdated" to ServerValue.TIMESTAMP
                )

                // Update driver in Realtime Database
                val driverData = mapOf(
                    "uid" to driverId,
                    "currentLocation" to mapOf(
                        "lat" to location.latitude,
                        "lng" to location.longitude
                    ),
                    "location" to locationData,
                    "status" to driverStatus,
                    "isOnline" to (driverStatus != "offline"),
                    "isAvailable" to (driverStatus == "available"),
                    "activeRideId" to currentRideId,
                    "platform" to "android",
                    "lastUpdated" to ServerValue.TIMESTAMP,
                    "accuracy" to location.accuracy.toDouble(),
                    "speed" to location.speed.toDouble(),
                    "bearing" to location.bearing.toDouble()
                )

                realtimeDb.child("drivers").child(driverId).setValue(driverData)
                    .addOnSuccessListener {
                        Log.d(TAG, "✅ Driver location updated in Firebase")
                    }
                    .addOnFailureListener { error ->
                        Log.e(TAG, "❌ Failed to update driver location", error)
                    }

                // Update ride location if on active ride
                currentRideId?.let { rideId ->
                    val rideLocationRef =
                        realtimeDb.child("rides").child(rideId).child("driverLocation")
                    rideLocationRef.setValue(locationData)
                        .addOnSuccessListener {
                            Log.d(TAG, "✅ Ride location updated for: $rideId")
                        }
                        .addOnFailureListener { error ->
                            Log.e(TAG, "❌ Failed to update ride location", error)
                        }
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error updating location in Firebase", e)
            }
        }
    }

    private fun clearDriverPresence() {
        val driverId = this.driverId ?: return

        serviceScope.launch {
            try {
                // Set driver as offline
                realtimeDb.child("drivers").child(driverId).child("isOnline").setValue(false)
                realtimeDb.child("drivers").child(driverId).child("lastUpdated")
                    .setValue(ServerValue.TIMESTAMP)

                Log.d(TAG, "✅ Driver presence cleared")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error clearing driver presence", e)
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }

    private fun notifyListeners(action: (LocationListener) -> Unit) {
        locationListeners.forEach { listener ->
            try {
                action(listener)
            } catch (e: Exception) {
                Log.e(TAG, "Error notifying location listener", e)
            }
        }
    }

    fun addLocationListener(listener: LocationListener) {
        locationListeners.add(listener)
    }

    fun removeLocationListener(listener: LocationListener) {
        locationListeners.remove(listener)
    }

    fun getTrackingStatus(): Boolean = isTracking

    fun getCurrentDriverId(): String? = driverId

    fun getCurrentRideId(): String? = currentRideId

    fun getDriverStatus(): String = driverStatus

    fun getLastKnownLocation(): Location? = lastKnownLocation

    override fun onDestroy() {
        Log.d(TAG, "🗑️ UberDriverLocationService destroyed")

        stopLocationTracking()
        serviceScope.cancel()

        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "📱 Task removed - keeping service alive")

        // Keep tracking active even if app is removed from recent apps
        // Only stop if explicitly requested or battery is low
        super.onTaskRemoved(rootIntent)
    }
}