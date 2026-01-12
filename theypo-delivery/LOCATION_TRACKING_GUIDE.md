# Android Location Tracking Implementation Guide

## Overview

This guide shows how to implement continuous location tracking in the Android delivery app. Location
tracking starts when the delivery partner goes **online** (not just during deliveries).

## Architecture

```
Partner Online → Start Tracking → Firebase Realtime Database
  ├── deliveryPartners/{partnerId}/currentLocation (always)
  └── activeOrders/{orderId}/location (only when on delivery)
```

## WebAppInterface.kt Implementation

### Add to WebAppInterface.kt

```kotlin
package com.yourcompany.delivery

import android.webkit.JavascriptInterface
import android.util.Log
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class WebAppInterface(
    private val context: Context,
    private val activity: Activity,
    private val webView: WebView
) {
    
    private val TAG = "WebAppInterface"

    @JavascriptInterface
    fun startLocationTracking(deliveryPartnerId: String, orderId: String) {
        Log.d(TAG, "Starting location tracking - Partner: $deliveryPartnerId, Order: $orderId")
        
        // Start foreground service for continuous location tracking
        val intent = Intent(context, LocationTrackingService::class.java).apply {
            putExtra("deliveryPartnerId", deliveryPartnerId)
            putExtra("orderId", if (orderId == "no-order") null else orderId)
            action = "START_TRACKING"
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent)
        } else {
            context.startService(intent)
        }
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        Log.d(TAG, "Stopping location tracking")
        
        val intent = Intent(context, LocationTrackingService::class.java).apply {
            action = "STOP_TRACKING"
        }
        context.stopService(intent)
    }

    @JavascriptInterface
    fun requestLocation() {
        Log.d(TAG, "One-time location request")
        
        // Get single location update
        LocationHelper.getCurrentLocation(context) { location ->
            if (location != null) {
                activity.runOnUiThread {
                    webView.evaluateJavascript(
                        "window.receiveLocation('${location.latitude}', '${location.longitude}')",
                        null
                    )
                }
            } else {
                activity.runOnUiThread {
                    webView.evaluateJavascript(
                        "window.receiveLocationError('Location not available')",
                        null
                    )
                }
            }
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }
}
```

## LocationTrackingService.kt

Create a new file: `LocationTrackingService.kt`

```kotlin
package com.yourcompany.delivery

import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue

class LocationTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var deliveryPartnerId: String? = null
    private var currentOrderId: String? = null
    private val database = FirebaseDatabase.getInstance()

    companion object {
        private const val TAG = "LocationTrackingService"
        private const val CHANNEL_ID = "location_tracking_channel"
        private const val NOTIFICATION_ID = 1001
        private const val LOCATION_UPDATE_INTERVAL = 5000L // 5 seconds
        private const val FASTEST_LOCATION_UPDATE_INTERVAL = 3000L // 3 seconds
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START_TRACKING" -> {
                deliveryPartnerId = intent.getStringExtra("deliveryPartnerId")
                currentOrderId = intent.getStringExtra("orderId")

                Log.d(
                    TAG,
                    "Starting tracking - Partner: $deliveryPartnerId, Order: $currentOrderId"
                )

                startForeground(NOTIFICATION_ID, createNotification())
                startLocationUpdates()
            }
            "STOP_TRACKING" -> {
                Log.d(TAG, "Stopping tracking")
                stopLocationUpdates()
                stopForeground(true)
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_UPDATE_INTERVAL
        ).apply {
            setMinUpdateIntervalMillis(FASTEST_LOCATION_UPDATE_INTERVAL)
            setWaitForAccurateLocation(false)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    updateLocationToFirebase(location)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission not granted", e)
        }
    }

    private fun updateLocationToFirebase(location: Location) {
        val partnerId = deliveryPartnerId ?: return

        val locationData = hashMapOf(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "accuracy" to location.accuracy,
            "speed" to location.speed,
            "heading" to location.bearing,
            "timestamp" to ServerValue.TIMESTAMP,
            "activeOrderId" to currentOrderId,
            "lastUpdated" to ServerValue.TIMESTAMP
        )

        // Always update partner's current location (while online)
        database.reference
            .child("deliveryPartners")
            .child(partnerId)
            .child("currentLocation")
            .setValue(locationData)
            .addOnSuccessListener {
                Log.d(TAG, "Partner location updated successfully")
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "Failed to update partner location", error)
            }

        // If on active delivery, also update order location
        currentOrderId?.let { orderId ->
            database.reference
                .child("activeOrders")
                .child(orderId)
                .child("location")
                .setValue(locationData)
                .addOnSuccessListener {
                    Log.d(TAG, "Order location updated successfully")
                }
                .addOnFailureListener { error ->
                    Log.e(TAG, "Failed to update order location", error)
                }
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)

        // Clear location from Firebase
        deliveryPartnerId?.let { partnerId ->
            database.reference
                .child("deliveryPartners")
                .child(partnerId)
                .child("currentLocation")
                .removeValue()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracks your location during deliveries"
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val message = if (currentOrderId != null) {
            "Tracking delivery location"
        } else {
            "You are online - Location tracking active"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Delivery Partner Active")
            .setContentText(message)
            .setSmallIcon(R.drawable.ic_location) // Add your icon
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

## AndroidManifest.xml Updates

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Location Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <!-- Your MainActivity -->
        <activity android:name=".MainActivity" />

        <!-- Location Tracking Service -->
        <service
            android:name=".LocationTrackingService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location" />
    </application>
</manifest>
```

## Usage Flow

### 1. Partner Goes Online (Dashboard)

```javascript
// Web calls:
window.AndroidBridge.startLocationTracking(partnerId, 'no-order')

// Android starts LocationTrackingService
// Updates: deliveryPartners/{partnerId}/currentLocation
```

### 2. Partner Accepts Order (ActiveDelivery)

```javascript
// Web calls:
window.AndroidBridge.startLocationTracking(partnerId, orderId)

// Android updates service with orderId
// Updates both:
//   - deliveryPartners/{partnerId}/currentLocation
//   - activeOrders/{orderId}/location
```

### 3. Partner Completes Order

```javascript
// Web calls:
window.AndroidBridge.startLocationTracking(partnerId, 'no-order')

// Android removes orderId from tracking
// Updates only: deliveryPartners/{partnerId}/currentLocation
```

### 4. Partner Goes Offline

```javascript
// Web calls:
window.AndroidBridge.stopLocationTracking()

// Android stops LocationTrackingService
// Clears all location data from Firebase
```

## Testing

1. Build and run the Android app
2. Log in as a delivery partner
3. Toggle "Go Online" - check Firebase for location updates
4. Accept an order - verify location appears in both nodes
5. Complete order - verify location only in partner node
6. Go offline - verify location cleared

## Firebase Database Structure

```json
{
  "deliveryPartners": {
    "{partnerId}": {
      "currentLocation": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "accuracy": 15.0,
        "speed": 5.2,
        "heading": 180.0,
        "timestamp": 1234567890,
        "activeOrderId": "order123"
        or
        null,
        "lastUpdated": 1234567890
      }
    }
  },
  "activeOrders": {
    "{orderId}": {
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "accuracy": 15.0,
        "deliveryPartnerId": "partner123",
        "timestamp": 1234567890
      }
    }
  }
}
```

## Next Steps

- Implement iOS version (see iOS_LOCATION_TRACKING_GUIDE.md)
- Add battery optimization handling
- Implement location permission prompts
- Add offline queue for failed updates
