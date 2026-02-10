package com.mat.purnidelivery

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.annotation.RequiresPermission
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.TimeUnit

/**
 * Native implementation for window.AndroidBridge used by delivery-simple.
 *
 * This matches apps/delivery-simple/src/utils/AndroidBridge.ts.
 */
class AndroidBridgeImpl(
    private val activity: Activity,
    private val webView: WebView
) {

    private val mActivity = activity
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)

    private var trackingDeliveryPartnerId: String? = null
    private var trackingOrderId: String? = null
    private var trackingCallback: LocationCallback? = null

    // Phone Authentication properties
    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null
    private val auth = FirebaseAuth.getInstance()

    // Check if running in Android app
    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    // Location Tracking Control
    @JavascriptInterface
    fun startLocationTracking() {
        val userId = auth.currentUser?.uid
        if (userId != null) {
            LocationTrackingService.startTracking(activity, userId)
            android.util.Log.d("AndroidBridge", "📍 Location tracking started via WebView")
        } else {
            android.util.Log.w(
                "AndroidBridge",
                "Cannot start location tracking - user not authenticated"
            )
        }
    }


    @JavascriptInterface
    fun updateDeliveryPartnerStatus(isOnline: Boolean, isAvailable: Boolean) {
        val userId = auth.currentUser?.uid
        if (userId != null) {
            val database = FirebaseDatabase.getInstance()
            val updates = mapOf(
                "deliveryPartners/$userId/isOnline" to isOnline,
                "deliveryPartners/$userId/isAvailable" to isAvailable,
                "deliveryPartners/$userId/lastStatusUpdate" to com.google.firebase.database.ServerValue.TIMESTAMP
            )

            database.reference.updateChildren(updates)
                .addOnSuccessListener {
                    android.util.Log.d(
                        "AndroidBridge",
                        "📱 Delivery partner status updated: online=$isOnline, available=$isAvailable"
                    )

                    // Location tracking will be handled by OrderUpdateService listener
                }
                .addOnFailureListener { e ->
                    android.util.Log.e(
                        "AndroidBridge",
                        "❌ Error updating delivery partner status",
                        e
                    )
                }
        } else {
            android.util.Log.w("AndroidBridge", "Cannot update status - user not authenticated")
        }
    }

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

    // ==================== PHONE AUTHENTICATION (PRODUCTION-PROVEN) ====================

    /**
     * Start phone authentication flow - sends OTP without captcha
     * This is the SAFE way for production: Native handles Firebase PhoneAuth
     */
    @JavascriptInterface
    fun startPhoneAuthentication(phoneNumber: String) {
        try {
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    // Auto-verification happened (instant verification)
                    signInWithPhoneCredential(credential)
                }

                override fun onVerificationFailed(p0: FirebaseException) {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                p0.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    // Store verification ID and resend token
                    this@AndroidBridgeImpl.verificationId = verificationId
                    this@AndroidBridgeImpl.resendToken = token

                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onOTPSent && window.onOTPSent('$verificationId')",
                            null
                        )
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(phoneNumber)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks)
                .build()

            PhoneAuthProvider.verifyPhoneNumber(options)

        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Verify OTP code entered by user
     */
    @JavascriptInterface
    fun verifyOTPCode(otpCode: String) {
        val currentVerificationId = verificationId
        if (currentVerificationId == null) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('No verification ID available')",
                    null
                )
            }
            return
        }

        try {
            val credential = PhoneAuthProvider.getCredential(currentVerificationId, otpCode)
            signInWithPhoneCredential(credential)
        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Resend OTP to the same phone number
     */
    @JavascriptInterface
    fun resendOTP(phoneNumber: String) {
        val currentResendToken = resendToken
        if (currentResendToken == null) {
            startPhoneAuthentication(phoneNumber)
            return
        }

        try {
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    signInWithPhoneCredential(credential)
                }

                override fun onVerificationFailed(p0: FirebaseException) {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                p0.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    this@AndroidBridgeImpl.verificationId = verificationId
                    this@AndroidBridgeImpl.resendToken = token

                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onOTPResent && window.onOTPResent('$verificationId')",
                            null
                        )
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(phoneNumber)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks)
                .setForceResendingToken(currentResendToken)
                .build()

            PhoneAuthProvider.verifyPhoneNumber(options)

        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Sign in with phone credential (private helper)
     */
    private fun signInWithPhoneCredential(credential: PhoneAuthCredential) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener(activity) { task ->
                if (task.isSuccessful) {
                    val user = auth.currentUser

                    // Start location tracking when delivery partner signs in
                    user?.uid?.let { partnerId ->
                        LocationTrackingService.startTracking(activity, partnerId)
                        android.util.Log.d(
                            "AndroidBridge",
                            "📍 Started location tracking for partner: $partnerId"
                        )
                    }

                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthSuccess && window.onPhoneAuthSuccess('${user?.uid}', '${user?.phoneNumber}')",
                            null
                        )
                    }
                } else {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                task.exception?.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }
            }
    }

    /**
     * Sign out current user
     */
    @JavascriptInterface
    fun signOutUser() {
        try {
            auth.signOut()
            verificationId = null
            resendToken = null

            // Stop location tracking on sign out
            LocationTrackingService.stopTracking(activity)
            android.util.Log.d("AndroidBridge", "📍 Stopped location tracking after sign out")

            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onSignOutSuccess && window.onSignOutSuccess()",
                    null
                )
            }
        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onSignOutError && window.onSignOutError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    // ==================== END PHONE AUTHENTICATION ====================

    // Show a native toast message
    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
    }

    // Request current location once and callback to window.receiveLocation(lat,lng)
    @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
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
    @RequiresPermission(allOf = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION])
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
                    LocationTrackingService.startTracking(activity, deliveryPartnerId, orderId)
                    Log.d("AndroidBridge", "Background service started successfully")
                }
            } else {
                LocationTrackingService.startTracking(activity, deliveryPartnerId, orderId)
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
        android.util.Log.d("AndroidBridge", "stopLocationTracking called")

        // Stop regular tracking
        trackingCallback?.let { fusedClient.removeLocationUpdates(it) }
        trackingCallback = null
        trackingDeliveryPartnerId = null
        trackingOrderId = null

        // Also stop background service
        try {
            LocationTrackingService.stopTracking(activity)
        } catch (e: Exception) {
            android.util.Log.e("AndroidBridge", "Failed to stop background service", e)
        }

        showToast("Native location tracking stopped")
    }

    // Start background location tracking service
    @JavascriptInterface
    fun startBackgroundTracking(deliveryPartnerId: String, orderId: String?) {
        android.util.Log.d(
            "AndroidBridge",
            "startBackgroundTracking called: partner=$deliveryPartnerId, order=$orderId"
        )

        if (!ensureLocationPermission()) {
            android.util.Log.w("AndroidBridge", "Location permission not granted")
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
                android.util.Log.w("AndroidBridge", "Notification permission not granted")
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
                android.util.Log.w("AndroidBridge", "Background location permission not granted")
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

        android.util.Log.d("AndroidBridge", "Starting LocationTrackingService")
        try {
            LocationTrackingService.startTracking(activity, deliveryPartnerId, orderId)
            showToast("Background tracking started")

            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onBackgroundTrackingStarted && window.onBackgroundTrackingStarted('$deliveryPartnerId')",
                    null
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("AndroidBridge", "Failed to start LocationTrackingService", e)
            showToast("Failed to start background tracking: ${e.message}")
        }
    }

    // Stop background location tracking service
    @JavascriptInterface
    fun stopBackgroundTracking() {
        android.util.Log.d("AndroidBridge", "stopBackgroundTracking called")
        LocationTrackingService.stopTracking(activity)
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
        android.util.Log.d("AndroidBridge", "getDeviceToken called with callback: $callbackName")
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    android.util.Log.w("AndroidBridge", "Failed to get FCM token", task.exception)
                    runOnUiThread {
                        webView.evaluateJavascript("$callbackName(null)", null)
                    }
                    return@addOnCompleteListener
                }

                val token = task.result
                android.util.Log.d("AndroidBridge", "FCM token received: ${token?.take(20)}...")
                runOnUiThread {
                    webView.evaluateJavascript("$callbackName('$token')", null)
                }
            }
    }

    // Alternative method name that the web app might be calling
    @JavascriptInterface
    fun requestFCMToken() {
        android.util.Log.d("AndroidBridge", "requestFCMToken called")
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    android.util.Log.w("AndroidBridge", "Failed to get FCM token", task.exception)
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onFCMTokenReceived && window.onFCMTokenReceived(null)",
                            null
                        )
                    }
                    return@addOnCompleteListener
                }

                val token = task.result
                android.util.Log.d("AndroidBridge", "FCM token received: ${token?.take(20)}...")
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
            val notification = NotificationCompat.Builder(activity, "delivery_alerts")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("")
                .setContentText("")
                .setDefaults(NotificationCompat.DEFAULT_SOUND)
                .build()

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
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
            val notification = NotificationCompat.Builder(activity, "delivery_alerts")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .build()

            val notificationManager =
                activity.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
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
                        android.util.Log.d(
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
        android.util.Log.d(
            "AndroidBridge",
            "🔥 pushLocationToFirebase called - partnerId: $partnerId"
        )

        if (partnerId == null) {
            android.util.Log.w("AndroidBridge", "Cannot push location - partnerId is null")
            return
        }

        // Security: Verify user is authenticated
        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            android.util.Log.e("AndroidBridge", "Cannot push location - user not authenticated")
            runOnUiThread {
                Toast.makeText(
                    activity,
                    "Authentication required for location tracking",
                    Toast.LENGTH_SHORT
                ).show()
            }
            return
        }

        android.util.Log.d(
            "AndroidBridge",
            "Pushing location for authenticated user: ${currentUser.uid}"
        )
        android.util.Log.d("AndroidBridge", "User email: ${currentUser.email}")

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
            android.util.Log.d("AndroidBridge", "Adding activeOrderId: $orderId")
        }

        android.util.Log.d(
            "AndroidBridge",
            "Writing to Firebase: lat=${location.latitude}, lng=${location.longitude}"
        )

        dbRef.updateChildren(payload)
            .addOnSuccessListener {
                android.util.Log.d(
                    "AndroidBridge",
                    "✅ Location successfully written to Firebase for partner: $partnerId"
                )
                runOnUiThread {
                    Toast.makeText(activity, "Location updated ✅", Toast.LENGTH_SHORT).show()
                }
            }
            .addOnFailureListener { exception ->
                android.util.Log.e(
                    "AndroidBridge",
                    "❌ Failed to write location to Firebase",
                    exception
                )
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
        android.util.Log.d("AndroidBridge", "Testing Firebase connection...")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            android.util.Log.e("AndroidBridge", "❌ Firebase test failed: User not authenticated")
            showToast("Not authenticated - please sign in first")
            return
        }

        android.util.Log.d("AndroidBridge", "✅ User authenticated: ${currentUser.uid}")
        android.util.Log.d("AndroidBridge", "✅ User email: ${currentUser.email}")

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
                android.util.Log.d("AndroidBridge", "✅ Firebase connection test successful")
                showToast("Firebase connection working!")

                // Now test delivery partner path
                testDeliveryPartnerPath()
            }
            .addOnFailureListener { exception ->
                android.util.Log.e("AndroidBridge", "❌ Firebase connection test failed", exception)
                showToast("Firebase connection failed: ${exception.message}")
            }
    }

    // Test specific delivery partner path access
    @JavascriptInterface
    fun testDeliveryPartnerPath() {
        val currentUser = FirebaseAuth.getInstance().currentUser
        val partnerId = trackingDeliveryPartnerId ?: "YruKuMoQQjU2Fa9RdhSibPousqy1"

        if (currentUser == null) {
            android.util.Log.e("AndroidBridge", "❌ Cannot test - user not authenticated")
            return
        }

        android.util.Log.d("AndroidBridge", "🔍 Testing deliveryPartners path access...")
        android.util.Log.d("AndroidBridge", "🔍 Partner ID: $partnerId")
        android.util.Log.d("AndroidBridge", "🔍 User ID: ${currentUser.uid}")

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
                android.util.Log.d("AndroidBridge", "✅ Delivery partner path test successful!")
                showToast("Delivery partner path accessible ✅")
            }
            .addOnFailureListener { exception ->
                android.util.Log.e(
                    "AndroidBridge",
                    "❌ Delivery partner path test failed",
                    exception
                )
                showToast("Path blocked: ${exception.message}")
            }
    }

    // Test basic Firebase write functionality
    @JavascriptInterface
    fun testBasicWrite() {
        android.util.Log.d("AndroidBridge", "🔍 Testing basic Firebase write...")

        val testRef = FirebaseDatabase.getInstance().getReference("debug_test")
        val testData = mapOf(
            "timestamp" to System.currentTimeMillis(),
            "test" to "basic_connectivity",
            "userAgent" to System.getProperty("http.agent")
        )

        testRef.setValue(testData)
            .addOnSuccessListener {
                android.util.Log.d("AndroidBridge", "✅ Basic write test SUCCESSFUL!")
                showToast("Firebase is working! ✅")
            }
            .addOnFailureListener { exception ->
                android.util.Log.e("AndroidBridge", "❌ Basic write test FAILED!", exception)
                showToast("Firebase not working: ${exception.message}")
            }
    }

    private fun showDebugTokenInstructions() {
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "🔧 APP CHECK DEBUG SETUP INSTRUCTIONS:")
        android.util.Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        android.util.Log.d("AndroidBridge", "1. Look for debug token in logcat:")
        android.util.Log.d("AndroidBridge", "   adb logcat | grep 'FirebaseAppCheck'")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "2. Copy the debug token from logs")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "3. Go to Firebase Console:")
        android.util.Log.d("AndroidBridge", "   → Project Settings → App Check")
        android.util.Log.d("AndroidBridge", "   → Apps → Your Android App → Debug tokens")
        android.util.Log.d("AndroidBridge", "   → Register debug token")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "4. Restart the app after adding the token")
        android.util.Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    }

    // Helper function for UI thread operations
    private fun runOnUiThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            mActivity.runOnUiThread { block() }
        }
    }

    // Master diagnostic - run all tests in sequence
    @JavascriptInterface
    fun runFullDiagnostic() {
        android.util.Log.d("AndroidBridge", "🚀 RUNNING FULL FIREBASE DIAGNOSTIC")
        android.util.Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        showToast("Running diagnostic sequence...")

        // Step 1: Check authentication
        testFirebaseConnection()

        // Step 2: Test basic write after 2 seconds
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            testBasicWrite()
        }, 2000)

        android.util.Log.d(
            "AndroidBridge",
            "⏳ Diagnostic sequence initiated - watch logs for results"
        )
    }

    // Test foreground service functionality
    @JavascriptInterface
    fun testForegroundService() {
        android.util.Log.d("AndroidBridge", "🔍 Testing foreground service functionality...")

        // Check notification permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotificationPermission = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

            android.util.Log.d(
                "AndroidBridge",
                "Notification permission: $hasNotificationPermission"
            )

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

        android.util.Log.d("AndroidBridge", "Location permission: $hasLocationPermission")

        if (!hasLocationPermission) {
            showToast("Location permission required for foreground service")
            return
        }

        // Test starting the service
        try {
            android.util.Log.d("AndroidBridge", "Testing LocationTrackingService startup...")
            LocationTrackingService.startTracking(activity, "TEST_PARTNER_ID", "TEST_ORDER_ID")
            showToast("Foreground service test started ✅")
            android.util.Log.d("AndroidBridge", "✅ Foreground service started successfully")

            // Stop it after 5 seconds
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                try {
                    LocationTrackingService.stopTracking(activity)
                    showToast("Foreground service test stopped ✅")
                    android.util.Log.d("AndroidBridge", "✅ Foreground service stopped successfully")
                } catch (e: Exception) {
                    android.util.Log.e("AndroidBridge", "❌ Failed to stop test service", e)
                }
            }, 5000)

        } catch (e: Exception) {
            android.util.Log.e("AndroidBridge", "❌ Failed to start foreground service", e)
            showToast("Foreground service failed: ${e.message}")
        }
    }


    // Monitor database read usage (legacy Firestore monitoring)
    @JavascriptInterface
    fun monitorFirestoreUsage() {
        android.util.Log.d("AndroidBridge", "📊 DATABASE USAGE MONITORING (LEGACY)")
        android.util.Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "✅ MIGRATED TO FIREBASE REALTIME DATABASE")
        android.util.Log.d("AndroidBridge", "   Previous: 37,000+ Firestore reads in 24 hours")
        android.util.Log.d("AndroidBridge", "   Current: Using Firebase RTDB for real-time data")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "🚀 CURRENT ARCHITECTURE:")
        android.util.Log.d("AndroidBridge", "   1. Real-time order updates via RTDB")
        android.util.Log.d("AndroidBridge", "   2. Location tracking via RTDB")
        android.util.Log.d("AndroidBridge", "   3. FCM tokens stored in RTDB")
        android.util.Log.d("AndroidBridge", "   4. Delivery partner status in RTDB")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "💡 BENEFITS ACHIEVED:")
        android.util.Log.d("AndroidBridge", "   ✅ Real-time data synchronization")
        android.util.Log.d("AndroidBridge", "   ✅ Reduced read costs (RTDB connection-based)")
        android.util.Log.d("AndroidBridge", "   ✅ Better performance for live tracking")
        android.util.Log.d("AndroidBridge", "   ✅ Offline support with persistence")
        android.util.Log.d("AndroidBridge", "   ✅ Simplified real-time listeners")
        android.util.Log.d("AndroidBridge", "")
        android.util.Log.d("AndroidBridge", "📈 MIGRATION COMPLETE:")
        android.util.Log.d("AndroidBridge", "   Cost: Firestore reads → RTDB connections")
        android.util.Log.d("AndroidBridge", "   Performance: Document queries → Real-time sync")
        android.util.Log.d("AndroidBridge", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        showToast("Database migration complete - using Firebase RTDB")

        // Also call the web-side monitoring if available
        runOnUiThread {
            webView.evaluateJavascript(
                "window.monitorDatabaseReads && window.monitorDatabaseReads()",
                null
            )
        }
    }
}

private fun getDebugToken() {
    try {
        // In debug builds, the debug token is automatically logged
        android.util.Log.d("AndroidBridge", "🔧 Debug mode - check logcat for App Check debug token")
        android.util.Log.d("AndroidBridge", "Look for: 'FirebaseAppCheck: Debug token'")

    } catch (e: Exception) {
        android.util.Log.e("AndroidBridge", "Failed to get debug token", e)
    }
}



