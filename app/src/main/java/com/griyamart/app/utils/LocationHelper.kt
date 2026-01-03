package com.griyaecom.app.utils

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.griyaecom.app.MainActivity

class LocationHelper(private val activity: MainActivity) {
    
    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null
    private var currentCallback: ((Location?, String?) -> Unit)? = null

    companion object {
        private const val LOCATION_UPDATE_MIN_TIME = 10000L // 10 seconds
        private const val LOCATION_UPDATE_MIN_DISTANCE = 10f // 10 meters
        
        val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    }

    init {
        locationManager = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }

    fun hasLocationPermission(): Boolean {
        return REQUIRED_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun requestLocationPermission() {
        activity.requestPermissions(REQUIRED_PERMISSIONS)
    }

    fun getCurrentLocation(callback: (Location?, String?) -> Unit) {
        currentCallback = callback
        
        if (!hasLocationPermission()) {
            callback(null, "Location permission not granted")
            return
        }

        if (!isLocationEnabled()) {
            callback(null, "Location services are disabled")
            return
        }

        try {
            // Try to get last known location first
            val providers = locationManager?.getProviders(true) ?: emptyList()
            var bestLocation: Location? = null
            
            for (provider in providers) {
                val location = locationManager?.getLastKnownLocation(provider)
                if (location != null) {
                    if (bestLocation == null || location.accuracy < bestLocation.accuracy) {
                        bestLocation = location
                    }
                }
            }

            if (bestLocation != null && System.currentTimeMillis() - bestLocation.time < 5 * 60 * 1000) {
                // Location is recent (less than 5 minutes old)
                callback(bestLocation, null)
                return
            }

            // Request fresh location update
            locationListener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    callback(location, null)
                    stopLocationUpdates()
                }

                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // Request updates from both GPS and Network providers
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0f,
                    locationListener!!
                )
            }

            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    1000L,
                    0f,
                    locationListener!!
                )
            }

            // Timeout after 30 seconds
            activity.getWebView().postDelayed({
                if (locationListener != null) {
                    callback(null, "Location request timeout")
                    stopLocationUpdates()
                }
            }, 30000)

        } catch (e: SecurityException) {
            callback(null, "Location permission error: ${e.message}")
        } catch (e: Exception) {
            callback(null, "Location error: ${e.message}")
        }
    }

    fun startLocationUpdates(intervalMs: Long, callback: (Location?, String?) -> Unit) {
        currentCallback = callback
        
        if (!hasLocationPermission()) {
            callback(null, "Location permission not granted")
            return
        }

        if (!isLocationEnabled()) {
            callback(null, "Location services are disabled")
            return
        }

        try {
            locationListener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    callback(location, null)
                }

                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {
                    callback(null, "Location provider disabled: $provider")
                }
            }

            val updateInterval = if (intervalMs > 0) intervalMs else LOCATION_UPDATE_MIN_TIME

            // Register for both GPS and Network updates
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    updateInterval,
                    LOCATION_UPDATE_MIN_DISTANCE,
                    locationListener!!
                )
            }

            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    updateInterval,
                    LOCATION_UPDATE_MIN_DISTANCE,
                    locationListener!!
                )
            }

        } catch (e: SecurityException) {
            callback(null, "Location permission error: ${e.message}")
        } catch (e: Exception) {
            callback(null, "Location error: ${e.message}")
        }
    }

    fun stopLocationUpdates() {
        try {
            locationListener?.let { listener ->
                locationManager?.removeUpdates(listener)
            }
            locationListener = null
            currentCallback = null
        } catch (e: Exception) {
            // Ignore exceptions when stopping updates
        }
    }

    private fun isLocationEnabled(): Boolean {
        return try {
            val gpsEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) ?: false
            val networkEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ?: false
            gpsEnabled || networkEnabled
        } catch (e: Exception) {
            false
        }
    }

    fun cleanup() {
        stopLocationUpdates()
    }

    // Get distance between two points in meters
    fun getDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val results = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, results)
        return results[0]
    }

    // Check if location is within a radius (in meters)
    fun isWithinRadius(
        currentLat: Double,
        currentLon: Double,
        targetLat: Double,
        targetLon: Double,
        radiusMeters: Float
    ): Boolean {
        val distance = getDistance(currentLat, currentLon, targetLat, targetLon)
        return distance <= radiusMeters
    }
}