package com.mat.dootha

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import org.json.JSONObject

class UberCustomerBridge(private val activity: AppCompatActivity, private val webView: WebView) {


    private var fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)
    private var locationCallback: LocationCallback? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isTrackingLocation = false

    @JavascriptInterface
    fun makePhoneCall(phoneNumber: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$phoneNumber")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                showToast("Unable to make call: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getCurrentLocation(): String {
        var locationJson = """{"error": "Location not available"}"""

        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                location?.let {
                    locationJson = """
                        {
                            "lat": ${it.latitude},
                            "lng": ${it.longitude},
                            "accuracy": ${it.accuracy},
                            "timestamp": ${it.time},
                            "source": "native_android_customer"
                        }
                    """.trimIndent()

                    // Send enhanced location to WebView
                    activity.runOnUiThread {
                        webView?.evaluateJavascript(
                            "window.onLocationUpdate && window.onLocationUpdate($locationJson)",
                            null
                        )
                    }
                }
            }
        } catch (e: SecurityException) {
            locationJson = """{"error": "Location permission denied"}"""
        }

        return locationJson
    }


    @JavascriptInterface
    fun requestLocationPermission() {
        activity.runOnUiThread {
            androidx.core.app.ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        }
    }

    @JavascriptInterface
    fun shareRide(rideDetails: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "Track my ride: $rideDetails")
                }
                activity.startActivity(Intent.createChooser(intent, "Share Ride"))
            } catch (e: Exception) {
                showToast("Unable to share: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun vibrate(duration: Int) {
        activity.runOnUiThread {
            try {
                @Suppress("DEPRECATION")
                val vibrator = activity.getSystemService(android.content.Context.VIBRATOR_SERVICE)
                        as android.os.Vibrator
                vibrator.vibrate(duration.toLong())
            } catch (e: Exception) {
                showToast("Vibration error: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun initiatePayment(amount: String, orderId: String): String {
        activity.runOnUiThread {
            try {
                // Initialize Razorpay or other payment gateway
                showToast("Payment of ₹$amount initiated")

                // Return payment result to web app
                val result = """
    {
        "success": true,
        "orderId": "$orderId",
        "paymentId": "pay_${System.currentTimeMillis()}",
        "amount": "$amount"
    }
    """.trimIndent()

                activity.runOnUiThread {
                    // Call JavaScript callback
                    val js = "window.handlePaymentResult && window.handlePaymentResult('$result')"
                    // Execute JavaScript if webview is available
                }
            } catch (e: Exception) {
                showToast("Payment error: ${e.message}")
            }
        }
        return "Payment initiated"
    }

    @JavascriptInterface
    fun openLocationPicker(title: String, initialLat: Double, initialLng: Double): String {
        activity.runOnUiThread {
            try {
                // Launch native location picker or map activity
                val intent =
                    Intent("com.google.android.gms.location.places.ui.PlacePicker.IntentBuilder")
                showToast("Opening location picker: $title")

                // For now, return current location or initial coordinates
                val result = """
    {
        "latitude": $initialLat,
        "longitude": $initialLng,
        "address": "Selected Location"
    }
    """.trimIndent()

                // Simulate location selection callback
                activity.runOnUiThread {
                    val js =
                        "window.handleLocationSelected && window.handleLocationSelected('$result')"
                    // Execute JavaScript if webview is available
                }
            } catch (e: Exception) {
                showToast("Location picker error: ${e.message}")
            }
        }
        return "Location picker opened"
    }

    @JavascriptInterface
    fun submitRating(rideId: String, rating: Int, feedback: String): String {
        activity.runOnUiThread {
            try {
                showToast("Rating submitted: $rating stars")

                // Return success response
                val result = """
    {
        "success": true,
        "rideId": "$rideId",
        "rating": $rating,
        "feedback": "$feedback"
    }
    """.trimIndent()

                activity.runOnUiThread {
                    val js =
                        "window.handleRatingSubmitted && window.handleRatingSubmitted('$result')"
                    // Execute JavaScript if webview is available
                }
            } catch (e: Exception) {
                showToast("Rating error: ${e.message}")
            }
        }
        return "Rating submitted"
    }

    @JavascriptInterface
    fun openMaps(lat: Double, lng: Double, address: String) {
        activity.runOnUiThread {
            try {
                val uri = Uri.parse("geo:$lat,$lng?q=$lat,$lng($address)")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    setPackage("com.google.android.apps.maps")
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to browser
                val browserIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng")
                )
                activity.startActivity(browserIntent)
            }
        }
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        return """
    {
        "platform": "android",
        "model": "${android.os.Build.MODEL}",
        "version": "${android.os.Build.VERSION.RELEASE}",
        "manufacturer": "${android.os.Build.MANUFACTURER}",
        "isTracking": $isTrackingLocation
    }
    """.trimIndent()
    }

    @JavascriptInterface
    fun startLocationTracking() {
        activity.runOnUiThread {
            if (hasLocationPermission()) {
                startTracking()
                webView.evaluateJavascript(
                    "window.onLocationTrackingStarted && window.onLocationTrackingStarted()",
                    null
                )
            } else {
                requestLocationPermissionInternal()
            }
        }
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        activity.runOnUiThread {
            stopTracking()
            webView.evaluateJavascript(
                "window.onLocationTrackingStopped && window.onLocationTrackingStopped()",
                null
            )
        }
    }

    @JavascriptInterface
    fun getLocationTrackingStatus(): String {
        return try {
            val status = JSONObject().apply {
                put("isTracking", isTrackingLocation)
                put("hasPermission", hasLocationPermission())
                put("source", "native_android_customer")
                put("timestamp", System.currentTimeMillis())
            }

            Log.d(TAG, "📊 Customer location status: $status")
            status.toString()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting location status", e)
            JSONObject().apply {
                put("isTracking", false)
                put("hasPermission", false)
                put("error", e.message ?: "Unknown error")
            }.toString()
        }
    }

    private fun startTracking() {
        if (!hasLocationPermission()) return

        isTrackingLocation = true

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10000 // 10 seconds for customer
        ).apply {
            setMinUpdateIntervalMillis(5000) // 5 seconds
            setMaxUpdateDelayMillis(30000) // 30 seconds max delay
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    val locationJson = """
    {
        "lat": ${location.latitude},
        "lng": ${location.longitude},
        "accuracy": ${location.accuracy},
        "speed": ${location.speed ?: 0},
        "bearing": ${location.bearing},
        "timestamp": ${location.time},
        "source": "native_android_customer"
    }
    """.trimIndent()

                    activity.runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onLocationUpdate && window.onLocationUpdate($locationJson)",
                            null
                        )
                    }
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                activity.mainLooper
            )

            activity.runOnUiThread {
                showToast("Location tracking started")
            }
        } catch (e: SecurityException) {
            showToast("Location permission denied")
            isTrackingLocation = false
        }
    }

    private fun stopTracking() {
        isTrackingLocation = false
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }

        activity.runOnUiThread {
            showToast("Location tracking stopped")
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestLocationPermissionInternal() {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ),
            LOCATION_PERMISSION_REQUEST_CODE
        )
    }

    fun cleanup() {
        stopTracking()
        Log.d(TAG, "🧹 UberCustomerBridge cleanup completed")
    }

    @JavascriptInterface
    fun requestPermission(permissionType: String): String {
        return try {
            when (permissionType.lowercase()) {
                "location" -> {
                    requestLocationPermissionInternal()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Location permission request initiated")
                    }.toString()
                }

                "camera" -> {
                    requestCameraPermission()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Camera permission request initiated")
                    }.toString()
                }

                "microphone", "audio" -> {
                    requestMicrophonePermission()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Microphone permission request initiated")
                    }.toString()
                }

                "storage" -> {
                    requestStoragePermission()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Storage permission request initiated")
                    }.toString()
                }

                "phone" -> {
                    requestPhonePermission()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Phone permission request initiated")
                    }.toString()
                }

                "notification" -> {
                    requestNotificationPermission()
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Notification permission request initiated")
                    }.toString()
                }

                else -> {
                    JSONObject().apply {
                        put("success", false)
                        put("error", "Unknown permission type: $permissionType")
                    }.toString()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting permission", e)
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Unknown error")
            }.toString()
        }
    }

    @JavascriptInterface
    fun checkPermissionStatus(permissionType: String): String {
        return try {
            val hasPermission = when (permissionType.lowercase()) {
                "location" -> hasLocationPermission()
                "camera" -> hasCameraPermission()
                "microphone", "audio" -> hasMicrophonePermission()
                "storage" -> hasStoragePermission()
                "phone" -> hasPhonePermission()
                "notification" -> hasNotificationPermission()
                else -> false
            }

            JSONObject().apply {
                put("permissionType", permissionType)
                put("granted", hasPermission)
                put("timestamp", System.currentTimeMillis())
            }.toString()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking permission status", e)
            JSONObject().apply {
                put("permissionType", permissionType)
                put("granted", false)
                put("error", e.message ?: "Unknown error")
            }.toString()
        }
    }

    private fun requestCameraPermission() {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.CAMERA),
            CAMERA_PERMISSION_REQUEST_CODE
        )
    }

    private fun requestMicrophonePermission() {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            MICROPHONE_PERMISSION_REQUEST_CODE
        )
    }

    private fun requestStoragePermission() {
        val permissions =
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                arrayOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.READ_MEDIA_VIDEO,
                    Manifest.permission.READ_MEDIA_AUDIO
                )
            } else {
                arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                )
            }

        ActivityCompat.requestPermissions(
            activity,
            permissions,
            STORAGE_PERMISSION_REQUEST_CODE
        )
    }

    private fun requestPhonePermission() {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.CALL_PHONE),
            PHONE_PERMISSION_REQUEST_CODE
        )
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST_CODE
            )
        } else {
            activity.runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPermissionResult && window.onPermissionResult('notification', true, 'Granted by default on this Android version')",
                    null
                )
            }
        }
    }

    private fun hasCameraPermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasMicrophonePermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasStoragePermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun hasPhonePermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            activity,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasNotificationPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Granted by default on older versions
        }
    }

    companion object {
        private const val TAG = "UberCustomerBridge"
        const val LOCATION_PERMISSION_REQUEST_CODE = 1001
        const val STORAGE_PERMISSION_REQUEST_CODE: Int = 5009
        const val MICROPHONE_PERMISSION_REQUEST_CODE: Int = 5010
        const val CAMERA_PERMISSION_REQUEST_CODE: Int = 5011
        const val PHONE_PERMISSION_REQUEST_CODE: Int = 5013
        const val NOTIFICATION_PERMISSION_REQUEST_CODE: Int = 5012
    }
}
