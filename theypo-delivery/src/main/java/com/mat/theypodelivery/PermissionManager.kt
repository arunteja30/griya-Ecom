package com.mat.theypodelivery

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import androidx.appcompat.app.AlertDialog
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Handles runtime permission requests with user-friendly dialogs
 */
class PermissionManager(private val activity: Activity) {

    companion object {
        const val LOCATION_PERMISSION_CODE = 1001
        const val BACKGROUND_LOCATION_PERMISSION_CODE = 1002
        const val NOTIFICATION_PERMISSION_CODE = 1003
    }

    interface PermissionCallback {
        fun onPermissionGranted()
        fun onPermissionDenied()
    }

    private var callback: PermissionCallback? = null

    fun requestLocationPermission(callback: PermissionCallback) {
        this.callback = callback

        if (hasLocationPermission()) {
            callback.onPermissionGranted()
            return
        }

        if (ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        ) {
            showPermissionRationale(
                "Location Permission Required",
                "We need location access to show nearby orders and track deliveries. This helps provide better service to customers.",
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                LOCATION_PERMISSION_CODE
            )
        } else {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                LOCATION_PERMISSION_CODE
            )
        }
    }

    fun requestBackgroundLocationPermission(callback: PermissionCallback) {
        this.callback = callback

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            if (hasBackgroundLocationPermission()) {
                callback.onPermissionGranted()
                return
            }

            showPermissionRationale(
                "Background Location Required",
                "To track deliveries even when the app is in background, we need 'Always Allow' location permission. This ensures customers can see your live location.",
                arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                BACKGROUND_LOCATION_PERMISSION_CODE
            )
        } else {
            callback.onPermissionGranted()
        }
    }

    fun requestNotificationPermission(callback: PermissionCallback) {
        this.callback = callback

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (hasNotificationPermission()) {
                callback.onPermissionGranted()
                return
            }

            showPermissionRationale(
                "Notification Permission",
                "Enable notifications to receive new order alerts and important updates instantly.",
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_CODE
            )
        } else {
            callback.onPermissionGranted()
        }
    }

    private fun showPermissionRationale(
        title: String,
        message: String,
        permissions: Array<String>,
        requestCode: Int
    ) {
        AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Allow") { _, _ ->
                ActivityCompat.requestPermissions(activity, permissions, requestCode)
            }
            .setNegativeButton("Deny") { dialog, _ ->
                dialog.dismiss()
                callback?.onPermissionDenied()
            }
            .setCancelable(false)
            .show()
    }

    fun handlePermissionResult(requestCode: Int, grantResults: IntArray) {
        when (requestCode) {
            LOCATION_PERMISSION_CODE,
            BACKGROUND_LOCATION_PERMISSION_CODE,
            NOTIFICATION_PERMISSION_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    callback?.onPermissionGranted()
                } else {
                    callback?.onPermissionDenied()
                }
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasBackgroundLocationPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun hasNotificationPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }
}
