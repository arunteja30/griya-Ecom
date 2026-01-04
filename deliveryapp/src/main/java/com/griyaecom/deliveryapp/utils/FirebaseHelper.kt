package com.griyaecom.deliveryapp.utils

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlin.time.Duration.Companion.seconds

/**
 * Firebase initialization helper with robust error handling for Delivery App
 */
object FirebaseHelper {
    private const val TAG = "DeliveryFirebaseHelper"
    private const val MAX_RETRY_ATTEMPTS = 3
    private const val RETRY_DELAY_MS = 2000L

    /**
     * Initialize Firebase Messaging with error handling and retry logic
     */
    suspend fun initializeFirebaseMessaging(
        context: Context,
        onTokenReceived: (String) -> Unit = {},
        onError: (Exception) -> Unit = {}
    ) {
        withContext(Dispatchers.IO) {
            var attempts = 0

            while (attempts < MAX_RETRY_ATTEMPTS) {
                try {
                    // Get FCM token with timeout
                    val token = withTimeout(10.seconds) {
                        suspendCancellableCoroutine<String> { continuation ->
                            FirebaseMessaging.getInstance().token
                                .addOnCompleteListener { task ->
                                    if (task.isSuccessful) {
                                        val token = task.result
                                        if (!token.isNullOrEmpty()) {
                                            Log.d(TAG, "FCM token retrieved successfully")
                                            continuation.resumeWith(Result.success(token))
                                        } else {
                                            continuation.resumeWith(
                                                Result.failure(
                                                    Exception("Empty FCM token received")
                                                )
                                            )
                                        }
                                    } else {
                                        val exception =
                                            task.exception ?: Exception("Unknown FCM error")
                                        Log.w(TAG, "FCM token fetch failed", exception)
                                        continuation.resumeWith(Result.failure(exception))
                                    }
                                }
                                .addOnFailureListener { exception ->
                                    Log.e(TAG, "FCM token request failed", exception)
                                    continuation.resumeWith(Result.failure(exception))
                                }
                        }
                    }

                    // Store token locally
                    storeTokenLocally(context, token)

                    // Notify success
                    withContext(Dispatchers.Main) {
                        onTokenReceived(token)
                    }

                    Log.i(TAG, "Firebase Messaging initialized successfully")
                    return@withContext

                } catch (e: Exception) {
                    attempts++
                    Log.w(TAG, "Firebase initialization attempt $attempts failed", e)

                    if (attempts >= MAX_RETRY_ATTEMPTS) {
                        Log.e(
                            TAG,
                            "Firebase initialization failed after $MAX_RETRY_ATTEMPTS attempts",
                            e
                        )

                        // Try to use cached token as fallback
                        val cachedToken = getCachedToken(context)
                        if (cachedToken != null) {
                            Log.i(TAG, "Using cached FCM token as fallback")
                            withContext(Dispatchers.Main) {
                                onTokenReceived(cachedToken)
                            }
                        } else {
                            withContext(Dispatchers.Main) {
                                onError(e)
                            }
                        }
                        return@withContext
                    }

                    // Wait before retrying
                    delay(RETRY_DELAY_MS * attempts)
                }
            }
        }
    }

    /**
     * Subscribe to delivery-specific topics with error handling
     */
    suspend fun subscribeToDeliveryTopics(
        onSuccess: (String) -> Unit = {},
        onError: (String, Exception) -> Unit = { _, _ -> }
    ) {
        val topics = listOf(
            "delivery_updates",
            "emergency_alerts",
            "available_orders"
        )

        subscribeToTopics(topics, onSuccess, onError)
    }

    /**
     * Subscribe to topics with error handling
     */
    suspend fun subscribeToTopics(
        topics: List<String>,
        onSuccess: (String) -> Unit = {},
        onError: (String, Exception) -> Unit = { _, _ -> }
    ) {
        topics.forEach { topic ->
            try {
                withTimeout(5.seconds) {
                    suspendCancellableCoroutine<Unit> { continuation ->
                        FirebaseMessaging.getInstance().subscribeToTopic(topic)
                            .addOnSuccessListener {
                                Log.d(TAG, "Subscribed to topic: $topic")
                                onSuccess(topic)
                                continuation.resumeWith(Result.success(Unit))
                            }
                            .addOnFailureListener { exception ->
                                Log.w(TAG, "Failed to subscribe to topic: $topic", exception)
                                onError(topic, exception)
                                continuation.resumeWith(Result.failure(exception))
                            }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Timeout or error subscribing to topic: $topic", e)
                onError(topic, e)
            }
        }
    }

    /**
     * Update driver status with topic management
     */
    suspend fun updateDriverStatus(
        status: String,
        onSuccess: () -> Unit = {},
        onError: (Exception) -> Unit = {}
    ) {
        try {
            when (status) {
                "online" -> {
                    subscribeToTopics(
                        listOf("available_orders"),
                        onSuccess = { Log.d(TAG, "Subscribed to $it for online status") }
                    )
                }

                "offline" -> {
                    unsubscribeFromTopics(
                        listOf("available_orders"),
                        onSuccess = { Log.d(TAG, "Unsubscribed from $it for offline status") }
                    )
                }

                "busy" -> {
                    // Maybe temporarily unsubscribe from new orders
                    unsubscribeFromTopics(
                        listOf("available_orders"),
                        onSuccess = { Log.d(TAG, "Unsubscribed from $it for busy status") }
                    )
                }
            }
            onSuccess()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update driver status: $status", e)
            onError(e)
        }
    }

    /**
     * Unsubscribe from topics with error handling
     */
    suspend fun unsubscribeFromTopics(
        topics: List<String>,
        onSuccess: (String) -> Unit = {},
        onError: (String, Exception) -> Unit = { _, _ -> }
    ) {
        topics.forEach { topic ->
            try {
                withTimeout(5.seconds) {
                    suspendCancellableCoroutine<Unit> { continuation ->
                        FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
                            .addOnSuccessListener {
                                Log.d(TAG, "Unsubscribed from topic: $topic")
                                onSuccess(topic)
                                continuation.resumeWith(Result.success(Unit))
                            }
                            .addOnFailureListener { exception ->
                                Log.w(TAG, "Failed to unsubscribe from topic: $topic", exception)
                                onError(topic, exception)
                                continuation.resumeWith(Result.failure(exception))
                            }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Timeout or error unsubscribing from topic: $topic", e)
                onError(topic, e)
            }
        }
    }

    private fun storeTokenLocally(context: Context, token: String) {
        try {
            val sharedPref = context.getSharedPreferences("DeliveryFCMPrefs", Context.MODE_PRIVATE)
            sharedPref.edit()
                .putString("fcm_token", token)
                .putLong("token_timestamp", System.currentTimeMillis())
                .apply()
            Log.d(TAG, "FCM token stored locally")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to store FCM token locally", e)
        }
    }

    private fun getCachedToken(context: Context): String? {
        return try {
            val sharedPref = context.getSharedPreferences("DeliveryFCMPrefs", Context.MODE_PRIVATE)
            val token = sharedPref.getString("fcm_token", null)
            val timestamp = sharedPref.getLong("token_timestamp", 0)

            // Check if token is less than 24 hours old
            if (token != null && (System.currentTimeMillis() - timestamp) < 24 * 60 * 60 * 1000) {
                Log.d(TAG, "Found valid cached FCM token")
                token
            } else {
                Log.d(TAG, "Cached FCM token is too old or missing")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get cached FCM token", e)
            null
        }
    }

    /**
     * Get current FCM token with fallback to cached token
     */
    fun getCurrentToken(context: Context): String? {
        return getCachedToken(context)
    }

    /**
     * Check if Firebase services are available
     */
    fun isFirebaseAvailable(): Boolean {
        return try {
            FirebaseMessaging.getInstance()
            true
        } catch (e: Exception) {
            Log.w(TAG, "Firebase services not available", e)
            false
        }
    }
}
