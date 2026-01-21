package com.mat.doothadriver

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.*
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.launch

class UberDriverActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "UberDriverActivity"
    }

    private lateinit var webView: WebView
    private lateinit var permissionLoadingLayout: View
    private lateinit var splashScreen: View
    private lateinit var splashLoadingText: TextView
    private lateinit var driverBridge: UberDriverBridge
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationManager: LocationManager

    private var hasLocationPermission = false
    private var isLocationEnabled = false
    private var webViewUrl: String = "https://dootha-driver.onrender.com" // Default URL
    private var isConfigLoaded = false
    private var isLoading = true
    private val splashTimeoutHandler = Handler(Looper.getMainLooper())

    // Permission launcher for location permissions
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        val backgroundGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions[Manifest.permission.ACCESS_BACKGROUND_LOCATION] == true
        } else true

        when {
            fineGranted || coarseGranted -> {
                hasLocationPermission = true
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show()

                // Check if background location is needed and granted
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !backgroundGranted) {
                    showBackgroundLocationDialog()
                } else {
                    // Check if location services are enabled
                    if (isLocationServicesEnabled()) {
                        isLocationEnabled = true
                        showWebView()
                        webView.loadUrl(webViewUrl)
                    } else {
                        showLocationServicesDisabledDialog()
                    }
                }
            }

            else -> {
                // Permission denied, check if permanently denied
                if (!shouldShowLocationRationale()) {
                    showLocationSettingsDialog()
                } else {
                    showLocationPermissionDeniedDialog()
                }
            }
        }
    }

    // Background location permission launcher (Android Q+)
    private val backgroundLocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Background location permission granted", Toast.LENGTH_SHORT)
                .show()
        } else {
            showBackgroundLocationDeniedDialog()
        }

        // Proceed regardless - basic location permissions are granted
        if (isLocationServicesEnabled()) {
            isLocationEnabled = true
            showWebView()
            webView.loadUrl(webViewUrl)
        } else {
            showLocationServicesDisabledDialog()
        }
    }

    // Notification permission launcher (Android 13+)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Notification permission granted", Toast.LENGTH_SHORT).show()
        } else {
            showNotificationPermissionDeniedDialog()
        }
        // After handling notification permission, proceed with location
        showPermissionScreen()
        requestLocationPermissionIfNeeded()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.d(TAG, "🚗 UberDriverActivity onCreate")

        // Configure window for proper status bar handling
        configureWindowInsets()

        setContentView(R.layout.activity_main)

        // Initialize views
        initializeViews()

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Load config and setup app
        lifecycleScope.launch {
            loadConfigAndSetup()
        }

        setupBackPressHandling()
    }

    private fun configureWindowInsets() {
        // Configure window for immersive experience with proper status bar handling
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
    }

    private fun initializeViews() {
        webView = findViewById(R.id.webView)
        permissionLoadingLayout = findViewById(R.id.permissionLoadingLayout)
        splashScreen = findViewById(R.id.splashScreen)
        splashLoadingText = splashScreen.findViewById(R.id.splashLoadingText)
    }

    private fun loadConfigAndSetup() {
        // Update splash screen
        runOnUiThread {
            splashLoadingText.text = "Loading configuration..."
        }

        try {
            // Load dynamic URL or use default
            val customUrl = intent?.getStringExtra("app_url")
            if (!customUrl.isNullOrEmpty()) {
                webViewUrl = customUrl
            }
            Log.d(TAG, "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load config, using fallback: $webViewUrl", e)
        } finally {
            isLoading = false
            isConfigLoaded = true
        }

        runOnUiThread {
            splashLoadingText.text = "Setting up app..."
        }

        setupWebView()

        runOnUiThread {
            splashLoadingText.text = "Checking permissions..."
        }

        // Request permissions in sequence: notification first, then location
        requestNotificationPermission()
    }

    private fun setupWebView() {
        // Create JavaScript bridge
        driverBridge = UberDriverBridge(this, webView)

        // Configure WebView
        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                allowFileAccess = true
                allowContentAccess = true
                loadWithOverviewMode = true
                useWideViewPort = true
                builtInZoomControls = false
                displayZoomControls = false
            }

            // Set WebView client
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "✅ Driver page loaded: $url")

                    // Dismiss splash screen once page loads
                    runOnUiThread {
                        splashTimeoutHandler.removeCallbacksAndMessages(null)
                        splashScreen.visibility = View.GONE
                        permissionLoadingLayout.visibility = View.GONE
                        webView.visibility = View.VISIBLE
                    }

                    // Inject platform detection
                    val platformScript = """
                        window.isNativeApp = true;
                        window.nativePlatform = 'android';
                        window.nativeAppType = 'driver';
                        console.log('🚗 Native Android Driver App detected');
                    """.trimIndent()

                    webView.evaluateJavascript(platformScript, null)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    Log.e(TAG, "❌ WebView error: ${error?.description}")
                }
            }

            // Set WebChrome client for console logs and geolocation
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d(TAG, "🌐 Console: ${consoleMessage?.message()}")
                    return true
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    // Grant geolocation permission if we have location permissions
                    callback?.invoke(origin, hasLocationPermission, false)
                }

                override fun onJsAlert(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@UberDriverActivity)
                        .setTitle("Alert")
                        .setMessage(message)
                        .setPositiveButton("OK") { _, _ -> result?.confirm() }
                        .show()
                    return true
                }
            }

            // Attach JavaScript interface
            addJavascriptInterface(driverBridge, "UberDriverBridge")
        }
    }

    private fun setupBackPressHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    // Permission checking functions
    private fun checkLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }

    private fun shouldShowLocationRationale(): Boolean {
        return shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION) ||
                shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    private fun isLocationServicesEnabled(): Boolean {
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    // Permission request functions
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                requestLocationPermissionIfNeeded()
            }
        } else {
            requestLocationPermissionIfNeeded()
        }
    }

    private fun requestLocationPermissionIfNeeded() {
        showPermissionScreen()

        webView.postDelayed({
            initializeLocationFlow()
        }, 1500)
    }

    private fun initializeLocationFlow() {
        when {
            checkLocationPermission() -> {
                hasLocationPermission = true
                if (isLocationServicesEnabled()) {
                    isLocationEnabled = true
                    showWebView()
                    webView.loadUrl(webViewUrl)
                } else {
                    showLocationServicesDisabledDialog()
                }
            }

            shouldShowLocationRationale() -> {
                showLocationPermissionRequiredDialog()
            }

            else -> {
                requestLocationPermission()
            }
        }
    }

    private fun requestLocationPermission() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            )
        } else {
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        }
        locationPermissionLauncher.launch(permissions)
    }

    private fun requestBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            backgroundLocationPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    // UI state management
    private fun showSplashScreen() {
        webView.visibility = View.GONE
        permissionLoadingLayout.visibility = View.GONE
        splashScreen.visibility = View.VISIBLE
    }

    private fun showPermissionScreen() {
        webView.visibility = View.GONE
        permissionLoadingLayout.visibility = View.VISIBLE
        splashScreen.visibility = View.GONE
    }

    private fun showWebView() {
        runOnUiThread {
            splashLoadingText.text = "Loading driver app..."
            splashScreen.visibility = View.VISIBLE
            permissionLoadingLayout.visibility = View.GONE
            webView.visibility = View.GONE
        }

        splashTimeoutHandler.postDelayed({
            if (splashScreen.visibility == View.VISIBLE) {
                Log.d(TAG, "Splash timeout reached, showing WebView")
                runOnUiThread {
                    splashScreen.visibility = View.GONE
                    permissionLoadingLayout.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                }
            }
        }, 10000) // 10 second timeout
    }

    // Dialog functions
    private fun showLocationPermissionRequiredDialog() {
        AlertDialog.Builder(this)
            .setTitle("📍 Enable Location Access")
            .setMessage("To provide efficient driver service, this app needs access to your location.\n\nThis permission is used to:\n• Navigate to pickup and delivery addresses\n• Track delivery progress for customers\n• Optimize delivery routes\n• Background tracking for live updates\n\nYour privacy is protected - location data stays secure.")
            .setPositiveButton("Allow Location") { _, _ ->
                requestLocationPermission()
            }
            .setNegativeButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showLocationPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("⚠️ Location Access Required")
            .setMessage("This driver app cannot function without location access.\n\nLocation is needed to:\n• Track your position during deliveries\n• Navigate to pickup and delivery addresses\n• Update customers on delivery status\n• Provide background location updates\n\nPlease enable location permission to continue using the app.")
            .setPositiveButton("Open Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Try Again") { _, _ ->
                showLocationPermissionRequiredDialog()
            }
            .setNeutralButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showLocationSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle("🚫 Permission Denied")
            .setMessage("Location permission has been permanently denied.\n\nTo use this driver app, please:\n1. Go to App Settings\n2. Enable Location permissions\n3. Allow background location access\n4. Return to the app")
            .setPositiveButton("Open Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showLocationServicesDisabledDialog() {
        AlertDialog.Builder(this)
            .setTitle("🛰️ Enable Location Services")
            .setMessage("Location services are currently disabled on your device.\n\nTo use this driver app, please:\n1. Go to device Settings\n2. Enable Location Services\n3. Return to the app\n\nThis ensures accurate delivery navigation and tracking.")
            .setPositiveButton("Open Settings") { _, _ ->
                openLocationSettings()
            }
            .setNegativeButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showBackgroundLocationDialog() {
        AlertDialog.Builder(this)
            .setTitle("🔋 Background Location Access")
            .setMessage("For continuous delivery tracking, this app needs background location access.\n\nThis allows:\n• Live location updates to customers\n• Accurate delivery time estimates\n• Seamless tracking even when app is minimized\n\nPlease select 'Allow all the time' in the next dialog.")
            .setPositiveButton("Continue") { _, _ ->
                requestBackgroundLocationPermission()
            }
            .setNegativeButton("Skip") { _, _ ->
                // Continue without background location
                if (isLocationServicesEnabled()) {
                    isLocationEnabled = true
                    showWebView()
                    webView.loadUrl(webViewUrl)
                } else {
                    showLocationServicesDisabledDialog()
                }
            }
            .setCancelable(false)
            .show()
    }

    private fun showBackgroundLocationDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("⚠️ Limited Location Access")
            .setMessage("Background location access was denied. The app will still work, but:\n\n• Location tracking may stop when app is minimized\n• Customers may not get live delivery updates\n• Battery optimization may affect tracking\n\nYou can enable this later in Settings.")
            .setPositiveButton("OK") { _, _ ->
                // Continue with limited functionality
            }
            .show()
    }

    private fun showNotificationPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("📱 Notification Permission")
            .setMessage("Notifications help you stay updated with delivery assignments and important alerts. You can still use the app, but you may miss important updates.")
            .setPositiveButton("Enable in Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Continue Without") { _, _ ->
                // Continue without notifications
            }
            .setCancelable(false)
            .show()
    }

    // Settings navigation
    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
    }

    private fun openLocationSettings() {
        val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        startActivity(intent)
    }

    // Lifecycle functions
    override fun onResume() {
        super.onResume()

        val hasPermissions = checkLocationPermission()
        val hasLocationServices = isLocationServicesEnabled()

        if (hasPermissions && hasLocationServices && !hasLocationPermission) {
            hasLocationPermission = true
            isLocationEnabled = true
            Toast.makeText(this, "Location requirements satisfied", Toast.LENGTH_SHORT).show()
            showWebView()
            webView.loadUrl(webViewUrl)
        } else if (hasPermissions && !hasLocationPermission) {
            hasLocationPermission = true
            if (!hasLocationServices) {
                showLocationServicesDisabledDialog()
            } else {
                isLocationEnabled = true
            }
        } else if (!hasPermissions && hasLocationPermission) {
            hasLocationPermission = false
            showLocationPermissionRequiredDialog()
        }

        if (::webView.isInitialized) {
            webView.onResume()

            if (::driverBridge.isInitialized) {
                driverBridge.resumeLocationTracking()
            }

            webView.evaluateJavascript(
                "window.onNativeAppResume && window.onNativeAppResume()",
                null
            )
        }
    }

    override fun onPause() {
        super.onPause()

        if (::webView.isInitialized) {
            webView.onPause()

            if (::driverBridge.isInitialized) {
                driverBridge.pauseLocationTracking()
            }

            webView.evaluateJavascript(
                "window.onNativeAppPause && window.onNativeAppPause()",
                null
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()

        try {
            splashTimeoutHandler.removeCallbacksAndMessages(null)

            if (::driverBridge.isInitialized) {
                driverBridge.onDestroy()
            }

            if (::webView.isInitialized) {
                webView.removeJavascriptInterface("UberDriverBridge")
                webView.destroy()
            }

            Log.d(TAG, "🗑️ UberDriverActivity destroyed")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error destroying activity", e)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
