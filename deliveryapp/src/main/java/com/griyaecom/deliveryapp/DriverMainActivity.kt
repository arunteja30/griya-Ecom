package com.griyaecom.deliveryapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.griyaecom.deliveryapp.services.LiveLocationTrackingService
import com.griyaecom.deliveryapp.ui.theme.GriyaMartTheme
import com.griyaecom.deliveryapp.utils.ConfigManager
import kotlinx.coroutines.launch

class DriverMainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var webViewUrl by mutableStateOf(ConfigManager.Defaults.DELIVERY_URL)
    private var isLoading by mutableStateOf(true)

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

        // Apply theme colors to status and navigation bars
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val statusColor =
                ContextCompat.getColor(this, com.griyaecom.deliveryapp.R.color.primary_color_dark)
            val navColor =
                ContextCompat.getColor(this, com.griyaecom.deliveryapp.R.color.primary_color)
            window.statusBarColor = statusColor
            window.navigationBarColor = navColor
        } catch (e: Exception) {
            Log.w("DeliveryApp", "Failed to set system bar colors", e)
        }

        requestNotificationPermissions()
        initializeFirebaseMessaging()
        handleNotificationData()

        // Load config asynchronously
        lifecycleScope.launch {
            loadConfigAndSetup()
        }

        setContent {
            GriyaMartTheme {
                AppContent()
            }
        }
    }

    @Composable
    private fun AppContent() {
        Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (isLoading) {
                    LoadingIndicator()
                } else {
                    WebViewComposable(
                        url = webViewUrl,
                        modifier = Modifier
                            .fillMaxSize()
                    )
                }
            }
        }
    }

    @Composable
    private fun LoadingIndicator() {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
    }

    private suspend fun loadConfigAndSetup() {
        try {
            webViewUrl = ConfigManager.getDeliveryWebUrl()
            Log.d("DeliveryApp", "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            Log.e("DeliveryApp", "Failed to load config, using fallback: $webViewUrl", e)
        } finally {
            isLoading = false
        }

        // Initialize Firebase after config is loaded
        initializeFirebaseMessaging()
    }

    private fun initializeFirebaseMessaging() {
        lifecycleScope.launch {
            try {
                com.griyaecom.deliveryapp.utils.FirebaseHelper.initializeFirebaseMessaging(
                    context = this@DriverMainActivity,
                    onTokenReceived = { token ->
                        Log.d("DeliveryApp", "FCM token received: $token")
                        // Subscribe to delivery topics
                        lifecycleScope.launch {
                            com.griyaecom.deliveryapp.utils.FirebaseHelper.subscribeToDeliveryTopics(
                                onSuccess = { topic ->
                                    Log.d("DeliveryApp", "Subscribed to topic: $topic")
                                },
                                onError = { topic, error ->
                                    Log.w(
                                        "DeliveryApp",
                                        "Failed to subscribe to topic: $topic",
                                        error
                                    )
                                }
                            )
                        }
                    },
                    onError = { exception ->
                        Log.e("DeliveryApp", "Firebase initialization failed", exception)
                        // Continue without push notifications
                    }
                )
            } catch (e: Exception) {
                Log.e("DeliveryApp", "Critical Firebase error", e)
            }
        }
    }

    @Composable
    private fun WebViewComposable(url: String, modifier: Modifier = Modifier) {
        AndroidView(
            modifier = modifier,
            factory = { context ->
                WebView(context).apply {
                    webView = this
                    setupWebView(this, url)
                }
            },
            update = { view ->
                if (view.url != url) {
                    view.loadUrl(url)
                }
            }
        )
    }

    private fun setupWebView(webView: WebView, url: String) {
        webView.apply {
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
                cacheMode = WebSettings.LOAD_DEFAULT
            }

            addJavascriptInterface(DeliveryWebBridge(), "DeliveryApp")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val requestUrl = request?.url?.toString() ?: return false

                    // Handle external URLs
                    if (requestUrl.startsWith("tel:") || requestUrl.startsWith("mailto:") || requestUrl.startsWith(
                            "sms:"
                        )
                    ) {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(requestUrl)))
                        return true
                    }

                    // Dynamic host checking
                    val baseHost = Uri.parse(webViewUrl).host
                    val targetHost = Uri.parse(requestUrl).host
                    return baseHost != targetHost
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    injectFCMToken()
                }
            }

            clearCache(true)
            loadUrl(url)
        }
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

    private fun injectFCMToken() {
        val token = com.griyaecom.deliveryapp.utils.FirebaseHelper.getCurrentToken(this) ?: ""

        val javascript = """
            window.fcmToken = '$token';
            window.appType = 'delivery';
            if (window.initializeNotifications) {
                window.initializeNotifications('$token', 'delivery');
            }
        """.trimIndent()

        if (::webView.isInitialized) {
            webView.evaluateJavascript(javascript, null)
        }
    }

    private fun handleNotificationData() {
        intent.extras?.let { extras ->
            val action = extras.getString("action")
            val orderId = extras.getString("order_id")

            when (action) {
                "accept_order", "decline_order" -> {
                    executeJavaScript("if (window.handleNotificationAction) { window.handleNotificationAction('$action', '$orderId'); }")
                }
                "share_location" -> {
                    executeJavaScript("if (window.handleNotificationAction) { window.handleNotificationAction('share_location', ''); }")
                }
            }
        }
    }

    private fun executeJavaScript(script: String) {
        if (::webView.isInitialized) {
            webView.evaluateJavascript(script, null)
        }
    }

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val url = data.toString()

        when {
            url.startsWith(webViewUrl) -> webView.loadUrl(url)
            url.startsWith("griyadriver://") -> {
                val path = data.path ?: "/"
                val targetUrl = webViewUrl.trimEnd('/') + path
                webView.loadUrl(targetUrl)
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleNotificationData()
        handleDeepLink(intent)
    }

    inner class DeliveryWebBridge {
        @JavascriptInterface
        fun getFCMToken(): String {
            return com.griyaecom.deliveryapp.utils.FirebaseHelper.getCurrentToken(this@DriverMainActivity)
                ?: ""
        }

        @JavascriptInterface
        fun updateDriverStatus(status: String) {
            Log.d("DeliveryApp", "Driver status updated: $status")
            val sharedPref = getSharedPreferences("DeliveryPrefs", MODE_PRIVATE)
            sharedPref.edit()
                .putString("driver_status", status)
                .putLong("status_updated_at", System.currentTimeMillis())
                .apply()

            lifecycleScope.launch {
                com.griyaecom.deliveryapp.utils.FirebaseHelper.updateDriverStatus(
                    status,
                    onSuccess = {
                        runOnUiThread {
                            when (status) {
                                "online" -> showToast("You are now online and available for orders")
                                "offline" -> showToast("You are now offline")
                                "busy" -> showToast("Status updated to busy")
                            }
                        }
                    },
                    onError = { exception ->
                        Log.e("DeliveryApp", "Failed to update driver status", exception)
                        runOnUiThread {
                            showToast("Failed to update status. Please try again.")
                        }
                    }
                )
            }
        }

        @JavascriptInterface
        fun acceptOrder(orderId: String) {
            Log.d("DeliveryApp", "Order accepted: $orderId")
            val driverId = getCurrentDriverId()
            if (driverId != null) {
                updateDriverOrderRelationship(orderId, driverId, "ACCEPTED")
                startLiveLocationTracking(orderId, driverId)
            }
            showToast("Order accepted - Live tracking started")
        }

        @JavascriptInterface
        fun updateOrderStatus(orderId: String, status: String) {
            Log.d("DeliveryApp", "Updating order status: $orderId to $status")
            val driverId = getCurrentDriverId()
            if (driverId != null) {
                updateDriverOrderRelationship(orderId, driverId, status)
                when (status) {
                    "ACCEPTED" -> startLiveLocationTracking(orderId, driverId)
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
                val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
                sharedPref.edit()
                    .putString("tracking_order_id", orderId)
                    .putString("tracking_driver_id", driverId)
                    .putLong("tracking_started_at", System.currentTimeMillis())
                    .putBoolean("is_tracking_active", true)
                    .apply()
                showToast("Live location tracking started")
            } else {
                showToast("Location permission required for live tracking")
            }
        }

        @JavascriptInterface
        fun requestLocationPermission(): Boolean {
            val hasFineLoc = ContextCompat.checkSelfPermission(
                this@DriverMainActivity, Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val hasCoarseLoc = ContextCompat.checkSelfPermission(
                this@DriverMainActivity, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasFineLoc || !hasCoarseLoc) {
                requestPermissionLauncher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
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
        sharedPref.edit()
            .putString("current_order_id", orderId)
            .putString("current_driver_id", driverId)
            .putString("current_order_status", status)
            .putLong("relation_timestamp", System.currentTimeMillis())
            .putString("relation_id", "${driverId}_${orderId}")
            .apply()
        Log.d("DriverMainActivity", "Updated driver-order relationship: $driverId -> $orderId ($status)")
    }

    private fun removeDriverOrderRelationship(orderId: String, driverId: String) {
        val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
        sharedPref.edit()
            .remove("current_order_id")
            .remove("current_driver_id")
            .remove("current_order_status")
            .putLong("relation_removed_at", System.currentTimeMillis())
            .apply()
        Log.d("DriverMainActivity", "Removed driver-order relationship: $driverId -> $orderId")
    }

    private fun stopLiveLocationTracking() {
        Log.d("DeliveryApp", "Stopping live location tracking")
        LiveLocationTrackingService.stopService(this)
        val sharedPref = getSharedPreferences("DriverOrderRelation", MODE_PRIVATE)
        sharedPref.edit()
            .putLong("tracking_stopped_at", System.currentTimeMillis())
            .putBoolean("is_tracking_active", false)
            .apply()
        showToast("Live location tracking stopped")
    }

    private fun showToast(message: String) {
        runOnUiThread {
            android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
