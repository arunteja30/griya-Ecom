package com.mat.purnidelivery

import android.content.Intent
import android.widget.Toast
import com.mat.purnidelivery.base.BaseHybridWebActivity
import com.mat.purnidelivery.config.AppConfig

/**
 * Optimized Hybrid WebView Activity for Delivery Partner App
 * Extends BaseHybridWebActivity for dynamic URL configuration and common functionality
 */
class HybridWebActivity : BaseHybridWebActivity() {

    private lateinit var permissionManager: PermissionManager
    private lateinit var networkMonitor: NetworkMonitor

    override fun getAppType(): AppConfig.AppType = AppConfig.AppType.PURNI_DELIVERY

    override fun createBridge(): AndroidBridgeImpl = AndroidBridgeImpl(this, webView)

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize permission manager
        permissionManager = PermissionManager(this)

        // Initialize network monitor
        networkMonitor = NetworkMonitor(this)

        // Check for deep link from notification
        handleDeepLink(intent)

        // Request permissions
        requestAllPermissions()
    }

    // Override notification methods for delivery-specific behavior
    override fun showActiveOrderNotification(
        orderId: String,
        status: String,
        restaurantName: String
    ) {
        Toast.makeText(this, "Order $orderId: $status from $restaurantName", Toast.LENGTH_SHORT)
            .show()
        // Add delivery-specific notification logic here
    }

    override fun hideActiveOrderNotification() {
        Toast.makeText(this, "Order notification hidden", Toast.LENGTH_SHORT).show()
        // Add delivery-specific notification hiding logic here
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent) {
        val deepLink = intent.getStringExtra("deepLink")
        val orderId = intent.getStringExtra("orderId")
        val action = intent.getStringExtra("EXTRA_ACTION")
        val legacyOrderId = intent.getStringExtra("EXTRA_ORDER_ID")

        if (deepLink != null) {
            // Navigate to specific page via WebView URL
            webView.post {
                webView.evaluateJavascript(
                    "if (window.location.pathname !== '$deepLink') { window.location.href = '$deepLink'; }",
                    null
                )
            }
        } else if (orderId != null) {
            // Navigate to active delivery page
            webView.post {
                webView.evaluateJavascript(
                    "window.location.href = '/active-delivery/$orderId';",
                    null
                )
            }
        } else if (legacyOrderId != null) {
            // Legacy handling - inject JavaScript to navigate to order
            webView.post {
                val js = when (action) {
                    "ACCEPT_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$legacyOrderId', 'accept');"
                    "VIEW_ORDER" -> "window.handleNotificationAction && window.handleNotificationAction('$legacyOrderId', 'view');"
                    else -> "window.location.hash = '/active-delivery';"
                }
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun requestAllPermissions() {
        permissionManager.requestLocationPermission(object : PermissionManager.PermissionCallback {
            override fun onPermissionGranted() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location permissions granted",
                    Toast.LENGTH_SHORT
                ).show()
                requestBackgroundLocationIfNeeded()
            }

            override fun onPermissionDenied() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Location permissions required for delivery tracking",
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    private fun requestBackgroundLocationIfNeeded() {
        permissionManager.requestBackgroundLocationPermission(object :
            PermissionManager.PermissionCallback {
            override fun onPermissionGranted() {
                Toast.makeText(
                    this@HybridWebActivity,
                    "Background location enabled",
                    Toast.LENGTH_SHORT
                ).show()
            }

            override fun onPermissionDenied() {
                // Optional, app can still work with foreground location
            }
        })
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionManager.handlePermissionResult(requestCode, grantResults)
    }
}
