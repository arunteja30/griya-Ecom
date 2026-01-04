package com.griyaecom.app.bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.widget.Toast
import com.griyaecom.app.MainActivity
import com.griyaecom.app.utils.CameraHelper
import com.griyaecom.app.utils.LocationHelper
import com.griyaecom.app.utils.NotificationHelper
import org.json.JSONObject

class WebBridge(
    private val activity: MainActivity,
    private val locationHelper: LocationHelper,
    private val cameraHelper: CameraHelper,
    private val notificationHelper: NotificationHelper
) {

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun showLongToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
        }
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val deviceInfo = JSONObject().apply {
            put("platform", "android")
            put("version", android.os.Build.VERSION.RELEASE)
            put("model", android.os.Build.MODEL)
            put("manufacturer", android.os.Build.MANUFACTURER)
            put("brand", android.os.Build.BRAND)
            put(
                "appVersion",
                activity.packageManager.getPackageInfo(activity.packageName, 0).versionName
            )
        }
        return deviceInfo.toString()
    }

    @JavascriptInterface
    fun openExternalUrl(url: String) {
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun makePhoneCall(phoneNumber: String) {
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun sendEmail(email: String, subject: String = "", body: String = "") {
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("mailto:$email")
                putExtra(Intent.EXTRA_SUBJECT, subject)
                putExtra(Intent.EXTRA_TEXT, body)
            }
            activity.startActivity(Intent.createChooser(intent, "Send Email"))
        }
    }

    @JavascriptInterface
    fun sendSMS(phoneNumber: String, message: String = "") {
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("sms:$phoneNumber")
                putExtra("sms_body", message)
            }
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun shareText(text: String, title: String = "Share") {
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
            }
            activity.startActivity(Intent.createChooser(intent, title))
        }
    }

    @JavascriptInterface
    fun vibrate(duration: Long = 200) {
        activity.runOnUiThread {
            notificationHelper.vibrate(duration)
        }
    }

    // Location Services
    @JavascriptInterface
    fun getCurrentLocation() {
        locationHelper.getCurrentLocation { location, error ->
            activity.runOnUiThread {
                val result = if (location != null) {
                    JSONObject().apply {
                        put("success", true)
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy)
                        put("timestamp", location.time)
                    }
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("error", error ?: "Unknown error")
                    }
                }

                val jsCode = "window.onLocationReceived && window.onLocationReceived(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun startLocationTracking(intervalMs: Long = 30000) {
        locationHelper.startLocationUpdates(intervalMs) { location, error ->
            activity.runOnUiThread {
                val result = if (location != null) {
                    JSONObject().apply {
                        put("success", true)
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy)
                        put("timestamp", location.time)
                    }
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("error", error ?: "Unknown error")
                    }
                }

                val jsCode = "window.onLocationUpdate && window.onLocationUpdate(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun stopLocationTracking() {
        locationHelper.stopLocationUpdates()
    }

    @JavascriptInterface
    fun checkLocationPermission(): Boolean {
        return locationHelper.hasLocationPermission()
    }

    @JavascriptInterface
    fun requestLocationPermission() {
        locationHelper.requestLocationPermission()
    }

    // Camera Functions
    @JavascriptInterface
    fun capturePhoto() {
        cameraHelper.capturePhoto { uri, error ->
            activity.runOnUiThread {
                val result = if (uri != null) {
                    JSONObject().apply {
                        put("success", true)
                        put("imageUri", uri.toString())
                        put("imagePath", cameraHelper.getImagePath(uri))
                    }
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("error", error ?: "Unknown error")
                    }
                }

                val jsCode = "window.onPhotoCaptured && window.onPhotoCaptured(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun selectFromGallery() {
        cameraHelper.selectFromGallery { uri, error ->
            activity.runOnUiThread {
                val result = if (uri != null) {
                    JSONObject().apply {
                        put("success", true)
                        put("imageUri", uri.toString())
                        put("imagePath", cameraHelper.getImagePath(uri))
                    }
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("error", error ?: "Unknown error")
                    }
                }

                val jsCode = "window.onImageSelected && window.onImageSelected(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun checkCameraPermission(): Boolean {
        return cameraHelper.hasCameraPermission()
    }

    @JavascriptInterface
    fun requestCameraPermission() {
        cameraHelper.requestCameraPermission()
    }

    // Notification Functions
    @JavascriptInterface
    fun showLocalNotification(title: String, message: String, id: Int = 1) {
        notificationHelper.showNotification(title, message, id)
    }

    @JavascriptInterface
    fun cancelNotification(id: Int) {
        notificationHelper.cancelNotification(id)
    }

    @JavascriptInterface
    fun cancelAllNotifications() {
        notificationHelper.cancelAllNotifications()
    }

    @JavascriptInterface
    fun checkNotificationPermission(): Boolean {
        return notificationHelper.hasNotificationPermission()
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        notificationHelper.requestNotificationPermission()
    }

    @JavascriptInterface
    fun getFCMToken() {
        notificationHelper.getFCMToken { token ->
            activity.runOnUiThread {
                val jsCode = "window.onFCMToken && window.onFCMToken('$token')"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun getStoredFCMToken(): String? {
        return notificationHelper.getStoredToken()
    }

    @JavascriptInterface
    fun registerFCMToken() {
        // This automatically registers the current FCM token with your server
        notificationHelper.getFCMToken { token ->
            activity.runOnUiThread {
                val result = JSONObject().apply {
                    put("success", token != null)
                    put("token", token ?: "")
                    put(
                        "message",
                        if (token != null) "Token registered successfully" else "Failed to get FCM token"
                    )
                }
                val jsCode = "window.onFCMTokenRegistered && window.onFCMTokenRegistered(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun subscribeToNotificationTopic(topic: String) {
        notificationHelper.subscribeToTopic(topic) { success ->
            activity.runOnUiThread {
                val result = JSONObject().apply {
                    put("success", success)
                    put("topic", topic)
                    put("message", if (success) "Subscribed to topic" else "Failed to subscribe")
                }
                val jsCode = "window.onTopicSubscription && window.onTopicSubscription(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun unsubscribeFromNotificationTopic(topic: String) {
        notificationHelper.unsubscribeFromTopic(topic) { success ->
            activity.runOnUiThread {
                val result = JSONObject().apply {
                    put("success", success)
                    put("topic", topic)
                    put(
                        "message",
                        if (success) "Unsubscribed from topic" else "Failed to unsubscribe"
                    )
                }
                val jsCode =
                    "window.onTopicUnsubscription && window.onTopicUnsubscription(${result})"
                activity.safeEvaluateJavascript(jsCode)
            }
        }
    }

    @JavascriptInterface
    fun refreshFCMToken() {
        notificationHelper.refreshFCMToken()
    }

    // Storage Functions
    @JavascriptInterface
    fun setLocalStorage(key: String, value: String) {
        val sharedPref = activity.getSharedPreferences("WebViewStorage", Activity.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString(key, value)
            apply()
        }
    }

    @JavascriptInterface
    fun getLocalStorage(key: String): String? {
        val sharedPref = activity.getSharedPreferences("WebViewStorage", Activity.MODE_PRIVATE)
        return sharedPref.getString(key, null)
    }

    @JavascriptInterface
    fun removeLocalStorage(key: String) {
        val sharedPref = activity.getSharedPreferences("WebViewStorage", Activity.MODE_PRIVATE)
        with(sharedPref.edit()) {
            remove(key)
            apply()
        }
    }

    @JavascriptInterface
    fun clearLocalStorage() {
        val sharedPref = activity.getSharedPreferences("WebViewStorage", Activity.MODE_PRIVATE)
        with(sharedPref.edit()) {
            clear()
            apply()
        }
    }

    // Network Functions
    @JavascriptInterface
    fun checkNetworkStatus(): String {
        val networkInfo = JSONObject().apply {
            put("isConnected", notificationHelper.isNetworkConnected())
            put("connectionType", notificationHelper.getNetworkType())
        }
        return networkInfo.toString()
    }

    // File Upload Support
    fun setFilePathCallback(callback: ValueCallback<Array<Uri>>?) {
        filePathCallback = callback
    }

    fun handleFileUploadResult(resultCode: Int, data: Intent?) {
        val results = if (resultCode == Activity.RESULT_OK && data != null) {
            data.clipData?.let { clipData ->
                Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } ?: arrayOf(data.data!!)
        } else {
            null
        }

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    // Permission Results Handler
    fun handlePermissionResults(permissions: Map<String, Boolean>) {
        val result = JSONObject()
        permissions.forEach { (permission, granted) ->
            result.put(permission, granted)
        }

        val jsCode = "window.onPermissionResult && window.onPermissionResult(${result})"
        activity.safeEvaluateJavascript(jsCode)
    }

    @JavascriptInterface
    fun reload() {
        activity.runOnUiThread {
            activity.safeReload()
        }
    }

    @JavascriptInterface
    fun goBack() {
        activity.runOnUiThread {
            activity.safeGoBack()
        }
    }

    @JavascriptInterface
    fun goForward() {
        activity.runOnUiThread {
            activity.safeGoForward()
        }
    }

    @JavascriptInterface
    fun exitApp() {
        activity.runOnUiThread {
            activity.finish()
        }
    }
}