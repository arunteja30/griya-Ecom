package com.mat.theypo

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
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
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.mat.theypo.utils.ConfigManager
import kotlinx.coroutines.launch

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
    private var webViewUrl: String = ConfigManager.Defaults.THEYPO_URL
    private var isConfigLoaded = false
    private var isLoading = true
    private val splashTimeoutHandler = Handler(Looper.getMainLooper())
    private var activeOrderNotificationId: Int? = null
    private val ACTIVE_ORDER_NOTIFICATION_ID = 1001
    private val NOTIFICATION_CHANNEL_ID = "customer_app_notifications"
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

        // Create notification channel for active order notifications
        createNotificationChannel()

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
            webViewUrl = ConfigManager.getTheypoWebUrl()
            android.util.Log.d("TheypoApp", "Loaded webViewUrl: $webViewUrl")
        } catch (e: Exception) {
            android.util.Log.e("TheypoApp", "Failed to load config, using fallback: $webViewUrl", e)
        } finally {
            isLoading = false
            isConfigLoaded = true
        }

        // Update splash screen text
        runOnUiThread {
            splashLoadingText.text = "Setting up app..."
        }

        setupWebView()

        // Update splash screen text
        runOnUiThread {
            splashLoadingText.text = "Checking permissions..."
        }

        // Request permissions in sequence: notification first, then location
        requestNotificationPermission()
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
            window.statusBarColor = android.graphics.Color.TRANSPARENT
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
                    favicon: android.graphics.Bitmap?
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
                    androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
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
                    androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
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
            .setMessage("Location services are currently disabled on your device.\n\nTo use this delivery app, please:\n1. Go to device Settings\n2. Enable Location Services\n3. Return to the app\n\nThis ensures accurate delivery tracking.")
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
                android.util.Log.d("TheypoApp", "Splash timeout reached, showing WebView")
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
            .setMessage("To provide you with the best delivery experience, this app needs access to your location.\n\nThis permission is used to:\n• Track your delivery in real-time\n• Find stores near you\n• Provide accurate delivery estimates\n\nYour privacy is protected - location data stays secure.")
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
            .setMessage("This delivery app cannot function without location access.\n\nLocation is needed to:\n• Track delivery progress\n• Find nearby stores\n• Provide accurate delivery estimates\n\nPlease enable location permission to continue using the app.")
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
    }


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

    private fun showNotificationPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("📱 Notification Permission")
            .setMessage("Notifications help you stay updated with delivery status and important alerts. You can still use the app, but you may miss important updates.")
            .setPositiveButton("Enable in Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Continue Without") { _, _ ->
                // Continue to location permission
            }
            .setCancelable(false)
            .show()
    }

    private fun requestLocationPermissionIfNeeded() {
        // Show loading screen initially
        showPermissionScreen()

        // Add a short delay to show the loading screen, then check permissions
        webView.postDelayed({
            initializeLocationFlow()
        }, 1500) // Show loading for 1.5 seconds
    }


    override fun onDestroy() {
        super.onDestroy()
        splashTimeoutHandler.removeCallbacksAndMessages(null)
        webView.destroy()
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

    // Create notification channel for Android 8.0+ (API 26+)
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Order Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Real-time notifications for your food delivery orders"
                enableLights(true)
                lightColor = android.graphics.Color.BLUE
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250) // Custom vibration pattern
                setShowBadge(true)
                setBypassDnd(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            // Create additional channel for delivery updates (higher priority)
            val deliveryChannel = NotificationChannel(
                "${NOTIFICATION_CHANNEL_ID}_delivery",
                "Delivery Alerts",
                NotificationManager.IMPORTANCE_MAX
            ).apply {
                description = "Critical delivery status updates"
                enableLights(true)
                lightColor = android.graphics.Color.RED
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500) // More prominent vibration
                setShowBadge(true)
                setBypassDnd(true) // Allow during Do Not Disturb
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            notificationManager.createNotificationChannel(deliveryChannel)
        }
    }

    // Show active order notification (called by bridge)
    fun showActiveOrderNotification(orderId: String, status: String, restaurantName: String) {
        // Check if notification permission is granted (for Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                android.util.Log.w("MainActivity", "Notification permission not granted")
                return
            }
        }

        // Main intent to open order tracking
        val trackOrderIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("orderId", orderId)
            putExtra("deepLink", "/order-tracking/$orderId")
        }

        val trackOrderPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID,
            trackOrderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Call restaurant action
        val callRestaurantIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:+918888888888") // Default restaurant number
        }
        val callPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 1,
            callRestaurantIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Help & Support action
        val helpIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deepLink", "/help-support")
        }
        val helpPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 2,
            helpIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusDetails = getStatusDetails(status)
        val statusText = statusDetails[0]
        val statusEmoji = statusDetails[1]
        val progressText = statusDetails[2]
        val estimatedTime = statusDetails[3]

        // Create custom big style notification
        val bigStyle = NotificationCompat.BigTextStyle()
            .bigText("$statusEmoji $statusText\n🏪 From: $restaurantName\n⏰ $estimatedTime\n📋 Order #$orderId")
            .setBigContentTitle("$statusEmoji Your Order Update")
            .setSummaryText("Tap to track • $progressText")

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("$statusEmoji $statusText")
            .setContentText("🏪 $restaurantName • ⏰ $estimatedTime")
            .setSubText("Order #$orderId")
            .setStyle(bigStyle)
            .setOngoing(true) // Keep notification persistent
            .setAutoCancel(false)
            .setContentIntent(trackOrderPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(getStatusColor(status))
            .setColorized(true)
            // Add status-specific action buttons
            .also { builder ->
//                addStatusSpecificActions(builder, status, orderId, restaurantName)
            }
            // Custom sound and vibration based on status
            .setDefaults(getNotificationDefaults(status))

        // Add progress indicator for certain statuses
        when (status) {
            "preparing", "ready_for_pickup", "picked_up" -> {
                val progress = getProgressPercentage(status)
                builder.setProgress(100, progress, false)
                    .setSubText("$progressText • $progress% complete")
            }

            "out_for_delivery" -> {
                builder.setProgress(0, 0, true) // Indeterminate progress
                    .setSubText("$progressText • Tracking live location")
            }
        }

        val notificationManager = getSystemService(NotificationManager::class.java)
        try {
            android.util.Log.d(
                "MainActivity",
                "Showing enhanced notification for order: $orderId, status: $status"
            )
            notificationManager.notify(ACTIVE_ORDER_NOTIFICATION_ID, builder.build())
            activeOrderNotificationId = ACTIVE_ORDER_NOTIFICATION_ID
            android.util.Log.d("MainActivity", "Enhanced notification shown successfully")
        } catch (e: SecurityException) {
            android.util.Log.e("MainActivity", "Failed to show notification: ${e.message}")
            e.printStackTrace()
        }
    }

    // Show delivery notification with live tracking (like Swiggy)
    fun showDeliveryTrackingNotification(
        orderId: String,
        driverName: String,
        estimatedTime: String,
        driverPhone: String
    ) {
        val trackOrderIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("orderId", orderId)
            putExtra("deepLink", "/live-tracking/$orderId")
        }

        val trackOrderPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 10,
            trackOrderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Call driver action
        val callDriverIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:$driverPhone")
        }
        val callDriverPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 11,
            callDriverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Share live location action
        val shareLocationIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "Track my order live: https://yourapp.com/track/$orderId")
        }
        val shareLocationPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 12,
            Intent.createChooser(shareLocationIntent, "Share tracking"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bigStyle = NotificationCompat.BigTextStyle()
            .bigText("🚚 $driverName is on the way to you!\n\n📍 Live tracking available\n⏰ Estimated delivery: $estimatedTime\n📞 Call driver for updates\n📋 Order #$orderId")
            .setBigContentTitle("🚚 Your order is out for delivery")
            .setSummaryText("Tap to track live location")

        val builder = NotificationCompat.Builder(this, "${NOTIFICATION_CHANNEL_ID}_delivery")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🚚 Out for Delivery - $estimatedTime")
            .setContentText("$driverName is bringing your order")
            .setSubText("Order #$orderId • Tap for live tracking")
            .setStyle(bigStyle)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(trackOrderPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(android.graphics.Color.parseColor("#FF5722")) // Orange-red for delivery
            .setColorized(true)
            .addAction(
                android.R.drawable.ic_menu_call,
                "Call $driverName",
                callDriverPendingIntent
            )
            .addAction(
                android.R.drawable.ic_menu_share,
                "Share Location",
                shareLocationPendingIntent
            )
            .addAction(
                android.R.drawable.ic_menu_help,
                "Help & Support",
                createHelpPendingIntent()
            )
            .setProgress(0, 0, true) // Indeterminate progress for live tracking
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(ACTIVE_ORDER_NOTIFICATION_ID + 10, builder.build())
    }

    // Show order placed notification (like Swiggy confirmation)
    fun showOrderPlacedNotification(
        orderId: String,
        restaurantName: String,
        totalAmount: String,
        estimatedTime: String
    ) {
        val orderDetailsIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("orderId", orderId)
            putExtra("deepLink", "/order-details/$orderId")
        }

        val orderDetailsPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 20,
            orderDetailsIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bigStyle = NotificationCompat.BigTextStyle()
            .bigText("✅ Order successfully placed!\n\n🏪 Restaurant: $restaurantName\n💰 Total: $totalAmount\n⏰ Estimated delivery: $estimatedTime\n📋 Order ID: $orderId\n\nYour delicious meal is being prepared!")
            .setBigContentTitle("🎉 Order Confirmed!")
            .setSummaryText("Tap to view order details")

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🎉 Order Confirmed - $estimatedTime")
            .setContentText("$restaurantName • $totalAmount")
            .setSubText("Order #$orderId")
            .setStyle(bigStyle)
            .setAutoCancel(true)
            .setContentIntent(orderDetailsPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(android.graphics.Color.parseColor("#4CAF50")) // Green for success
            .setColorized(true)
            .addAction(
                android.R.drawable.ic_menu_view,
                "View Order",
                orderDetailsPendingIntent
            )
//            .addAction(
//                android.R.drawable.ic_menu_call,
//                "Call Restaurant",
//                createCallRestaurantPendingIntent()
//            )
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(ACTIVE_ORDER_NOTIFICATION_ID + 20, builder.build())

        // Auto-dismiss after 10 seconds and show persistent tracking notification
        Handler(Looper.getMainLooper()).postDelayed({
            notificationManager.cancel(ACTIVE_ORDER_NOTIFICATION_ID + 20)
        }, 10000)
    }

    // Show delivery completed notification (like Swiggy delivery confirmation)
    fun showDeliveryCompletedNotification(
        orderId: String,
        restaurantName: String,
        deliveryTime: String
    ) {
        val rateOrderIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("orderId", orderId)
            putExtra("deepLink", "/rate-order/$orderId")
        }

        val rateOrderPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 30,
            rateOrderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val reorderIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("restaurantName", restaurantName)
            putExtra("deepLink", "/restaurant/$restaurantName/menu")
        }

        val reorderPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 31,
            reorderIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bigStyle = NotificationCompat.BigTextStyle()
            .bigText("🎉 Your order has been delivered!\n\n🏪 From: $restaurantName\n⏰ Delivered in: $deliveryTime\n📋 Order #$orderId\n\n😋 Enjoy your meal! How was your experience?")
            .setBigContentTitle("🎉 Order Delivered Successfully!")
            .setSummaryText("Rate your experience • Reorder anytime")

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🎉 Delivered! Enjoy your meal")
            .setContentText("$restaurantName • Order #$orderId")
            .setSubText("Delivered in $deliveryTime")
            .setStyle(bigStyle)
            .setAutoCancel(true)
            .setContentIntent(rateOrderPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(android.graphics.Color.parseColor("#4CAF50")) // Green for success
            .setColorized(true)
//            .addAction(
//                android.R.drawable.ic_menu_edit,
//                "Rate Order",
//                rateOrderPendingIntent
//            )
//            .addAction(
//                android.R.drawable.star_big_on,
//                "Reorder",
//                reorderPendingIntent
//            )
//            .addAction(
//                android.R.drawable.ic_menu_help,
//                "Support",
//                createHelpPendingIntent()
//            )
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(ACTIVE_ORDER_NOTIFICATION_ID + 30, builder.build())

        // Clear any persistent tracking notifications
        hideActiveOrderNotification()
    }

    // Helper method to create help pending intent
    private fun createHelpPendingIntent(): PendingIntent {
        val helpIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deepLink", "/help-support")
        }
        return PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 100,
            helpIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // Helper method to create call restaurant pending intent
    private fun createCallRestaurantPendingIntent(): PendingIntent {
        val callRestaurantIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:+918888888888") // Default restaurant number
        }
        return PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 101,
            callRestaurantIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // Enhanced method to show promotional notifications (like Swiggy offers)
    fun showPromotionalNotification(
        title: String,
        message: String,
        offerCode: String?,
        imageUrl: String?
    ) {
        val promoIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deepLink", "/offers")
        }

        val promoPendingIntent = PendingIntent.getActivity(
            this,
            ACTIVE_ORDER_NOTIFICATION_ID + 200,
            promoIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🎁 $title")
            .setContentText(message)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("🎁 $message\n\n${offerCode?.let { "Use code: $it" } ?: ""}"))
            .setAutoCancel(true)
            .setContentIntent(promoPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_PROMO)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(android.graphics.Color.parseColor("#FF9800")) // Orange for promotions
            .setColorized(true)
            .addAction(
                android.R.drawable.ic_menu_view,
                "View Offers",
                promoPendingIntent
            )

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(ACTIVE_ORDER_NOTIFICATION_ID + 200, builder.build())
    }

    // Get status details with emojis and descriptions
    private fun getStatusDetails(status: String): Array<String> {
        return when (status) {
            "pending" -> arrayOf("Order Placed", "📝", "Order received", "Confirming in 2-3 mins")
            "confirmed" -> arrayOf(
                "Order Confirmed",
                "✅",
                "Preparation starting",
                "Ready in 15-20 mins"
            )

            "preparing" -> arrayOf(
                "Being Prepared",
                "👨‍🍳",
                "Cooking in progress",
                "Ready in 10-15 mins"
            )

            "ready_for_pickup" -> arrayOf(
                "Ready for Pickup",
                "📦",
                "Packed & ready",
                "Pickup in 5 mins"
            )

            "picked_up" -> arrayOf("Picked Up", "🏃‍♂️", "On the way", "Delivery in 15-20 mins")
            "out_for_delivery" -> arrayOf(
                "Out for Delivery",
                "🚚",
                "Almost there",
                "Arriving in 5-10 mins"
            )

            "delivered" -> arrayOf("Delivered", "🎉", "Order completed", "Enjoy your meal!")
            else -> arrayOf(status, "📍", "Status update", "Check app for details")
        }
    }

    // Get status-specific colors
    private fun getStatusColor(status: String): Int {
        return when (status) {
            "pending" -> android.graphics.Color.parseColor("#FF9800") // Orange
            "confirmed" -> android.graphics.Color.parseColor("#4CAF50") // Green
            "preparing" -> android.graphics.Color.parseColor("#2196F3") // Blue
            "ready_for_pickup" -> android.graphics.Color.parseColor("#9C27B0") // Purple
            "picked_up" -> android.graphics.Color.parseColor("#FF5722") // Deep Orange
            "out_for_delivery" -> android.graphics.Color.parseColor("#F44336") // Red
            "delivered" -> android.graphics.Color.parseColor("#4CAF50") // Green
            else -> android.graphics.Color.parseColor("#607D8B") // Blue Grey
        }
    }

    // Get progress percentage for visual progress bar
    private fun getProgressPercentage(status: String): Int {
        return when (status) {
            "pending" -> 10
            "confirmed" -> 25
            "preparing" -> 50
            "ready_for_pickup" -> 75
            "picked_up" -> 85
            "out_for_delivery" -> 95
            "delivered" -> 100
            else -> 0
        }
    }

    // Get notification defaults based on status importance
    private fun getNotificationDefaults(status: String): Int {
        return when (status) {
            "confirmed", "ready_for_pickup", "out_for_delivery", "delivered" -> {
                NotificationCompat.DEFAULT_ALL // Sound + Vibration + Lights
            }

            "picked_up" -> {
                NotificationCompat.DEFAULT_VIBRATE // Just vibration
            }

            else -> {
                NotificationCompat.DEFAULT_LIGHTS // Just lights, no sound for frequent updates
            }
        }
    }

    // Hide active order notification
    fun hideActiveOrderNotification() {
        activeOrderNotificationId?.let { id ->
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.cancel(id)
            activeOrderNotificationId = null
        }
    }
}

