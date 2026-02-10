package com.mat.purnidelivery.base

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
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.mat.purnidelivery.AndroidBridgeImpl
import com.mat.purnidelivery.config.AppConfig
import kotlinx.coroutines.launch

/**
 * Base hybrid WebView activity for delivery partner app
 * Handles dynamic URL loading and configuration
 */
abstract class BaseHybridWebActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "BaseHybridWebActivity"
        private const val FILE_UPLOAD_REQUEST_CODE = 1001
    }

    protected lateinit var webView: WebView
    protected lateinit var progressBar: ProgressBar
    protected lateinit var bridgeImpl: AndroidBridgeImpl
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var isConfigLoaded = false
    private var isWebViewSetupComplete = false

    // Abstract methods to be implemented by subclasses
    abstract fun getAppType(): AppConfig.AppType
    abstract fun createBridge(): AndroidBridgeImpl

    // Default implementation - subclasses should override for proper permission handling
    open fun showActiveOrderNotification(orderId: String, status: String, restaurantName: String) {
        // Default implementation - subclasses should override
    }

    open fun hideActiveOrderNotification() {
        // Default implementation - subclasses should override
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
            visibility = View.GONE // Hide initially - only show during actual web app loading
            alpha = 0f // Make completely transparent initially
        }
    }

    private fun loadConfiguration() {
        lifecycleScope.launch {
            try {
                // Step 1: Update loading progress
                updateLoadingProgress(20, "Connecting to Firebase...")

                val url = AppConfig.loadWebViewUrl(getAppType(), this@BaseHybridWebActivity)

                // Step 2: Configuration loaded
                updateLoadingProgress(50, "Configuration loaded successfully")

                // Cache the URL for offline access
                AppConfig.saveUrlToCache(getAppType(), url, this@BaseHybridWebActivity)

                // Step 3: Setting up security
                updateLoadingProgress(70, "Setting up security...")

                isConfigLoaded = true
                setupWebView(url)

                // Step 4: Almost ready
                updateLoadingProgress(90, "Loading interface...")

                loadWebApp(url)

            } catch (e: Exception) {
                Log.e(TAG, "Failed to load configuration", e)
                updateLoadingProgress(30, "Using fallback configuration...")
                handleConfigurationError()
            }
        }
    }

    private fun updateLoadingProgress(progress: Int, message: String) {
        runOnUiThread {
            webView.evaluateJavascript(
                """
                if (typeof window.updateNativeProgress === 'function') {
                    window.updateNativeProgress($progress, '$message');
                } else {
                    // Fallback - update progress elements directly
                    const progressFill = document.getElementById('progressFill');
                    const progressText = document.getElementById('progressText');
                    
                    if (progressFill) progressFill.style.width = '$progress%';
                    if (progressText) progressText.textContent = '$message';
                    
                    // Update steps based on progress
                    if ($progress >= 25) {
                        const step1 = document.getElementById('step1');
                        if (step1 && !step1.classList.contains('completed')) {
                            step1.classList.add('completed');
                            step1.classList.remove('active');
                            step1.querySelector('.step-icon').textContent = '✓';
                            
                            const step2 = document.getElementById('step2');
                            if (step2) step2.classList.add('active');
                        }
                    }
                    
                    if ($progress >= 50) {
                        const step2 = document.getElementById('step2');
                        if (step2 && !step2.classList.contains('completed')) {
                            step2.classList.add('completed');
                            step2.classList.remove('active');
                            step2.querySelector('.step-icon').textContent = '✓';
                            
                            const step3 = document.getElementById('step3');
                            if (step3) step3.classList.add('active');
                        }
                    }
                    
                    if ($progress >= 75) {
                        const step3 = document.getElementById('step3');
                        if (step3 && !step3.classList.contains('completed')) {
                            step3.classList.add('completed');
                            step3.classList.remove('active');
                            step3.querySelector('.step-icon').textContent = '✓';
                            
                            const step4 = document.getElementById('step4');
                            if (step4) step4.classList.add('active');
                        }
                    }
                    
                    if ($progress >= 100) {
                        const step4 = document.getElementById('step4');
                        if (step4) {
                            step4.classList.add('completed');
                            step4.classList.remove('active');
                            step4.querySelector('.step-icon').textContent = '✓';
                        }
                    }
                }
            """.trimIndent(), null
            )
        }
    }

    private fun configureWebViewSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
            domStorageEnabled = true
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
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
        }
    }

    private fun setupWebViewClients() {
        // Set WebChromeClient for progress tracking and file uploads
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                // Only update progress bar if it's visible (for actual web app loading)
                if (progressBar.visibility == View.VISIBLE && progressBar.alpha > 0f) {
                    progressBar.progress = newProgress
                    if (newProgress == 100) {
                        // Smooth fade out when complete
                        progressBar.animate()
                            .alpha(0f)
                            .setDuration(300)
                            .withEndAction {
                                progressBar.visibility = View.GONE
                            }
                    }
                }
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

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)

                // Only show the thin progress bar for actual web app loading (not our interactive loading screen)
                if (url != null && !url.startsWith("data:")) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.alpha = 1f // Make visible with animation
                    progressBar.progress = 0
                }

                // Final loading progress update - actual web app loading
                updateLoadingProgress(95, "Loading your app...")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)

                // Smoothly hide the progress bar
                progressBar.animate()
                    .alpha(0f)
                    .setDuration(300)
                    .withEndAction {
                        progressBar.visibility = View.GONE
                    }

                // Initialize any WebView services if available
                try {
                    view?.evaluateJavascript("if(window.webViewReady) window.webViewReady();", null)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to call webViewReady", e)
                }

                // Complete loading
                updateLoadingProgress(100, "Ready!")
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
        fileUploadCallback = filePathCallback

        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                if (fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
            }

            startActivityForResult(
                Intent.createChooser(intent, "Choose File"),
                FILE_UPLOAD_REQUEST_CODE
            )
            return true
        } catch (e: Exception) {
            fileUploadCallback = null
            return false
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == FILE_UPLOAD_REQUEST_CODE) {
            val results = mutableListOf<Uri>()

            if (resultCode == RESULT_OK && data != null) {
                data.clipData?.let { clipData ->
                    // Multiple files
                    for (i in 0 until clipData.itemCount) {
                        results.add(clipData.getItemAt(i).uri)
                    }
                } ?: data.data?.let { uri ->
                    // Single file
                    results.add(uri)
                }
            }

            fileUploadCallback?.onReceiveValue(results.toTypedArray())
            fileUploadCallback = null
        }
    }

    private fun setupWebView(webAppUrl: String) {
        try {
            Log.i(TAG, "Setting up WebView with URL: $webAppUrl")

            // Create and setup bridge
            bridgeImpl = createBridge()
            webView.addJavascriptInterface(bridgeImpl, "AndroidBridge")

            // Configure WebView settings
            configureWebViewSettings()

            // Setup clients
            setupWebViewClients()

            isWebViewSetupComplete = true
            Log.i(TAG, "WebView setup complete")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to setup WebView", e)
            showErrorDialog(
                "Setup Error",
                "Failed to initialize the application. Please restart the app."
            )
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

        // Add a small delay to let the interactive loading complete smoothly
        webView.postDelayed({
            webView.loadUrl(webAppUrl)
        }, 500) // 500ms delay for smooth transition
    }

    private fun handleConfigurationError() {
        try {
            val fallbackUrl = AppConfig.AppType.PURNI_DELIVERY.fallbackUrl
            Log.w(TAG, "Using fallback URL: $fallbackUrl")

            isConfigLoaded = true
            setupWebView(fallbackUrl)
            loadWebApp(fallbackUrl)

        } catch (e: Exception) {
            Log.e(TAG, "Critical error - cannot load fallback", e)
            showErrorDialog(
                "Critical Error",
                "Unable to load the application. Please check your internet connection and restart the app."
            )
        }
    }

    private fun showLoadingMessage() {
        val loadingHtml = """
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        height: 100vh;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        overflow: hidden;
                        position: relative;
                    }
                    
                    .loading-container {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        width: 90%;
                        max-width: 400px;
                    }
                    
                    .logo-container {
                        margin-bottom: 30px;
                        animation: logoFloat 3s ease-in-out infinite;
                    }
                    
                    .app-logo {
                        width: 80px;
                        height: 80px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 20px;
                        margin: 0 auto 15px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }
                    
                    h1 {
                        font-size: 28px;
                        font-weight: 300;
                        margin-bottom: 8px;
                        animation: textGlow 2s ease-in-out infinite alternate;
                    }
                    
                    .loading-subtitle {
                        font-size: 16px;
                        opacity: 0.8;
                        margin-bottom: 40px;
                        animation: fadeInOut 2s ease-in-out infinite;
                    }
                    
                    .progress-container {
                        margin-bottom: 30px;
                    }
                    
                    .progress-bar {
                        width: 100%;
                        height: 4px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 2px;
                        overflow: hidden;
                        margin-bottom: 10px;
                    }
                    
                    .progress-fill {
                        height: 100%;
                        background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
                        background-size: 300% 100%;
                        border-radius: 2px;
                        animation: progressAnimation 3s ease-in-out, gradientShift 2s ease-in-out infinite;
                        width: 0%;
                    }
                    
                    .progress-text {
                        font-size: 12px;
                        opacity: 0.7;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    
                    .loading-steps {
                        list-style: none;
                        text-align: left;
                    }
                    
                    .loading-step {
                        padding: 8px 0;
                        font-size: 14px;
                        opacity: 0.6;
                        display: flex;
                        align-items: center;
                        transition: all 0.3s ease;
                    }
                    
                    .loading-step.active {
                        opacity: 1;
                        transform: translateX(5px);
                    }
                    
                    .step-icon {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.3);
                        margin-right: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        transition: all 0.3s ease;
                    }
                    
                    .loading-step.active .step-icon {
                        background: #48dbfb;
                        animation: pulse 1s ease-in-out infinite;
                    }
                    
                    .loading-step.completed .step-icon {
                        background: #55efc4;
                    }
                    
                    .tips-container {
                        margin-top: 30px;
                        font-size: 13px;
                        opacity: 0.7;
                        min-height: 40px;
                    }
                    
                    .tip {
                        display: none;
                        animation: slideIn 0.5s ease-in-out;
                    }
                    
                    .tip.active {
                        display: block;
                    }
                    
                    @keyframes logoFloat {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                    }
                    
                    @keyframes textGlow {
                        0% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
                        100% { text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 30px rgba(255, 255, 255, 0.6); }
                    }
                    
                    @keyframes fadeInOut {
                        0%, 100% { opacity: 0.8; }
                        50% { opacity: 1; }
                    }
                    
                    @keyframes progressAnimation {
                        0% { width: 0%; }
                        100% { width: 100%; }
                    }
                    
                    @keyframes gradientShift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.2); }
                    }
                    
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 0.7; transform: translateY(0); }
                    }
                </style>
            </head>
            <body>
                <div class="loading-container">
                    <div class="logo-container">
                        <div class="app-logo">🚚</div>
                        <h1>Loading ${getAppType().configKey}</h1>
                        <div class="loading-subtitle">Preparing your delivery dashboard...</div>
                    </div>
                    
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-text" id="progressText">Initializing...</div>
                    </div>
                    
                    <ul class="loading-steps" id="loadingSteps">
                        <li class="loading-step active" id="step1">
                            <div class="step-icon">1</div>
                            <span>Fetching configuration...</span>
                        </li>
                        <li class="loading-step" id="step2">
                            <div class="step-icon">2</div>
                            <span>Setting up security...</span>
                        </li>
                        <li class="loading-step" id="step3">
                            <div class="step-icon">3</div>
                            <span>Loading interface...</span>
                        </li>
                        <li class="loading-step" id="step4">
                            <div class="step-icon">4</div>
                            <span>Almost ready!</span>
                        </li>
                    </ul>
                    
                    <div class="tips-container">
                        <div class="tip active">🚚 Delivery dashboard: View and manage orders efficiently</div>
                        <div class="tip">📱 Enable location for accurate delivery tracking</div>
                        <div class="tip">🔔 Stay notified of new orders and updates</div>
                        <div class="tip">⭐ Complete deliveries to maintain high ratings</div>
                        <div class="tip">💰 Track your earnings and delivery statistics</div>
                        <div class="tip">🛣️ Use navigation features for optimal routes</div>
                        <div class="tip">📞 Contact customers easily through the app</div>
                        <div class="tip">⚡ Report issues quickly for fast resolution</div>
                    </div>
                </div>
                
                <script>
                    // Auto-start configuration loading
                    setTimeout(() => {
                        window.loadConfiguration && window.loadConfiguration();
                    }, 1000);
                    
                    // Rotate tips
                    let currentTip = 0;
                    function rotateTips() {
                        const tips = document.querySelectorAll('.tip');
                        tips[currentTip].classList.remove('active');
                        currentTip = (currentTip + 1) % tips.length;
                        tips[currentTip].classList.add('active');
                    }
                    
                    setInterval(rotateTips, 2500);
                    
                    // Native progress update function
                    window.updateNativeProgress = function(progress, message) {
                        const progressFill = document.getElementById('progressFill');
                        const progressText = document.getElementById('progressText');
                        
                        if (progressFill) {
                            progressFill.style.width = progress + '%';
                            progressFill.style.transition = 'width 0.3s ease';
                        }
                        if (progressText) progressText.textContent = message;
                        
                        // Auto-advance steps based on progress
                        if (progress >= 25) {
                            completeStep(1);
                            activateStep(2);
                        }
                        if (progress >= 50) {
                            completeStep(2);
                            activateStep(3);
                        }
                        if (progress >= 75) {
                            completeStep(3);
                            activateStep(4);
                        }
                        if (progress >= 100) {
                            completeStep(4);
                            
                            // Celebration animation when complete
                            setTimeout(() => {
                                document.querySelector('.loading-container').style.animation = 'fadeOut 0.5s ease-in-out forwards';
                            }, 500);
                        }
                    };
                    
                    function completeStep(stepNum) {
                        const step = document.getElementById('step' + stepNum);
                        if (step) {
                            step.classList.add('completed');
                            step.classList.remove('active');
                            step.querySelector('.step-icon').textContent = '✓';
                        }
                    }
                    
                    function activateStep(stepNum) {
                        const step = document.getElementById('step' + stepNum);
                        if (step) step.classList.add('active');
                    }
                </script>
                
                <style>
                    @keyframes fadeOut {
                        to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    }
                </style>
            </body>
            </html>
        """.trimIndent()

        webView.loadData(loadingHtml, "text/html", "UTF-8")

        // Start configuration loading
        loadConfiguration()
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Retry") { _, _ ->
                recreate()
            }
            .setNegativeButton("Close") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    override fun onResume() {
        super.onResume()
        try {
            webView.onResume()
        } catch (e: Exception) {
            Log.e(TAG, "Error in onResume", e)
        }
    }

    override fun onPause() {
        try {
            webView.onPause()
        } catch (e: Exception) {
            Log.e(TAG, "Error in onPause", e)
        }
        super.onPause()
    }

    override fun onDestroy() {
        try {
            webView.removeAllViews()
            webView.clearHistory()
            webView.clearCache(true)
            webView.loadUrl("about:blank")
            webView.destroy()
        } catch (e: Exception) {
            Log.e(TAG, "Error in onDestroy", e)
        }
        super.onDestroy()
    }
}
