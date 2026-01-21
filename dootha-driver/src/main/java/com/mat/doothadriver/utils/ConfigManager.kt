package com.mat.doothadriver.utils

import android.util.Log
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.timeout
import kotlin.time.Duration.Companion.seconds

/**
 * Centralized configuration manager for Firebase-based app configurations
 */
object ConfigManager {
    private const val TAG = "ConfigManager"

    /**
     * App configuration paths in Firebase Realtime Database
     */
    object Paths {
        const val DOOTHA_DRIVER_WEB_URL = "appConfig/doothaDriver/webViewUrl"
        const val DOOTHA_CUSTOMER_WEB_URL = "appConfig/dootha/webViewUrl"
    }

    /**
     * Default fallback URLs
     */
    object Defaults {
        const val DOOTHA_DRIVER_URL = "https://dootha-driver.onrender.com"
        const val DOOTHA_CUSTOMER_URL = "https://dootha.onrender.com"
    }

    /**
     * Fetches configuration value from Firebase with timeout and fallback
     */
    suspend fun getConfigValue(path: String, fallback: String, timeoutSeconds: Long = 5): String {
        return try {
            getConfigFlow(path)
                .timeout(timeoutSeconds.seconds)
                .first()
                .takeIf { it.isNotEmpty() } ?: fallback
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch config for path: $path, using fallback: $fallback", e)
            fallback
        }
    }

    /**
     * Creates a Flow that listens to Firebase config changes
     */
    fun getConfigFlow(path: String): Flow<String> = callbackFlow {
        val database = FirebaseDatabase.getInstance().reference
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val value = snapshot.getValue(String::class.java) ?: ""
                Log.d(TAG, "Config updated for $path: $value")
                trySend(value)
            }

            override fun onCancelled(error: DatabaseError) {
                Log.e(TAG, "Firebase config read cancelled for $path", error.toException())
                close(error.toException())
            }
        }

        database.child(path).addValueEventListener(listener)

        awaitClose {
            database.child(path).removeEventListener(listener)
        }
    }.catch { e ->
        Log.e(TAG, "Error in config flow for $path", e)
        emit("")
    }

    /**
     * App-specific convenience methods
     */
    suspend fun getDoothaDriverWebUrl(): String =
        getConfigValue(Paths.DOOTHA_DRIVER_WEB_URL, Defaults.DOOTHA_DRIVER_URL)

    suspend fun getDoothaCustomerWebUrl(): String =
        getConfigValue(Paths.DOOTHA_CUSTOMER_WEB_URL, Defaults.DOOTHA_CUSTOMER_URL)
}
