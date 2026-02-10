package com.mat.purnidelivery.config

import android.content.Context
import android.util.Log
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Centralized configuration management for purni-delivery app
 * Handles Firebase RTDB configuration loading with fallbacks
 */
object AppConfig {
    private const val TAG = "AppConfig"
    private const val FIREBASE_CONFIG_PATH = "appConfig"
    private const val CONFIG_TIMEOUT_MS = 10000L

    // App type configurations
    enum class AppType(val configKey: String, val fallbackUrl: String) {
        PURNI_DELIVERY("theypoDelivery", "https://thepo-delivery.onrender.com")
    }

    // Navigation page patterns that should trigger app exit
    object NavigationPatterns {
        val EXIT_PATHS = listOf(
            "/",
            "/home",
            "/orders",
            "/main",
            "/index",
            "/login",
            "/profile",
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

            // Track if we've already resumed to prevent double-resume
            var isResumed = false

            val listener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    synchronized(continuation) {
                        if (isResumed || !continuation.isActive) return
                        isResumed = true
                    }

                    try {
                        val url = snapshot.getValue(String::class.java)

                        if (!url.isNullOrBlank()) {
                            Log.i(TAG, "✅ Firebase config loaded: $url")
                            continuation.resumeWith(Result.success(url))
                        } else {
                            Log.w(TAG, "⚠️ No URL found, using fallback")
                            val fallbackUrl = getFallbackUrl(appType, context)
                            continuation.resumeWith(Result.success(fallbackUrl))
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Error processing config", e)
                        val fallbackUrl = getFallbackUrl(appType, context)
                        continuation.resumeWith(Result.success(fallbackUrl))
                    }
                }

                override fun onCancelled(error: DatabaseError) {
                    synchronized(continuation) {
                        if (isResumed || !continuation.isActive) return
                        isResumed = true
                    }

                    Log.e(TAG, "❌ Firebase cancelled: ${error.message}")
                    val fallbackUrl = getFallbackUrl(appType, context)
                    continuation.resumeWith(Result.success(fallbackUrl))
                }
            }

            // Set timeout with proper runnable instance
            val timeoutHandler = android.os.Handler(android.os.Looper.getMainLooper())
            val timeoutRunnable = Runnable {
                synchronized(continuation) {
                    if (isResumed || !continuation.isActive) return@Runnable
                    isResumed = true
                }

                Log.w(TAG, "⏰ Config loading timeout, using fallback")
                val fallbackUrl = getFallbackUrl(appType, context)
                continuation.resumeWith(Result.success(fallbackUrl))
            }

            timeoutHandler.postDelayed(timeoutRunnable, CONFIG_TIMEOUT_MS)

            // Add listener
            configRef.addListenerForSingleValueEvent(listener)

            // Cancel timeout when coroutine is cancelled
            continuation.invokeOnCancellation {
                synchronized(continuation) {
                    if (!isResumed) {
                        isResumed = true
                    }
                }
                timeoutHandler.removeCallbacks(timeoutRunnable)
                configRef.removeEventListener(listener)
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to load config", e)
            val fallbackUrl = getFallbackUrl(appType, context)
            continuation.resumeWith(Result.success(fallbackUrl))
        }
    }

    /**
     * Get fallback URL (cached or default)
     */
    private fun getFallbackUrl(appType: AppType, context: Context?): String {
        // Try to get cached URL
        context?.let { ctx ->
            val cachedUrl = getCachedUrl(appType, ctx)
            if (!cachedUrl.isNullOrBlank()) {
                Log.i(TAG, "📱 Using cached URL: $cachedUrl")
                return cachedUrl
            }
        }

        // Use default fallback
        Log.i(TAG, "🔄 Using default fallback: ${appType.fallbackUrl}")
        return appType.fallbackUrl
    }

    /**
     * Save URL to local cache for offline use
     */
    fun saveUrlToCache(appType: AppType, url: String, context: Context) {
        try {
            val prefs = context.getSharedPreferences("app_config", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("${appType.configKey}_url", url)
                .putLong("${appType.configKey}_cached_at", System.currentTimeMillis())
                .apply()
            Log.d(TAG, "💾 Cached URL for ${appType.configKey}: $url")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to cache URL", e)
        }
    }

    /**
     * Get cached URL from local storage
     */
    private fun getCachedUrl(appType: AppType, context: Context): String? {
        return try {
            val prefs = context.getSharedPreferences("app_config", Context.MODE_PRIVATE)
            val url = prefs.getString("${appType.configKey}_url", null)
            val cachedAt = prefs.getLong("${appType.configKey}_cached_at", 0)

            // Check if cache is not too old (24 hours)
            val maxAge = 24 * 60 * 60 * 1000L // 24 hours in ms
            if (System.currentTimeMillis() - cachedAt < maxAge && !url.isNullOrBlank()) {
                url
            } else {
                Log.d(TAG, "🕐 Cached URL expired or invalid")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to get cached URL", e)
            null
        }
    }

    /**
     * Check if URL path should trigger app exit
     */
    fun shouldExitOnNavigation(path: String?): Boolean {
        if (path.isNullOrBlank()) return false
        return NavigationPatterns.EXIT_PATHS.any { exitPath ->
            path.equals(exitPath, ignoreCase = true) ||
                    path.endsWith(exitPath, ignoreCase = true)
        }
    }

    /**
     * Check if URL path is a login/auth page
     */
    fun isLoginPage(path: String?): Boolean {
        if (path.isNullOrBlank()) return false
        return NavigationPatterns.LOGIN_PATHS.any { loginPath ->
            path.contains(loginPath, ignoreCase = true)
        }
    }

    /**
     * Check if URL appears to be a modal/popup
     */
    fun isModalPattern(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        return NavigationPatterns.MODAL_PATTERNS.any { pattern ->
            url.contains(pattern, ignoreCase = true)
        }
    }

    /**
     * Get current configuration status for debugging
     */
    fun getConfigStatus(appType: AppType, context: Context): Map<String, Any> {
        val prefs = context.getSharedPreferences("app_config", Context.MODE_PRIVATE)
        return mapOf(
            "appType" to appType.configKey,
            "fallbackUrl" to appType.fallbackUrl,
            "cachedUrl" to (prefs.getString("${appType.configKey}_url", null) ?: "none"),
            "cachedAt" to prefs.getLong("${appType.configKey}_cached_at", 0),
            "cacheAge" to (System.currentTimeMillis() - prefs.getLong(
                "${appType.configKey}_cached_at",
                0
            ))
        )
    }
}
