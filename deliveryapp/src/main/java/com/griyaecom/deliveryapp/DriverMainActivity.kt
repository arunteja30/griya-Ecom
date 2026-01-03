package com.griyaecom.deliveryapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.griyaecom.deliveryapp.services.LiveLocationTrackingService
import com.griyaecom.deliveryapp.ui.theme.GriyaMartTheme

class DriverMainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private val webViewUrl = "https://delivery-hungrimart.onrender.com" // Replace with your delivery web URL

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        permissions.entries.forEach { (permission, isGranted) ->
            Log.d("DeliveryApp", "$permission granted: $isGranted")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Request notification permissions
        requestNotificationPermissions()

        // Initialize Firebase and get FCM token
        initializeFirebaseMessaging()

        // Handle notification data from intent
        handleNotificationData()

        setContent {
            GriyaMartTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    WebViewComposable(
                        url = webViewUrl,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    )
                }
            }
        }
    }

    @Composable
    fun WebViewComposable(url: String, modifier: Modifier = Modifier) {
        AndroidView(
            modifier = modifier,
            factory = { context ->
                WebView(context).apply {
                    webView = this

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        setSupportZoom(true)
                        builtInZoomControls = false
                        displayZoomControls = false
                        loadWithOverviewMode = true
                        useWideViewPort = true
                    }

                    // Add JavaScript interface for native communication
                    addJavascriptInterface(DeliveryWebBridge(), "DeliveryApp")

                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            // Inject FCM token into web app
                            injectFCMToken()
                        }
                    }

                    loadUrl(url)
                }
            }
        )
    }

    private fun requestNotificationPermissions() {
        val permissions = arrayOf(
            Manifest.permission.POST_NOTIFICATIONS,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        val permissionsToRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun initializeFirebaseMessaging() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("DeliveryApp", "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            // Get new FCM registration token
            val token = task.result
            Log.d("DeliveryApp", "FCM Registration Token: $token")

            // Store token locally
            val sharedPref = getSharedPreferences("DeliveryFCMPrefs", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("fcm_token", token)
                apply()
            }
        }

        // Subscribe to topics for delivery drivers
        FirebaseMessaging.getInstance().subscribeToTopic("delivery_updates")
        FirebaseMessaging.getInstance().subscribeToTopic("emergency_alerts")
    }

    private fun injectFCMToken() {
        val sharedPref = getSharedPreferences("DeliveryFCMPrefs", MODE_PRIVATE)
        val token = sharedPref.getString("fcm_token", "")

        val javascript = """
            window.fcmToken = '$token';
            window.appType = 'delivery';
            if (window.initializeNotifications) {
                window.initializeNotifications('$token', 'delivery');
            }
        """.trimIndent()

        webView.evaluateJavascript(javascript, null)
    }

    private fun handleNotificationData() {
        intent.extras?.let { extras ->
            val action = extras.getString("action")
            when (action) {
                "accept_order" -> {
                    val orderId = extras.getString("order_id")
                    // Handle accept order action
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('accept_order', '$orderId'); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
                "decline_order" -> {
                    val orderId = extras.getString("order_id")
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('decline_order', '$orderId'); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
                "share_location" -> {
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('share_location', ''); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
            }
        }
    }

    inner class DeliveryWebBridge {

        @JavascriptInterface
        fun getFCMToken(): String {
            val sharedPref = getSharedPreferences("DeliveryFCMPrefs", MODE_PRIVATE)
            return sharedPref.getString("fcm_token", "") ?: ""
        }

        @JavascriptInterface
        fun subscribeToTopic(topic: String) {
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
            Log.d("DeliveryApp", "Subscribed to topic: $topic")
        }

        @JavascriptInterface
        fun unsubscribeFromTopic(topic: String) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
            Log.d("DeliveryApp", "Unsubscribed from topic: $topic")
        }

        @JavascriptInterface
        fun sendTokenToServer(token: String, driverId: String) {
            Log.d("DeliveryApp", "Sending token to server: $token for driver: $driverId")

            // Store driver ID for future use
            val sharedPref = getSharedPreferences("DeliveryPrefs", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("driver_id", driverId)
                apply()
            }

            // TODO: Implement API call to register token with driver relationship
        }

        @JavascriptInterface
        fun updateDriverStatus(status: String) {
            Log.d("DeliveryApp", "Driver status updated: $status")

            // Update driver status in local storage
            val sharedPref = getSharedPreferences("DeliveryPrefs", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("driver_status", status)
                putLong("status_updated_at", System.currentTimeMillis())
                apply()
            }

            // Subscribe/unsubscribe based on status
            when (status) {
                "online" -> {
                    FirebaseMessaging.getInstance().subscribeToTopic("available_orders")
                    showToast("You are now online and available for orders")
                }
                "offline" -> {
                    FirebaseMessaging.getInstance().unsubscribeFromTopic("available_orders")
                    showToast("You are now offline")
                }
                "busy" -> {
                    showToast("Status updated to busy")
                }
            }
        }

        @JavascriptInterface
        fun acceptOrder(orderId: String) {
            Log.d("DeliveryApp", "Order accepted: $orderId")

            val driverId = getCurrentDriverId()
            if (driverId != null) {
                // Update driver-order relationship
                updateDriverOrderRelationship(orderId, driverId, "ACCEPTED")

                // Start live location tracking
                startLiveLocationTracking(orderId, driverId)

                // Update order status
                updateOrderStatus(orderId, "ACCEPTED")
            }

            showToast("Order accepted - Live tracking started")
        }

        @JavascriptInterface
        fun declineOrder(orderId: String) {
            Log.d("DeliveryApp", "Order declined: $orderId")

            val driverId = getCurrentDriverId()
            if (driverId != null) {
                // Remove driver-order relationship
                removeDriverOrderRelationship(orderId, driverId)
            }

            showToast("Order declined")
        }

        @JavascriptInterface
        fun updateOrderStatus(orderId: String, status: String) {
            Log.d("DeliveryApp", "Updating order status: $orderId to $status")

            val driverId = getCurrentDriverId()
            if (driverId != null) {
                // Update driver-order relationship status
                updateDriverOrderRelationship(orderId, driverId, status)

                // Handle live tracking based on status
                when (status) {
                    "ACCEPTED" -> {
                        startLiveLocationTracking(orderId, driverId)
                    }
                    "DELIVERED", "CANCELLED" -> {
                        stopLiveLocationTracking()
                        removeDriverOrderRelationship(orderId, driverId)
                    }
                }
            }

            showToast("Order status updated to $status")
        }

        @JavascriptInterface
        fun startLiveLocationTracking(orderId: String, driverId: String) {
            Log.d("DeliveryApp", "Starting live location tracking for order: $orderId")

            if (requestLocationPermission()) {
                LiveLocationTrackingService.startService(this@DriverMainActivity, orderId, driverId)

                // Update tracking status in relationship
                val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
                with(sharedPref.edit()) {
                    putString("tracking_order_id", orderId)
                    putString("tracking_driver_id", driverId)
                    putLong("tracking_started_at", System.currentTimeMillis())
                    putBoolean("is_tracking_active", true)
                    apply()
                }

                showToast("Live location tracking started")
            } else {
                showToast("Location permission required for live tracking")
            }
        }

        @JavascriptInterface
        fun stopLiveLocationTracking() {
            Log.d("DeliveryApp", "Stopping live location tracking")

            LiveLocationTrackingService.stopService(this@DriverMainActivity)

            // Update tracking status
            val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putLong("tracking_stopped_at", System.currentTimeMillis())
                putBoolean("is_tracking_active", false)
                apply()
            }

            showToast("Live location tracking stopped")
        }

        @JavascriptInterface
        fun navigateToPickup(orderId: String) {
            Log.d("DeliveryApp", "Navigate to pickup for order: $orderId")

            // Get pickup location from stored order data
            val orderData = getStoredOrderData(orderId)
            orderData?.let { order ->
                val pickupLat = order.getString("pickup_lat", "0")
                val pickupLng = order.getString("pickup_lng", "0")

                if (pickupLat != "0" && pickupLng != "0") {
                    openGoogleMapsNavigation(pickupLat, pickupLng, "Pickup Location")
                } else {
                    showToast("Pickup location not available")
                }
            }
        }

        @JavascriptInterface
        fun navigateToCustomer(orderId: String) {
            Log.d("DeliveryApp", "Navigate to customer for order: $orderId")

            // Get customer location from stored order data
            val orderData = getStoredOrderData(orderId)
            orderData?.let { order ->
                val dropLat = order.getString("drop_lat", "0")
                val dropLng = order.getString("drop_lng", "0")

                if (dropLat != "0" && dropLng != "0") {
                    openGoogleMapsNavigation(dropLat, dropLng, "Customer Location")
                } else {
                    showToast("Customer location not available")
                }
            }
        }

        @JavascriptInterface
        fun callCustomer(phoneNumber: String) {
            Log.d("DeliveryApp", "Calling customer: $phoneNumber")

            try {
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$phoneNumber")
                }

                if (ContextCompat.checkSelfPermission(this@DriverMainActivity, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                    startActivity(intent)
                } else {
                    // Fallback to dialer
                    val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                        data = Uri.parse("tel:$phoneNumber")
                    }
                    startActivity(dialIntent)
                }
            } catch (e: Exception) {
                Log.e("DeliveryApp", "Error making call", e)
                showToast("Unable to make call")
            }
        }

        @JavascriptInterface
        fun shareCurrentLocation(orderId: String) {
            Log.d("DeliveryApp", "Sharing current location for order: $orderId")

            val driverId = getCurrentDriverId()
            if (driverId != null) {
                // Force location update through live tracking service
                if (isLocationTrackingActive()) {
                    showToast("Location shared with customer")
                } else {
                    // Start temporary location sharing
                    startLiveLocationTracking(orderId, driverId)
                }
            }
        }

        @JavascriptInterface
        fun getCurrentLocation(): String {
            // Return current location if available from live tracking service
            val sharedPref = getSharedPreferences("LiveLocationData", MODE_PRIVATE)
            val lat = sharedPref.getFloat("last_lat", 0f)
            val lng = sharedPref.getFloat("last_lng", 0f)
            val accuracy = sharedPref.getFloat("last_accuracy", 0f)
            val timestamp = sharedPref.getLong("last_timestamp", 0)

            return if (lat != 0f && lng != 0f) {
                """{"lat": $lat, "lng": $lng, "accuracy": $accuracy, "timestamp": $timestamp}"""
            } else {
                """{"error": "Location not available"}"""
            }
        }

        @JavascriptInterface
        fun getDriverOrderRelation(): String {
            val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
            val orderId = sharedPref.getString("current_order_id", "")
            val status = sharedPref.getString("current_order_status", "")
            val isTracking = sharedPref.getBoolean("is_tracking_active", false)
            val relationTimestamp = sharedPref.getLong("relation_timestamp", 0)

            return """
                {
                    "orderId": "$orderId",
                    "status": "$status",
                    "isTrackingActive": $isTracking,
                    "relationTimestamp": $relationTimestamp,
                    "driverId": "${getCurrentDriverId() ?: ""}"
                }
            """.trimIndent()
        }

        @JavascriptInterface
        fun requestLocationPermission(): Boolean {
            val hasFineLoc = ContextCompat.checkSelfPermission(
                this@DriverMainActivity,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val hasCoarseLoc = ContextCompat.checkSelfPermission(
                this@DriverMainActivity,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasFineLoc || !hasCoarseLoc) {
                requestPermissionLauncher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION
                ))
                return false
            }

            return true
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                android.widget.Toast.makeText(this@DriverMainActivity, message, android.widget.Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun logMessage(message: String) {
            Log.d("DeliveryWebApp", message)
        }
    }

    private fun getCurrentDriverId(): String? {
        val sharedPref = getSharedPreferences("DeliveryPrefs", MODE_PRIVATE)
        return sharedPref.getString("driver_id", null)
    }

    private fun updateDriverOrderRelationship(orderId: String, driverId: String, status: String) {
        val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("current_order_id", orderId)
            putString("current_driver_id", driverId)
            putString("current_order_status", status)
            putLong("relation_timestamp", System.currentTimeMillis())
            putString("relation_id", "${driverId}_${orderId}")
            apply()
        }

        Log.d("DriverMainActivity", "Updated driver-order relationship: $driverId -> $orderId ($status)")
    }

    private fun removeDriverOrderRelationship(orderId: String, driverId: String) {
        val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
        with(sharedPref.edit()) {
            remove("current_order_id")
            remove("current_driver_id")
            remove("current_order_status")
            putLong("relation_removed_at", System.currentTimeMillis())
            apply()
        }

        Log.d("DriverMainActivity", "Removed driver-order relationship: $driverId -> $orderId")
    }

    private fun getStoredOrderData(orderId: String): Bundle? {
        // Get order data from intent extras (passed from notification)
        return if (intent.getStringExtra("order_id") == orderId) {
            intent.extras
        } else {
            null
        }
    }

    private fun openGoogleMapsNavigation(lat: String, lng: String, label: String) {
        try {
            val gmmIntentUri = Uri.parse("google.navigation:q=$lat,$lng&mode=d")
            val mapIntent = Intent(Intent.ACTION_VIEW, gmmIntentUri).apply {
                setPackage("com.google.android.apps.maps")
            }

            if (mapIntent.resolveActivity(packageManager) != null) {
                startActivity(mapIntent)
            } else {
                // Fallback to web maps
                val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
                val webIntent = Intent(Intent.ACTION_VIEW, webUri)
                startActivity(webIntent)
            }
        } catch (e: Exception) {
            Log.e("DriverMainActivity", "Error opening navigation", e)
            showToast("Unable to open navigation")
        }
    }

    private fun isLocationTrackingActive(): Boolean {
        val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
        return sharedPref.getBoolean("is_tracking_active", false)
    }

    private fun showToast(message: String) {
        runOnUiThread {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}