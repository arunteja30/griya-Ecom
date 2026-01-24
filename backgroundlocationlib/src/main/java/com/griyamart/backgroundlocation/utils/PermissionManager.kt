package com.griyamart.backgroundlocation.utils

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Utility class for managing location permissions
 */
class PermissionManager(private val context: Context) {

    companion object {
        const val REQUEST_LOCATION_PERMISSIONS = 1001

        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        private val BACKGROUND_PERMISSION = Manifest.permission.ACCESS_BACKGROUND_LOCATION
    }

    /**
     * Check if all required location permissions are granted
     */
    fun hasAllLocationPermissions(): Boolean {
        return hasBasicLocationPermissions() &&
                (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasBackgroundLocationPermission())
    }

    /**
     * Check if basic location permissions (foreground) are granted
     */
    fun hasBasicLocationPermissions(): Boolean {
        return REQUIRED_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(
                context,
                permission
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Check if background location permission is granted (Android 10+)
     */
    fun hasBackgroundLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                BACKGROUND_PERMISSION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Not required for older versions
        }
    }

    /**
     * Get list of missing permissions
     */
    fun getMissingLocationPermissions(): List<String> {
        val missing = mutableListOf<String>()

        // Check basic permissions
        REQUIRED_PERMISSIONS.forEach { permission ->
            if (ContextCompat.checkSelfPermission(
                    context,
                    permission
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(permission)
            }
        }

        // Check background permission for Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    BACKGROUND_PERMISSION
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(BACKGROUND_PERMISSION)
            }
        }

        return missing
    }

    /**
     * Request location permissions from an Activity
     */
    fun requestLocationPermissions(
        activity: Activity,
        requestCode: Int = REQUEST_LOCATION_PERMISSIONS
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Request background location separately on Android 10+
            requestPermissionsStepByStep(activity, requestCode)
        } else {
            // Request all permissions at once for older versions
            ActivityCompat.requestPermissions(activity, REQUIRED_PERMISSIONS, requestCode)
        }
    }

    /**
     * Handle permission request result
     */
    fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): PermissionResult {
        if (requestCode != REQUEST_LOCATION_PERMISSIONS) {
            return PermissionResult.NOT_HANDLED
        }

        val granted = permissions.zip(grantResults.toTypedArray()).all { (_, result) ->
            result == PackageManager.PERMISSION_GRANTED
        }

        return when {
            granted && hasAllLocationPermissions() -> PermissionResult.ALL_GRANTED
            granted -> PermissionResult.PARTIAL_GRANTED
            else -> PermissionResult.DENIED
        }
    }

    private fun requestPermissionsStepByStep(activity: Activity, requestCode: Int) {
        when {
            !hasBasicLocationPermissions() -> {
                // First request basic location permissions
                ActivityCompat.requestPermissions(activity, REQUIRED_PERMISSIONS, requestCode)
            }

            !hasBackgroundLocationPermission() -> {
                // Then request background location
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(BACKGROUND_PERMISSION),
                        requestCode
                    )
                }
            }
        }
    }

    /**
     * Get permission rationale text for UI
     */
    fun getPermissionRationale(): String {
        val missing = getMissingLocationPermissions()

        return when {
            missing.isEmpty() -> "All location permissions are granted."
            missing.contains(BACKGROUND_PERMISSION) && missing.size == 1 ->
                "Background location permission is needed for continuous tracking when the app is not in use."

            missing.contains(Manifest.permission.ACCESS_FINE_LOCATION) ->
                "Location permissions are required for tracking your location."

            else ->
                "Some location permissions are missing. Please grant all requested permissions."
        }
    }
}

/**
 * Result of permission request
 */
enum class PermissionResult {
    ALL_GRANTED,
    PARTIAL_GRANTED,
    DENIED,
    NOT_HANDLED
}
