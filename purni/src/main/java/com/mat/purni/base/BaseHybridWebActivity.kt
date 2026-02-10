package com.mat.purni.base

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
import androidx.lifecycle.lifecycleScope
import com.mat.purni.AndroidBridgeImpl
import com.mat.purni.config.AppConfig
import kotlinx.coroutines.launch

/**
 * Base hybrid WebView activity with common functionality
 * Can be extended by different app modules
 */
abstract class BaseHybridWebActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "BaseHybridWebActivity"
        private const val FILE_UPLOAD_REQUEST_CODE = 1001
        private const val BACK_PRESS_TIME_INTERVAL = 2000L // 2 seconds
    }

    protected lateinit var webView: WebView
    protected lateinit var progressBar: ProgressBar
    protected lateinit var bridgeImpl: AndroidBridgeImpl
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var isConfigLoaded = false
    private var isWebViewSetupComplete = false
    private var backPressedTime: Long = 0

    // Abstract properties to be implemented by subclasses
    abstract fun getAppType(): AppConfig.AppType
    abstract fun createBridge(): AndroidBridgeImpl

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set up intelligent back navigation early
        setupIntelligentBackNavigation()

        // Set up UI first
        setupUI()

        // Load configuration and setup WebView
        loadConfiguration()
    }

    private fun setupUI() {
        // Set up edge-to-edge display with proper insets handling
        setupEdgeToEdge()

        // Create container layout
        val container = FrameLayout(this)
        setupWindowInsets(container)

        // Create WebView
        webView = WebView(this)
        container.addView(
            webView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // Create progress bar
        progressBar = createProgressBar()
        container.addView(progressBar)

        setContentView(container)
        showLoadingMessage()
    }

    private fun setupEdgeToEdge() {
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
    }

    private fun setupWindowInsets(container: FrameLayout) {
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
    }

    private fun createProgressBar(): ProgressBar {
        return ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                8
            ).apply {
                topMargin = 0
            }
            progressDrawable = resources.getDrawable(android.R.drawable.progress_horizontal, null)
            visibility = View.VISIBLE // Show loading initially
        }
    }

    private fun loadConfiguration() {
        lifecycleScope.launch {
            try {
                val url = AppConfig.loadWebViewUrl(getAppType(), this@BaseHybridWebActivity)

                // Cache the URL for offline access
                AppConfig.saveUrlToCache(getAppType(), url, this@BaseHybridWebActivity)

                isConfigLoaded = true
                setupWebView(url)
                loadWebApp(url)

            } catch (e: Exception) {
                Log.e(TAG, "Failed to load configuration", e)
                handleConfigurationError()
            }
        }
    }

    private fun setupWebView(webAppUrl: String) {
        if (isWebViewSetupComplete) return

        Log.d(TAG, "Setting up WebView with URL: $webAppUrl")

        // Initialize bridge
        bridgeImpl = createBridge()

        // Configure WebView with optimized settings
        configureWebViewSettings()

        // Add JavaScript interface
        webView.addJavascriptInterface(bridgeImpl, "AndroidBridge")

        // Set WebChromeClient and WebViewClient
        setupWebViewClients()

        isWebViewSetupComplete = true
    }

    private fun configureWebViewSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
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
            userAgentString = "$originalUserAgent ${getAppType().configKey}/1.0 wv"
        }

        // Optimize WebView performance
        webView.apply {
            isScrollbarFadingEnabled = false
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
        }
    }

    private fun setupWebViewClients() {
        // Set WebChromeClient for progress tracking and file uploads
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress == 100) View.GONE else View.VISIBLE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean = handleFileChooser(filePathCallback, fileChooserParams)

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let { msg ->
                    Log.d(
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
                AlertDialog.Builder(this@BaseHybridWebActivity)
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
    }

    private fun handleFileChooser(
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ): Boolean {
        fileUploadCallback?.onReceiveValue(null)
        fileUploadCallback = filePathCallback

        return try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
                if (fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
            }

            startActivityForResult(
                Intent.createChooser(intent, "Select File"),
                FILE_UPLOAD_REQUEST_CODE
            )
            true
        } catch (e: Exception) {
            fileUploadCallback = null
            Toast.makeText(this, "File selection failed", Toast.LENGTH_SHORT).show()
            false
        }
    }

    private fun loadWebApp(webAppUrl: String) {
        if (!isConfigLoaded || !isWebViewSetupComplete) {
            Log.w(
                TAG,
                "Cannot load web app - config loaded: $isConfigLoaded, webview setup: $isWebViewSetupComplete"
            )
            return
        }

        Log.i(TAG, "Loading web app URL: $webAppUrl")
        webView.loadUrl(webAppUrl)
    }

    private fun showLoadingMessage() {
        val loadingHtml = """
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex; justify-content: center; align-items: center;
                        height: 100vh; margin: 0; text-align: center; padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .loader { margin-bottom: 20px; animation: spin 1s linear infinite; font-size: 24px; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    h1 { margin-bottom: 10px; font-weight: 300; }
                    p { opacity: 0.8; }
                </style>
            </head>
            <body>
                <div>
                    <div class="loader">⚙️</div>
                    <h1>Loading ${getAppType().configKey}</h1>
                    <p>Fetching configuration...</p>
                </div>
            </body>
            </html>
        """.trimIndent()

        webView.loadData(loadingHtml, "text/html", "UTF-8")
    }

    // Back navigation setup and handling
    private fun setupIntelligentBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleIntelligentBackNavigation()
            }
        })
    }

    private fun handleIntelligentBackNavigation() {
        try {
            webView.evaluateJavascript(
                """
                (function() {
                    var navigationMode = window.webViewNavigationMode || 'hybrid';
                    var canGoBack = window.webViewCanGoBack || false;
                    
                    if (typeof window.webViewService !== 'undefined' && 
                        typeof window.webViewService.onBackPressed === 'function') {
                        var handled = window.webViewService.onBackPressed();
                        return JSON.stringify({
                            handled: handled, mode: navigationMode, canGoBack: canGoBack,
                            path: window.location.pathname, historyLength: window.history.length
                        });
                    }
                    
                    return JSON.stringify({
                        handled: false, mode: navigationMode, canGoBack: canGoBack,
                        path: window.location.pathname, historyLength: window.history.length
                    });
                })();
            """.trimIndent()
            ) { result ->
                handleBackNavigationResult(result)
            }
        } catch (e: Exception) {
            handleNativeBackNavigation()
        }
    }

    private fun handleBackNavigationResult(result: String?) {
        try {
            if (result != null && result != "null") {
                val cleanResult = result.replace("\"", "")
                val navigationInfo = org.json.JSONObject(cleanResult)

                val webHandledBack = navigationInfo.optBoolean("handled", false)
                val navigationMode = navigationInfo.optString("mode", "hybrid")
                val webCanGoBack = navigationInfo.optBoolean("canGoBack", false)
                val currentPath = navigationInfo.optString("path", "/")

                if (!webHandledBack) {
                    handleNativeBackNavigationWithContext(navigationMode, webCanGoBack, currentPath)
                }
            } else {
                handleNativeBackNavigation()
            }
        } catch (e: Exception) {
            handleNativeBackNavigation()
        }
    }

    private fun handleNativeBackNavigationWithContext(
        mode: String,
        webCanGoBack: Boolean,
        currentPath: String
    ) {
        when (mode) {
            "spa" -> if (webCanGoBack) webView.goBack() else handleAppExit()
            "native" -> handleNativeBackNavigation()
            "hybrid" -> {
                when {
                    AppConfig.isExitPath(currentPath) -> {
                        Log.d(TAG, "On exit page ($currentPath) - handling app exit")
                        handleAppExit()
                    }

                    webView.canGoBack() -> {
                        val currentUrl = webView.url ?: ""
                        if (AppConfig.isModalUrl(currentUrl)) closeModalOrGoBack() else webView.goBack()
                    }

                    else -> handleAppExit()
                }
            }

            else -> handleNativeBackNavigation()
        }
    }

    private fun handleNativeBackNavigation() {
        when {
            webView.canGoBack() -> {
                val currentUrl = webView.url ?: ""
                when {
                    isHomePage(currentUrl) -> handleAppExit()
                    AppConfig.isModalUrl(currentUrl) -> closeModalOrGoBack()
                    else -> webView.goBack()
                }
            }

            else -> handleAppExit()
        }
    }

    private fun isHomePage(url: String): Boolean {
        val baseUrl = try {
            val uri = Uri.parse(url)
            "${uri.scheme}://${uri.host}"
        } catch (e: Exception) {
            ""
        }

        if (baseUrl.isEmpty()) return false

        val homePatterns = AppConfig.generateHomePatterns(baseUrl)
        return homePatterns.any { pattern -> url.matches(Regex(pattern)) }
    }

    private fun closeModalOrGoBack() {
        webView.evaluateJavascript(
            """
            (function() {
                if (typeof window.closeModal === 'function') { window.closeModal(); return true; }
                else if (typeof window.hideModal === 'function') { window.hideModal(); return true; }
                else if (document.querySelector('.modal-close')) { document.querySelector('.modal-close').click(); return true; }
                else if (document.querySelector('[data-dismiss="modal"]')) { document.querySelector('[data-dismiss="modal"]').click(); return true; }
                return false;
            })();
        """.trimIndent()
        ) { result ->
            val modalClosed = result?.equals("true") == true
            if (!modalClosed) webView.goBack()
        }
    }

    private fun handleAppExit() {
        val currentTime = System.currentTimeMillis()

        if (currentTime - backPressedTime > BACK_PRESS_TIME_INTERVAL) {
            backPressedTime = currentTime
            Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show()
        } else {
            exitAppGracefully()
        }
    }

    private fun exitAppGracefully() {
        try {
            webView.evaluateJavascript(
                "if (typeof window.onAppExit === 'function') window.onAppExit();",
                null
            )
            webView.postDelayed({ finishAffinity() }, 100)
        } catch (e: Exception) {
            finish()
        }
    }

    private fun handleConfigurationError() {
        showErrorDialog(
            "Configuration Error",
            "Failed to load app configuration. Using default settings."
        )
        // Use fallback configuration
        val fallbackUrl = getAppType().fallbackUrl
        isConfigLoaded = true
        setupWebView(fallbackUrl)
        loadWebApp(fallbackUrl)
    }

    protected fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Retry") { _, _ -> webView.reload() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == FILE_UPLOAD_REQUEST_CODE) {
            val result = if (resultCode == RESULT_OK && data != null) {
                if (data.clipData != null) {
                    val clipData = data.clipData!!
                    Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                } else if (data.data != null) {
                    arrayOf(data.data!!)
                } else null
            } else null

            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        }
    }
}
