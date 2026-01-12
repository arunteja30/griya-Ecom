package com.griyaecom.seller

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
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
import androidx.annotation.RequiresApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import com.google.firebase.messaging.FirebaseMessaging
import com.griyaecom.seller.ui.theme.GriyaMartTheme
import com.griyaecom.seller.utils.ConfigManager
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var webViewUrl by mutableStateOf(ConfigManager.Defaults.SELLER_URL)
    private var isLoading by mutableStateOf(true)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        permissions.entries.forEach { (permission, isGranted) ->
            Log.d("SellerApp", "$permission granted: $isGranted")
        }
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Apply theme colors to status and navigation bars
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val statusColor =
                ContextCompat.getColor(this, com.griyaecom.seller.R.color.primary_color_dark)
            val navColor = ContextCompat.getColor(this, com.griyaecom.seller.R.color.primary_color)
            window.statusBarColor = statusColor
            window.navigationBarColor = navColor
        } catch (e: Exception) {
            Log.w("SellerApp", "Failed to set system bar colors", e)
        }

        requestNotificationPermissions()
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
        Box(modifier = Modifier.fillMaxSize()) {
            if (isLoading) {
                LoadingIndicator()
            } else {
                WebViewComposable(
                    url = webViewUrl,
                    modifier = Modifier.fillMaxSize()
                )
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
            webViewUrl = ConfigManager.getSellerWebUrl()
            Log.d("SellerApp", "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            Log.e("SellerApp", "Failed to load config, using fallback: $webViewUrl", e)
        } finally {
            isLoading = false
        }

        // Initialize Firebase after config is loaded
        initializeFirebaseMessaging()
    }

    private fun initializeFirebaseMessaging() {
        lifecycleScope.launch {
            try {
                com.griyaecom.seller.utils.FirebaseHelper.initializeFirebaseMessaging(
                    context = this@MainActivity,
                    onTokenReceived = { token ->
                        Log.d("SellerApp", "FCM token received: $token")
                        // Subscribe to seller topics
                        lifecycleScope.launch {
                            com.griyaecom.seller.utils.FirebaseHelper.subscribeToSellerTopics(
                                onSuccess = { topic ->
                                    Log.d("SellerApp", "Subscribed to topic: $topic")
                                },
                                onError = { topic, error ->
                                    Log.w(
                                        "SellerApp",
                                        "Failed to subscribe to topic: $topic",
                                        error
                                    )
                                }
                            )
                        }
                    },
                    onError = { exception ->
                        Log.e("SellerApp", "Firebase initialization failed", exception)
                        // Continue without push notifications
                    }
                )
            } catch (e: Exception) {
                Log.e("SellerApp", "Critical Firebase error", e)
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

            addJavascriptInterface(SellerWebBridge(), "SellerApp")

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
                        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(requestUrl)))
                        return true
                    }

                    // Dynamic host checking
                    val baseHost = android.net.Uri.parse(webViewUrl).host
                    val targetHost = android.net.Uri.parse(requestUrl).host
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

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
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

    private fun injectFCMToken() {
        val token = com.griyaecom.seller.utils.FirebaseHelper.getCurrentToken(this) ?: ""

        val javascript = """
            window.fcmToken = '$token';
            window.appType = 'seller';
            if (window.initializeNotifications) {
                window.initializeNotifications('$token', 'seller');
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
            val productName = extras.getString("product_name")

            when (action) {
                "accept_order", "view_order" -> {
                    executeJavaScript("if (window.handleNotificationAction) { window.handleNotificationAction('$action', '$orderId'); }")
                }
                "restock_product" -> {
                    executeJavaScript("if (window.handleNotificationAction) { window.handleNotificationAction('restock_product', '$productName'); }")
                }
                "view_reviews" -> {
                    executeJavaScript("if (window.handleNotificationAction) { window.handleNotificationAction('view_reviews', ''); }")
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
            url.startsWith("griyaseller://") -> {
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

    inner class SellerWebBridge {
        @JavascriptInterface
        fun getFCMToken(): String {
            return com.griyaecom.seller.utils.FirebaseHelper.getCurrentToken(this@MainActivity)
                ?: ""
        }

        @JavascriptInterface
        fun subscribeToTopic(topic: String) {
            lifecycleScope.launch {
                com.griyaecom.seller.utils.FirebaseHelper.subscribeToTopics(
                    listOf(topic),
                    onSuccess = { Log.d("SellerApp", "Subscribed to topic: $it") },
                    onError = { t, e -> Log.w("SellerApp", "Failed to subscribe to topic: $t", e) }
                )
            }
        }

        @JavascriptInterface
        fun unsubscribeFromTopic(topic: String) {
            lifecycleScope.launch {
                com.griyaecom.seller.utils.FirebaseHelper.unsubscribeFromTopics(
                    listOf(topic),
                    onSuccess = { Log.d("SellerApp", "Unsubscribed from topic: $it") },
                    onError = { t, e ->
                        Log.w(
                            "SellerApp",
                            "Failed to unsubscribe from topic: $t",
                            e
                        )
                    }
                )
            }
        }

        @JavascriptInterface
        fun updateSellerStatus(status: String) {
            Log.d("SellerApp", "Seller status updated: $status")
            lifecycleScope.launch {
                com.griyaecom.seller.utils.FirebaseHelper.updateSellerStatus(
                    status,
                    onSuccess = {
                        runOnUiThread {
                            when (status) {
                                "open" -> showToast("You are now accepting orders")
                                "closed" -> showToast("You are now closed")
                                "busy" -> showToast("Status updated to busy")
                            }
                        }
                    },
                    onError = { exception ->
                        Log.e("SellerApp", "Failed to update seller status", exception)
                        runOnUiThread {
                            showToast("Failed to update status. Please try again.")
                        }
                    }
                )
            }
        }

        @JavascriptInterface
        fun setInventoryAlerts(enabled: Boolean, threshold: Int) {
            Log.d("SellerApp", "Inventory alerts: $enabled, threshold: $threshold")
            val sharedPref = getSharedPreferences("SellerPrefs", MODE_PRIVATE)
            sharedPref.edit()
                .putBoolean("inventory_alerts_enabled", enabled)
                .putInt("inventory_threshold", threshold)
                .apply()

            if (enabled) {
                FirebaseMessaging.getInstance().subscribeToTopic("inventory_alerts")
            } else {
                FirebaseMessaging.getInstance().unsubscribeFromTopic("inventory_alerts")
            }
        }

        @JavascriptInterface
        fun requestCameraPermission(): Boolean {
            val hasPermission = ContextCompat.checkSelfPermission(
                this@MainActivity, Manifest.permission.CAMERA
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