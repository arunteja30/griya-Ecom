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

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun requestLocation() {
        if (!hasLocationPermission()) {
            onRequestLocationPermission()
            return
        }

        try {
            getCurrentLocation { lat, lng, error ->
                if (error != null) {
                    callJavaScript("window.receiveLocationError", "\"$error\"")
                } else {
                    callJavaScript("window.receiveLocation", lat.toString(), lng.toString())
                }
            }
        } catch (_: SecurityException) {
            callJavaScript("window.receiveLocationError", "\"Location permission denied\"")
        }
    }

    @JavascriptInterface
    fun startLocationTracking(orderId: String) {
        if (!hasLocationPermission()) {
            Toast.makeText(context, "Location permission required", Toast.LENGTH_SHORT).show()
            onRequestLocationPermission()
            return
        }

        // Start foreground service for continuous location tracking
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_START_TRACKING
            putExtra(LocationService.EXTRA_ORDER_ID, orderId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }

        Toast.makeText(context, "Location tracking started", Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        val intent = Intent(context, LocationService::class.java).apply {
            action = LocationService.ACTION_STOP_TRACKING
        }
        context.stopService(intent)
        Toast.makeText(context, "Location tracking stopped", Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun getDeviceToken(callback: String) {
        // Get FCM token
        com.google.firebase.messaging.FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                callJavaScript(callback, "\"$token\"")
            }
            .addOnFailureListener {
                callJavaScript(callback, "null")
            }
    }

    @RequiresPermission(Manifest.permission.VIBRATE)
    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager =
                context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

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
    }

    @JavascriptInterface
    fun openExternalLink(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, url.toUri())
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(context, "Cannot open link", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(Intent.createChooser(intent, "Share via").apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        })
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun startLocationTrackingWithPartner(deliveryPartnerId: String, orderId: String) {
        (context as? MainActivity)?.runOnUiThread {
            // Start foreground service for location tracking
            val intent = Intent(context, LocationService::class.java).apply {
                action = "START_TRACKING"
                putExtra("deliveryPartnerId", deliveryPartnerId)
                putExtra("orderId", orderId)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    @JavascriptInterface
    fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            (context as? MainActivity)?.let { _ ->
                // This should be handled by the activity, not here
                Toast.makeText(context, "Background location permission needed", Toast.LENGTH_SHORT)
                    .show()
            }
        }
    }

    @JavascriptInterface
    fun isInBackground(): Boolean {
        val appProcessInfo = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(appProcessInfo)
        return appProcessInfo.importance != ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    fun onLocationPermissionGranted() {
        // Notify web app that permission was granted
        callJavaScript("window.onLocationPermissionGranted")
    }

    @RequiresPermission(anyOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
    private fun getCurrentLocation(callback: (lat: Double, lng: Double, error: String?) -> Unit) {
        try {
            val cancellationTokenSource = CancellationTokenSource()

            fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cancellationTokenSource.token
            ).addOnSuccessListener { location: Location? ->
                if (location != null) {
                    callback(location.latitude, location.longitude, null)
                } else {
                    callback(0.0, 0.0, "Location not available")
                }
            }.addOnFailureListener { exception ->
                callback(0.0, 0.0, exception.message ?: "Failed to get location")
            }
        } catch (_: SecurityException) {
            callback(0.0, 0.0, "Location permission denied")
        }
    }

    private fun callJavaScript(function: String, vararg args: String) {
        val argsString = args.joinToString(", ")
        val script = "$function($argsString);"

        (context as? MainActivity)?.runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }


    @JavascriptInterface
    fun isLocationTrackingActive(): Boolean {
        // Check if LocationService is running
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        for (service in manager.getRunningServices(Integer.MAX_VALUE)) {
            if (LocationService::class.java.name == service.service.className) {
                return true
            }
        }
        return false
    }
}
