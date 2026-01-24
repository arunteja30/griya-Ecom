package com.mat.theypo

import android.R
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONObject

/**
 * Full-featured WebView host for the customer app.
 * Includes: splash screen, permissions, offline handling, progress bar, error pages
 */
class HybridWebActivity : AppCompatActivity(), NetworkMonitor.NetworkListener {

    companion object {
        // TODO: change this to your real deployed customer-web URL
        private const val WEB_APP_URL = "https://fags.onrender.com"
        const val NOTIFICATION_CHANNEL_ID = "customer_app_notifications"
        private const val ACTIVE_ORDER_NOTIFICATION_ID = 1001
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var permissionManager: PermissionManager
    private lateinit var networkMonitor: NetworkMonitor
    private lateinit var bridgeImpl: AndroidBridgeImpl
    private lateinit var notificationBridge: MobileNotificationBridge
    private var isOfflineShown = false
    private var activeOrderNotificationId: Int? = null

    private val notificationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == PushNotificationService.ACTION_FOREGROUND_NOTIFICATION) {
                val title = intent.getStringExtra("title") ?: "New Update"
                val body = intent.getStringExtra("body") ?: ""
                val orderId = intent.getStringExtra("orderId")

                // Send to WebView via JavaScript
                val jsData = JSONObject().apply {
                    put("title", title)
                    put("body", body)
                    put("orderId", orderId ?: JSONObject.NULL)
                }

                webView.post {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('pushNotification', { detail: $jsData }));",
                        null
                    )
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up edge-to-edge display with proper insets handling
//        try {
//            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
//                window?.let { win ->
//                    win.setDecorFitsSystemWindows(false)
//                    try {
//                        val controller = win.insetsController
//                        controller?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
//                    } catch (e: Exception) {
//                        // Fallback for devices where insetsController is not available
//                        e.printStackTrace()
//                    }
//                }
//            } else {
//                @Suppress("DEPRECATION")
//                window?.decorView?.systemUiVisibility = (
//                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
//                                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
//                                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
//                        )
//            }
//        } catch (e: Exception) {
//            // If edge-to-edge setup fails, continue without it
//            e.printStackTrace()
//        }

        // Create container layout
        val container = FrameLayout(this)

        // Set up window insets handling for the container
//        try {
//            ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
//                val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
//                view.setPadding(
//                    systemBars.left,
//                    systemBars.top,
//                    systemBars.right,
//                    systemBars.bottom
//                )
//                insets
//            }
//        } catch (e: Exception) {
//            // If insets handling fails, use default padding
//            container.setPadding(0, 24, 0, 0) // Basic status bar padding
//            e.printStackTrace()
//        }

        // Create WebView
        webView = WebView(this)
        container.addView(
            webView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // Create progress bar
        progressBar = ProgressBar(this, null, R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                8
            ).apply {
                // Position progress bar at the top, accounting for status bar
                topMargin = 0
            }
            progressDrawable = resources.getDrawable(R.drawable.progress_horizontal, null)
            visibility = View.GONE
        }
        container.addView(progressBar)

        setContentView(container)

        // Initialize managers and bridges
        permissionManager = PermissionManager(this)
        networkMonitor = NetworkMonitor(this, this)
        bridgeImpl = AndroidBridgeImpl(this, webView)
        notificationBridge = MobileNotificationBridge(this, webView)

        // Register network monitor
        networkMonitor.register()

        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = true
            allowContentAccess = true
            setGeolocationEnabled(true)

            // Improve WebView rendering and prevent content from being cut off
            layoutAlgorithm = WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)

            // Enable viewport meta tag support for proper mobile rendering
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        // Add CSS to prevent content from going under system bars
        val systemBarsCss = """
            javascript:(function() {
                var style = document.createElement('style');
                style.innerHTML = `
                    * { box-sizing: border-box; }
                    body { 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        min-height: 100vh !important;
                        overflow-x: hidden !important;
                    }
                    .app-container, #root, #app { 
                        min-height: 100vh !important; 
                        padding-bottom: env(safe-area-inset-bottom) !important;
                    }
                `;
                document.head.appendChild(style);
            })()
        """.trimIndent()

        // Add JavaScript interfaces (bridges)
        webView.addJavascriptInterface(notificationBridge, "mobileNotificationBridge")
        webView.addJavascriptInterface(bridgeImpl, "AndroidBridge")

        // Set WebChromeClient for progress tracking
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                }
            }
        }

        // Set WebViewClient for navigation and error handling
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 0
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE

                // Inject CSS to handle system bars properly
                try {
                    val safeCss = """
                        javascript:(function() {
                            try {
                                var meta = document.createElement('meta');
                                meta.name = 'viewport';
                                meta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
                                document.head.appendChild(meta);
                                
                                var style = document.createElement('style');
                                style.innerHTML = 
                                    ':root {' +
                                        '--safe-area-inset-top: env(safe-area-inset-top);' +
                                        '--safe-area-inset-bottom: env(safe-area-inset-bottom);' +
                                    '}' +
                                    'body {' + 
                                        'padding-top: var(--safe-area-inset-top) !important;' +
                                        'padding-bottom: var(--safe-area-inset-bottom) !important;' +
                                        'margin: 0 !important;' +
                                    '}' +
                                    '.app-header, .navbar, .header {' +
                                        'padding-top: calc(var(--safe-area-inset-top) + 10px) !important;' +
                                    '}';
                                document.head.appendChild(style);
                            } catch(e) {
                                console.log('CSS injection failed:', e);
                            }
                        })()
                    """.trimIndent()

                    view?.evaluateJavascript(safeCss, null)
                } catch (e: Exception) {
                    // If CSS injection fails, continue without it
                    e.printStackTrace()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showErrorPage("Error loading page: ${error?.description}")
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                return false
            }
        }

        // Handle deep links from notifications
        handleDeepLink(intent)

        // Request permissions
        requestAllPermissions()

        // Load web app
        webView.loadUrl(WEB_APP_URL)

        // Register broadcast receiver for foreground notifications
        LocalBroadcastManager.getInstance(this).registerReceiver(
            notificationReceiver,
            IntentFilter(PushNotificationService.ACTION_FOREGROUND_NOTIFICATION)
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent?.let { handleDeepLink(it) }
    }

    private fun handleDeepLink(intent: Intent) {
        val deepLink = intent.getStringExtra("deepLink")
        val orderId = intent.getStringExtra("orderId")

        if (deepLink != null) {
            // Navigate to specific page via WebView URL
            webView.post {
                webView.evaluateJavascript(
                    "if (window.location.pathname !== '$deepLink') { window.location.href = '$deepLink'; }",
                    null
                )
            }
        } else if (orderId != null) {
            // Navigate to order tracking page
            webView.post {
                webView.evaluateJavascript(
                    "window.location.href = '/track-order/$orderId';",
                    null
                )
            }
        }
    }

    private fun requestAllPermissions() {
        // First request location
        permissionManager.requestLocationPermissions(object : PermissionManager.PermissionCallback {
            override fun onGranted() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location enabled - we can show nearby restaurants",
                    Toast.LENGTH_SHORT
                ).show()
                // Then request notifications
                requestNotifications()
            }

            override fun onDenied() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location helps us show nearby restaurants",
                    Toast.LENGTH_LONG
                ).show()
                // Still request notifications
                requestNotifications()
            }
        })
    }

    private fun requestNotifications() {
        permissionManager.requestNotificationPermission(object :
            PermissionManager.PermissionCallback {
            override fun onGranted() {
                Toast.makeText(this@HybridWebActivity, "Notifications enabled", Toast.LENGTH_SHORT)
                    .show()
            }

            override fun onDenied() {
                // Optional feature
            }
        })
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionManager.handlePermissionResult(requestCode, permissions, grantResults)
    }

    private fun showErrorPage(message: String) {
        val errorHtml = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                        text-align: center;
                        padding: 20px;
                    }
                    .error-container {
                        max-width: 400px;
                    }
                    h1 { color: #ff6b6b; margin-bottom: 16px; }
                    p { color: #666; line-height: 1.5; }
                    button {
                        margin-top: 24px;
                        padding: 12px 24px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 16px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>Oops!</h1>
                    <p>$message</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            </body>
            </html>
        """.trimIndent()
        webView.loadData(errorHtml, "text/html", "UTF-8")
    }

    // Network listener callbacks
    override fun onNetworkAvailable() {
        runOnUiThread {
            if (isOfflineShown) {
                isOfflineShown = false
                Toast.makeText(this, "Back online", Toast.LENGTH_SHORT).show()
                webView.reload()
            }
        }
    }

    override fun onNetworkLost() {
        runOnUiThread {
            if (!isOfflineShown) {
                isOfflineShown = true
                AlertDialog.Builder(this)
                    .setTitle("No Internet Connection")
                    .setMessage("Please check your internet connection and try again.")
                    .setPositiveButton("Retry") { _, _ -> webView.reload() }
                    .setNegativeButton("Cancel", null)
                    .show()
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(notificationReceiver)
        networkMonitor.unregister()
    }

    // Show active order notification (called by bridge)
    fun showActiveOrderNotification(orderId: String, status: String, restaurantName: String) {
        val intent = Intent(this, HybridWebActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("orderId", orderId)
            putExtra("deepLink", "/order-tracking/$orderId")
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = when (status) {
            "pending" -> "Order Placed"
            "confirmed" -> "Order Confirmed"
            "preparing" -> "Being Prepared"
            "ready_for_pickup" -> "Ready for Pickup"
            "picked_up" -> "Picked Up"
            "out_for_delivery" -> "Out for Delivery"
            else -> status
        }

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(statusText)
            .setContentText(restaurantName)
            .setOngoing(true) // Make it persistent
            .setAutoCancel(false)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS)

        with(NotificationManagerCompat.from(this)) {
            try {
                notify(ACTIVE_ORDER_NOTIFICATION_ID, builder.build())
                activeOrderNotificationId = ACTIVE_ORDER_NOTIFICATION_ID
            } catch (e: SecurityException) {
                e.printStackTrace()
            }
        }
    }

    // Hide active order notification
    fun hideActiveOrderNotification() {
        activeOrderNotificationId?.let { id ->
            NotificationManagerCompat.from(this).cancel(id)
            activeOrderNotificationId = null
        }
    }
}

class MobileNotificationBridge1(
    private val context: Context,
    private val activity: HybridWebActivity
) {

    @JavascriptInterface
    fun notifyStatusChange(orderId: String, status: String, payloadJson: String?) {
        try {
            val payload = if (!payloadJson.isNullOrEmpty()) JSONObject(payloadJson) else null
            val title = payload?.optString("title").takeUnless { it.isNullOrEmpty() }
                ?: "Order update"
            val body = payload?.optString("body").takeUnless { it.isNullOrEmpty() }
                ?: "Order $orderId status changed to $status"

            showLocalNotification(title, body)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Bridge error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun showActiveOrderBanner(orderId: String, status: String, restaurantName: String) {
        activity.showActiveOrderNotification(orderId, status, restaurantName)
    }

    @JavascriptInterface
    fun hideActiveOrderBanner() {
        activity.hideActiveOrderNotification()
    }

    private fun showLocalNotification(title: String, body: String) {
        val builder = NotificationCompat.Builder(context, HybridWebActivity.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        with(NotificationManagerCompat.from(context)) {
            notify(System.currentTimeMillis().toInt(), builder.build())
        }
    }
}
