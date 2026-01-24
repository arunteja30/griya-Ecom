package com.mat.theypodelivery

import android.Manifest
import android.R
import android.app.Activity
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Native implementation for window.AndroidBridge used by delivery-simple.
 *
 * This matches apps/delivery-simple/src/utils/AndroidBridge.ts.
 */
class AndroidBridgeImpl(
    private val activity: Activity,
    private val webView: WebView
) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)

    private var trackingDeliveryPartnerId: String? = null
    private var trackingOrderId: String? = null
    private var trackingCallback: LocationCallback? = null

    // Check if running in Android app
    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    // Authentication method for WebView to authenticate the user
    @JavascriptInterface
    fun authenticateUser(email: String, password: String) {
        FirebaseAuth.getInstance().signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(activity) { task ->
                if (task.isSuccessful) {
                    val user = FirebaseAuth.getInstance().currentUser
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onAuthenticationSuccess && window.onAuthenticationSuccess('${user?.uid}', '${user?.email}')",
                            null
                        )
                    }
                } else {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onAuthenticationError && window.onAuthenticationError('${task.exception?.message}')",
                            null
                        )
                    }
                }
            }
    }

    // Get current authenticated user
    @JavascriptInterface
    fun getCurrentUser(): String {
        val user = FirebaseAuth.getInstance().currentUser
        return if (user != null) {
            "{\"uid\":\"${user.uid}\",\"email\":\"${user.email}\"}"
        } else {
            "{}"
        }
    }

    // Show a native toast message
    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
    }

    // Request current location once and callback to window.receiveLocation(lat,lng)
    @JavascriptInterface
    fun requestLocation() {
        if (!ensureLocationPermission()) {
            sendLocationError("Location permission not granted")
            return
        }

        // Try to get last known location first for speed
        fusedClient.lastLocation
            .addOnSuccessListener { location: Location? ->
                if (location != null && isLocationRecent(location)) {
                    sendLocationToJs(location)
                } else {
                    // Request fresh location if no recent location available
                    requestFreshLocation()
                }
            }
            .addOnFailureListener {
                // If last location fails, try fresh location
                requestFreshLocation()
            }
    }

    // Request a fresh location update
    private fun requestFreshLocation() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            5000L // 5 seconds timeout
        ).build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                super.onLocationResult(result)
                val location = result.lastLocation
                if (location != null) {
                    sendLocationToJs(location)
                } else {
                    sendLocationError("Unable to get current location")
                }
                fusedClient.removeLocationUpdates(this)
            }
        }

        if (ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            fusedClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } else {
            sendLocationError("Location permission denied")
        }
    }

    // Check if location is recent (within 30 seconds)
    private fun isLocationRecent(location: Location): Boolean {
        val locationAge = System.currentTimeMillis() - location.time
        return locationAge < 30000 // 30 seconds
    }

    // Start continuous location tracking, writing to Firebase Realtime DB
    // JS signature: startLocationTracking(deliveryPartnerId, orderId)
    @JavascriptInterface
    fun startLocationTracking(deliveryPartnerId: String, orderId: String?) {
        Log.d("AndroidBridge", "🔥 NATIVE METHOD CALLED: startLocationTracking")
        Log.d("AndroidBridge", "🔥 Parameters: partner=$deliveryPartnerId, order=$orderId")

        if (!ensureLocationPermission()) {
            Log.w("AndroidBridge", "Location permission not granted")
            showToast("Location permission required")
            return
        }

        trackingDeliveryPartnerId = deliveryPartnerId
        trackingOrderId = if (orderId.isNullOrBlank() || orderId == "no-order") null else orderId

        if (trackingCallback != null) {
            Log.d("AndroidBridge", "Location tracking already active")
            return
        }

        Log.d("AndroidBridge", "Setting up location request with 10 second intervals")
        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10_000L // 10 seconds, tune as needed
        )
            .setMinUpdateDistanceMeters(30f) // ~30m
            .setWaitForAccurateLocation(true)
            .build()

        trackingCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation
                Log.d(
                    "AndroidBridge",
                    "Location update received: lat=${location?.latitude}, lng=${location?.longitude}"
                )
                if (location != null) {
                    pushLocationToFirebase(location)
                } else {
                    Log.w("AndroidBridge", "Location update received but location is null")
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                super.onLocationAvailability(availability)
                Log.d(
                    "AndroidBridge",
                    "Location availability changed: ${availability.isLocationAvailable}"
                )
            }
        }

        Log.d("AndroidBridge", "Requesting location updates from FusedLocationClient")
        fusedClient.requestLocationUpdates(
            request,
            trackingCallback as LocationCallback,
            Looper.getMainLooper()
        )
        Log.d("AndroidBridge", "Location updates requested successfully")

        // Also start background service for when app is closed
        Log.d("AndroidBridge", "Starting background service as well")
        try {
            // Check notification permission first for foreground service
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasNotificationPermission = ContextCompat.checkSelfPermission(
                    activity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED

                if (!hasNotificationPermission) {
                    Log.w("AndroidBridge", "Notification permission missing - requesting it")
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        1003
                    )
                    showToast("Please allow notifications for tracking service")
                } else {
                    LocationTrackingServiceNew.startTracking(activity, deliveryPartnerId, orderId)
                    Log.d("AndroidBridge", "Background service started successfully")
                }
            } else {
                LocationTrackingServiceNew.startTracking(activity, deliveryPartnerId, orderId)
                Log.d("AndroidBridge", "Background service started successfully")
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Failed to start background service", e)
            showToast("Background service failed: ${e.message}")
        }

        showToast("Native location tracking started")
    }

    // Stop continuous tracking
    @JavascriptInterface
    fun stopLocationTracking() {
        Log.d("AndroidBridge", "stopLocationTracking called")

        // Stop regular tracking
        trackingCallback?.let { fusedClient.removeLocationUpdates(it) }
        trackingCallback = null
        trackingDeliveryPartnerId = null
        trackingOrderId = null

        // Also stop background service
        try {
            LocationTrackingServiceNew.stopTracking(activity)
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Failed to stop background service", e)
        }

        showToast("Native location tracking stopped")
    }

    // Start background location tracking service
    @JavascriptInterface
    fun startBackgroundTracking(deliveryPartnerId: String, orderId: String?) {
        Log.d(
            "AndroidBridge",
            "startBackgroundTracking called: partner=$deliveryPartnerId, order=$orderId"
        )

        if (!ensureLocationPermission()) {
            Log.w("AndroidBridge", "Location permission not granted")
            showToast("Location permission required for background tracking")
            return
        }

        // Check for notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotificationPermission = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasNotificationPermission) {
                Log.w("AndroidBridge", "Notification permission not granted")
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1003
                )
                showToast("Please allow notifications for tracking service")
                return
            }
        }

        // Check for background location permission on Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val hasBackgroundPermission = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasBackgroundPermission) {
                Log.w("AndroidBridge", "Background location permission not granted")
                showToast("Background location permission required")
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onBackgroundPermissionRequired && window.onBackgroundPermissionRequired()",
                        null
                    )
                }
                return
            }
        }

        Log.d("AndroidBridge", "Starting LocationTrackingServiceNew")
        try {
            LocationTrackingServiceNew.startTracking(activity, deliveryPartnerId, orderId)
            showToast("Background tracking started")

            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onBackgroundTrackingStarted && window.onBackgroundTrackingStarted('$deliveryPartnerId')",
                    null
                )
            }
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Failed to start LocationTrackingServiceNew", e)
            showToast("Failed to start background tracking: ${e.message}")
        }
    }

    // Stop background location tracking service
    @JavascriptInterface
    fun stopBackgroundTracking() {
        Log.d("AndroidBridge", "stopBackgroundTracking called")
        LocationTrackingServiceNew.stopTracking(activity)
        showToast("Background tracking stopped")

        runOnUiThread {
            webView.evaluateJavascript(
                "window.onBackgroundTrackingStopped && window.onBackgroundTrackingStopped()",
                null
            )
        }
    }

    // Get FCM device token: JS passes callbackName, we call callbackName(token)
    @JavascriptInterface
    fun getDeviceToken(callbackName: String) {
        Log.d("AndroidBridge", "getDeviceToken called with callback: $callbackName")
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w("AndroidBridge", "Failed to get FCM token", task.exception)
                    runOnUiThread {
                        webView.evaluateJavascript("$callbackName(null)", null)
                    }
                    return@addOnCompleteListener
                }

                val token = task.result
                Log.d("AndroidBridge", "FCM token received: ${token?.take(20)}...")
                runOnUiThread {
                    webView.evaluateJavascript("$callbackName('$token')", null)
                }
            }
    }

    // Alternative method name that the web app might be calling
    @JavascriptInterface
    fun requestFCMToken() {
        Log.d("AndroidBridge", "requestFCMToken called")
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w("AndroidBridge", "Failed to get FCM token", task.exception)
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onFCMTokenReceived && window.onFCMTokenReceived(null)",
                            null
                        )
                    }
                    return@addOnCompleteListener
                }

                val token = task.result
                Log.d("AndroidBridge", "FCM token received: ${token?.take(20)}...")
                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onFCMTokenReceived && window.onFCMTokenReceived('$token')",
                        null
                    )
                }
            }
    }

    // Vibrate device (very simple, you can expand)
    @JavascriptInterface
    fun vibrate(milliseconds: Int) {
        // Left as a no-op here to keep example simple
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun openExternalLink(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        activity.startActivity(intent)
    }

    @JavascriptInterface
    fun openNavigation(latitude: Double, longitude: Double, label: String?) {
        // Open Google Maps with navigation intent
        val gmmIntentUri = Uri.parse("google.navigation:q=$latitude,$longitude")
        val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri)
        mapIntent.setPackage("com.google.android.apps.maps")

        if (mapIntent.resolveActivity(activity.packageManager) != null) {
            activity.startActivity(mapIntent)
        } else {
            // Fallback to geo: URI if Google Maps not installed
            val geoUri =
                Uri.parse("geo:$latitude,$longitude?q=$latitude,$longitude(${label ?: "Destination"})")
            val fallbackIntent = Intent(Intent.ACTION_VIEW, geoUri)
            activity.startActivity(fallbackIntent)
        }
    }

    @JavascriptInterface
    fun openDialer(phoneNumber: String) {
        // Open phone dialer with number pre-filled
        val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
        activity.startActivity(dialIntent)
    }

    @JavascriptInterface
    fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        activity.startActivity(Intent.createChooser(intent, "Share"))
    }

    @JavascriptInterface
    fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
                1002
            )
        }
    }

    @JavascriptInterface
    fun isInBackground(): Boolean {
        // Simple heuristic: always false from JS perspective
        return false
    }

    // ========================================
    // Mobile Notification Bridge Methods
    // ========================================

    /**
     * Show bottom sheet notification - called from mobileNotificationBridge.showBottomSheet()
     */
    @JavascriptInterface
    fun showBottomSheet(title: String, body: String, dataJson: String?) {
        runOnUiThread {
            try {
                // Send to WebView to show bottom sheet UI
                val jsData = dataJson ?: "{}"
                val js =
                    "window.showMobileBottomSheet && window.showMobileBottomSheet('$title', '$body', $jsData)"
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                // Fallback: show as system notification
                showSystemNotification(title, body)
            }
        }
    }

    /**
     * Play notification sound - called from mobileNotificationBridge.playNotificationSound()
     */
    @JavascriptInterface
    fun playNotificationSound(soundFile: String?) {
        try {
            // In a real app, play actual sound file
            // For now, use system notification sound
            val notification = Notification.Builder(activity, "delivery_alerts")
                .setSmallIcon(R.drawable.ic_dialog_info)
                .setContentTitle("")
                .setContentText("")
                .setDefaults(Notification.DEFAULT_SOUND)
                .build()

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(999, notification)
            notificationManager.cancel(999) // Cancel immediately to only play sound
        } catch (e: Exception) {
            // Vibrate as fallback
            vibrate(200)
        }
    }

    /**
     * Trigger vibration - called from mobileNotificationBridge.triggerVibration()
     */
    @JavascriptInterface
    fun triggerVibration(pattern: String?) {
        try {
            // Parse pattern like "[200, 100, 200]" or use default
            vibrate(200)
        } catch (e: Exception) {
            // Ignore vibration errors
        }
    }

    /**
     * Status change notification - called from mobileNotificationBridge.notifyStatusChange()
     */
    @JavascriptInterface
    fun notifyStatusChange(orderId: String, status: String, payloadJson: String?) {
        runOnUiThread {
            try {
                // Send to WebView for UI updates
                val jsData = payloadJson ?: "{}"
                val js =
                    "window.onMobileStatusChange && window.onMobileStatusChange('$orderId', '$status', $jsData)"
                webView.evaluateJavascript(js, null)

                // Also show system notification for important status changes
                if (status in listOf("confirmed", "picked_up", "delivered", "cancelled")) {
                    showSystemNotification("Order Update", "Order $orderId is now $status")
                }
            } catch (e: Exception) {
                showToast("Order $orderId: $status")
            }
        }
    }

    /**
     * Helper method to show system notification
     */
    private fun showSystemNotification(title: String, body: String) {
        try {
            val notification = Notification.Builder(activity, "delivery_alerts")
                .setSmallIcon(R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)
                .build()

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(System.currentTimeMillis().toInt(), notification)
        } catch (e: Exception) {
            showToast("$title: $body")
        }
    }

    // Helpers
    private fun ensureLocationPermission(): Boolean {
        val granted = hasLocationPermission()
        if (!granted) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                1001
            )
        }
        return granted
    }

    private fun sendLocationToJs(location: Location) {
        try {
            val js =
                "if (window.receiveLocation) { window.receiveLocation('${location.latitude}','${location.longitude}'); } else { console.warn('receiveLocation callback not found'); }"
            runOnUiThread {
                webView.evaluateJavascript(js) { result ->
                    if (result == null) {
                        Log.d(
                            "AndroidBridge",
                            "Location sent to JS: ${location.latitude}, ${location.longitude}"
                        )
                    }
                }
            }
        } catch (e: Exception) {
            sendLocationError("Error sending location to JS: ${e.message}")
        }
    }

    private fun sendLocationError(message: String) {
        try {
            val js =
                "if (window.receiveLocationError) { window.receiveLocationError('$message'); } else { console.error('receiveLocationError callback not found: $message'); }"
            runOnUiThread {
                webView.evaluateJavascript(js, null)
            }
        } catch (e: Exception) {
            // Last resort - show toast
            activity.runOnUiThread {
                Toast.makeText(activity, "Location Error: $message", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun pushLocationToFirebase(location: Location) {
        val partnerId = trackingDeliveryPartnerId
        Log.d("AndroidBridge", "🔥 pushLocationToFirebase called - partnerId: $partnerId")

        if (partnerId == null) {
            Log.w("AndroidBridge", "Cannot push location - partnerId is null")
            return
        }

        // Security: Verify user is authenticated
        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            Log.e("AndroidBridge", "Cannot push location - user not authenticated")
            runOnUiThread {
                Toast.makeText(
                    activity,
                    "Authentication required for location tracking",
                    Toast.LENGTH_SHORT
                ).show()
            }
            return
        }

        Log.d("AndroidBridge", "Pushing location for authenticated user: ${currentUser.uid}")
        Log.d("AndroidBridge", "User email: ${currentUser.email}")

        val dbRef = FirebaseDatabase.getInstance()
            .getReference("deliveryPartners")
            .child(partnerId)

        val locationData = mapOf(
            "latitude" to location.latitude,
            "longitude" to location.longitude,
            "timestamp" to System.currentTimeMillis(),
            "accuracy" to location.accuracy,
            "speed" to if (location.hasSpeed()) location.speed else 0f,
            "bearing" to if (location.hasBearing()) location.bearing else 0f
        )

        val payload = mutableMapOf<String, Any>(
            "currentLocation" to locationData,
            "lastLocationUpdate" to System.currentTimeMillis(),
            "isOnline" to true,
            "userId" to currentUser.uid
        )

        trackingOrderId?.let { orderId ->
            payload["activeOrderId"] = orderId
            Log.d("AndroidBridge", "Adding activeOrderId: $orderId")
        }

        Log.d(
            "AndroidBridge",
            "Writing to Firebase: lat=${location.latitude}, lng=${location.longitude}"
        )

        dbRef.updateChildren(payload)
            .addOnSuccessListener {
                Log.d(
                    "AndroidBridge",
                    "✅ Location successfully written to Firebase for partner: $partnerId"
                )
                runOnUiThread {
                    Toast.makeText(activity, "Location updated ✅", Toast.LENGTH_SHORT).show()
                }
            }
            .addOnFailureListener { exception ->
                Log.e("AndroidBridge", "❌ Failed to write location to Firebase", exception)
                runOnUiThread {
                    Toast.makeText(
                        activity,
                        "Failed to update location: ${exception.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
    }

    // Test Firebase connection and authentication
    @JavascriptInterface
    fun testFirebaseConnection() {
        Log.d("AndroidBridge", "Testing Firebase connection...")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            Log.e("AndroidBridge", "❌ Firebase test failed: User not authenticated")
            showToast("Not authenticated - please sign in first")
            return
        }

        Log.d("AndroidBridge", "✅ User authenticated: ${currentUser.uid}")
        Log.d("AndroidBridge", "✅ User email: ${currentUser.email}")

        val testRef = FirebaseDatabase.getInstance()
            .getReference("test")
            .child("connection_test")

        val testData = mapOf(
            "timestamp" to System.currentTimeMillis(),
            "userId" to currentUser.uid,
            "message" to "Test connection from Android app"
        )

        testRef.setValue(testData)
            .addOnSuccessListener {
                Log.d("AndroidBridge", "✅ Firebase connection test successful")
                showToast("Firebase connection working!")

                // Now test delivery partner path
                testDeliveryPartnerPath()
            }
            .addOnFailureListener { exception ->
                Log.e("AndroidBridge", "❌ Firebase connection test failed", exception)
                showToast("Firebase connection failed: ${exception.message}")
            }
    }

    // Test specific delivery partner path access
    @JavascriptInterface
    fun testDeliveryPartnerPath() {
        val currentUser = FirebaseAuth.getInstance().currentUser
        val partnerId = trackingDeliveryPartnerId ?: "YruKuMoQQjU2Fa9RdhSibPousqy1"

        if (currentUser == null) {
            Log.e("AndroidBridge", "❌ Cannot test - user not authenticated")
            return
        }

        Log.d("AndroidBridge", "🔍 Testing deliveryPartners path access...")
        Log.d("AndroidBridge", "🔍 Partner ID: $partnerId")
        Log.d("AndroidBridge", "🔍 User ID: ${currentUser.uid}")

        val partnerRef = FirebaseDatabase.getInstance()
            .getReference("deliveryPartners")
            .child(partnerId)

        val testLocationData = mapOf(
            "testWrite" to true,
            "timestamp" to System.currentTimeMillis(),
            "userId" to currentUser.uid,
            "userEmail" to (currentUser.email ?: "unknown")
        )

        partnerRef.updateChildren(testLocationData)
            .addOnSuccessListener {
                Log.d("AndroidBridge", "✅ Delivery partner path test successful!")
                showToast("Delivery partner path accessible ✅")
            }
            .addOnFailureListener { exception ->
                Log.e("AndroidBridge", "❌ Delivery partner path test failed", exception)
                showToast("Path blocked: ${exception.message}")
            }
    }

    // Test basic Firebase write functionality
    @JavascriptInterface
    fun testBasicWrite() {
        Log.d("AndroidBridge", "🔍 Testing basic Firebase write...")

        val testRef = FirebaseDatabase.getInstance().getReference("debug_test")
        val testData = mapOf(
            "timestamp" to System.currentTimeMillis(),
            "test" to "basic_connectivity",
            "userAgent" to System.getProperty("http.agent")
        )

        testRef.setValue(testData)
            .addOnSuccessListener {
                Log.d("AndroidBridge", "✅ Basic write test SUCCESSFUL!")
                showToast("Firebase is working! ✅")
            }
            .addOnFailureListener { exception ->
                Log.e("AndroidBridge", "❌ Basic write test FAILED!", exception)
                showToast("Firebase not working: ${exception.message}")
            }
    }

    // Master diagnostic - run all tests in sequence
    @JavascriptInterface
    fun runFullDiagnostic() {
        Log.d("AndroidBridge", "🚀 RUNNING FULL FIREBASE DIAGNOSTIC")
        Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        showToast("Running diagnostic sequence...")

        // Step 1: Check authentication
        testFirebaseConnection()

        // Step 2: Test basic write after 2 seconds
        Handler(Looper.getMainLooper()).postDelayed({
            testBasicWrite()
        }, 2000)

        Log.d("AndroidBridge", "⏳ Diagnostic sequence initiated - watch logs for results")
    }

    // Test foreground service functionality
    @JavascriptInterface
    fun testForegroundService() {
        Log.d("AndroidBridge", "🔍 Testing foreground service functionality...")

        // Check notification permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotificationPermission = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            Log.d("AndroidBridge", "Notification permission: $hasNotificationPermission")

            if (!hasNotificationPermission) {
                showToast("Notification permission required for foreground service")
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1003
                )
                return
            }
        }

        // Check location permissions
        val hasLocationPermission = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        Log.d("AndroidBridge", "Location permission: $hasLocationPermission")

        if (!hasLocationPermission) {
            showToast("Location permission required for foreground service")
            return
        }

        // Test starting the service
        try {
            Log.d("AndroidBridge", "Testing LocationTrackingServiceNew startup...")
            LocationTrackingServiceNew.startTracking(activity, "TEST_PARTNER_ID", "TEST_ORDER_ID")
            showToast("Foreground service test started ✅")
            Log.d("AndroidBridge", "✅ Foreground service started successfully")

            // Stop it after 5 seconds
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    LocationTrackingServiceNew.stopTracking(activity)
                    showToast("Foreground service test stopped ✅")
                    Log.d("AndroidBridge", "✅ Foreground service stopped successfully")
                } catch (e: Exception) {
                    Log.e("AndroidBridge", "❌ Failed to stop test service", e)
                }
            }, 5000)

        } catch (e: Exception) {
            Log.e("AndroidBridge", "❌ Failed to start foreground service", e)
            showToast("Foreground service failed: ${e.message}")
        }
    }

    private fun runOnUiThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            activity.runOnUiThread { block() }
        }
    }
}
