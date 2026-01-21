package com.mat.theypodelivery

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.annotation.RequiresPermission
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

class WebAppInterface(
    private val context: Context,
    private val webView: WebView,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val onRequestLocationPermission: () -> Unit
) {
    companion object {
        private const val TAG = "WebAppInterface"
    }

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun requestLocation() {
        Log.d(TAG, "One-time location request")

        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted for one-time request")
            onRequestLocationPermission()
            return
        }

        Log.d(TAG, "Getting single location update")
        try {
            getCurrentLocation { lat, lng, error ->
                if (error != null) {
                    Log.e(TAG, "One-time location error: $error")
                    callJavaScript("window.receiveLocationError", "\"$error\"")
                } else {
                    Log.d(TAG, "One-time location received: lat=$lat, lng=$lng")
                    callJavaScript("window.receiveLocation", lat.toString(), lng.toString())
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException when getting one-time location", e)
            callJavaScript("window.receiveLocationError", "\"Location permission denied\"")
        }
    }

    @JavascriptInterface
    fun startLocationTracking(deliveryPartnerId: String, orderId: String) {
        Log.d(TAG, "=== startLocationTracking Called ===")
        Log.d(TAG, "Partner ID: '$deliveryPartnerId'")
        Log.d(TAG, "Order ID: '$orderId'")
        Log.d(TAG, "Order ID is null/empty: ${orderId.isEmpty()}")
        Log.d(TAG, "Order ID equals 'no-order': ${orderId == "no-order"}")

        // Handle null parameters that might come from JavaScript as "null" strings
        val safeDeliveryPartnerId =
            if (deliveryPartnerId == "null" || deliveryPartnerId == "undefined") {
                Log.w(
                    TAG,
                    "⚠️ deliveryPartnerId received as '$deliveryPartnerId', converting to empty string"
                )
                ""
            } else {
                deliveryPartnerId
            }

        val safeOrderId = if (orderId == "null" || orderId == "undefined") {
            Log.w(TAG, "⚠️ orderId received as '$orderId', converting to 'no-order'")
            "no-order"
        } else {
            orderId
        }

        // Validate inputs
        if (safeDeliveryPartnerId.isEmpty()) {
            Log.e(TAG, "❌ CRITICAL: deliveryPartnerId is empty!")
            Toast.makeText(context, "Error: Delivery Partner ID is required", Toast.LENGTH_SHORT)
                .show()
            return
        }

        if (!hasLocationPermission()) {
            Log.w(TAG, "❌ Location permission not granted for tracking")
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        // Normalize order ID - handle null, empty, or "no-order"
        val normalizedOrderId = when {
            safeOrderId.isEmpty() || safeOrderId == "no-order" || safeOrderId.equals(
                "null",
                ignoreCase = true
            ) -> {
                Log.d(TAG, "No active order - partner going online")
                null
            }

            else -> {
                Log.d(TAG, "Active delivery order: $safeOrderId")
                safeOrderId
            }
        }

        Log.d(TAG, "Normalized Order ID: $normalizedOrderId")
        Log.d(TAG, "Starting location tracking service for partner: $safeDeliveryPartnerId")

        // Start foreground service for continuous location tracking
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_START_TRACKING
            putExtra("deliveryPartnerId", safeDeliveryPartnerId)
            putExtra("orderId", normalizedOrderId)

            // Add default zone data (can be updated later via updateDeliveryZone)
            putExtra(LocationService.EXTRA_DELIVERY_ZONE, "pk4HklhD1kBNq1XT4KVS")
            putExtra(LocationService.EXTRA_ZONE_NAME, "huzurabad")
            putExtra(LocationService.EXTRA_ZONE_STATUS, "in-zone")
            putExtra(LocationService.EXTRA_IS_AVAILABLE, true)
            putExtra(LocationService.EXTRA_IS_ONLINE, true)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "Starting foreground service for Android O+")
                context.startForegroundService(intent)
            } else {
                Log.d(TAG, "Starting regular service for older Android")
                context.startService(intent)
            }
            Log.i(TAG, "✅ Location tracking service started successfully")

            val message = if (normalizedOrderId != null) {
                "📍 Location tracking started for delivery #${normalizedOrderId.takeLast(6)}"
            } else {
                "📍 You are online - Ready to receive orders"
            }
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()

            // Notify web app about successful tracking start
            callJavaScript(
                "window.onLocationTrackingStarted",
                "\"$safeDeliveryPartnerId\"",
                "\"${normalizedOrderId ?: "no-order"}\""
            )

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start location tracking service", e)
            Toast.makeText(
                context,
                "Failed to start location tracking: ${e.message}",
                Toast.LENGTH_LONG
            ).show()

            // Notify web app about failure
            callJavaScript(
                "window.onLocationTrackingError",
                "\"Failed to start tracking: ${e.message}\""
            )
        }
    }


    @JavascriptInterface
    fun startLocationTracking(orderId: String) {
        Log.d(TAG, "startLocationTracking called with orderId: $orderId")
        Log.w(
            TAG,
            "⚠️ WARNING: startLocationTracking without deliveryPartnerId - may not work properly!"
        )

        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted for tracking")
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        Log.d(TAG, "Starting foreground location tracking service for order: $orderId")
        // Start foreground service for continuous location tracking
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_START_TRACKING
            putExtra("orderId", orderId)
            // NOTE: deliveryPartnerId is missing! This method should not be used.
            // Use startLocationTracking(deliveryPartnerId, orderId) instead.
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "Starting foreground service for Android O+")
                context.startForegroundService(intent)
            } else {
                Log.d(TAG, "Starting service for older Android versions")
                context.startService(intent)
            }
            Log.i(
                TAG,
                "Foreground location tracking service started successfully for order: $orderId"
            )
            Toast.makeText(context, "Location tracking started (no partner ID)", Toast.LENGTH_SHORT)
                .show()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground location tracking service", e)
            Toast.makeText(context, "Failed to start location tracking", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        Log.d(TAG, "stopLocationTracking called")
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_STOP_TRACKING
        }

        try {
            context.stopService(intent)
            Log.i(TAG, "Location tracking service stopped successfully")
            Toast.makeText(context, "Location tracking stopped", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop location tracking service", e)
            Toast.makeText(context, "Failed to stop location tracking", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun startLocationTrackingWithZone(
        deliveryPartnerId: String,
        orderId: String,
        zoneData: String
    ) {
        Log.d(
            TAG,
            "startLocationTrackingWithZone called - Partner: $deliveryPartnerId, Order: $orderId"
        )

        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted for tracking")
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        try {
            val zoneInfo = org.json.JSONObject(zoneData)
            val deliveryZone = zoneInfo.optString("deliveryZone", "pk4HklhD1kBNq1XT4KVS")
            val zoneName = zoneInfo.optString("zoneName", "huzurabad")
            val zoneStatus = zoneInfo.optString("zoneStatus", "in-zone")
            val isAvailable = zoneInfo.optBoolean("isAvailable", true)
            val isOnline = zoneInfo.optBoolean("isOnline", true)

            Log.d(TAG, "Starting location tracking service with zone data:")
            Log.d(TAG, "  - Zone: $zoneName ($deliveryZone)")
            Log.d(TAG, "  - Status: $zoneStatus")
            Log.d(TAG, "  - Available: $isAvailable, Online: $isOnline")

            // Start foreground service for continuous location tracking with zone data
            val intent = Intent(context, LocationService::class.java).apply {
                action = LocationService.ACTION_START_TRACKING
                putExtra("deliveryPartnerId", deliveryPartnerId)
                putExtra("orderId", if (orderId == "no-order") null else orderId)
                putExtra(LocationService.EXTRA_DELIVERY_ZONE, deliveryZone)
                putExtra(LocationService.EXTRA_ZONE_NAME, zoneName)
                putExtra(LocationService.EXTRA_ZONE_STATUS, zoneStatus)
                putExtra(LocationService.EXTRA_IS_AVAILABLE, isAvailable)
                putExtra(LocationService.EXTRA_IS_ONLINE, isOnline)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "Starting foreground service for location tracking")
                context.startForegroundService(intent)
            } else {
                Log.d(TAG, "Starting service for location tracking")
                context.startService(intent)
            }
            Log.i(TAG, "Location tracking service started successfully with zone data")

            val message = if (orderId != "no-order") {
                "Location tracking started for delivery in $zoneName"
            } else {
                "You are online in $zoneName - Location tracking active"
            }
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start location tracking service with zone data", e)
            Toast.makeText(context, "Failed to start location tracking", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getDeviceToken(callback: String) {
        Log.d(TAG, "getDeviceToken called with callback: $callback")
        // Get FCM token
        com.google.firebase.messaging.FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                Log.d(TAG, "FCM token retrieved successfully: ${token.take(20)}...")
                callJavaScript(callback, "\"$token\"")
            }
            .addOnFailureListener { exception ->
                Log.e(TAG, "Failed to get FCM token", exception)
                callJavaScript(callback, "null")
            }
    }

    @RequiresPermission(Manifest.permission.VIBRATE)
    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        Log.d(TAG, "vibrate called with duration: ${milliseconds}ms")
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager =
                context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(
                        milliseconds,
                        VibrationEffect.DEFAULT_AMPLITUDE
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(milliseconds)
            }
            Log.d(TAG, "Vibration executed successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to vibrate device", e)
        }
    }

    @JavascriptInterface
    fun openExternalLink(url: String) {
        Log.d(TAG, "openExternalLink called with URL: $url")
        try {
            val intent = Intent(Intent.ACTION_VIEW, url.toUri())
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            Log.d(TAG, "External link opened successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open external link: $url", e)
            Toast.makeText(context, "Cannot open link", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun shareText(text: String) {
        Log.d(TAG, "shareText called with text length: ${text.length}")
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(Intent.createChooser(intent, "Share via").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
            Log.d(TAG, "Share intent launched successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share text", e)
        }
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        Log.d(TAG, "hasLocationPermission called, result: $hasPermission")
        return hasPermission
    }

    @JavascriptInterface
    fun startLocationTrackingWithPartner(deliveryPartnerId: String, orderId: String) {
        Log.d(
            TAG,
            "startLocationTrackingWithPartner called with partnerId: $deliveryPartnerId, orderId: $orderId"
        )

        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted for partner tracking")
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        (context as? MainActivity)?.runOnUiThread {
            try {
                Log.d(
                    TAG,
                    "Starting location tracking service for partner: $deliveryPartnerId, order: $orderId"
                )
                // Start foreground service for location tracking
                val intent = Intent(context, LocationService::class.java).apply {
                    action = LocationService.ACTION_START_TRACKING
                    putExtra("orderId", if (orderId == "no-order") null else orderId)
                    putExtra("deliveryPartnerId", deliveryPartnerId)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Log.d(TAG, "Starting foreground service for partner tracking (Android O+)")
                    context.startForegroundService(intent)
                } else {
                    Log.d(TAG, "Starting service for partner tracking (older Android)")
                    context.startService(intent)
                }
                Log.i(TAG, "Partner location tracking service started successfully")

                val message = if (orderId != "no-order") {
                    "Location tracking started for delivery"
                } else {
                    "You are online - Location tracking active"
                }
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start partner location tracking", e)
                Toast.makeText(context, "Failed to start tracking", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun requestBackgroundLocationPermission() {
        Log.d(TAG, "requestBackgroundLocationPermission called")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Log.d(TAG, "Android Q+ detected, background location permission needed")
            (context as? MainActivity)?.let { _ ->
                // This should be handled by the activity, not here
                Log.w(TAG, "Background location permission handling delegated to activity")
                Toast.makeText(context, "Background location permission needed", Toast.LENGTH_SHORT)
                    .show()
            }
        } else {
            Log.d(TAG, "Android version < Q, background location permission not required")
        }
    }

    @JavascriptInterface
    fun isInBackground(): Boolean {
        val appProcessInfo = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(appProcessInfo)
        val isBackground =
            appProcessInfo.importance != ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        Log.d(
            TAG,
            "isInBackground called, result: $isBackground (importance: ${appProcessInfo.importance})"
        )
        return isBackground
    }

    @JavascriptInterface
    fun openNavigation(latitude: Double, longitude: Double, label: String = "Destination") {
        Log.d(TAG, "openNavigation called with lat: $latitude, lng: $longitude, label: $label")
        try {
            // Create Google Maps navigation intent
            val gmmIntentUri = "google.navigation:q=$latitude,$longitude".toUri()
            val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri).apply {
                setPackage("com.google.android.apps.maps")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }

            // Check if Google Maps is installed
            if (mapIntent.resolveActivity(context.packageManager) != null) {
                Log.d(TAG, "Opening Google Maps navigation")
                context.startActivity(mapIntent)
            } else {
                // Fallback to web Google Maps
                Log.d(TAG, "Google Maps not installed, using web fallback")
                val webIntent = Intent(Intent.ACTION_VIEW).apply {
                    data =
                        "https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude".toUri()
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(webIntent)
            }
            Log.d(TAG, "Navigation opened successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open navigation", e)
            Toast.makeText(context, "Cannot open navigation", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun openDialer(phoneNumber: String) {
        Log.d(TAG, "openDialer called with number: $phoneNumber")
        try {
            val intent = Intent(Intent.ACTION_DIAL).apply {
                data = "tel:+91$phoneNumber".toUri()
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            Log.d(TAG, "Dialer opened successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open dialer", e)
            Toast.makeText(context, "Cannot open dialer", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun checkBatteryOptimization(): Boolean {
        Log.d(TAG, "checkBatteryOptimization called")
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager =
                context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val isIgnoringOptimization =
                powerManager.isIgnoringBatteryOptimizations(context.packageName)
            Log.d(TAG, "Battery optimization ignored: $isIgnoringOptimization")
            isIgnoringOptimization
        } else {
            Log.d(TAG, "Battery optimization not applicable on this Android version")
            true
        }
    }

    @JavascriptInterface
    fun requestBatteryOptimizationExemption() {
        Log.d(TAG, "requestBatteryOptimizationExemption called")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager =
                    context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                if (!powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
                    val intent = Intent().apply {
                        action = Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                        data = Uri.parse("package:${context.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    Log.d(TAG, "Battery optimization settings opened")
                    Toast.makeText(
                        context,
                        "Please allow this app to run in background for continuous location tracking",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Log.d(TAG, "App is already exempt from battery optimization")
                    Toast.makeText(
                        context,
                        "App is already optimized for background running",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } else {
                Log.d(TAG, "Battery optimization not applicable on this Android version")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery optimization settings", e)
            // Fallback to general battery settings
            try {
                val intent = Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                Toast.makeText(
                    context,
                    "Please check battery settings to allow background running",
                    Toast.LENGTH_LONG
                ).show()
            } catch (e2: Exception) {
                Toast.makeText(
                    context,
                    "Please check your device's battery settings to allow this app to run in background",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }


    fun onLocationPermissionGranted() {
        Log.d(TAG, "onLocationPermissionGranted called")
        // Notify web app that permission was granted
        callJavaScript("window.onLocationPermissionGranted")
    }

    @RequiresPermission(anyOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun getCurrentLocation(callback: (lat: Double, lng: Double, error: String?) -> Unit) {
        Log.d(TAG, "getCurrentLocation called")
        try {
            val cancellationTokenSource = CancellationTokenSource()

            Log.d(TAG, "Requesting location from FusedLocationProviderClient")
            fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cancellationTokenSource.token
            ).addOnSuccessListener { location: Location? ->
                if (location != null) {
                    Log.d(
                        TAG,
                        "Location received successfully: lat=${location.latitude}, lng=${location.longitude}"
                    )
                    callback(location.latitude, location.longitude, null)
                } else {
                    Log.w(TAG, "Location is null")
                    callback(0.0, 0.0, "Location not available")
                }
            }.addOnFailureListener { exception ->
                Log.e(TAG, "Failed to get location", exception)
                callback(0.0, 0.0, exception.message ?: "Failed to get location")
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException in getCurrentLocation", e)
            callback(0.0, 0.0, "Location permission denied")
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected exception in getCurrentLocation", e)
            callback(0.0, 0.0, "Unexpected error: ${e.message}")
        }
    }

    private fun callJavaScript(function: String, vararg args: String) {
        val argsString = args.joinToString(", ")
        val script = "$function($argsString);"
        Log.d(TAG, "Calling JavaScript: $script")

        (context as? MainActivity)?.runOnUiThread {
            try {
                webView.evaluateJavascript(script) { result ->
                    Log.d(TAG, "JavaScript result for '$script': $result")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to execute JavaScript: $script", e)
            }
        }
    }

    // Delivery Zone and Status Management
    @JavascriptInterface
    fun updateDeliveryZone(
        deliveryPartnerId: String,
        zoneId: String,
        zoneName: String,
        zoneStatus: String
    ) {
        Log.d(
            TAG,
            "updateDeliveryZone called - Partner: $deliveryPartnerId, Zone: $zoneName ($zoneId), Status: $zoneStatus"
        )

        try {
            // First update the running LocationService if active
            val serviceIntent = Intent(context, LocationService::class.java).apply {
                action = LocationService.ACTION_UPDATE_ZONE
                putExtra(LocationService.EXTRA_DELIVERY_ZONE, zoneId)
                putExtra(LocationService.EXTRA_ZONE_NAME, zoneName)
                putExtra(LocationService.EXTRA_ZONE_STATUS, zoneStatus)
            }
            context.startService(serviceIntent)

            val zoneData = hashMapOf<String, Any?>(
                "deliveryZone" to zoneId,
                "zoneName" to zoneName,
                "zoneStatus" to zoneStatus,
                "lastZoneCheck" to com.google.firebase.database.ServerValue.TIMESTAMP
            )

            // Update zone information in Firebase
            com.google.firebase.database.FirebaseDatabase.getInstance()
                .reference
                .child("deliveryPartners")
                .child(deliveryPartnerId)
                .updateChildren(zoneData)
                .addOnSuccessListener {
                    Log.d(
                        TAG,
                        "✅ Delivery zone updated successfully for partner: $deliveryPartnerId"
                    )
                    Toast.makeText(context, "Zone updated: $zoneName", Toast.LENGTH_SHORT).show()
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update delivery zone", error)
                    Toast.makeText(context, "Failed to update zone", Toast.LENGTH_SHORT).show()
                }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error updating delivery zone", e)
        }
    }

    @JavascriptInterface
    fun updatePartnerAvailability(
        deliveryPartnerId: String,
        isAvailable: Boolean,
        isOnline: Boolean
    ) {
        Log.d(
            TAG,
            "updatePartnerAvailability called - Partner: $deliveryPartnerId, Available: $isAvailable, Online: $isOnline"
        )

        try {
            // First update the running LocationService if active
            val serviceIntent = Intent(context, LocationService::class.java).apply {
                action = LocationService.ACTION_UPDATE_AVAILABILITY
                putExtra(LocationService.EXTRA_IS_AVAILABLE, isAvailable)
                putExtra(LocationService.EXTRA_IS_ONLINE, isOnline)
            }
            context.startService(serviceIntent)

            val availabilityData = hashMapOf<String, Any?>(
                "isAvailable" to isAvailable,
                "isOnline" to isOnline,
                "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP
            )

            // Update availability status in Firebase
            com.google.firebase.database.FirebaseDatabase.getInstance()
                .reference
                .child("deliveryPartners")
                .child(deliveryPartnerId)
                .updateChildren(availabilityData)
                .addOnSuccessListener {
                    Log.d(
                        TAG,
                        "✅ Partner availability updated successfully for partner: $deliveryPartnerId"
                    )
                    val status = when {
                        isOnline && isAvailable -> "Online & Available"
                        isOnline && !isAvailable -> "Online & Busy"
                        else -> "Offline"
                    }
                    Toast.makeText(context, "Status: $status", Toast.LENGTH_SHORT).show()
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to update partner availability", error)
                    Toast.makeText(context, "Failed to update status", Toast.LENGTH_SHORT).show()
                }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error updating partner availability", e)
        }
    }

    @JavascriptInterface
    fun initializeDeliveryPartner(deliveryPartnerId: String, partnerData: String) {
        Log.d(TAG, "initializeDeliveryPartner called with partner: $deliveryPartnerId")

        try {
            val partnerInfo = org.json.JSONObject(partnerData)

            val initialData = hashMapOf<String, Any?>(
                "uid" to deliveryPartnerId,
                "isOnline" to true,
                "isAvailable" to true,
                "deliveryZone" to partnerInfo.optString("deliveryZone", "pk4HklhD1kBNq1XT4KVS"),
                "zoneName" to partnerInfo.optString("zoneName", "huzurabad"),
                "zoneStatus" to partnerInfo.optString("zoneStatus", "in-zone"),
                "lastUpdated" to com.google.firebase.database.ServerValue.TIMESTAMP,
                "lastZoneCheck" to com.google.firebase.database.ServerValue.TIMESTAMP,
                "partnerName" to partnerInfo.optString("name", ""),
                "phoneNumber" to partnerInfo.optString("phone", ""),
                "vehicleType" to partnerInfo.optString("vehicleType", ""),
                "vehicleNumber" to partnerInfo.optString("vehicleNumber", "")
            )

            // Initialize delivery partner data in Firebase
            com.google.firebase.database.FirebaseDatabase.getInstance()
                .reference
                .child("deliveryPartners")
                .child(deliveryPartnerId)
                .updateChildren(initialData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Delivery partner initialized successfully: $deliveryPartnerId")
                    callJavaScript("window.onPartnerInitialized", "\"$deliveryPartnerId\"")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to initialize delivery partner", error)
                    callJavaScript("window.onPartnerInitializationError", "\"${error.message}\"")
                }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error initializing delivery partner", e)
            callJavaScript("window.onPartnerInitializationError", "\"${e.message}\"")
        }
    }

    @JavascriptInterface
    fun getDeliveryPartnerStatus(deliveryPartnerId: String) {
        Log.d(TAG, "getDeliveryPartnerStatus called for partner: $deliveryPartnerId")

        try {
            com.google.firebase.database.FirebaseDatabase.getInstance()
                .reference
                .child("deliveryPartners")
                .child(deliveryPartnerId)
                .get()
                .addOnSuccessListener { snapshot ->
                    if (snapshot.exists()) {
                        val partnerData = snapshot.value
                        Log.d(TAG, "✅ Partner data retrieved: $partnerData")

                        val jsonData = org.json.JSONObject()
                        jsonData.put("success", true)
                        jsonData.put("data", partnerData.toString())

                        callJavaScript("window.onPartnerStatusReceived", "\"${jsonData}\"")
                    } else {
                        Log.w(TAG, "❌ No data found for partner: $deliveryPartnerId")
                        callJavaScript("window.onPartnerStatusError", "\"Partner data not found\"")
                    }
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "❌ Failed to retrieve partner status", error)
                    callJavaScript("window.onPartnerStatusError", "\"${error.message}\"")
                }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting delivery partner status", e)
            callJavaScript("window.onPartnerStatusError", "\"${e.message}\"")
        }
    }

    @JavascriptInterface
    fun testLocationTrackingCall(deliveryPartnerId: String, orderId: String) {
        Log.d(TAG, "=== TEST: testLocationTrackingCall ===")
        Log.d(TAG, "This is a test call to verify JavaScript bridge is working")
        Log.d(TAG, "Received - Partner: '$deliveryPartnerId', Order: '$orderId'")

        Toast.makeText(
            context,
            "Test call received!\nPartner: ${deliveryPartnerId.take(10)}...\nOrder: ${orderId}",
            Toast.LENGTH_LONG
        ).show()

        // Call the actual method
        startLocationTracking(deliveryPartnerId, orderId)
    }

    @JavascriptInterface
    fun debugLocationTracking(): String {
        Log.d(TAG, "=== DEBUG: Location Tracking Status ===")

        val hasPermission = hasLocationPermission()
        val serviceRunning = isLocationServiceRunning()

        val debugInfo = org.json.JSONObject().apply {
            put("hasLocationPermission", hasPermission)
            put("isServiceRunning", serviceRunning)
            put("androidVersion", Build.VERSION.SDK_INT)
            put("packageName", context.packageName)
            put("timestamp", System.currentTimeMillis())
        }

        Log.d(TAG, "Debug info: $debugInfo")
        Toast.makeText(context, "Debug info logged - check console", Toast.LENGTH_SHORT).show()

        return debugInfo.toString()
    }

    private fun isLocationServiceRunning(): Boolean {
        return try {
            val manager =
                context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            for (service in manager.getRunningServices(Integer.MAX_VALUE)) {
                if (LocationService::class.java.name == service.service.className) {
                    Log.d(TAG, "LocationService is running")
                    return true
                }
            }
            Log.d(TAG, "LocationService is NOT running")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error checking service status", e)
            false
        }
    }

}
