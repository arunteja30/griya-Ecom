package com.griyamart.backgroundlocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.griyamart.backgroundlocation.config.BackgroundLocationConfig
import com.griyamart.backgroundlocation.model.LocationData
import com.griyamart.backgroundlocation.model.TrackingState
import com.griyamart.backgroundlocation.model.TrackingStatus
import com.griyamart.backgroundlocation.service.BackgroundLocationService
import com.griyamart.backgroundlocation.ui.BatteryOptimizationActivity
import com.griyamart.backgroundlocation.utils.PermissionManager

/**
 * Main API class for the Background Location Library
 *
 * This is the primary interface that apps should use to integrate location tracking.
 * It provides a simple, plug-and-play solution with minimal configuration required.
 */
class BackgroundLocationManager private constructor(
    private val context: Context
) {
    companion object {
        private const val TAG = "BackgroundLocationManager"
        private const val PREFS_NAME = "background_location_prefs"
        private const val KEY_CONFIG = "config"
        private const val KEY_WAS_TRACKING = "was_tracking"
        private const val KEY_AUTO_RESTART = "auto_restart"

        @Volatile
        private var INSTANCE: BackgroundLocationManager? = null

        /**
         * Get singleton instance of the manager
         */
        fun getInstance(context: Context): BackgroundLocationManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: BackgroundLocationManager(context.applicationContext).also {
                    INSTANCE = it
                }
            }
        }
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val localBroadcastManager = LocalBroadcastManager.getInstance(context)
    private val permissionManager = PermissionManager(context)

    private var currentConfig: BackgroundLocationConfig? = null
    private var trackingState: TrackingState = TrackingState(TrackingStatus.STOPPED)

    // Listeners
    private val locationListeners = mutableSetOf<LocationListener>()
    private val statusListeners = mutableSetOf<StatusListener>()
    private val errorListeners = mutableSetOf<ErrorListener>()

    private val broadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                BackgroundLocationService.BROADCAST_LOCATION_UPDATE -> {
                    val locationData = intent.getParcelableExtra<LocationData>("location_data")
                    locationData?.let { notifyLocationListeners(it) }
                }

                BackgroundLocationService.BROADCAST_TRACKING_STATUS -> {
                    val state = intent.getParcelableExtra<TrackingState>("tracking_state")
                    state?.let {
                        trackingState = it
                        notifyStatusListeners(it)
                    }
                }

                BackgroundLocationService.BROADCAST_ERROR -> {
                    val error = intent.getStringExtra("error_message")
                    error?.let { notifyErrorListeners(it) }
                }
            }
        }
    }

    init {
        registerBroadcastReceiver()
        loadSavedConfig()
    }

    /**
     * Initialize the library with configuration
     * This should be called once during app initialization
     */
    fun initialize(config: BackgroundLocationConfig): BackgroundLocationManager {
        currentConfig = config
        saveConfig(config)

        log("Library initialized with config: ${config.networkConfig?.baseUrl}")

        return this
    }

    /**
     * Start location tracking
     * Returns true if started successfully, false if permissions are missing
     */
    fun startTracking(): Boolean {
        val config = currentConfig
            ?: throw IllegalStateException("Library not initialized. Call initialize() first.")

        log("Starting location tracking")

        // Check permissions first
        if (!permissionManager.hasAllLocationPermissions()) {
            log("Missing location permissions")
            return false
        }

        // Guide user to disable battery optimization if needed
        if (!BatteryOptimizationActivity.isIgnoringBatteryOptimizations(context)) {
            BatteryOptimizationActivity.start(context)
        }

        // Mark as tracking for auto-restart
        prefs.edit()
            .putBoolean(KEY_WAS_TRACKING, true)
            .putBoolean(KEY_AUTO_RESTART, config.autoStart)
            .apply()

        // Start the service
        BackgroundLocationService.startTracking(context, config)

        return true
    }

    /**
     * Stop location tracking
     */
    fun stopTracking() {
        log("Stopping location tracking")

        prefs.edit()
            .putBoolean(KEY_WAS_TRACKING, false)
            .apply()

        BackgroundLocationService.stopTracking(context)
    }

    /**
     * Pause location tracking (can be resumed later)
     */
    fun pauseTracking() {
        log("Pausing location tracking")
        BackgroundLocationService.pauseTracking(context)
    }

    /**
     * Resume location tracking
     */
    fun resumeTracking() {
        log("Resuming location tracking")
        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_RESUME_TRACKING
        }
        context.startService(intent)
    }

    /**
     * Check if location tracking is currently active
     */
    fun isTracking(): Boolean {
        return trackingState.status == TrackingStatus.RUNNING
    }

    /**
     * Get current tracking state
     */
    fun getTrackingState(): TrackingState = trackingState

    /**
     * Update configuration while tracking (if supported)
     */
    fun updateConfig(newConfig: BackgroundLocationConfig) {
        currentConfig = newConfig
        saveConfig(newConfig)

        val intent = Intent(context, BackgroundLocationService::class.java).apply {
            action = BackgroundLocationService.ACTION_UPDATE_CONFIG
            putExtra(BackgroundLocationService.EXTRA_CONFIG, newConfig)
        }
        context.startService(intent)
    }

    /**
     * Request location permissions
     * This should be called from an Activity
     */
    fun requestPermissions(activity: android.app.Activity, requestCode: Int = 1001) {
        permissionManager.requestLocationPermissions(activity, requestCode)
    }

    /**
     * Check if all required permissions are granted
     */
    fun hasLocationPermissions(): Boolean {
        return permissionManager.hasAllLocationPermissions()
    }

    /**
     * Check what permissions are missing
     */
    fun getMissingPermissions(): List<String> {
        return permissionManager.getMissingLocationPermissions()
    }

    /**
     * Add location update listener
     */
    fun addLocationListener(listener: LocationListener) {
        locationListeners.add(listener)
    }

    /**
     * Remove location update listener
     */
    fun removeLocationListener(listener: LocationListener) {
        locationListeners.remove(listener)
    }

    /**
     * Add status change listener
     */
    fun addStatusListener(listener: StatusListener) {
        statusListeners.add(listener)
    }

    /**
     * Remove status change listener
     */
    fun removeStatusListener(listener: StatusListener) {
        statusListeners.remove(listener)
    }

    /**
     * Add error listener
     */
    fun addErrorListener(listener: ErrorListener) {
        errorListeners.add(listener)
    }

    /**
     * Remove error listener
     */
    fun removeErrorListener(listener: ErrorListener) {
        errorListeners.remove(listener)
    }

    /**
     * Clear all listeners
     */
    fun clearAllListeners() {
        locationListeners.clear()
        statusListeners.clear()
        errorListeners.clear()
    }

    /**
     * Cleanup method - call when done with the manager
     */
    fun cleanup() {
        localBroadcastManager.unregisterReceiver(broadcastReceiver)
        clearAllListeners()
    }

    // Internal methods
    internal fun shouldRestartAfterBoot(): Boolean {
        return prefs.getBoolean(KEY_AUTO_RESTART, false) &&
                prefs.getBoolean(KEY_WAS_TRACKING, false)
    }

    internal fun restartFromBoot() {
        val config = loadSavedConfig()
        if (config != null) {
            BackgroundLocationService.startTracking(context, config)
        }
    }

    internal fun onNetworkStateChanged(isConnected: Boolean) {
        log("Network state changed: connected=$isConnected")
    }

    private fun registerBroadcastReceiver() {
        val filter = IntentFilter().apply {
            addAction(BackgroundLocationService.BROADCAST_LOCATION_UPDATE)
            addAction(BackgroundLocationService.BROADCAST_TRACKING_STATUS)
            addAction(BackgroundLocationService.BROADCAST_ERROR)
        }
        localBroadcastManager.registerReceiver(broadcastReceiver, filter)
    }

    private fun saveConfig(config: BackgroundLocationConfig) {
        prefs.edit()
            .putString(KEY_CONFIG, config.toString())
            .apply()
    }

    private fun loadSavedConfig(): BackgroundLocationConfig? {
        return currentConfig
    }

    private fun notifyLocationListeners(location: LocationData) {
        locationListeners.forEach { listener ->
            try {
                listener.onLocationUpdate(location)
            } catch (e: Exception) {
                log("Error in location listener: ${e.message}")
            }
        }
    }

    private fun notifyStatusListeners(state: TrackingState) {
        statusListeners.forEach { listener ->
            try {
                listener.onStatusChanged(state)
            } catch (e: Exception) {
                log("Error in status listener: ${e.message}")
            }
        }
    }

    private fun notifyErrorListeners(error: String) {
        errorListeners.forEach { listener ->
            try {
                listener.onError(error)
            } catch (e: Exception) {
                log("Error in error listener: ${e.message}")
            }
        }
    }

    private fun log(message: String) {
        Log.d(TAG, message)
    }

    // Listener interfaces
    interface LocationListener {
        fun onLocationUpdate(location: LocationData)
    }

    interface StatusListener {
        fun onStatusChanged(state: TrackingState)
    }

    interface ErrorListener {
        fun onError(error: String)
    }
}
