package com.mat.theypo

import android.Manifest
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

        getCurrentLocation { lat, lng, error ->
            if (error != null) {
                callJavaScript("window.receiveLocationError", error)
            } else {
                callJavaScript("window.receiveLocation", lat.toString(), lng.toString())
            }
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

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
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
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
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
            val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url))
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Cannot open link", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        context.startActivity(Intent.createChooser(intent, "Share via"))
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
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
        } catch (e: SecurityException) {
            callback(0.0, 0.0, "Location permission denied")
        }
    }

    private fun callJavaScript(function: String, vararg args: String) {
        val argsString = args.joinToString(", ")
        val script = "$function($argsString);"

        (context as? MainActivity)?.runOnUiThread {
            webView.evaluateJavascript(script) { result ->
                // Handle result if needed
            }
        }
    }
}
