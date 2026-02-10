package com.mat.purni

import android.widget.Toast
import com.mat.purni.base.BaseHybridWebActivity
import com.mat.purni.config.AppConfig

/**
 * Optimized Hybrid WebView Activity for Purni (Customer) App
 * Extends BaseHybridWebActivity for common functionality
 */
class HybridWebActivity : BaseHybridWebActivity() {

    override fun getAppType(): AppConfig.AppType = AppConfig.AppType.PURNI

    override fun createBridge(): AndroidBridgeImpl = AndroidBridgeImpl(this, webView)

    // Methods required by AndroidBridgeImpl
    fun showActiveOrderNotification(orderId: String, status: String, restaurantName: String) {
        Toast.makeText(this, "Order $orderId: $status from $restaurantName", Toast.LENGTH_SHORT)
            .show()
    }

    fun hideActiveOrderNotification() {
        Toast.makeText(this, "Order notification hidden", Toast.LENGTH_SHORT).show()
    }

    fun requestLocationPermissionFromWeb(callback: PermissionManager.PermissionCallback) {
        callback.onGranted() // For now, assume granted
    }

    fun requestNotificationPermissionFromWeb(callback: PermissionManager.PermissionCallback) {
        callback.onGranted() // For now, assume granted
    }

    fun hasLocationPermissionsFromWeb(): Boolean = true // For now, assume granted

    fun hasNotificationPermissionFromWeb(): Boolean = true // For now, assume granted
}

// Permission Manager interface
interface PermissionManager {
    interface PermissionCallback {
        fun onGranted()
        fun onDenied()
    }
}
