package com.mat.purni

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsetsController
import android.webkit.ConsoleMessage
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

// Permission Manager interface
interface PermissionManager {
    interface PermissionCallback {
        fun onGranted()
        fun onDenied()
    }
}

class HybridWebActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "HybridWebActivity"

        // Default fallback URL - will be replaced by Firebase config
        private var WEB_APP_URL = "https://google.com"
        private const val FILE_UPLOAD_REQUEST_CODE = 1001

        // Firebase RTDB configuration paths
        private const val FIREBASE_CONFIG_PATH = "appConfig"

        // App type - should be set based on the module
        private var APP_TYPE = "theypo" // For purni module, this should be "theypo"

        // Allow external configuration of the URL
        fun setWebAppUrl(url: String) {
            WEB_APP_URL = url
        }

        fun getWebAppUrl(): String = WEB_APP_URL

        // Set app type for different modules
        fun setAppType(appType: String) {
            APP_TYPE = appType
        }
    }

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var bridgeImpl: AndroidBridgeImpl
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var isConfigLoaded = false
    private var isWebViewSetupComplete = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up intelligent back navigation early
        setupIntelligentBackNavigation()

        // Set up UI first
        setupUI()

        // Load configuration from Firebase RTDB, then setup WebView
        loadConfigFromFirebase {
            setupWebView()
            loadWebApp()
        }
    }

    private fun setupUI() {
        // Set up edge-to-edge display with proper insets handling
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window?.let { win ->
                    win.setDecorFitsSystemWindows(false)
                    try {
                        val controller = win.insetsController
                        controller?.systemBarsBehavior =
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                window?.decorView?.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Create container layout
        val container = FrameLayout(this)

        // Set up window insets handling for the container
        try {
            ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
                val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                view.setPadding(
                    systemBars.left,
                    systemBars.top,
                    systemBars.right,
                    systemBars.bottom
                )
                insets
            }
        } catch (e: Exception) {
            container.setPadding(0, 24, 0, 0)
            e.printStackTrace()
        }

        // Create WebView
        webView = WebView(this)
        container.addView(
            webView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // Create progress bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                8
            ).apply {
                topMargin = 0
            }
            progressDrawable = resources.getDrawable(android.R.drawable.progress_horizontal, null)
            visibility = View.VISIBLE // Show loading initially
        }
        container.addView(progressBar)

        setContentView(container)

        // Show loading message
        showLoadingMessage()
    }

    private fun setupWebView() {
        if (isWebViewSetupComplete) return

        Log.d(TAG, "Setting up WebView with URL: $WEB_APP_URL")

        // Initialize bridge
        bridgeImpl = AndroidBridgeImpl(this, webView)

        // Configure WebView with optimized settings
        webView.settings.apply {
            javaScriptEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            // setAppCacheEnabled is deprecated and removed in newer API levels
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            textZoom = 100
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = false
            allowContentAccess = true
            allowUniversalAccessFromFileURLs = false
            allowFileAccessFromFileURLs = false
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false

            val originalUserAgent = userAgentString
            userAgentString = "$originalUserAgent PurniCustomer/1.0 wv"
        }

        // Optimize WebView performance
        webView.apply {
            isScrollbarFadingEnabled = false
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
        }

        // Add JavaScript interface
        webView.addJavascriptInterface(bridgeImpl, "AndroidBridge")

        // Set WebChromeClient for progress tracking and file uploads
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                } else {
                    progressBar.visibility = View.VISIBLE
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                try {
                    val intent = Intent(Intent.ACTION_GET_CONTENT)
                    intent.type = "*/*"
                    intent.addCategory(Intent.CATEGORY_OPENABLE)

                    if (fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }

                    startActivityForResult(
                        Intent.createChooser(intent, "Select File"),
                        FILE_UPLOAD_REQUEST_CODE
                    )
                } catch (e: Exception) {
                    fileUploadCallback = null
                    Toast.makeText(
                        this@HybridWebActivity,
                        "File selection failed",
                        Toast.LENGTH_SHORT
                    ).show()
                    return false
                }
                return true
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let { msg ->
                    android.util.Log.d(
                        "WebView-Console",
                        "${msg.sourceId()}:${msg.lineNumber()} - ${msg.message()}"
                    )
                }
                return true
            }

            override fun onJsAlert(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult?
            ): Boolean {
                AlertDialog.Builder(this@HybridWebActivity)
                    .setTitle("Alert")
                    .setMessage(message ?: "")
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
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
                bridgeImpl.initializeWebViewService()
                view?.evaluateJavascript("if(window.webViewReady) window.webViewReady();", null)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showErrorDialog(
                        "Failed to load page",
                        "Please check your internet connection and try again."
                    )
                }
            }
        }

        isWebViewSetupComplete = true
    }

    private fun loadWebApp() {
        if (!isConfigLoaded || !isWebViewSetupComplete) {
            Log.w(
                TAG,
                "Cannot load web app - config loaded: $isConfigLoaded, webview setup: $isWebViewSetupComplete"
            )
            return
        }

        Log.i(TAG, "Loading web app URL: $WEB_APP_URL")
        webView.loadUrl(WEB_APP_URL)
    }

    private fun showLoadingMessage() {
        webView.loadData(
            """
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                        padding: 20px;
                    }
                    .loader {
                        margin-bottom: 20px;
                        animation: spin 1s linear infinite;
                        font-size: 24px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    h1 { margin-bottom: 10px; font-weight: 300; }
                    p { opacity: 0.8; }
                </style>
            </head>
            <body>
                <div>
                    <div class="loader">⚙️</div>
                    <h1>Loading App</h1>
                    <p>Fetching configuration...</p>
                </div>
            </body>
            </html>
            """.trimIndent(),
            "text/html",
            "UTF-8"
        )
    }

    /**
     * Load configuration from Firebase RTDB
     * Path: appConfig/{appType}/webViewUrl
     */
    private fun loadConfigFromFirebase(onComplete: () -> Unit) {
        try {
            Log.d(TAG, "Loading config from Firebase for app type: $APP_TYPE")

            val database = FirebaseDatabase.getInstance()
            val configRef = database.getReference("$FIREBASE_CONFIG_PATH/$APP_TYPE/webViewUrl")

            configRef.addListenerForSingleValueEvent(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    try {
                        val url = snapshot.getValue(String::class.java)

                        if (!url.isNullOrBlank()) {
                            Log.i(TAG, "✅ Firebase config loaded successfully")
                            Log.i(TAG, "🌐 WebView URL: $url")

                            WEB_APP_URL = url
                            isConfigLoaded = true

                            // Call completion callback
                            onComplete()
                        } else {
                            Log.w(TAG, "⚠️ No URL found in Firebase config, using default")
                            handleConfigLoadFailure("URL not found in Firebase", onComplete)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Error processing Firebase config", e)
                        handleConfigLoadFailure("Error processing config: ${e.message}", onComplete)
                    }
                }

                override fun onCancelled(error: DatabaseError) {
                    Log.e(TAG, "❌ Firebase config load cancelled", error.toException())
                    handleConfigLoadFailure("Firebase error: ${error.message}", onComplete)
                }
            })

            // Add timeout handling
            webView.postDelayed({
                if (!isConfigLoaded) {
                    Log.w(TAG, "⏰ Firebase config load timeout, using default URL")
                    handleConfigLoadFailure("Firebase load timeout", onComplete)
                }
            }, 10000) // 10 second timeout

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to initialize Firebase config loading", e)
            handleConfigLoadFailure("Firebase initialization error: ${e.message}", onComplete)
        }
    }

    private fun handleConfigLoadFailure(reason: String, onComplete: () -> Unit) {
        Log.w(TAG, "Using default URL due to: $reason")

        // Use fallback URL configuration
        configureFallbackUrl()

        isConfigLoaded = true
        onComplete()
    }

    private fun configureFallbackUrl() {
        // Check Intent extras first
        intent?.extras?.getString("WEB_APP_URL")?.let { url ->
            WEB_APP_URL = url
            Log.i(TAG, "Using URL from Intent: $url")
            return
        }

        // Check SharedPreferences
        val sharedPreferences = getSharedPreferences("app_prefs", MODE_PRIVATE)
        sharedPreferences.getString("WEB_APP_URL", null)?.let { url ->
            WEB_APP_URL = url
            Log.i(TAG, "Using URL from SharedPreferences: $url")
            return
        }

        // Keep default URL
        Log.i(TAG, "Using default URL: $WEB_APP_URL")
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == FILE_UPLOAD_REQUEST_CODE) {
            val result = if (resultCode == RESULT_OK && data != null) {
                if (data.clipData != null) {
                    // Multiple files selected
                    val clipData = data.clipData!!
                    Array(clipData.itemCount) { i ->
                        clipData.getItemAt(i).uri
                    }
                } else if (data.data != null) {
                    // Single file selected
                    arrayOf(data.data!!)
                } else {
                    null
                }
            } else {
                null
            }

            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        }
    }

    // Back navigation properties
    private var backPressedTime: Long = 0
    private val BACK_PRESS_TIME_INTERVAL = 2000L // 2 seconds

    private fun setupIntelligentBackNavigation() {
        // Modern back button handling using OnBackPressedDispatcher
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleIntelligentBackNavigation()
            }
        })
    }

    private fun handleIntelligentBackNavigation() {
        try {
            // First, check if the web app wants to handle back navigation
            webView.evaluateJavascript(
                """
                (function() {
                    // Check if web app has set a navigation mode
                    var navigationMode = window.webViewNavigationMode || 'hybrid';
                    var canGoBack = window.webViewCanGoBack || false;
                    
                    if (typeof window.webViewService !== 'undefined' && 
                        typeof window.webViewService.onBackPressed === 'function') {
                        var handled = window.webViewService.onBackPressed();
                        return JSON.stringify({
                            handled: handled,
                            mode: navigationMode,
                            canGoBack: canGoBack,
                            path: window.location.pathname,
                            historyLength: window.history.length
                        });
                    }
                    
                    return JSON.stringify({
                        handled: false,
                        mode: navigationMode,
                        canGoBack: canGoBack,
                        path: window.location.pathname,
                        historyLength: window.history.length
                    });
                })();
                """.trimIndent()
            ) { result ->
                try {
                    if (result != null && result != "null") {
                        val cleanResult = result.replace("\"", "")
                        val navigationInfo = org.json.JSONObject(cleanResult)

                        val webHandledBack = navigationInfo.optBoolean("handled", false)
                        val navigationMode = navigationInfo.optString("mode", "hybrid")
                        val webCanGoBack = navigationInfo.optBoolean("canGoBack", false)
                        val currentPath = navigationInfo.optString("path", "/")

                        if (!webHandledBack) {
                            // Web app didn't handle it, use native logic with web app context
                            handleNativeBackNavigationWithContext(
                                navigationMode,
                                webCanGoBack,
                                currentPath
                            )
                        }
                        // If web app handled it (returned true), do nothing - web app took care of navigation
                    } else {
                        // Fallback to simple native handling
                        handleNativeBackNavigation()
                    }
                } catch (e: Exception) {
                    // JSON parsing failed, fallback to simple native handling
                    handleNativeBackNavigation()
                }
            }
        } catch (e: Exception) {
            // Fallback to native handling if JavaScript evaluation fails
            handleNativeBackNavigation()
        }
    }

    private fun handleNativeBackNavigationWithContext(
        navigationMode: String,
        webCanGoBack: Boolean,
        currentPath: String
    ) {
        when (navigationMode) {
            "spa" -> {
                // Single Page Application mode - let web app handle most navigation
                if (webCanGoBack) {
                    webView.goBack()
                } else {
                    handleAppExit()
                }
            }

            "native" -> {
                // Native mode - use traditional WebView navigation
                handleNativeBackNavigation()
            }

            "hybrid" -> {
                // Hybrid mode - intelligent navigation based on context
                when {
                    // Check if we're on a main page that should trigger exit
                    isMainPagePath(currentPath) -> {
                        handleAppExit()
                    }
                    // Check if WebView can go back
                    webView.canGoBack() -> {
                        val currentUrl = webView.url ?: ""
                        when {
                            isModalPage(currentUrl) -> closeModalOrGoBack()
                            else -> webView.goBack()
                        }
                    }
                    // No history, exit app
                    else -> {
                        handleAppExit()
                    }
                }
            }

            else -> {
                // Unknown mode, use default native handling
                handleNativeBackNavigation()
            }
        }
    }

    private fun isMainPagePath(path: String): Boolean {
        // Check if the current path represents a main/home page
        val mainPaths = listOf("/", "/home", "/dashboard", "/main", "/index")
        return mainPaths.contains(path) || path.isEmpty()
    }

    private fun handleNativeBackNavigation() {
        when {
            // Check if WebView can go back in history
            webView.canGoBack() -> {
                // Get current URL to make intelligent decisions
                val currentUrl = webView.url ?: ""

                when {
                    // If we're on a specific page that should exit instead of going back
                    isHomePage(currentUrl) -> {
                        handleAppExit()
                    }
                    // If we're on a modal or overlay page, try to close it first
                    isModalPage(currentUrl) -> {
                        closeModalOrGoBack()
                    }
                    // Normal back navigation in WebView
                    else -> {
                        webView.goBack()
                    }
                }
            }
            // No WebView history, handle app exit
            else -> {
                handleAppExit()
            }
        }
    }

    private fun isHomePage(url: String): Boolean {
        // Get the base URL from the current loaded URL
        val baseUrl = try {
            val uri = Uri.parse(url)
            "${uri.scheme}://${uri.host}"
        } catch (e: Exception) {
            ""
        }

        if (baseUrl.isEmpty()) return false

        // Define patterns for home/main pages where back should exit
        // These are relative to any domain
        val homePatterns = listOf(
            "^$baseUrl/?$",                    // Just the domain
            "^$baseUrl/$",                     // Domain with single slash
            "^$baseUrl/home/?$",               // /home
            "^$baseUrl/dashboard/?$",          // /dashboard
            "^$baseUrl/main/?$",               // /main
            "^$baseUrl/index/?$",              // /index
            "^$baseUrl/index.html?$",          // /index.html
            "^$baseUrl/#/?$"                   // Single page app root
        )

        return homePatterns.any { pattern ->
            url.matches(Regex(pattern))
        }
    }

    private fun isModalPage(url: String): Boolean {
        // Define patterns for modal/overlay pages
        val modalPatterns = listOf(
            "/modal/",
            "/popup/",
            "/overlay/",
            "modal=true",
            "popup=true"
        )

        return modalPatterns.any { pattern ->
            url.contains(pattern)
        }
    }

    private fun closeModalOrGoBack() {
        // Try to close modal via JavaScript first
        webView.evaluateJavascript(
            """
            (function() {
                // Try common modal close methods
                if (typeof window.closeModal === 'function') {
                    window.closeModal();
                    return true;
                } else if (typeof window.hideModal === 'function') {
                    window.hideModal();
                    return true;
                } else if (document.querySelector('.modal-close')) {
                    document.querySelector('.modal-close').click();
                    return true;
                } else if (document.querySelector('[data-dismiss="modal"]')) {
                    document.querySelector('[data-dismiss="modal"]').click();
                    return true;
                }
                return false;
            })();
            """.trimIndent()
        ) { result ->
            val modalClosed = result?.equals("true") == true
            if (!modalClosed) {
                // Modal couldn't be closed, just go back normally
                webView.goBack()
            }
        }
    }

    private fun handleAppExit() {
        val currentTime = System.currentTimeMillis()

        if (currentTime - backPressedTime > BACK_PRESS_TIME_INTERVAL) {
            // First back press - show toast and record time
            backPressedTime = currentTime
            Toast.makeText(
                this,
                "Press back again to exit",
                Toast.LENGTH_SHORT
            ).show()
        } else {
            // Second back press within time interval - exit app
            exitAppGracefully()
        }
    }

    private fun exitAppGracefully() {
        try {
            // Notify web app that we're about to exit
            webView.evaluateJavascript(
                "if (typeof window.onAppExit === 'function') window.onAppExit();",
                null
            )

            // Small delay to let web app handle cleanup
            webView.postDelayed({
                finishAffinity() // Close all activities in task
            }, 100)

        } catch (e: Exception) {
            // Fallback exit
            finish()
        }
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Retry") { _, _ -> webView.reload() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // Methods required by AndroidBridgeImpl
    fun showActiveOrderNotification(orderId: String, status: String, restaurantName: String) {
        // Implement notification logic here
        // For now, just show a toast
        Toast.makeText(this, "Order $orderId: $status from $restaurantName", Toast.LENGTH_SHORT)
            .show()
    }

    fun hideActiveOrderNotification() {
        // Implement notification hiding logic here
        // For now, just show a toast
        Toast.makeText(this, "Order notification hidden", Toast.LENGTH_SHORT).show()
    }

    fun requestLocationPermissionFromWeb(callback: PermissionManager.PermissionCallback) {
        // Implement location permission request
        callback.onGranted() // For now, assume granted
    }

    fun requestNotificationPermissionFromWeb(callback: PermissionManager.PermissionCallback) {
        // Implement notification permission request
        callback.onGranted() // For now, assume granted
    }

    fun hasLocationPermissionsFromWeb(): Boolean {
        // Check location permissions
        return true // For now, assume granted
    }

    fun hasNotificationPermissionFromWeb(): Boolean {
        // Check notification permissions
        return true // For now, assume granted
    }
}
