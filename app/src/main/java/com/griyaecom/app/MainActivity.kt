package com.griyaecom.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.griyaecom.app.bridge.WebBridge
import com.griyaecom.app.utils.CameraHelper
import com.griyaecom.app.utils.ConfigManager
import com.griyaecom.app.utils.FirebaseHelper
import com.griyaecom.app.utils.LocationHelper
import com.griyaecom.app.utils.NotificationHelper
import kotlinx.coroutines.launch


class MainActivity : AppCompatActivity() {

    companion object {
        private var INSTANCE_REF: java.lang.ref.WeakReference<MainActivity>? = null
        fun getInstance(): MainActivity? = INSTANCE_REF?.get()
        private const val TAG = "MainActivity"
    }

    private lateinit var webView: WebView
    private lateinit var webBridge: WebBridge
    private lateinit var locationHelper: LocationHelper
    private lateinit var cameraHelper: CameraHelper
    private lateinit var notificationHelper: NotificationHelper

    private var webViewUrl: String = ConfigManager.Defaults.CUSTOMER_URL
    private var isConfigLoaded = false

    // Pending permission results if launcher returns before WebView is initialized
    private var pendingPermissionResults: Map<String, Boolean>? = null

    // Queue JS to be executed once WebView is ready
    private val pendingJs = mutableListOf<String>()

    private val fileUploadCallback = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result -> webBridge.handleFileUploadResult(result.resultCode, result.data) }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // If WebView (and bridge) aren't ready yet, store the result and handle it after setup
        if (::webView.isInitialized && ::webBridge.isInitialized) {
            webBridge.handlePermissionResults(permissions)
        } else {
            pendingPermissionResults = permissions
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        INSTANCE_REF = java.lang.ref.WeakReference(this)
        setContentView(R.layout.activity_main)

        setupFullScreen()
        initializeHelpers()

        // Load config and setup WebView asynchronously
        lifecycleScope.launch {
            loadConfigAndSetupWebView()
            handleDeepLink(intent)
        }

        // Request permissions
        notificationHelper.requestNotificationPermission()
    }

    private suspend fun loadConfigAndSetupWebView() {
        try {
            webViewUrl = ConfigManager.getCustomerWebUrl()
            Log.i(TAG, "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load config, using fallback: $webViewUrl", e)
        }

        isConfigLoaded = true
        setupWebView()
        loadWebApp()

        // Initialize Firebase after WebView is ready
        initializeFirebaseMessaging()
    }

    private fun initializeFirebaseMessaging() {
        lifecycleScope.launch {
            try {
                FirebaseHelper.initializeFirebaseMessaging(
                    context = this@MainActivity,
                    onTokenReceived = { token ->
                        Log.d(TAG, "FCM token received: $token")
                        // Inject token into WebView
                        val jsCode =
                            "window.onAppStartFCMToken && window.onAppStartFCMToken('$token')"
                        evaluateJavascript(jsCode)
                    },
                    onError = { exception ->
                        Log.e(TAG, "Firebase initialization failed", exception)
                        // Continue without push notifications
                    }
                )
            } catch (e: Exception) {
                Log.e(TAG, "Critical Firebase error", e)
            }
        }
    }

    private fun setupFullScreen() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.let { controller ->
                    controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                or View.SYSTEM_UI_FLAG_FULLSCREEN
                        )
            }

            // Apply theme colors for status bar and navigation bar so they match the app
            try {
                val statusColor = ContextCompat.getColor(this, R.color.primary_color_dark)
                val navColor = ContextCompat.getColor(this, R.color.primary_color)
                window.statusBarColor = statusColor
                // navigationBarColor is available on API 21+, effect is stronger on newer APIs
                window.navigationBarColor = navColor
            } catch (e: Exception) {
                Log.w(TAG, "Failed to apply system bar colors", e)
            }

        } catch (e: Exception) {
            Log.w(TAG, "Failed to setup full screen", e)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            window.decorView.post { setupFullScreen() }
        }
    }

    private fun initializeHelpers() {
        locationHelper = LocationHelper(this)
        cameraHelper = CameraHelper(this)
        notificationHelper = NotificationHelper(this)
        webBridge = WebBridge(this, locationHelper, cameraHelper, notificationHelper)
    }

    private fun setupWebView() {
        webView = findViewById(R.id.webView)


        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                loadsImagesAutomatically = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                mediaPlaybackRequiresUserGesture = false
                databaseEnabled = true
                setGeolocationEnabled(true)
                layoutAlgorithm = WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING
            }

            addJavascriptInterface(webBridge, "Android")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val url = request?.url?.toString() ?: return false

                    // Handle external URLs
                    if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:")) {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        return true
                    }

                    // Dynamic host checking
                    val baseHost = Uri.parse(webViewUrl).host
                    val targetHost = Uri.parse(url).host
                    if (baseHost == targetHost) return false

                    // External domain
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    injectFullScreenOptimization()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    view?.loadUrl("data:text/html,<html><body><h2>Network Error</h2><p>Please check your internet connection and try again.</p></body></html>")
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    webBridge.setFilePathCallback(filePathCallback)
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                    fileUploadCallback.launch(Intent.createChooser(intent, "Select Files"))
                    return true
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?, callback: GeolocationPermissions.Callback?
                ) {
                    callback?.invoke(origin, true, false)
                }

                override fun onPermissionRequest(request: PermissionRequest?) {
                    request?.grant(request.resources)
                }
            }

            clearCache(true)
        }

        // If any permission result arrived earlier, apply it now
        pendingPermissionResults?.let { results ->
            try {
                webBridge.handlePermissionResults(results)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to apply pending permission results", e)
            } finally {
                pendingPermissionResults = null
            }
        }

        // Flush any pending JS queued while WebView was not ready
        if (pendingJs.isNotEmpty()) {
            try {
                pendingJs.forEach { js -> webView.evaluateJavascript(js, null) }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to flush pending JS", e)
            } finally {
                pendingJs.clear()
            }
        }
    }

    private fun injectFullScreenOptimization() {
        val jsCode = """
            if(window.Android) console.log('Android bridge available');
            
            var viewport = document.querySelector('meta[name=viewport]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
            }
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            
            var style = document.createElement('style');
            style.textContent = `
                body { 
                    margin: 0; padding: 0; 
                    padding-top: env(safe-area-inset-top, 0px); 
                    padding-bottom: env(safe-area-inset-bottom, 0px); 
                    padding-left: env(safe-area-inset-left, 0px); 
                    padding-right: env(safe-area-inset-right, 0px); 
                }
                html { margin: 0; padding: 0; height: 100vh; height: 100dvh; }
            `;
            if (!document.getElementById('fullscreen-styles')) {
                style.id = 'fullscreen-styles';
                document.head.appendChild(style);
            }
        """.trimIndent()

        webView.evaluateJavascript(jsCode, null)
    }

    private fun loadWebApp() {
        Log.d(TAG, "Loading webViewUrl: $webViewUrl")
        webView.loadUrl(webViewUrl)
    }

    private fun handleDeepLink(intent: Intent?) {
        if (!isConfigLoaded) return

        val data = intent?.data ?: run {
            loadWebApp()
            return
        }

        val url = data.toString()
        when {
            Uri.parse(url).host == Uri.parse(webViewUrl).host -> webView.loadUrl(url)
            url.startsWith("griyamart://") -> {
                val path = data.path ?: "/"
                val targetUrl = webViewUrl.trimEnd('/') + path
                webView.loadUrl(targetUrl)
            }
            else -> loadWebApp()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
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

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::webView.isInitialized) webView.destroy()
        locationHelper.cleanup()
        INSTANCE_REF?.clear()
    }

    fun requestPermissions(permissions: Array<String>) {
        permissionLauncher.launch(permissions)
    }

    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun getLocationHelper() = locationHelper
    fun getCameraHelper() = cameraHelper
    fun getNotificationHelper() = notificationHelper
    fun getWebView(): WebView? = if (::webView.isInitialized) webView else null

    // Safe helpers to interact with the WebView from other classes (bridge, services)
    fun safeEvaluateJavascript(jsCode: String) {
        runOnUiThread {
            if (::webView.isInitialized) {
                try {
                    webView.evaluateJavascript(jsCode, null)
                } catch (e: Exception) {
                    Log.w(TAG, "safeEvaluateJavascript failed", e)
                }
            } else {
                // Queue for later
                pendingJs.add(jsCode)
            }
        }
    }

    fun safeReload() {
        runOnUiThread {
            if (::webView.isInitialized) webView.reload()
        }
    }

    fun safeGoBack() {
        runOnUiThread {
            if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        }
    }

    fun safeGoForward() {
        runOnUiThread {
            if (::webView.isInitialized && webView.canGoForward()) webView.goForward()
        }
    }

    fun evaluateJavascript(jsCode: String) {
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(jsCode, null)
            }
        }
    }
}
