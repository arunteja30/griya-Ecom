package com.mat.theypo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import org.json.JSONException
import org.json.JSONObject

/**
 * Native implementation for window.AndroidBridge used by customer app.
 * Provides essential functionality for the WebView interface.
 */
class AndroidBridgeImpl(
    private val activity: Activity,
    private val webView: WebView
) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    // Back button handling support for web app
    @JavascriptInterface
    fun initializeWebViewService() {
        runOnUiThread {
            webView.evaluateJavascript(
                """
                window.webViewService = {
                    goBack: function() {
                        if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            AndroidBridge.exitApp();
                        }
                    }
                };
            """.trimIndent(), null
            )
        }
    }

    @JavascriptInterface
    fun exitApp() {
        mainHandler.post {
            activity.finish()
        }
    }

    @JavascriptInterface
    fun getCurrentLocation() {
        if (!hasLocationPermission()) {
            requestLocationPermission()
            return
        }

        try {
            fusedClient.lastLocation.addOnSuccessListener { location: Location? ->
                val result = if (location != null) {
                    JSONObject().apply {
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy)
                    }.toString()
                } else {
                    JSONObject().apply {
                        put("error", "Location not available")
                    }.toString()
                }

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onLocationResult && window.onLocationResult($result)",
                        null
                    )
                }
            }.addOnFailureListener { exception ->
                val errorResult = JSONObject().apply {
                    put("error", exception.message ?: "Unknown location error")
                }.toString()

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onLocationResult && window.onLocationResult($errorResult)",
                        null
                    )
                }
            }
        } catch (e: SecurityException) {
            showToast("Location permission required")
        }
    }

    @JavascriptInterface
    fun requestLocationPermission() {
        if (!hasLocationPermission()) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                1001
            )
        }
    }

    @JavascriptInterface
    fun makePhoneCall(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$phoneNumber")
            }

            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED
            ) {
                activity.startActivity(intent)
            } else {
                // Fall back to dial intent if no call permission
                val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$phoneNumber")
                }
                activity.startActivity(dialIntent)
            }
        } catch (e: Exception) {
            showToast("Unable to make call: ${e.message}")
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun shareContent(params: String) {
        try {
            val json = JSONObject(params)
            val text = json.optString("text", "")
            val url = json.optString("url", "")
            val title = json.optString("title", "Share")

            mainHandler.post {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    val shareText = if (url.isNotEmpty()) "$text $url" else text
                    putExtra(Intent.EXTRA_TEXT, shareText)

                    if (title.isNotEmpty()) {
                        putExtra(Intent.EXTRA_SUBJECT, title)
                    }
                }

                activity.startActivity(Intent.createChooser(shareIntent, "Share"))
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun openAppSettings() {
        mainHandler.post {
            val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.data = Uri.parse("package:${activity.packageName}")
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun setStatusBar(params: String) {
        try {
            val json = JSONObject(params)
            val color = json.optString("color", "#FFFFFF")
            val lightContent = json.optBoolean("lightContent", false)

            mainHandler.post {
                // Status bar customization can be implemented here if needed
                // For now, we'll just acknowledge the call
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    activity,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }

    private fun runOnUiThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            activity.runOnUiThread { block() }
        }
    }
}
