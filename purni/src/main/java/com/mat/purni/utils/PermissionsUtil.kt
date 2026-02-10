package com.mat.purni.utils

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.mat.purni.PermissionManager

/**
 * Comprehensive permissions utility for all app modules
 * Provides common permission handling for location, notifications, etc.
 */
class PermissionsUtil(private val context: Context) {

    companion object {
        private const val TAG = "PermissionsUtil"

        // Permission request codes
        const val REQUEST_CODE_LOCATION = 1001
        const val REQUEST_CODE_NOTIFICATIONS = 1002
        const val REQUEST_CODE_CAMERA = 1003
        const val REQUEST_CODE_STORAGE = 1004
        const val REQUEST_CODE_MICROPHONE = 1005

        // Location permissions
        val LOCATION_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        // Storage permissions (for different Android versions)
        val STORAGE_PERMISSIONS = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
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

        // Notification permissions
        val NOTIFICATION_PERMISSIONS = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray() // Not needed for Android < 13
        }
    }

    /**
     * Check if location permissions are granted
     */
    fun hasLocationPermissions(): Boolean {
        return LOCATION_PERMISSIONS.any { permission ->
            ContextCompat.checkSelfPermission(
                context,
                permission
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Check if notification permissions are granted
     */
    fun hasNotificationPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Notifications are allowed by default on older versions
        }
    }

    /**
     * Check if camera permission is granted
     */
    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Check if storage permissions are granted
     */
    fun hasStoragePermissions(): Boolean {
        return STORAGE_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(
                context,
                permission
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Check if microphone permission is granted
     */
    fun hasMicrophonePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Request location permissions
     */
    fun requestLocationPermissions(activity: Activity) {
        if (!hasLocationPermissions()) {
            Log.d(TAG, "Requesting location permissions")
            ActivityCompat.requestPermissions(
                activity,
                LOCATION_PERMISSIONS,
                REQUEST_CODE_LOCATION
            )
        }
    }

    /**
     * Request notification permissions
     */
    fun requestNotificationPermissions(activity: Activity) {
        if (!hasNotificationPermissions() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Log.d(TAG, "Requesting notification permissions")
            ActivityCompat.requestPermissions(
                activity,
                NOTIFICATION_PERMISSIONS,
                REQUEST_CODE_NOTIFICATIONS
            )
        }
    }

    /**
     * Request camera permission
     */
    fun requestCameraPermission(activity: Activity) {
        if (!hasCameraPermission()) {
            Log.d(TAG, "Requesting camera permission")
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.CAMERA),
                REQUEST_CODE_CAMERA
            )
        }
    }

    /**
     * Request storage permissions
     */
    fun requestStoragePermissions(activity: Activity) {
        if (!hasStoragePermissions()) {
            Log.d(TAG, "Requesting storage permissions")
            ActivityCompat.requestPermissions(
                activity,
                STORAGE_PERMISSIONS,
                REQUEST_CODE_STORAGE
            )
        }
    }

    /**
     * Request microphone permission
     */
    fun requestMicrophonePermission(activity: Activity) {
        if (!hasMicrophonePermission()) {
            Log.d(TAG, "Requesting microphone permission")
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                REQUEST_CODE_MICROPHONE
            )
        }
    }

    /**
     * Handle permission results for location
     */
    fun handleLocationPermissionResult(
        grantResults: IntArray,
        callback: PermissionManager.PermissionCallback
    ) {
        if (grantResults.isNotEmpty() && grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            Log.d(TAG, "Location permission granted")
            callback.onGranted()
        } else {
            Log.d(TAG, "Location permission denied")
            callback.onDenied()
        }
    }

    /**
     * Handle permission results for notifications
     */
    fun handleNotificationPermissionResult(
        grantResults: IntArray,
        callback: PermissionManager.PermissionCallback
    ) {
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Notification permission granted")
            callback.onGranted()
        } else {
            Log.d(TAG, "Notification permission denied")
            callback.onDenied()
        }
    }

    /**
     * Handle generic permission result
     */
    fun handlePermissionResult(
        grantResults: IntArray,
        callback: PermissionManager.PermissionCallback,
        permissionName: String
    ) {
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            Log.d(TAG, "$permissionName permission granted")
            callback.onGranted()
        } else {
            Log.d(TAG, "$permissionName permission denied")
            callback.onDenied()
        }
    }

    /**
     * Check if we should show rationale for location permissions
     */
    fun shouldShowLocationRationale(activity: Activity): Boolean {
        return LOCATION_PERMISSIONS.any { permission ->
            ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        }
    }

    /**
     * Check if we should show rationale for notification permissions
     */
    fun shouldShowNotificationRationale(activity: Activity): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            )
        } else {
            false
        }
    }

    /**
     * Get user-friendly permission names for display
     */
    fun getPermissionDisplayName(permission: String): String {
        return when (permission) {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION -> "Location"

            Manifest.permission.POST_NOTIFICATIONS -> "Notifications"
            Manifest.permission.CAMERA -> "Camera"
            Manifest.permission.RECORD_AUDIO -> "Microphone"
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO -> "Storage"

            else -> permission.substringAfterLast(".")
        }
    }

    /**
     * Check if location services are enabled on the device
     */
    fun isLocationServicesEnabled(): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    /**
     * Check if both location permissions and location services are available
     */
    fun isLocationFullyAvailable(): Boolean {
        return hasLocationPermissions() && isLocationServicesEnabled()
    }


}

