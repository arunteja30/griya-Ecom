package com.mat.theypo

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Manages runtime permissions with user-friendly UX.
 * Customer app needs fewer permissions than delivery app.
 */
class PermissionManager(private val activity: AppCompatActivity) {

    companion object {
        private const val REQUEST_LOCATION = 1001
        private const val REQUEST_NOTIFICATIONS = 1002
    }

    interface PermissionCallback {
        fun onGranted()
        fun onDenied()
    }

    private var pendingLocationCallback: PermissionCallback? = null
    private var pendingNotificationCallback: PermissionCallback? = null

    /**
     * Request location permissions (for finding nearby restaurants).
     */
    fun requestLocationPermissions(callback: PermissionCallback) {
        if (hasLocationPermissions()) {
            callback.onGranted()
            return
        }

        pendingLocationCallback = callback

        AlertDialog.Builder(activity)
            .setTitle("Location Permission")
            .setMessage("We need your location to show nearby restaurants and estimate delivery time.")
            .setPositiveButton("Allow") { _, _ ->
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    REQUEST_LOCATION
                )
            }
            .setNegativeButton("Cancel") { _, _ ->
                callback.onDenied()
            }
            .show()
    }

    /**
     * Request notification permission (Android 13+).
     */
    fun requestNotificationPermission(callback: PermissionCallback) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            callback.onGranted()
            return
        }

        if (hasNotificationPermission()) {
            callback.onGranted()
            return
        }

        pendingNotificationCallback = callback

        AlertDialog.Builder(activity)
            .setTitle("Notification Permission")
            .setMessage("Enable notifications to get updates about your order status and delivery.")
            .setPositiveButton("Allow") { _, _ ->
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_NOTIFICATIONS
                )
            }
            .setNegativeButton("Cancel") { _, _ ->
                callback.onDenied()
            }
            .show()
    }

    fun handlePermissionResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        when (requestCode) {
            REQUEST_LOCATION -> {
                val granted = grantResults.isNotEmpty() &&
                        grantResults.all { it == PackageManager.PERMISSION_GRANTED }
                
                if (granted) {
                    pendingLocationCallback?.onGranted()
                } else {
                    pendingLocationCallback?.onDenied()
                }
                pendingLocationCallback = null
            }
            REQUEST_NOTIFICATIONS -> {
                val granted = grantResults.isNotEmpty() &&
                        grantResults[0] == PackageManager.PERMISSION_GRANTED
                
                if (granted) {
                    pendingNotificationCallback?.onGranted()
                } else {
                    pendingNotificationCallback?.onDenied()
                }
                pendingNotificationCallback = null
            }
        }
    }

    fun hasLocationPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true
        }
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
