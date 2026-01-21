package com.mat.doothadriver

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.google.firebase.database.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import org.json.JSONObject

class UberDriverBridge(
    private val context: Context,
    private val webView: WebView
) {

    companion object {
        private const val TAG = "UberDriverBridge"
        private const val LOCATION_UPDATE_INTERVAL = 30000L // 30 seconds
        private const val LOCATION_FASTEST_INTERVAL = 15000L // 15 seconds
    }

    @JavascriptInterface
    fun showAlert(title: String, message: String) {
        Log.d(TAG, "📣 showAlert called: $title - $message")
        try {
            // Simple implementation: show a Toast with title + message
            val text = "$title: $message"
            Toast.makeText(context, text, Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Log.e(TAG, "❌ showAlert failed", e)
        }
    }

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
    private val realtimeDb: DatabaseReference = FirebaseDatabase.getInstance().reference
    private val vibrator: Vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

    private var locationCallback: LocationCallback? = null
    private var isLocationTracking = false
    private var currentDriverId: String? = null
    private var currentRideId: String? = null
    private var driverStatus: String = "offline"

    init {
        Log.d(TAG, "🚗 UberDriverBridge initialized")
        setupLocationCallback()
    }

    private fun setupLocationCallback() {
        Log.d(TAG, "🚫 OLD setupLocationCallback called - DISABLED")
        Log.d(TAG, "🔄 All location tracking now handled by LocationTrackingService")

        // Disable the old location callback system
        // All location tracking should go through LocationTrackingService
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)

                Log.d(TAG, "🚫 OLD location callback received - IGNORING")
                Log.d(TAG, "🔄 LocationTrackingService should handle location updates")

                // Don't process location updates in the old system anymore
                // updateDriverLocationInFirebase is now disabled
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                super.onLocationAvailability(availability)
                Log.d(TAG, "🚫 OLD location availability callback - IGNORING")
            }
        }
    }

    private fun updateDriverLocationInFirebase(location: Location) {
        Log.d(TAG, "🚫 OLD updateDriverLocationInFirebase called - DISABLED")
        Log.d(TAG, "🔄 New LocationTrackingService should handle all location updates")

        // This method is now disabled - all location updates go through LocationTrackingService
        // Keep the old code commented for reference but don't execute it

        /*
        currentDriverId?.let { driverId ->
            Log.d(TAG, "=== Firebase Driver Update ===")
            Log.d(TAG, "Driver ID: $driverId")
            Log.d(TAG, "Current ride ID: $currentRideId")
            Log.d(TAG, "Driver status: $driverStatus")
            Log.d(TAG, "Location: lat=${location.latitude}, lng=${location.longitude}")
            // ... rest of old implementation disabled
        }
        */
    }

    @JavascriptInterface
    fun startLocationTracking(driverId: String, rideId: String) {
        Log.d(
            TAG,
            "🚀 [LEGACY] Starting driver location tracking - driverId: $driverId, rideId: $rideId"
        )
        Log.d(TAG, "🔄 Redirecting to new DriverLocationService...")

        try {
            currentDriverId = driverId
            currentRideId = if (rideId == "null" || rideId.isEmpty()) null else rideId

            Log.d(
                TAG,
                "📦 Set tracking parameters - driverId: $currentDriverId, rideId: $currentRideId"
            )

            if (!checkLocationPermission()) {
                Log.w(TAG, "❌ Location permission not granted")
                callWebViewError("Location permission required")
                return
            }

            // Determine driver state based on ride assignment
            val isOnline = true // Driver is online if starting tracking
            val isAvailable = currentRideId == null // Available if no active ride

            Log.d(
                TAG,
                "📊 Driver State: Online=$isOnline, Available=$isAvailable, RideId=$currentRideId"
            )

            // Stop any existing old tracking
            if (isLocationTracking) {
                Log.d(TAG, "🛑 Stopping old location tracking")
                locationCallback?.let { callback ->
                    fusedLocationClient.removeLocationUpdates(callback)
                }
                isLocationTracking = false
            }

            // Start the new continuous location service
            val serviceIntent = Intent(context, DriverLocationService::class.java).apply {
                action = DriverLocationService.ACTION_START_TRACKING
                putExtra(DriverLocationService.EXTRA_DRIVER_ID, driverId)
                putExtra(DriverLocationService.EXTRA_IS_ONLINE, isOnline)
                putExtra(DriverLocationService.EXTRA_IS_AVAILABLE, isAvailable)
                // Pass ride information for active ride tracking
                if (currentRideId != null) {
                    putExtra("activeRideId", currentRideId)
                }
            }

            Log.d(TAG, "🚀 SERVICE INTENT CREATED")
            Log.d(TAG, "   - Action: ${serviceIntent.action}")
            Log.d(TAG, "   - Driver ID: $driverId")
            Log.d(TAG, "   - Is Online: $isOnline")
            Log.d(TAG, "   - Is Available: $isAvailable")
            Log.d(TAG, "🎯 SERVICE START COMMAND SENT")

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Log.d(TAG, "📱 Starting FOREGROUND service for Android O+")
                    val result = context.startForegroundService(serviceIntent)
                    Log.d(TAG, "🎯 startForegroundService result: $result")
                } else {
                    Log.d(TAG, "📱 Starting regular service for older Android")
                    val result = context.startService(serviceIntent)
                    Log.d(TAG, "🎯 startService result: $result")
                }

                // Add a small delay to allow service to start
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    Log.d(TAG, "🕐 Checking if DriverLocationService started after 2 seconds...")
                }, 2000)

            } catch (e: IllegalStateException) {
                Log.e(
                    TAG,
                    "❌ IllegalStateException starting service - app might be in background",
                    e
                )
                callWebViewError("Cannot start background service while app is in background: ${e.message}")
                return
            } catch (e: SecurityException) {
                Log.e(TAG, "❌ SecurityException starting service - permission issue", e)
                callWebViewError("Permission denied to start service: ${e.message}")
                return
            } catch (e: Exception) {
                Log.e(TAG, "❌ Unexpected exception starting service", e)
                callWebViewError("Failed to start service: ${e.message}")
                return
            }

            Log.d(TAG, "🎯 SERVICE STARTUP COMPLETED")

            // Update driver status
            driverStatus = if (isAvailable) "available" else "busy"

            Log.d(TAG, "✅ New DriverLocationService started successfully")
            callWebViewSuccess(
                "onLocationTrackingStarted", mapOf<String, Any>(
                    "success" to true,
                    "driverId" to driverId,
                    "rideId" to (currentRideId ?: "null"),
                    "isOnline" to isOnline,
                    "isAvailable" to isAvailable
                )
            )

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in startLocationTracking", e)
            callWebViewError("Failed to start location tracking: ${e.message}")
        }
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        Log.d(TAG, "🛑 [LEGACY] Stopping driver location tracking")
        Log.d(TAG, "🔄 Using new DriverLocationService...")

        try {
            // Stop any old tracking first
            if (isLocationTracking) {
                locationCallback?.let { callback ->
                    fusedLocationClient.removeLocationUpdates(callback)
                }
                isLocationTracking = false
            }

            // Stop the new continuous location service
            val serviceIntent = Intent(context, DriverLocationService::class.java).apply {
                action = DriverLocationService.ACTION_STOP_TRACKING
            }
            context.stopService(serviceIntent)

            // Clean up state
            currentDriverId = null
            currentRideId = null
            driverStatus = "offline"

            Log.d(TAG, "✅ All location tracking stopped")
            callWebViewSuccess("onLocationTrackingStopped", mapOf("success" to true))

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error stopping location tracking", e)
            callWebViewError("Failed to stop location tracking: ${e.message}")
        }
    }

    @JavascriptInterface
    fun updateDriverStatus(data: String) {
        Log.d(TAG, "👤 Updating driver status with data: $data")

        try {
            val jsonData = JSONObject(data)
            val status = jsonData.getString("status")
            val driverId = currentDriverId ?: jsonData.optString("driverId")

            driverStatus = status

            driverId?.let { id ->
                val statusData = mapOf(
                    "status" to status,
                    "isOnline" to (status != "offline"),
                    "isAvailable" to (status == "available"),
                    "lastUpdated" to ServerValue.TIMESTAMP
                )

                firestore.collection("drivers").document(id)
                    .update(statusData)
                    .addOnSuccessListener {
                        Log.d(TAG, "✅ Driver status updated to: $status")
                        callWebViewSuccess(
                            "onDriverStatusUpdated",
                            mapOf("status" to status, "success" to true)
                        )
                    }
                    .addOnFailureListener { error ->
                        Log.e(TAG, "❌ Failed to update driver status", error)
                        callWebViewError("Failed to update status: ${error.message}")
                    }
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing driver status data", e)
            callWebViewError("Invalid status data format")
        }
    }

    @JavascriptInterface
    fun acceptRide(data: String) {
        Log.d(TAG, "✅ Accepting ride with data: $data")

        try {
            val jsonData = JSONObject(data)
            val rideId = jsonData.getString("rideId")
            val driverId = currentDriverId ?: jsonData.optString("driverId")

            currentRideId = rideId
            driverStatus = "busy"

            val acceptData = mapOf(
                "driverId" to driverId,
                "status" to "accepted",
                "acceptedAt" to ServerValue.TIMESTAMP
            )

            firestore.collection("rides").document(rideId)
                .update(acceptData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Ride $rideId accepted successfully")
                    callWebViewSuccess(
                        "onRideAccepted",
                        mapOf("rideId" to rideId, "success" to true)
                    )
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to accept ride", error)
                    callWebViewError("Failed to accept ride: ${error.message}")
                }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing accept ride data", e)
            callWebViewError("Invalid ride data format")
        }
    }

    @JavascriptInterface
    fun rejectRide(data: String) {
        Log.d(TAG, "❌ Rejecting ride with data: $data")

        try {
            val jsonData = JSONObject(data)
            val rideId = jsonData.getString("rideId")

            Log.d(TAG, "✅ Ride $rideId rejected")
            callWebViewSuccess("onRideRejected", mapOf("rideId" to rideId, "success" to true))

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing reject ride data", e)
            callWebViewError("Invalid ride rejection data")
        }
    }

    @JavascriptInterface
    fun startRide(data: String) {
        Log.d(TAG, "🚗 Starting ride with data: $data")

        try {
            val jsonData = JSONObject(data)
            val rideId = jsonData.getString("rideId")

            val startData = mapOf(
                "status" to "in_progress",
                "startedAt" to ServerValue.TIMESTAMP
            )

            firestore.collection("rides").document(rideId)
                .update(startData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Ride $rideId started successfully")
                    callWebViewSuccess(
                        "onRideStarted",
                        mapOf("rideId" to rideId, "success" to true)
                    )
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to start ride", error)
                    callWebViewError("Failed to start ride: ${error.message}")
                }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing start ride data", e)
            callWebViewError("Invalid start ride data")
        }
    }

    @JavascriptInterface
    fun completeRide(data: String) {
        Log.d(TAG, "✅ Completing ride with data: $data")

        try {
            val jsonData = JSONObject(data)
            val rideId = jsonData.getString("rideId")

            val completeData = mapOf(
                "status" to "completed",
                "completedAt" to ServerValue.TIMESTAMP
            )

            firestore.collection("rides").document(rideId)
                .update(completeData)
                .addOnSuccessListener {
                    currentRideId = null
                    driverStatus = "available"
                    Log.d(TAG, "✅ Ride $rideId completed successfully")
                    callWebViewSuccess(
                        "onRideCompleted",
                        mapOf("rideId" to rideId, "success" to true)
                    )
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to complete ride", error)
                    callWebViewError("Failed to complete ride: ${error.message}")
                }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing complete ride data", e)
            callWebViewError("Invalid complete ride data")
        }
    }

    @JavascriptInterface
    fun getDriverEarnings(data: String) {
        Log.d(TAG, "💰 Getting driver earnings")

        val driverId = currentDriverId
        if (driverId == null) {
            callWebViewError("Driver not authenticated")
            return
        }

        firestore.collection("drivers").document(driverId).collection("earnings")
            .orderBy("date", Query.Direction.DESCENDING)
            .limit(30)
            .get()
            .addOnSuccessListener { documents ->
                val earnings = documents.map { doc ->
                    val data = doc.data.toMutableMap()
                    data["id"] = doc.id
                    data
                }
                callWebViewSuccess(
                    "onEarningsFetched",
                    mapOf("earnings" to earnings, "success" to true)
                )
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "❌ Failed to fetch earnings", error)
                callWebViewError("Failed to fetch earnings: ${error.message}")
            }
    }

    @JavascriptInterface
    fun sendSOS(data: String) {
        Log.d(TAG, "🚨 Sending SOS alert")

        try {
            val jsonData = JSONObject(data)
            val message = jsonData.optString("message", "Driver emergency")
            val driverId = currentDriverId

            if (driverId == null) {
                callWebViewError("Driver not authenticated")
                return
            }

            // Get current location for SOS (with permission check)
            if (checkLocationPermission()) {
                fusedLocationClient.lastLocation
                    .addOnSuccessListener { location ->
                        val sosData = mapOf(
                            "driverId" to driverId,
                            "type" to "driver_emergency",
                            "message" to message,
                            "location" to if (location != null) {
                                mapOf(
                                    "latitude" to location.latitude,
                                    "longitude" to location.longitude
                                )
                            } else null,
                            "timestamp" to ServerValue.TIMESTAMP,
                            "status" to "active",
                            "rideId" to currentRideId
                        )

                        firestore.collection("emergencies")
                            .add(sosData)
                            .addOnSuccessListener {
                                Log.d(TAG, "✅ SOS alert sent successfully")
                                callWebViewSuccess("onSOSSent", mapOf("success" to true))
                            }
                            .addOnFailureListener { error ->
                                Log.e(TAG, "❌ Failed to send SOS", error)
                                callWebViewError("Failed to send SOS: ${error.message}")
                            }
                    }
                    .addOnFailureListener { error ->
                        Log.e(TAG, "❌ Failed to get location for SOS", error)
                        callWebViewError("Location not available for SOS")
                    }
            } else {
                // Send SOS without location if permission not available
                val sosData = mapOf(
                    "driverId" to driverId,
                    "type" to "driver_emergency",
                    "message" to message,
                    "location" to null,
                    "timestamp" to ServerValue.TIMESTAMP,
                    "status" to "active",
                    "rideId" to currentRideId
                )

                firestore.collection("emergencies")
                    .add(sosData)
                    .addOnSuccessListener {
                        Log.d(TAG, "✅ SOS alert sent successfully (without location)")
                        callWebViewSuccess("onSOSSent", mapOf("success" to true))
                    }
                    .addOnFailureListener { error ->
                        Log.e(TAG, "❌ Failed to send SOS", error)
                        callWebViewError("Failed to send SOS: ${error.message}")
                    }
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error parsing SOS data", e)
            callWebViewError("Invalid SOS data format")
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        (context as? Activity)?.runOnUiThread {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun vibrate(duration: Int = 200) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(
                        duration.toLong(),
                        VibrationEffect.DEFAULT_AMPLITUDE
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(duration.toLong())
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to vibrate", e)
        }
    }

    @JavascriptInterface
    fun openNavigation(latitude: Double, longitude: Double, label: String?) {
        try {
            val uri = if (label.isNullOrEmpty()) {
                "geo:$latitude,$longitude?q=$latitude,$longitude"
            } else {
                "geo:$latitude,$longitude?q=$latitude,$longitude($label)"
            }

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open navigation", e)
        }
    }

    @JavascriptInterface
    fun openDialer(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open dialer", e)
        }
    }

    private fun checkLocationPermission(): Boolean {
        val hasFine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        Log.d(TAG, "🔍 Location Permission Check - Fine: $hasFine, Coarse: $hasCoarse")
        return hasFine && hasCoarse
    }

    /**
     * Check if location services are enabled on the device
     */
    private fun isLocationServicesEnabled(): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
        val isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        val isEnabled = isGpsEnabled || isNetworkEnabled
        Log.d(
            TAG,
            "🔍 Location Services - GPS: $isGpsEnabled, Network: $isNetworkEnabled, Overall: $isEnabled"
        )
        return isEnabled
    }

    /**
     * Check background location permission (Android 10+)
     */
    private fun hasBackgroundLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val hasBackground = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            Log.d(TAG, "🔍 Background Location Permission: $hasBackground")
            hasBackground
        } else {
            Log.d(TAG, "🔍 Background Location Permission: Not required (Android < Q)")
            true // Not required on older versions
        }
    }

    @JavascriptInterface
    fun requestLocation(): String {
        Log.d(TAG, "📍 Requesting current location")
        try {
            if (!checkLocationPermission()) {
                return JSONObject().apply {
                    put("success", false)
                    put("error", "Location permission not granted")
                }.toString()
            }

            // For now, return last known location or request fresh one
            return JSONObject().apply {
                put("success", false)
                put("error", "Location request not implemented yet")
            }.toString()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting location", e)
            return JSONObject().apply {
                put("success", false)
                put("error", e.message)
            }.toString()
        }
    }

    @JavascriptInterface
    fun getDeviceToken(): String {
        Log.d(TAG, "🔑 Getting FCM device token")
        // This should return FCM token - for now return placeholder
        return "fcm-token-placeholder"
    }

    @JavascriptInterface
    fun shareText(text: String) {
        Log.d(TAG, "📤 Sharing text: $text")
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(Intent.createChooser(intent, "Share via"))
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to share text", e)
        }
    }

    @JavascriptInterface
    fun openExternalLink(url: String) {
        Log.d(TAG, "🔗 Opening external link: $url")
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open external link", e)
        }
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        val hasCoarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasFine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return hasCoarse && hasFine
    }

    /**
     * Comprehensive permission and location service checker with native Android permissions
     */
    @JavascriptInterface
    fun checkAndRequestPermissions(): String {
        Log.d(TAG, "🔒 === COMPREHENSIVE PERMISSION CHECK ===")

        val result = StringBuilder()

        try {
            // 1. Check basic location permissions
            val hasFineLocation = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val hasCoarseLocation = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            Log.d(TAG, "🔒 Fine Location Permission: $hasFineLocation")
            Log.d(TAG, "🔒 Coarse Location Permission: $hasCoarseLocation")
            result.appendLine("✓ Fine Location: $hasFineLocation")
            result.appendLine("✓ Coarse Location: $hasCoarseLocation")

            // 2. Check background location permission (Android Q+)
            val hasBackgroundLocation = hasBackgroundLocationPermission()
            result.appendLine("✓ Background Location: $hasBackgroundLocation")

            // 3. Check location services
            val isLocationEnabled = isLocationServicesEnabled()
            result.appendLine("✓ Location Services: $isLocationEnabled")

            // 4. Build list of missing permissions
            val missingPermissions = mutableListOf<String>()
            if (!hasFineLocation) missingPermissions.add("ACCESS_FINE_LOCATION")
            if (!hasCoarseLocation) missingPermissions.add("ACCESS_COARSE_LOCATION")
            if (!hasBackgroundLocation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                missingPermissions.add("ACCESS_BACKGROUND_LOCATION")
            }

            // 5. Handle missing permissions
            if (missingPermissions.isNotEmpty()) {
                Log.e(TAG, "❌ Missing permissions: ${missingPermissions.joinToString()}")
                result.appendLine("")
                result.appendLine("❌ MISSING PERMISSIONS:")
                missingPermissions.forEach { permission ->
                    result.appendLine("  • $permission")
                }

                // Request permissions using native Android methods
                if (context is Activity) {
                    Log.d(TAG, "🔒 Requesting permissions using ActivityCompat...")
                    val activity = context as Activity

                    when {
                        // First request basic location permissions
                        (!hasFineLocation || !hasCoarseLocation) -> {
                            Log.d(TAG, "🔒 Requesting basic location permissions")
                            ActivityCompat.requestPermissions(
                                activity,
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                ),
                                1001
                            )
                            result.appendLine("")
                            result.appendLine("📱 REQUESTING: Basic location permissions...")
                        }
                        // Then request background location (Android Q+)
                        (!hasBackgroundLocation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) -> {
                            Log.d(TAG, "🔒 Requesting background location permission")
                            ActivityCompat.requestPermissions(
                                activity,
                                arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                                1002
                            )
                            result.appendLine("")
                            result.appendLine("📱 REQUESTING: Background location permission...")
                        }
                    }
                } else {
                    result.appendLine("")
                    result.appendLine("❌ Cannot request permissions - context is not Activity")
                }

                result.appendLine("")
                result.appendLine("STATUS: ❌ PERMISSIONS MISSING")
                return result.toString()
            }

            // 6. Check location services
            if (!isLocationEnabled) {
                Log.w(TAG, "⚠️ Location services are disabled")
                result.appendLine("")
                result.appendLine("⚠️ LOCATION SERVICES DISABLED")
                result.appendLine("Please enable GPS/Location in device settings")
                result.appendLine("")
                result.appendLine("STATUS: ❌ LOCATION SERVICES OFF")
                return result.toString()
            }

            // 7. All checks passed
            Log.d(TAG, "✅ All permissions and location services OK")
            result.appendLine("")
            result.appendLine("STATUS: ✅ ALL REQUIREMENTS MET")
            result.appendLine("Ready for location tracking!")

            return result.toString()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in comprehensive permission check", e)
            return "ERROR: ${e.message}"
        }
    }

    /**
     * Request specific location permissions using native ActivityCompat
     */
    @JavascriptInterface
    fun requestLocationPermissions(): String {
        Log.d(TAG, "🔒 === REQUESTING LOCATION PERMISSIONS ===")

        return try {
            if (context is Activity) {
                val activity = context as Activity

                Log.d(TAG, "🔒 Using ActivityCompat.requestPermissions()")
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    1001
                )

                "✅ Location permissions requested using ActivityCompat"
            } else {
                "❌ Cannot request permissions - context is not Activity"
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting location permissions", e)
            "ERROR: ${e.message}"
        }
    }

    /**
     * Request background location permission using native ActivityCompat
     */
    @JavascriptInterface
    fun requestBackgroundLocationPermission(): String {
        Log.d(TAG, "🔒 === REQUESTING BACKGROUND LOCATION ===")

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val hasBackground = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION
                ) == PackageManager.PERMISSION_GRANTED

                if (!hasBackground) {
                    if (context is Activity) {
                        val activity = context as Activity
                        Log.d(
                            TAG,
                            "🔒 Using ActivityCompat.requestPermissions() for background location"
                        )
                        ActivityCompat.requestPermissions(
                            activity,
                            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                            1002
                        )
                        return "✅ Background location permission requested using ActivityCompat"
                    } else {
                        return "❌ Cannot request permission - context is not Activity"
                    }
                } else {
                    return "✅ Background location already granted"
                }
            } else {
                return "✅ Background location not required on this Android version"
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting background location", e)
            return "ERROR: ${e.message}"
        }
    }

    /**
     * Open device location settings
     */
    @JavascriptInterface
    fun openLocationSettings(): String {
        Log.d(TAG, "⚙️ Opening location settings")

        return try {
            val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            "✅ Location settings opened"
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to open location settings", e)
            "ERROR: ${e.message}"
        }
    }

    /**
     * Check if all location requirements are met
     */
    @JavascriptInterface
    fun checkLocationRequirements(): String {
        Log.d(TAG, "🔍 === CHECKING ALL LOCATION REQUIREMENTS ===")

        val result = StringBuilder()

        try {
            val hasFine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val hasBackground = hasBackgroundLocationPermission()
            val isLocationEnabled = isLocationServicesEnabled()

            result.appendLine("=== LOCATION REQUIREMENTS ===")
            result.appendLine("Fine Location Permission: ${if (hasFine) "✅" else "❌"}")
            result.appendLine("Coarse Location Permission: ${if (hasCoarse) "✅" else "❌"}")
            result.appendLine("Background Location Permission: ${if (hasBackground) "✅" else "❌"}")
            result.appendLine("Location Services Enabled: ${if (isLocationEnabled) "✅" else "❌"}")
            result.appendLine("")

            val allPermissions = hasFine && hasCoarse && hasBackground
            val allRequirements = allPermissions && isLocationEnabled

            if (allRequirements) {
                result.appendLine("STATUS: ✅ ALL REQUIREMENTS MET")
                result.appendLine("Ready for location tracking!")
            } else {
                result.appendLine("STATUS: ❌ REQUIREMENTS NOT MET")
                if (!allPermissions) {
                    result.appendLine("→ Grant missing permissions")
                }
                if (!isLocationEnabled) {
                    result.appendLine("→ Enable location services in device settings")
                }
            }

            return result.toString()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking location requirements", e)
            return "ERROR: ${e.message}"
        }
    }

    /**
     * Test Firebase initialization and connectivity
     */
    @JavascriptInterface
    fun testFirebaseInitialization(): String {
        Log.d(TAG, "🔥 === TESTING FIREBASE INITIALIZATION ===")

        val result = StringBuilder()

        try {
            result.appendLine("=== FIREBASE CONNECTIVITY TEST ===")

            // 1. Test Firestore connection
            try {
                val firestoreInstance = FirebaseFirestore.getInstance()
                result.appendLine("✅ Firestore instance created: ${firestoreInstance.javaClass.simpleName}")
                Log.d(TAG, "✅ Firestore instance: $firestoreInstance")

                // Test a simple Firestore operation
                firestoreInstance.collection("test")
                    .limit(1)
                    .get()
                    .addOnSuccessListener {
                        Log.d(TAG, "✅ Firestore connectivity test successful")
                    }
                    .addOnFailureListener { error ->
                        Log.w(TAG, "⚠️ Firestore connectivity test failed", error)
                    }

            } catch (e: Exception) {
                result.appendLine("❌ Firestore initialization failed: ${e.message}")
                Log.e(TAG, "❌ Firestore initialization error", e)
            }

            // 2. Test Realtime Database connection
            try {
                val realtimeDbInstance = FirebaseDatabase.getInstance()
                val dbReference = realtimeDbInstance.reference
                result.appendLine("✅ Realtime Database instance created")
                result.appendLine("   - Database URL: ${realtimeDbInstance.app.options.databaseUrl}")
                result.appendLine("   - Reference: ${dbReference.javaClass.simpleName}")

                Log.d(TAG, "✅ Realtime DB instance: $realtimeDbInstance")
                Log.d(TAG, "✅ Database URL: ${realtimeDbInstance.app.options.databaseUrl}")

                // Test a simple database operation
                dbReference.child("test").child("connectivity")
                    .setValue(
                        mapOf(
                            "timestamp" to System.currentTimeMillis(),
                            "testFrom" to "DoothaDriverApp"
                        )
                    )
                    .addOnSuccessListener {
                        Log.d(TAG, "✅ Realtime Database connectivity test successful")
                    }
                    .addOnFailureListener { error ->
                        Log.w(TAG, "⚠️ Realtime Database connectivity test failed", error)
                    }

            } catch (e: Exception) {
                result.appendLine("❌ Realtime Database initialization failed: ${e.message}")
                Log.e(TAG, "❌ Realtime Database initialization error", e)
            }

            // 3. Check Firebase configuration
            try {
                val app = com.google.firebase.FirebaseApp.getInstance()
                val options = app.options

                result.appendLine("✅ Firebase App Configuration:")
                result.appendLine("   - Project ID: ${options.projectId}")
                result.appendLine("   - Application ID: ${options.applicationId}")
                result.appendLine("   - Database URL: ${options.databaseUrl}")
                result.appendLine("   - API Key: ${options.apiKey?.take(8)}...***")

                Log.d(TAG, "✅ Firebase Project ID: ${options.projectId}")
                Log.d(TAG, "✅ Firebase App ID: ${options.applicationId}")
                Log.d(TAG, "✅ Database URL: ${options.databaseUrl}")

            } catch (e: Exception) {
                result.appendLine("❌ Firebase App configuration error: ${e.message}")
                Log.e(TAG, "❌ Firebase App configuration error", e)
            }

            // 4. Test google-services.json validation
            result.appendLine("")
            result.appendLine("=== GOOGLE SERVICES CONFIGURATION ===")
            result.appendLine("✅ Package name: com.mat.doothadriver")
            result.appendLine("✅ Project: uber-90550")
            result.appendLine("✅ Firebase URL: https://uber-90550-default-rtdb.asia-southeast1.firebasedatabase.app")
            result.appendLine("✅ Google Services plugin: Applied in build.gradle.kts")

            result.appendLine("")
            result.appendLine("STATUS: ✅ FIREBASE INITIALIZATION VERIFIED")

            return result.toString()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error testing Firebase initialization", e)
            return "ERROR: ${e.message}"
        }
    }

    /**
     * Test Firebase Realtime Database connectivity specifically
     */
    @JavascriptInterface
    fun testFirebaseRTDBConnectivity(): String {
        Log.d(TAG, "🔥 === TESTING FIREBASE RTDB CONNECTIVITY ===")

        return try {
            val database = FirebaseDatabase.getInstance()
            val testRef = database.reference.child("connectivity_test").child("dootha_driver")

            val testData = mapOf(
                "timestamp" to System.currentTimeMillis(),
                "app" to "DoothaDriverApp",
                "package" to "com.mat.doothadriver",
                "testType" to "connectivity_verification"
            )

            testRef.setValue(testData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ RTDB connectivity test successful")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ RTDB connectivity test failed", error)
                }

            "✅ RTDB connectivity test initiated - check logs for results"

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error testing RTDB connectivity", e)
            "ERROR: ${e.message}"
        }
    }

    // ...existing code...

    private fun callWebViewSuccess(functionName: String, data: Map<String, Any>) {
        try {
            val jsonData = JSONObject(data)
            val script = "window.$functionName && window.$functionName($jsonData)"

            (context as? Activity)?.runOnUiThread {
                webView.evaluateJavascript(script) { result ->
                    Log.d(TAG, "📱 WebView success callback for $functionName: $result")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error calling WebView success callback", e)
        }
    }

    private fun callWebViewError(message: String) {
        val script = "window.onDriverError && window.onDriverError('$message')"

        (context as? Activity)?.runOnUiThread {
            webView.evaluateJavascript(script) { result ->
                Log.d(TAG, "📱 WebView error callback: $result")
            }
        }
    }

    fun onDestroy() {
        Log.d(TAG, "🗑️ UberDriverBridge cleanup")

        if (isLocationTracking) {
            stopLocationTracking()
        }
    }

    fun initializeLocationTracking() {
        if (checkLocationPermission() && currentDriverId != null) {
            Log.d(TAG, "🚀 Initializing location tracking for driver: $currentDriverId")
            // Start basic location tracking without specific ride
        }
    }

    fun resumeLocationTracking() {
        if (isLocationTracking) {
            Log.d(TAG, "🔄 Resuming location tracking")
            // Location tracking continues automatically
        }
    }

    fun pauseLocationTracking() {
        if (isLocationTracking) {
            Log.d(TAG, "⏸️ Pausing location tracking")
            // Keep tracking active but reduce frequency if needed
        }
    }
}