package com.griyaecom.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.griyaecom.app.bridge.WebBridge
import com.griyaecom.app.utils.CameraHelper
import com.griyaecom.app.utils.LocationHelper
import com.griyaecom.app.utils.NotificationHelper

class MainActivity : AppCompatActivity() {

    companion object {
        @Volatile
        private var INSTANCE: MainActivity? = null

        fun getInstance(): MainActivity? = INSTANCE
    }

    private lateinit var webView: WebView
    private lateinit var webBridge: WebBridge
    private lateinit var locationHelper: LocationHelper
    private lateinit var cameraHelper: CameraHelper
    private lateinit var notificationHelper: NotificationHelper

    // Default customer web URL fallback
    private var webViewUrl: String = "https://hungrimart.onrender.com"

    // Firebase Realtime Database path for the customer web URL
    private val webUrlConfigPath = "appConfig/customer/webViewUrl"

    private val fileUploadCallback = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        webBridge.handleFileUploadResult(result.resultCode, result.data)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        webBridge.handlePermissionResults(permissions)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set singleton instance
        INSTANCE = this

        setContentView(R.layout.activity_main)

        // Enable full screen mode after content view is set
        setupFullScreen()

        initializeHelpers()

        // Load customer web URL from Firebase before setting up WebView
        loadCustomerWebUrl()

        setupWebView()
        handleDeepLink(intent)
        
        // Request notification permission for Android 13+
        notificationHelper.requestNotificationPermission()
        
        // Auto-register FCM token on app start
        registerFCMTokenOnStartup()
    }

    private fun loadCustomerWebUrl() {
        val ref = FirebaseDatabase.getInstance().getReference(webUrlConfigPath)
        ref.addListenerForSingleValueEvent(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (snapshot.exists()) {
                    val url = snapshot.getValue(String::class.java)
                    if (!url.isNullOrEmpty()) {
                        webViewUrl = url
                        // If WebView already created, reload with new URL
                        if (::webView.isInitialized) {
                            webView.loadUrl(webViewUrl)
                        }
                    }
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Ignore and keep fallback URL
            }
        })
    }
    private fun setupFullScreen() {
        try {
            // Enable edge-to-edge display
            WindowCompat.setDecorFitsSystemWindows(window, false)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // For API 30+
                window.setDecorFitsSystemWindows(false)
                val controller = window.insetsController
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                // For API < 30
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
        } catch (@Suppress("UNUSED_PARAMETER") e: Exception) {
            // Fallback to basic full screen if modern approach fails
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
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            // Add a small delay to ensure the window is fully ready
            window.decorView.post {
                setupFullScreen()
            }
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

        webView.settings.apply {
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
            // Optimize for full screen
            layoutAlgorithm = WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING

        }

        // Add JavaScript interfaces
        webView.addJavascriptInterface(webBridge, "Android")

        // Set WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url.toString()
                
                // Handle external URLs
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
                
                // Handle external domains
                if (!url.contains("hungrimart.onrender.com") && !url.contains("griyamart")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                }
                
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Inject JavaScript to check if Android bridge is available and optimize for full screen
                view?.evaluateJavascript(
                    """
                    if(window.Android) { 
                        console.log('Android bridge available'); 
                    }
                    
                    // Optimize viewport for full screen
                    var viewport = document.querySelector('meta[name=viewport]');
                    if (!viewport) {
                        viewport = document.createElement('meta');
                        viewport.name = 'viewport';
                        document.head.appendChild(viewport);
                    }
                    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
                    
                    // Add CSS for full screen optimization
                    var style = document.createElement('style');
                    style.textContent = `
                        body { 
                            margin: 0; 
                            padding: 0; 
                            padding-top: env(safe-area-inset-top, 0px); 
                            padding-bottom: env(safe-area-inset-bottom, 0px); 
                            padding-left: env(safe-area-inset-left, 0px); 
                            padding-right: env(safe-area-inset-right, 0px); 
                        }
                        html { 
                            margin: 0; 
                            padding: 0; 
                            height: 100vh; 
                            height: 100dvh; 
                        }
                    `;
                    if (!document.getElementById('fullscreen-styles')) {
                        style.id = 'fullscreen-styles';
                        document.head.appendChild(style);
                    }
                    """.trimIndent(),
                    null
                )
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                // Handle error page
                view?.loadUrl("data:text/html,<html><body><h2>Network Error</h2><p>Please check your internet connection and try again.</p></body></html>")
            }
        }

        // Set WebChromeClient for file uploads and other features
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
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
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        // Load the web app
        loadWebApp()
    }

    private fun loadWebApp() {
        webView.loadUrl(webViewUrl)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val url = data.toString()

        when {
            // If the deep link already points to the same host as our current webViewUrl, load directly
            url.startsWith(webViewUrl.substringBefore("/", "")) || url.startsWith(webViewUrl) -> {
                webView.loadUrl(url)
            }

            // Custom scheme: griyamart://path -> map onto our dynamic base URL
            url.startsWith("griyamart://") -> {
                val path = data.path ?: "/"
                val targetUrl = webViewUrl.trimEnd('/') + path
                webView.loadUrl(targetUrl)
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    override fun onBackPressed() {
        when {
            webView.canGoBack() -> webView.goBack()
            else -> super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
        locationHelper.cleanup()

        // Clear singleton instance
        INSTANCE = null
    }

    // Permission handling
    fun requestPermissions(permissions: Array<String>) {
        permissionLauncher.launch(permissions)
    }

    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    // Getters for helpers
    fun getLocationHelper() = locationHelper
    fun getCameraHelper() = cameraHelper
    fun getNotificationHelper() = notificationHelper
    fun getWebView() = webView

    /**
     * Evaluate JavaScript code in the WebView from external services
     */
    fun evaluateJavascript(jsCode: String) {
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(jsCode, null)
            }
        }
    }

    private fun registerFCMTokenOnStartup() {
        // This will automatically get and register the FCM token
        notificationHelper.getFCMToken { token ->
            if (token != null) {
                // Token is now registered with your server
                // You can also send it to your web app if needed
                val jsCode = "window.onAppStartFCMToken && window.onAppStartFCMToken('$token')"
                webView.evaluateJavascript(jsCode, null)
            }
        }
    }
}