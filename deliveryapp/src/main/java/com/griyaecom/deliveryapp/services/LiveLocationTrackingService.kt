package com.griyaecom.deliveryapp.services

import android.Manifest
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
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.google.firebase.database.*
import com.griyaecom.deliveryapp.DriverMainActivity

/**
 * Live Location Tracking Service for Delivery Drivers
 * Continuously tracks and shares driver location during active deliveries
 */
class LiveLocationTrackingService : Service() {

    companion object {
        private const val TAG = "LiveLocationService"
        private const val NOTIFICATION_ID = 2002
        private const val CHANNEL_ID = "live_location_tracking"
        private const val CHANNEL_NAME = "Live Location Tracking"

        // Location update intervals
        private const val LOCATION_UPDATE_INTERVAL = 10000L // 10 seconds
        private const val FASTEST_UPDATE_INTERVAL = 5000L   // 5 seconds
        private const val DISPLACEMENT_THRESHOLD = 10f      // 10 meters

        fun startService(context: Context, orderId: String, riderId: String) {
            val intent = Intent(context, LiveLocationTrackingService::class.java).apply {
                putExtra("order_id", orderId)
                putExtra("rider_id", riderId)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, LiveLocationTrackingService::class.java)
            context.stopService(intent)
        }
    }

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var locationRequest: LocationRequest? = null

    private var database: FirebaseDatabase? = null
    private var riderLocationRef: DatabaseReference? = null
    private var orderRef: DatabaseReference? = null

    private var currentOrderId: String? = null
    private var currentRiderId: String? = null
    private var isLocationTracking = false
    private var lastLocationUpdate = 0L
    private var totalDistance = 0f
    private var startTime = 0L

    private var notificationManager: NotificationManager? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "LiveLocationTrackingService created")

        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        database = FirebaseDatabase.getInstance()

        setupLocationRequest()
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val orderId = intent?.getStringExtra("order_id")
        val riderId = intent?.getStringExtra("rider_id")

        if (orderId != null && riderId != null) {
            currentOrderId = orderId
            currentRiderId = riderId
            startTime = System.currentTimeMillis()

            Log.d(TAG, "Starting live location tracking for order: $orderId, rider: $riderId")

            setupDatabaseReferences()
            startLocationTracking()
            startForegroundNotification()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun setupLocationRequest() {
        locationRequest = LocationRequest.create().apply {
            interval = LOCATION_UPDATE_INTERVAL
            fastestInterval = FASTEST_UPDATE_INTERVAL
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
            smallestDisplacement = DISPLACEMENT_THRESHOLD
        }
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)

                for (location in locationResult.locations) {
                    handleLocationUpdate(location)
                }
            }

            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                super.onLocationAvailability(locationAvailability)
                Log.d(TAG, "Location availability: ${locationAvailability.isLocationAvailable}")

                if (!locationAvailability.isLocationAvailable) {
                    updateLocationStatus("GPS_UNAVAILABLE")
                } else {
                    updateLocationStatus("GPS_ACTIVE")
                }
            }
        }
    }

    private fun setupDatabaseReferences() {
        if (currentRiderId != null) {
            riderLocationRef = database?.getReference("riderLocations")?.child(currentRiderId!!)
            orderRef = database?.getReference("orders")?.child(currentOrderId!!)

            // Set initial tracking status
            updateLocationStatus("TRACKING_STARTED")
        }
    }

    private fun startLocationTracking() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Location permission not granted")
            stopSelf()
            return
        }

        fusedLocationClient?.requestLocationUpdates(
            locationRequest!!,
            locationCallback!!,
            Looper.getMainLooper()
        )

        isLocationTracking = true
        Log.d(TAG, "Location tracking started")
    }

    private fun handleLocationUpdate(location: Location) {
        val currentTime = System.currentTimeMillis()

        // Calculate distance traveled
        if (lastLocationUpdate > 0) {
            val timeDiff = currentTime - lastLocationUpdate
            // Only update if significant time has passed (avoid spam)
            if (timeDiff < 3000) return
        }

        lastLocationUpdate = currentTime

        Log.d(TAG, "Location update: ${location.latitude}, ${location.longitude}")

        // Create location data
        val locationData = mapOf(
            "lat" to location.latitude,
            "lng" to location.longitude,
            "accuracy" to location.accuracy,
            "speed" to location.speed,
            "bearing" to location.bearing,
            "altitude" to location.altitude,
            "timestamp" to currentTime,
            "orderId" to currentOrderId,
            "trackingStatus" to "ACTIVE"
        )

        // Update Firebase with current location
        riderLocationRef?.setValue(locationData)?.addOnSuccessListener {
            Log.d(TAG, "Location updated in Firebase successfully")
            updateNotification(location)
            sendLocationToWebApp(location)
        }?.addOnFailureListener { exception ->
            Log.e(TAG, "Failed to update location in Firebase", exception)
        }

        // Update order with latest location
        orderRef?.child("currentLocation")?.setValue(locationData)

        // Calculate and update ETA
        calculateAndUpdateETA(location)
    }

    private fun calculateAndUpdateETA(currentLocation: Location) {
        // Get order destination from database
        orderRef?.child("dropLocation")?.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val dropLat = snapshot.child("lat").getValue(Double::class.java)
                val dropLng = snapshot.child("lng").getValue(Double::class.java)

                if (dropLat != null && dropLng != null) {
                    val destinationLocation = Location("destination").apply {
                        latitude = dropLat
                        longitude = dropLng
                    }

                    val distance = currentLocation.distanceTo(destinationLocation)
                    val speed = if (currentLocation.speed > 0) currentLocation.speed else 5.0f // 5 m/s default

                    val etaSeconds = (distance / speed).toInt()
                    val etaMinutes = etaSeconds / 60

                    // Update ETA in database
                    val etaData = mapOf(
                        "distanceToDestination" to distance,
                        "estimatedArrivalMinutes" to etaMinutes,
                        "calculatedAt" to System.currentTimeMillis()
                    )

                    orderRef?.child("liveETA")?.setValue(etaData)

                    Log.d(TAG, "ETA calculated: $etaMinutes minutes, distance: ${distance}m")
                }
            }

            override fun onCancelled(error: DatabaseError) {
                Log.e(TAG, "Failed to get drop location", error.toException())
            }
        })
    }

    private fun updateNotification(location: Location) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Live Location Tracking")
            .setContentText("Sharing location for order #${currentOrderId}")
            .setSubText("Accuracy: ${location.accuracy.toInt()}m • Speed: ${(location.speed * 3.6).toInt()} km/h")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

        notificationManager?.notify(NOTIFICATION_ID, notification)
    }

    private fun startForegroundNotification() {
        val intent = Intent(this, DriverMainActivity::class.java).apply {
            putExtra("action", "view_live_tracking")
            putExtra("order_id", currentOrderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Live Location Tracking")
            .setContentText("Starting location tracking for order #${currentOrderId}")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Stop Tracking",
                createStopTrackingIntent()
            )
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createStopTrackingIntent(): PendingIntent {
        val intent = Intent(this, LiveLocationTrackingService::class.java).apply {
            action = "STOP_TRACKING"
        }
        return PendingIntent.getService(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun sendLocationToWebApp(location: Location) {
        val jsCode = """
            if (window.handleLiveLocationUpdate) {
                window.handleLiveLocationUpdate({
                    lat: ${location.latitude},
                    lng: ${location.longitude},
                    accuracy: ${location.accuracy},
                    speed: ${location.speed},
                    bearing: ${location.bearing},
                    timestamp: ${System.currentTimeMillis()},
                    orderId: '$currentOrderId',
                    riderId: '$currentRiderId'
                });
            }
        """.trimIndent()

        // Send to DriverMainActivity if available
        // You'll need to implement a way to communicate with the WebView
        Log.d(TAG, "Sending location update to web app")
    }

    private fun updateLocationStatus(status: String) {
        val statusData = mapOf(
            "status" to status,
            "timestamp" to System.currentTimeMillis(),
            "orderId" to currentOrderId
        )

        riderLocationRef?.child("trackingStatus")?.setValue(statusData)
    }

    private fun stopLocationTracking() {
        if (isLocationTracking) {
            fusedLocationClient?.removeLocationUpdates(locationCallback!!)
            isLocationTracking = false

            // Update final status
            updateLocationStatus("TRACKING_STOPPED")

            Log.d(TAG, "Location tracking stopped")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live location tracking for deliveries"
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "LiveLocationTrackingService destroyed")

        stopLocationTracking()

        // Update final tracking status
        updateLocationStatus("TRACKING_COMPLETED")
    }
}
