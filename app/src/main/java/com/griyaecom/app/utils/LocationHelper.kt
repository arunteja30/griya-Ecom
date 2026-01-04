package com.griyaecom.app.utils

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.griyaecom.app.MainActivity

class LocationHelper(private val activity: MainActivity) {

    companion object {
        private const val TAG = "LocationHelper"
    }

    private val fusedLocationClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(activity)
    }

    private var locationCallback: LocationCallback? = null
    private var pendingLocationRequest: ((Location?, String?) -> Unit)? = null
    private var continuousLocationCallback: ((Location?, String?) -> Unit)? = null

    fun getCurrentLocation(callback: (Location?, String?) -> Unit) {
        if (!hasLocationPermission()) {
            requestLocationPermission()
            pendingLocationRequest = callback
            return
        }

        try {
            fusedLocationClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        callback(location, null)
                    } else {
                        requestLocationUpdates(callback)
                    }
                }
                .addOnFailureListener { exception ->
                    Log.e(TAG, "Failed to get location", exception)
                    callback(null, exception.message ?: "Failed to get location")
                }
        } catch (securityException: SecurityException) {
            Log.e(TAG, "Location permission denied", securityException)
            callback(null, "Location permission denied")
        }
    }

    private fun requestLocationUpdates(callback: (Location?, String?) -> Unit) {
        if (!hasLocationPermission()) {
            callback(null, "Location permission not granted")
            return
        }

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L)
            .setMinUpdateIntervalMillis(5000L)
            .setMaxUpdates(1)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)
                val location = locationResult.lastLocation
                callback(location, null)
                stopLocationUpdates()
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback!!, null)
        } catch (securityException: SecurityException) {
            Log.e(TAG, "Location permission denied during updates", securityException)
            callback(null, "Location permission denied")
        }
    }

    fun startLocationUpdates(intervalMs: Long, callback: (Location?, String?) -> Unit) {
        if (!hasLocationPermission()) {
            requestLocationPermission()
            continuousLocationCallback = callback
            return
        }

        stopLocationUpdates() // Stop any existing updates first

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)
                val location = locationResult.lastLocation
                callback(location, null)
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback!!, null)
            continuousLocationCallback = callback
        } catch (securityException: SecurityException) {
            Log.e(TAG, "Location permission denied during continuous updates", securityException)
            callback(null, "Location permission denied")
        }
    }

    fun stopLocationUpdates() {
        locationCallback?.let { callback ->
            fusedLocationClient.removeLocationUpdates(callback)
            locationCallback = null
        }
        continuousLocationCallback = null
    }

    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    activity,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }

    fun requestLocationPermission() {
        activity.requestPermissions(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    fun handlePermissionResult(permissions: Map<String, Boolean>) {
        val hasLocationPermission = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (hasLocationPermission && pendingLocationRequest != null) {
            getCurrentLocation(pendingLocationRequest!!)
            pendingLocationRequest = null
        } else if (pendingLocationRequest != null) {
            pendingLocationRequest!!(null, "Location permission denied")
            pendingLocationRequest = null
        }

        if (hasLocationPermission && continuousLocationCallback != null) {
            startLocationUpdates(30000L, continuousLocationCallback!!)
        } else if (continuousLocationCallback != null) {
            continuousLocationCallback!!(null, "Location permission denied")
            continuousLocationCallback = null
        }
    }

    fun cleanup() {
        stopLocationUpdates()
        pendingLocationRequest = null
        continuousLocationCallback = null
    }
}
