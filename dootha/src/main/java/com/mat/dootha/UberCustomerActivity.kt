package com.mat.dootha

import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.webkit.WebView
import android.webkit.WebSettings
import android.webkit.WebViewClient
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.*
import androidx.lifecycle.lifecycleScope
import com.mat.dootha.utils.ConfigManager
import kotlinx.coroutines.launch

class UberCustomerActivity : AppCompatActivity() {

    lateinit var webView: WebView
    private lateinit var bridge: UberCustomerBridge

    companion object {
        private const val LOCATION_SETTINGS_REQUEST_CODE = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)
        applySystemInsets()

        // Initialize bridge
        bridge = UberCustomerBridge(this, webView)

        // Check if location services are enabled before proceeding
        if (!isLocationEnabled()) {
            showLocationServiceDialog()
            return
        }

        // If location is enabled, proceed with app initialization
        initializeAppAfterLocationCheck()
    }

    private fun isLocationEnabled(): Boolean {
        val locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    private fun showLocationServiceDialog() {
        AlertDialog.Builder(this)
            .setTitle("Location Service Required")
            .setMessage("This app requires location services to function properly. Please enable location services to continue.")
            .setCancelable(false)
            .setPositiveButton("Turn On Location") { _, _ ->
                // Open location settings
                try {
                    val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    startActivityForResult(intent, LOCATION_SETTINGS_REQUEST_CODE)
                } catch (e: Exception) {
                    Log.e("TAG", "Error opening location settings", e)
                    finishAffinity()
                }
            }
            .setNegativeButton("Exit App") { _, _ ->
                finishAffinity()
            }
            .show()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == LOCATION_SETTINGS_REQUEST_CODE) {
            // Check again if location is enabled after returning from settings
            if (isLocationEnabled()) {
                // Location is now enabled, continue with app initialization
                initializeAppAfterLocationCheck()
            } else {
                // User didn't enable location, show dialog again
                showLocationServiceDialog()
            }
        }
    }

    private fun initializeAppAfterLocationCheck() {
        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            allowFileAccess = true
            allowContentAccess = true
        }

        // Add JavaScript interface
        webView.addJavascriptInterface(bridge, "AndroidRidesCustomer")

        // Set WebView client
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)


            }
        }

        loadConfigAndSetupUrl()
    }

    private fun loadConfigAndSetupUrl() {


        lifecycleScope.launch {
            try {
                val webViewUrl = ConfigManager.getDoothaCustomerWebUrl()
                val finalUrl = intent.getStringExtra("url") ?: webViewUrl

                runOnUiThread {
                    webView.loadUrl(finalUrl)
                }
            } catch (e: Exception) {
                Log.e("UberCustomerActivity", "Error loading config: ${e.message}")
            }

        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private fun applySystemInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        val isGranted = grantResults.isNotEmpty() &&
                grantResults.all { it == PackageManager.PERMISSION_GRANTED }

        val (permissionType, message) = when (requestCode) {
            UberCustomerBridge.LOCATION_PERMISSION_REQUEST_CODE -> {
                "location" to if (isGranted) "Location permission granted" else "Location permission denied"
            }

            UberCustomerBridge.CAMERA_PERMISSION_REQUEST_CODE -> {
                "camera" to if (isGranted) "Camera permission granted" else "Camera permission denied"
            }

            UberCustomerBridge.MICROPHONE_PERMISSION_REQUEST_CODE -> {
                "microphone" to if (isGranted) "Microphone permission granted" else "Microphone permission denied"
            }

            UberCustomerBridge.STORAGE_PERMISSION_REQUEST_CODE -> {
                "storage" to if (isGranted) "Storage permission granted" else "Storage permission denied"
            }

            UberCustomerBridge.PHONE_PERMISSION_REQUEST_CODE -> {
                "phone" to if (isGranted) "Phone permission granted" else "Phone permission denied"
            }

            UberCustomerBridge.NOTIFICATION_PERMISSION_REQUEST_CODE -> {
                "notification" to if (isGranted) "Notification permission granted" else "Notification permission denied"
            }

            else -> {
                "unknown" to "Unknown permission request"
            }
        }

        bridge.showToast(message)

        // Notify WebView
        webView.evaluateJavascript(
            "window.onPermissionResult && window.onPermissionResult('$permissionType', $isGranted, '$message')",
            null
        )

        // Special handling for location permission
        if (requestCode == UberCustomerBridge.LOCATION_PERMISSION_REQUEST_CODE) {
            if (isGranted) {
                webView.evaluateJavascript(
                    "window.onLocationPermissionGranted && window.onLocationPermissionGranted()",
                    null
                )
            } else {
                webView.evaluateJavascript(
                    "window.onLocationPermissionDenied && window.onLocationPermissionDenied('$message')",
                    null
                )
            }
        }
    }

    override fun onDestroy() {
        bridge.cleanup()
        super.onDestroy()
    }
}
