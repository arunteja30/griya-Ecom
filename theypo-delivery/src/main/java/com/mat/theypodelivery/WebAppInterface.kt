package com.mat.theypodelivery

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
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
        Log.d(TAG, "Starting location tracking - Partner: $deliveryPartnerId, Order: $orderId")

        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted for tracking")
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        Log.d(
            TAG,
            "Starting location tracking service for partner: $deliveryPartnerId, order: $orderId"
        )
        // Start foreground service for continuous location tracking
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_START_TRACKING
            putExtra("deliveryPartnerId", deliveryPartnerId)
            putExtra("orderId", if (orderId == "no-order") null else orderId)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "Starting foreground service for location tracking")
                context.startForegroundService(intent)
            } else {
                Log.d(TAG, "Starting service for location tracking")
                context.startService(intent)
            }
            Log.i(TAG, "Location tracking service started successfully")

            val message = if (orderId != "no-order") {
                "Location tracking started for delivery"
            } else {
                "You are online - Location tracking active"
            }
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start location tracking service", e)
            Toast.makeText(context, "Failed to start location tracking", Toast.LENGTH_SHORT).show()
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
}
