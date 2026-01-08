package com.mat.theypo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var permissionLoadingLayout: View
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationManager: LocationManager
    private lateinit var webAppInterface: WebAppInterface
    private var hasLocationPermission = false
    private var isLocationEnabled = false

    // Change these URLs for customer/delivery
    private val WEB_URL = "https://fags.onrender.com" // or delivery app URL

    // Permission launcher
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        when {
            permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true -> {
                hasLocationPermission = true
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show()

                // Now check if location services are enabled
                if (isLocationServicesEnabled()) {
                    isLocationEnabled = true
                    if (::webAppInterface.isInitialized) {
                        webAppInterface.onLocationPermissionGranted()
                    }
                    showWebView()
                    webView.loadUrl(WEB_URL)
                } else {
                    showLocationServicesDisabledDialog()
                }
            }

            else -> {
                hasLocationPermission = false
                showLocationPermissionDeniedDialog()
            }
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Notification permission granted", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configure window for proper status bar handling
        configureWindowInsets()

        setContentView(R.layout.main)

        // Initialize views
        webView = findViewById(R.id.webView)
        permissionLoadingLayout = findViewById(R.id.permissionLoadingLayout)

        // Apply system insets to handle status bar properly
        applySystemInsets()

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        setupWebView()
        requestNotificationPermission()

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

        // Check both location permissions and location services
        checkLocationRequirements()
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

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
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
                    // Update progress bar if you have one
                }
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

    private fun checkLocationRequirements() {
        // Show loading screen initially
        showPermissionLoadingScreen()

        // Add a short delay to show the loading screen, then check permissions
        webView.postDelayed({
            if (!hasLocationPermissions()) {
                // Immediately show permission request dialog
                showLocationPermissionRequiredDialog()
                return@postDelayed
            }

            hasLocationPermission = true

            // Then check if location services are enabled
            if (!isLocationServicesEnabled()) {
                showLocationServicesDisabledDialog()
                return@postDelayed
            }

            isLocationEnabled = true

            // Both permissions and location services are available
            Toast.makeText(this, "Location access granted", Toast.LENGTH_SHORT).show()
            showWebView()
            webView.loadUrl(WEB_URL)
        }, 1500) // Show loading for 1.5 seconds
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
        webView.visibility = View.VISIBLE
        permissionLoadingLayout.visibility = View.GONE
    }

    private fun showPermissionLoadingScreen() {
        webView.visibility = View.GONE
        permissionLoadingLayout.visibility = View.VISIBLE
    }

    private fun hasLocationPermissions(): Boolean {
        val fineLocationPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseLocationPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return fineLocationPermission || coarseLocationPermission
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
        val hasPermissions = hasLocationPermissions()
        val hasLocationServices = isLocationServicesEnabled()

        if (hasPermissions && hasLocationServices && !hasLocationPermission) {
            // Both permission and location services are now available
            hasLocationPermission = true
            isLocationEnabled = true
            Toast.makeText(this, "Location requirements satisfied", Toast.LENGTH_SHORT).show()
            showWebView()
            webView.loadUrl(WEB_URL)
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
            }
        }
    }


    override fun onDestroy() {
        super.onDestroy()
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

}
