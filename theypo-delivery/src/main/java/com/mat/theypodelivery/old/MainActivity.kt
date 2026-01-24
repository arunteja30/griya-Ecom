package com.mat.theypodelivery.old

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.griyamart.backgroundlocation.BackgroundLocationManager
import com.griyamart.backgroundlocation.config.BackgroundLocationConfig
import com.griyamart.backgroundlocation.config.FirebaseConfig
import com.griyamart.backgroundlocation.config.LocationConfig
import com.griyamart.backgroundlocation.config.LocationPriority
import com.griyamart.backgroundlocation.config.NotificationConfig
import com.griyamart.backgroundlocation.config.PayloadConfig
import com.mat.theypodelivery.R
import com.mat.theypodelivery.utils.ConfigManager
import kotlinx.coroutines.launch
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var permissionLoadingLayout: View
    private lateinit var splashScreen: View
    private lateinit var splashLoadingText: TextView
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationManager: LocationManager
    private lateinit var webAppInterface: WebAppInterface
    private var hasLocationPermission = false
    private var isLocationEnabled = false
    private var webViewUrl: String = ConfigManager.Defaults.THEYPO_DELIVERY_URL
    private var isConfigLoaded = false
    private var isLoading = true
    private val splashTimeoutHandler = Handler(Looper.getMainLooper())

    // Permission launcher
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        when {
            fineGranted || coarseGranted -> {
                hasLocationPermission = true
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show()

                // Now check if location services are enabled
                if (isLocationServicesEnabled()) {
                    isLocationEnabled = true
                    if (::webAppInterface.isInitialized) {
                        webAppInterface.onLocationPermissionGranted()
                    }
                    showWebView()
                    webView.loadUrl(webViewUrl)
                } else {
                    showLocationServicesDisabledDialog()
                }
            }

            else -> {
                // Permission denied, check if permanently denied
                if (!shouldShowLocationRationale()) {
                    showLocationSettingsDialog()
                } else {
                    // Show rationale and request again
                    showLocationPermissionDeniedDialog()
                }
            }
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Notification permission granted", Toast.LENGTH_SHORT).show()
        } else {
            // Show custom dialog for notification permission denial
            showNotificationPermissionDeniedDialog()
        }
        // After handling notification permission (granted or denied), proceed with location
        showPermissionScreen() // Transition from splash to permission screen
        requestLocationPermissionIfNeeded()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configure window for proper status bar handling
        configureWindowInsets()

        setContentView(R.layout.main)

        // Initialize views
        webView = findViewById(R.id.webView)
        permissionLoadingLayout = findViewById(R.id.permissionLoadingLayout)
        splashScreen = findViewById(R.id.splashScreen)
        splashLoadingText = splashScreen.findViewById(R.id.splashLoadingText)

        // Apply system insets to handle status bar properly
        applySystemInsets()

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Load config asynchronously
        lifecycleScope.launch {
            loadConfigAndSetup()
        }

        // Setup back press handling
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

    private suspend fun loadConfigAndSetup() {
        // Update splash screen text
        runOnUiThread {
            splashLoadingText.text = "Loading configuration..."
        }

        try {
            webViewUrl = ConfigManager.getTheypoDeliveryWebUrl()
            Log.d("TheypoDeliveryApp", "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            Log.e(
                "TheypoDeliveryApp",
                "Failed to load config, using fallback: $webViewUrl",
                e
            )
        } finally {
            isLoading = false
            isConfigLoaded = true
        }

        // Update splash screen text
        runOnUiThread {
            splashLoadingText.text = "Setting up app..."
        }

//        setupWebView()
        setupBackgroundLocation()

        // Update splash screen text
        runOnUiThread {
            splashLoadingText.text = "Checking permissions..."
        }

        // Request permissions in sequence: notification first, then location
        requestNotificationPermission()
    }


    private fun setupBackgroundLocation() {
// In your MainActivity or Service

        FirebaseAuth.getInstance().signInAnonymously()
            .addOnSuccessListener {
                Log.d("AUTH", "Signed in anonymously")
            }
            .addOnFailureListener {
                Log.e("AUTH", "Auth failed", it)
            }


        FirebaseDatabase.getInstance()
            .reference
            .child("drivers")
            .child("driverId")
            .setValue("arun")
        // 🔥 Firebase Configuration
        val firebaseConfig = FirebaseConfig(
            enabled = true,
            databaseUrl = "https://swiggy-9f24c-default-rtdb.asia-southeast1.firebasedatabase.app", // Optional: custom DB URL
            rootPath = "driver_locations",              // Root path in RTDB
            userIdPath = "drivers/{userId}/location",   // Dynamic path with user ID
            enableRealtimeUpdates = true                // Update 'current' location in real-time
        )

        val payloadConfig = PayloadConfig(
            includeAltitude = true,
            includeAccuracy = true,
            includeBearing = true,
            includeProvider = true,
            includeSpeed = true,
            includeTimestamp = true,
            userId = "driver_123",
            deviceId = UUID.randomUUID().toString(),
            customFields = mapOf(
                "driver_name" to "John Doe",
                "vehicle_type" to "motorcycle"
            )
        )
        val locationConfig = LocationConfig(
            60000L, // 1 minute
            30000L, // 30 seconds
            10f, // 10 meters
            LocationPriority.LOW_POWER,
            10000L,
            false,
            true, true
        )
        val notificationConfig = NotificationConfig(
            "background_location_tracking",
            "Location Tracking",
            "Tracks your location in the background",
            2001,
            "Location Tracking Active",
            "Your location is being tracked",
            true,
            "Stop Tracking",
            "Pause Tracking",
            null, // Resource name without extension
            null,
            true,
            false
        )
        val backgroundLocationConfig = BackgroundLocationConfig(
            locationConfig,
            null,
            firebaseConfig, notificationConfig,
            payloadConfig,
            true
        )


        val locationManager = BackgroundLocationManager.getInstance(this)
        locationManager.initialize(backgroundLocationConfig)
        locationManager.startTracking()

    }

    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        // Create JavaScript interface
        webAppInterface = WebAppInterface(
            context = this,
            webView = webView,
            fusedLocationClient = fusedLocationClient,
            onRequestLocationPermission = { requestLocationPermission() }
        )

        // Configure WebView
        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                // Enable zoom
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false

                // Modern web features
                javaScriptCanOpenWindowsAutomatically = true
                mediaPlaybackRequiresUserGesture = false

                // Geolocation
                setGeolocationEnabled(true)
            }

            // Add JavaScript interface
            addJavascriptInterface(webAppInterface, "AndroidBridge")

            // WebView client for navigation
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    return false // Let WebView handle navigation
                }

                override fun onPageStarted(
                    view: WebView?,
                    url: String?,
                    favicon: Bitmap?
                ) {
                    super.onPageStarted(view, url, favicon)

                    // Show loading if WebView is visible (for subsequent page loads)
                    if (webView.visibility == View.VISIBLE) {
                        runOnUiThread {
                            splashLoadingText.text = "Loading page..."
                            splashScreen.visibility = View.VISIBLE
                            webView.visibility = View.GONE
                        }
                    }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)

                    // Clear any pending timeout
                    splashTimeoutHandler.removeCallbacksAndMessages(null)

                    // Hide loading screens once page is loaded
                    runOnUiThread {
                        splashScreen.visibility = View.GONE
                        permissionLoadingLayout.visibility = View.GONE
                        webView.visibility = View.VISIBLE
                    }

                    // Inject any initial JavaScript if needed
                    view?.evaluateJavascript(
                        """
                        console.log('Android WebView loaded');
                        window.isAndroidApp = true;
                    """.trimIndent(), null
                    )
                }
            }

            // Chrome client for alerts, geolocation, etc.
            webChromeClient = object : WebChromeClient() {
                override fun onJsAlert(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("OK") { _, _ -> result?.confirm() }
                        .setCancelable(false)
                        .create()
                        .show()
                    return true
                }

                override fun onJsConfirm(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("OK") { _, _ -> result?.confirm() }
                        .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
                        .setCancelable(false)
                        .create()
                        .show()
                    return true
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    callback?.invoke(origin, true, false)
                }

                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                    super.onProgressChanged(view, newProgress)

                    runOnUiThread {
                        splashLoadingText.text = "Loading app... ${newProgress}%"

                        // Hide splash screen when page is fully loaded
                        if (newProgress >= 100) {
                            // Clear any pending timeout
                            splashTimeoutHandler.removeCallbacksAndMessages(null)

                            splashScreen.visibility = View.GONE
                            permissionLoadingLayout.visibility = View.GONE
                            webView.visibility = View.VISIBLE
                        }
                    }
                }
            }
        }
    }

    private fun configureWindowInsets() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // For API 30+ use WindowInsetsController
            window.setDecorFitsSystemWindows(false)
        } else {
            // For older versions, use system UI flags
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    )
        }

        // Set status bar to be transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.statusBarColor = Color.TRANSPARENT
        }
    }

    private fun applySystemInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())

            // Apply padding to permission loading layout
            permissionLoadingLayout.setPadding(
                32.dpToPx(),
                systemBars.top + 32.dpToPx(),
                32.dpToPx(),
                systemBars.bottom + 32.dpToPx()
            )

            // Apply padding to WebView
            webView.setPadding(
                0,
                systemBars.top,
                0,
                0
            )

            insets
        }
    }

    private fun Int.dpToPx(): Int {
        return (this * resources.displayMetrics.density).toInt()
    }

    private fun checkLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }

    private fun shouldShowLocationRationale(): Boolean {
        return shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION) ||
                shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    private fun showLocationSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle("Location Permission Required")
            .setMessage("This app needs location access to function properly. Please enable it in Settings.")
            .setPositiveButton("Go to Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun requestLocationPermission() {
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun initializeLocationFlow() {
        when {
            checkLocationPermission() -> {
                // Permission already granted
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
                // Show rationale first
                showLocationPermissionRequiredDialog()
            }

            else -> {
                // Request permission directly
                requestLocationPermission()
            }
        }
    }

    private fun isLocationServicesEnabled(): Boolean {
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    private fun showLocationServicesDisabledDialog() {
        AlertDialog.Builder(this)
            .setTitle("🛰️ Enable Location Services")
            .setMessage("Location services are currently disabled on your device.\n\nTo use this delivery app, please:\n1. Go to device Settings\n2. Enable Location Services\n3. Return to the app\n\nThis ensures accurate delivery navigation and tracking.")
            .setPositiveButton("Open Settings") { _, _ ->
                openLocationSettings()
            }
            .setNegativeButton("Exit App") { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun openLocationSettings() {
        val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        startActivity(intent)
    }

    private fun showWebView() {
        // Show splash screen with loading message while WebView loads
        runOnUiThread {
            splashLoadingText.text = "Loading app..."
            splashScreen.visibility = View.VISIBLE
            permissionLoadingLayout.visibility = View.GONE
            webView.visibility = View.GONE
        }

        // Set a timeout to dismiss splash screen if WebView takes too long to load
        splashTimeoutHandler.postDelayed({
            if (splashScreen.visibility == View.VISIBLE) {
                Log.d("TheypoDeliveryApp", "Splash timeout reached, showing WebView")
                runOnUiThread {
                    splashScreen.visibility = View.GONE
                    permissionLoadingLayout.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                }
            }
        }, 10000) // 10 second timeout
    }

    private fun showPermissionScreen() {
        webView.visibility = View.GONE
        permissionLoadingLayout.visibility = View.VISIBLE
        splashScreen.visibility = View.GONE
    }

    private fun showSplashScreen() {
        webView.visibility = View.GONE
        permissionLoadingLayout.visibility = View.GONE
        splashScreen.visibility = View.VISIBLE
    }

    private fun showLocationPermissionRequiredDialog() {
        AlertDialog.Builder(this)
            .setTitle("📍 Enable Location Access")
            .setMessage("To provide efficient delivery service, this app needs access to your location.\n\nThis permission is used to:\n• Navigate to delivery addresses\n• Track delivery progress for customers\n• Optimize delivery routes\n\nYour privacy is protected - location data stays secure.")
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
            .setMessage("This delivery app cannot function without location access.\n\nLocation is needed to:\n• Track delivery progress\n• Navigate to delivery addresses\n• Update customers on delivery status\n\nPlease enable location permission to continue using the app.")
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

    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
    }

    override fun onResume() {
        super.onResume()

        // Re-check all requirements when returning from settings
        val hasPermissions = checkLocationPermission()
        val hasLocationServices = isLocationServicesEnabled()

        if (hasPermissions && hasLocationServices && !hasLocationPermission) {
            // Both permission and location services are now available
            hasLocationPermission = true
            isLocationEnabled = true
            Toast.makeText(this, "Location requirements satisfied", Toast.LENGTH_SHORT).show()
            showWebView()
            webView.loadUrl(webViewUrl)
        } else if (hasPermissions && !hasLocationPermission) {
            // Permission granted but need to check location services
            hasLocationPermission = true
            if (!hasLocationServices) {
                showLocationServicesDisabledDialog()
            }
        } else if (!hasPermissions && hasLocationPermission) {
            // Permission was revoked
            hasLocationPermission = false
            showLocationPermissionRequiredDialog()
        }

        webView.evaluateJavascript(
            "if (window.AndroidBridge && window.AndroidBridge.onAppResumed) { window.AndroidBridge.onAppResumed(); }",
            null
        )
    }

//    private fun requestLocationPermission() {
//        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
//            arrayOf(
//                Manifest.permission.ACCESS_FINE_LOCATION,
//                Manifest.permission.ACCESS_COARSE_LOCATION,
//                Manifest.permission.ACCESS_BACKGROUND_LOCATION
//            )
//        } else {
//            arrayOf(
//                Manifest.permission.ACCESS_FINE_LOCATION,
//                Manifest.permission.ACCESS_COARSE_LOCATION
//            )
//        }
//        locationPermissionLauncher.launch(permissions)
//    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                // Notification permission already granted, proceed with location
                requestLocationPermissionIfNeeded()
            }
        } else {
            // For older Android versions, no notification permission needed
            requestLocationPermissionIfNeeded()
        }
    }

    private fun requestLocationPermissionIfNeeded() {
        // Show loading screen initially
        showPermissionScreen()

        // Add a short delay to show the loading screen, then check permissions
        webView.postDelayed({
            initializeLocationFlow()
        }, 1500) // Show loading for 1.5 seconds
    }

    private fun showNotificationPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("📱 Notification Permission")
            .setMessage("Notifications help you stay updated with delivery assignments and important alerts. You can still use the app, but you may miss important updates.")
            .setPositiveButton("Enable in Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Continue Without") { _, _ ->
                // Continue to location permission
            }
            .setCancelable(false)
            .show()
    }


    override fun onPause() {
        super.onPause()
        // Notify web app that app is going to background
        webView.evaluateJavascript(
            "if (window.AndroidBridge && window.AndroidBridge.onAppPaused) { window.AndroidBridge.onAppPaused(); }",
            null
        )
    }


    override fun onDestroy() {
        super.onDestroy()
        splashTimeoutHandler.removeCallbacksAndMessages(null)
        // Stop location service when app is destroyed
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.extras?.let { extras ->
            val notificationData = extras.getString("notificationData")
            if (notificationData != null) {
                // Send to web app
                webView.evaluateJavascript(
                    "if (window.handleNotification) { window.handleNotification($notificationData); }",
                    null
                )
            }
        }
    }


}
