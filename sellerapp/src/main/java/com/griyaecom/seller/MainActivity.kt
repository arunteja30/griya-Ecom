package com.griyaecom.seller

import android.Manifest
import android.content.pm.PackageManager
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
import com.griyaecom.seller.ui.theme.GriyaMartTheme

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private val webViewUrl = "https://seller-griyamart.onrender.com" // Replace with your seller web URL

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        permissions.entries.forEach { (permission, isGranted) ->
            Log.d("SellerApp", "$permission granted: $isGranted")
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
                    addJavascriptInterface(SellerWebBridge(), "SellerApp")

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
            Manifest.permission.CAMERA
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
                Log.w("SellerApp", "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            // Get new FCM registration token
            val token = task.result
            Log.d("SellerApp", "FCM Registration Token: $token")

            // Store token locally
            val sharedPref = getSharedPreferences("SellerFCMPrefs", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("fcm_token", token)
                apply()
            }
        }

        // Subscribe to topics for sellers
        FirebaseMessaging.getInstance().subscribeToTopic("seller_updates")
        FirebaseMessaging.getInstance().subscribeToTopic("admin_announcements")
    }

    private fun injectFCMToken() {
        val sharedPref = getSharedPreferences("SellerFCMPrefs", MODE_PRIVATE)
        val token = sharedPref.getString("fcm_token", "")

        val javascript = """
            window.fcmToken = '$token';
            window.appType = 'seller';
            if (window.initializeNotifications) {
                window.initializeNotifications('$token', 'seller');
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
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('accept_order', '$orderId'); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
                "view_order" -> {
                    val orderId = extras.getString("order_id")
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('view_order', '$orderId'); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
                "restock_product" -> {
                    val productName = extras.getString("product_name")
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('restock_product', '$productName'); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
                "view_reviews" -> {
                    val javascript = "if (window.handleNotificationAction) { window.handleNotificationAction('view_reviews', ''); }"
                    if (::webView.isInitialized) {
                        webView.evaluateJavascript(javascript, null)
                    }
                }
            }
        }
    }

    inner class SellerWebBridge {

        @JavascriptInterface
        fun getFCMToken(): String {
            val sharedPref = getSharedPreferences("SellerFCMPrefs", MODE_PRIVATE)
            return sharedPref.getString("fcm_token", "") ?: ""
        }

        @JavascriptInterface
        fun subscribeToTopic(topic: String) {
            FirebaseMessaging.getInstance().subscribeToTopic(topic)
            Log.d("SellerApp", "Subscribed to topic: $topic")
        }

        @JavascriptInterface
        fun unsubscribeFromTopic(topic: String) {
            FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
            Log.d("SellerApp", "Unsubscribed from topic: $topic")
        }

        @JavascriptInterface
        fun sendTokenToServer(token: String, sellerId: String) {
            Log.d("SellerApp", "Sending token to server: $token for seller: $sellerId")
            // Implement your API call to send token to server
        }

        @JavascriptInterface
        fun updateSellerStatus(status: String) {
            Log.d("SellerApp", "Seller status updated: $status")
            // Update seller status (open, closed, busy)

            // Subscribe/unsubscribe based on status
            when (status) {
                "open" -> {
                    FirebaseMessaging.getInstance().subscribeToTopic("order_notifications")
                    FirebaseMessaging.getInstance().subscribeToTopic("payment_notifications")
                }
                "closed" -> {
                    FirebaseMessaging.getInstance().unsubscribeFromTopic("order_notifications")
                    // Keep payment notifications even when closed
                }
            }
        }

        @JavascriptInterface
        fun setInventoryAlerts(enabled: Boolean, threshold: Int) {
            Log.d("SellerApp", "Inventory alerts: $enabled, threshold: $threshold")
            // Store inventory alert preferences
            val sharedPref = getSharedPreferences("SellerPrefs", MODE_PRIVATE)
            with(sharedPref.edit()) {
                putBoolean("inventory_alerts_enabled", enabled)
                putInt("inventory_threshold", threshold)
                apply()
            }

            if (enabled) {
                FirebaseMessaging.getInstance().subscribeToTopic("inventory_alerts")
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("inventory_alerts")
            }
        }

        @JavascriptInterface
        fun requestCameraPermission(): Boolean {
            val hasPermission = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasPermission) {
                requestPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            }

            return hasPermission
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                android.widget.Toast.makeText(this@MainActivity, message, android.widget.Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun logMessage(message: String) {
            Log.d("SellerWebApp", message)
        }

        @JavascriptInterface
        fun getSellerPreferences(): String {
            val sharedPref = getSharedPreferences("SellerPrefs", MODE_PRIVATE)
            val inventoryAlertsEnabled = sharedPref.getBoolean("inventory_alerts_enabled", true)
            val inventoryThreshold = sharedPref.getInt("inventory_threshold", 10)

            return """
                {
                    "inventoryAlertsEnabled": $inventoryAlertsEnabled,
                    "inventoryThreshold": $inventoryThreshold
                }
            """.trimIndent()
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