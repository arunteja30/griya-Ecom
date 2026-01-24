package com.mat.theypodelivery

import android.Manifest
import android.R
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
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
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import org.json.JSONObject

/**
 * Full-featured WebView host for the delivery partner app.
 * Includes: splash screen, permissions, offline handling, progress bar, error pages
 */
class HybridWebActivity : AppCompatActivity(), NetworkMonitor.NetworkListener {

    companion object {
        // TODO: change this to your real deployed delivery-simple URL
        private const val WEB_APP_URL = "https://thepo-delivery.onrender.com"
        const val NOTIFICATION_CHANNEL_ID = "delivery_app_notifications"
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var permissionManager: PermissionManager
    private lateinit var networkMonitor: NetworkMonitor
    private var isOfflineShown = false

    private val notificationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == PushNotificationService.Companion.ACTION_FOREGROUND_NOTIFICATION) {
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

        // Create container layout
        val container = FrameLayout(this)

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
            )
            progressDrawable = resources.getDrawable(R.drawable.progress_horizontal, null)
            visibility = View.GONE
        }
        container.addView(progressBar)

        setContentView(container)

        // Initialize permission manager
        permissionManager = PermissionManager(this)

        // Initialize network monitor
        networkMonitor = NetworkMonitor(this)
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
            setGeolocationDatabasePath(filesDir.path)
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            mediaPlaybackRequiresUserGesture = false
        }

        // Add JavaScript interfaces (bridges)
        val bridge = AndroidBridgeImpl(this, webView)
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(createPermissionBridge(), "mobilePermissionBridge")
        webView.addJavascriptInterface(createNotificationBridge(), "mobileNotificationBridge")

        // Set WebChromeClient for progress tracking and geolocation permissions
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                // Always grant geolocation permission for our app
                callback?.invoke(origin, true, false)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                // Handle other permission requests (camera, microphone, etc.)
                request?.grant(request.resources)
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

        // Check for deep link from notification
        handleDeepLink(intent)

        // Request permissions
        requestAllPermissions()

        // Load web app
        webView.loadUrl(WEB_APP_URL)

        // Handle deep link from notification
        handleDeepLink(intent)

        // Register broadcast receiver for foreground notifications
        LocalBroadcastManager.getInstance(this).registerReceiver(
            notificationReceiver,
            IntentFilter(PushNotificationService.Companion.ACTION_FOREGROUND_NOTIFICATION)
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
        val action = intent.getStringExtra("EXTRA_ACTION")
        val legacyOrderId = intent.getStringExtra("EXTRA_ORDER_ID")

        if (deepLink != null) {
            // Navigate to specific page via WebView URL
            webView.post {
                webView.evaluateJavascript(
                    "if (window.location.pathname !== '$deepLink') { window.location.href = '$deepLink'; }",
                    null
                )
            }
        } else if (orderId != null) {
            // Navigate to active delivery page
            webView.post {
                webView.evaluateJavascript(
                    "window.location.href = '/active-delivery/$orderId';",
                    null
                )
            }
        } else if (legacyOrderId != null) {
            // Legacy handling - inject JavaScript to navigate to order
            webView.post {
                val js = when (action) {
                    "ACCEPT_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$legacyOrderId', 'accept');"
                    "VIEW_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$legacyOrderId', 'view');"
                    else -> "window.location.hash = '/active-delivery';"
                }
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun handleLegacyDeepLink(intent: Intent) {
        val orderId = intent.getStringExtra("EXTRA_ORDER_ID")
        val action = intent.getStringExtra("EXTRA_ACTION")

        if (orderId != null) {
            // Inject JavaScript to navigate to order
            webView.post {
                val js = when (action) {
                    "ACCEPT_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$orderId', 'accept');"
                    "VIEW_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$orderId', 'view');"
                    else -> "window.location.hash = '/active-delivery';"
                }
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun requestAllPermissions() {
        permissionManager.requestLocationPermission(object : PermissionManager.PermissionCallback {

            override fun onPermissionGranted() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location permissions granted",
                    Toast.LENGTH_SHORT
                ).show()
                requestBackgroundLocationIfNeeded()
            }

            override fun onPermissionDenied() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location permissions required for delivery tracking",
                    Toast.LENGTH_LONG
                ).show()

            }
        })
    }

    private fun requestBackgroundLocationIfNeeded() {
        permissionManager.requestBackgroundLocationPermission(object :
            PermissionManager.PermissionCallback {
            override fun onPermissionGranted() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Background location enabled",
                    Toast.LENGTH_SHORT
                ).show()
            }

            override fun onPermissionDenied() {
                // Optional, app can still work with foreground location
            }
        })
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

    private fun createNotificationBridge(): MobileNotificationBridge {
        return MobileNotificationBridge(this)
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

    override fun onDestroy() {
        super.onDestroy()
        networkMonitor.unregister()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(notificationReceiver)

    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private fun createPermissionBridge() = object {
        @JavascriptInterface
        fun requestBackgroundLocationPermission() {
            runOnUiThread {
                permissionManager.requestBackgroundLocationPermission(object :
                    PermissionManager.PermissionCallback {
                    override fun onPermissionGranted() {
                        webView.evaluateJavascript(
                            "window.onBackgroundLocationPermissionGranted && window.onBackgroundLocationPermissionGranted()",
                            null
                        )
                    }

                    override fun onPermissionDenied() {
                        webView.evaluateJavascript(
                            "window.onBackgroundLocationPermissionDenied && window.onBackgroundLocationPermissionDenied()",
                            null
                        )
                    }
                })
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                permissionManager.requestNotificationPermission(object :
                    PermissionManager.PermissionCallback {
                    override fun onPermissionGranted() {
                        webView.evaluateJavascript(
                            "window.onNotificationPermissionGranted && window.onNotificationPermissionGranted()",
                            null
                        )
                    }

                    override fun onPermissionDenied() {
                        webView.evaluateJavascript(
                            "window.onNotificationPermissionDenied && window.onNotificationPermissionDenied()",
                            null
                        )
                    }
                })
            }
        }
    }
}

/**
 * JS interface that matches the web-side MobileNotificationBridge.
 *
 * JS signature:
 *   window.mobileNotificationBridge.notifyStatusChange(orderId, status, payloadJson?)
 */
class MobileNotificationBridge1(private val context: Context) {

    @JavascriptInterface
    fun notifyStatusChange(orderId: String, status: String, payloadJson: String?) {
        try {
            val payload = if (!payloadJson.isNullOrEmpty()) JSONObject(payloadJson) else null
            val title = payload?.optString("title").takeUnless { it.isNullOrEmpty() }
                ?: "Order update"
            val body = payload?.optString("body").takeUnless { it.isNullOrEmpty() }
                ?: "Order $orderId status changed to $status"

            showLocalNotificationWithActions(orderId, title, body)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Bridge error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showLocalNotificationWithActions(orderId: String, title: String, body: String) {
        // Create intent for viewing order
        val viewIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "VIEW_ORDER"
            putExtra("ORDER_ID", orderId)
        }
        val viewPendingIntent = PendingIntent.getBroadcast(
            context,
            orderId.hashCode(),
            viewIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Create intent for accepting order
        val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "ACCEPT_ORDER"
            putExtra("ORDER_ID", orderId)
        }
        val acceptPendingIntent = PendingIntent.getBroadcast(
            context,
            orderId.hashCode() + 1,
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification with actions
        val builder = NotificationCompat.Builder(context, HybridWebActivity.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(R.drawable.ic_menu_view, "View", viewPendingIntent)
            .addAction(R.drawable.ic_input_add, "Accept", acceptPendingIntent)

        with(NotificationManagerCompat.from(context)) {
            if (ActivityCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Toast.makeText(context, "Notification permission not granted", Toast.LENGTH_SHORT)
                    .show()
                return
            }
            notify(orderId.hashCode(), builder.build())
        }
    }
}
