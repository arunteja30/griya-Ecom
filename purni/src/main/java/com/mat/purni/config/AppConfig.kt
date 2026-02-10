package com.mat.purni.config

import android.content.Context
import android.util.Log
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Centralized configuration management for all apps
 * Handles Firebase RTDB configuration loading with fallbacks
 */
object AppConfig {
    private const val TAG = "AppConfig"
    private const val FIREBASE_CONFIG_PATH = "appConfig"
    private const val CONFIG_TIMEOUT_MS = 10000L

    // App type configurations
    enum class AppType(val configKey: String, val fallbackUrl: String) {
        PURNI("theypo", "https://google.com") // Purni uses theypo config
    }

    // Navigation page patterns that should trigger app exit
    object NavigationPatterns {
        val EXIT_PATHS = listOf(
            "/",
            "/home",
            "/dashboard",
            "/main",
            "/index",
            "/login",
            "/signin",
            "/auth",
            "/welcome",
            "/onboarding"
        )

        val LOGIN_PATHS = listOf(
            "/login",
            "/signin",
            "/auth",
            "/authentication",
            "/welcome",
            "/onboarding"
        )

        val MODAL_PATTERNS = listOf(
            "/modal/",
            "/popup/",
            "/overlay/",
            "modal=true",
            "popup=true"
        )
    }

    /**
     * Load WebView URL from Firebase RTDB
     */
    suspend fun loadWebViewUrl(
        appType: AppType,
        context: Context? = null
    ): String = suspendCancellableCoroutine { continuation ->

        Log.d(TAG, "Loading config for app type: ${appType.configKey}")

        try {
            val database = FirebaseDatabase.getInstance()
            val configRef =
                database.getReference("$FIREBASE_CONFIG_PATH/${appType.configKey}/webViewUrl")

            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    try {
                        val url = snapshot.getValue(String::class.java)

                        if (!url.isNullOrBlank()) {
                            Log.i(TAG, "✅ Firebase config loaded: $url")
                            continuation.resume(url)
                        } else {
                            Log.w(TAG, "⚠️ No URL found, using fallback")
                            val fallbackUrl = getFallbackUrl(appType, context)
                            continuation.resume(fallbackUrl)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Error processing config", e)
                        val fallbackUrl = getFallbackUrl(appType, context)
                        continuation.resume(fallbackUrl)
                    }
                }

                override fun onCancelled(error: DatabaseError) {
                    Log.e(TAG, "❌ Firebase cancelled: ${error.message}")
                    val fallbackUrl = getFallbackUrl(appType, context)
                    continuation.resume(fallbackUrl)
                }
            }

            configRef.addListenerForSingleValueEvent(listener)

            // Add timeout
            continuation.invokeOnCancellation {
                configRef.removeEventListener(listener)
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Firebase init failed", e)
            val fallbackUrl = getFallbackUrl(appType, context)
            continuation.resume(fallbackUrl)
        }
    }

    /**
     * Get fallback URL with priority: Intent -> SharedPreferences -> Default
     */
    private fun getFallbackUrl(appType: AppType, context: Context?): String {
        context?.let { ctx ->
            // Check SharedPreferences
            val prefs = ctx.getSharedPreferences("app_config", Context.MODE_PRIVATE)
            val savedUrl = prefs.getString("web_app_url_${appType.configKey}", null)
            if (!savedUrl.isNullOrBlank()) {
                Log.i(TAG, "Using saved URL: $savedUrl")
                return savedUrl
            }
        }

        // Return default fallback
        Log.i(TAG, "Using default URL: ${appType.fallbackUrl}")
        return appType.fallbackUrl
    }

    /**
     * Save URL to SharedPreferences for offline access
     */
    fun saveUrlToCache(appType: AppType, url: String, context: Context) {
        try {
            val prefs = context.getSharedPreferences("app_config", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("web_app_url_${appType.configKey}", url)
                .putLong("url_cached_at_${appType.configKey}", System.currentTimeMillis())
                .apply()
            Log.d(TAG, "URL cached for ${appType.configKey}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cache URL", e)
        }
    }

    /**
     * Check if current path should trigger app exit
     */
    fun isExitPath(path: String): Boolean {
        return NavigationPatterns.EXIT_PATHS.any { exitPath ->
            path.equals(exitPath, ignoreCase = true) ||
                    path.startsWith("$exitPath/", ignoreCase = true) ||
                    path.startsWith("$exitPath?", ignoreCase = true)
        } || path.isEmpty()
    }

    /**
     * Check if current path is a login page
     */
    fun isLoginPath(path: String): Boolean {
        return NavigationPatterns.LOGIN_PATHS.any { loginPath ->
            path.equals(loginPath, ignoreCase = true) ||
                    path.startsWith("$loginPath/", ignoreCase = true) ||
                    path.startsWith("$loginPath?", ignoreCase = true)
        }
    }

    /**
     * Check if URL contains modal patterns
     */
    fun isModalUrl(url: String): Boolean {
        return NavigationPatterns.MODAL_PATTERNS.any { pattern ->
            url.contains(pattern, ignoreCase = true)
        }
    }

    /**
     * Generate home page patterns for any base URL
     */
    fun generateHomePatterns(baseUrl: String): List<String> {
        return NavigationPatterns.EXIT_PATHS.map { path ->
            when (path) {
                "/" -> listOf("^$baseUrl/?$", "^$baseUrl/$", "^$baseUrl/#/?$")
                else -> listOf("^$baseUrl$path/?$")
            }
        }.flatten()
    }
}
