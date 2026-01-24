package com.griyamart.backgroundlocation.service

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.griyamart.backgroundlocation.config.BackgroundLocationConfig
import com.griyamart.backgroundlocation.config.LocationConfig
import com.griyamart.backgroundlocation.config.LocationPriority
import com.griyamart.backgroundlocation.config.NotificationConfig
import com.griyamart.backgroundlocation.model.LocationData
import com.griyamart.backgroundlocation.model.TrackingState
import com.griyamart.backgroundlocation.model.TrackingStatus
import com.griyamart.backgroundlocation.utils.LocationUploadManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

class BackgroundLocationService : Service() {

    companion object {
        private const val TAG = "BackgroundLocationService"

        const val ACTION_START_TRACKING = "START_TRACKING"
        const val ACTION_STOP_TRACKING = "STOP_TRACKING"
        const val ACTION_PAUSE_TRACKING = "PAUSE_TRACKING"
        const val ACTION_RESUME_TRACKING = "RESUME_TRACKING"
        const val ACTION_UPDATE_CONFIG = "UPDATE_CONFIG"

        const val EXTRA_CONFIG = "config"

        const val BROADCAST_LOCATION_UPDATE = "location_update"
        const val BROADCAST_TRACKING_STATUS = "tracking_status"
        const val BROADCAST_ERROR = "error"

        fun startTracking(context: Context, config: BackgroundLocationConfig) {
            val intent = Intent(context, BackgroundLocationService::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra(EXTRA_CONFIG, config)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopTracking(context: Context) {
            val intent = Intent(context, BackgroundLocationService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }

        fun pauseTracking(context: Context) {
            val intent = Intent(context, BackgroundLocationService::class.java).apply {
                action = ACTION_PAUSE_TRACKING
            }
            context.startService(intent)
        }
    }

    private val binder = LocationServiceBinder()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var notificationManager: NotificationManager
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private lateinit var locationCallback: LocationCallback
    private lateinit var wakeLock: PowerManager.WakeLock

    private var config: BackgroundLocationConfig? = null
    private var trackingState = TrackingState(TrackingStatus.STOPPED)
    private var sessionId: String? = null

    private val locationQueue = ConcurrentLinkedQueue<LocationData>()
    private var lastLocationUpdate = 0L
    private var totalLocationsTracked = 0

    private var uploadManager: LocationUploadManager? = null

    inner class LocationServiceBinder : Binder() {
        fun getService(): BackgroundLocationService = this@BackgroundLocationService
    }

    override fun onCreate() {
        super.onCreate()
        log("Service created")

        initializeComponents()
        createLocationCallback()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        log("onStartCommand: ${intent?.action}")

        when (intent?.action) {
            ACTION_START_TRACKING -> {
                val newConfig = intent.getParcelableExtra<BackgroundLocationConfig>(EXTRA_CONFIG)
                if (newConfig != null) {
                    handleStartTracking(newConfig)
                }
            }

            ACTION_STOP_TRACKING -> handleStopTracking()
            ACTION_PAUSE_TRACKING -> handlePauseTracking()
            ACTION_RESUME_TRACKING -> handleResumeTracking()
            ACTION_UPDATE_CONFIG -> {
                val newConfig = intent.getParcelableExtra<BackgroundLocationConfig>(EXTRA_CONFIG)
                if (newConfig != null) {
                    handleUpdateConfig(newConfig)
                }
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        log("Service destroyed")
        stopLocationUpdates()
        releaseWakeLock()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun initializeComponents() {
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "$TAG::LocationTracking"
        )
    }

    private fun createLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                super.onLocationResult(locationResult)

                locationResult.locations.forEach { location ->
                    handleLocationUpdate(location)
                }
            }

            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                super.onLocationAvailability(locationAvailability)
                log("Location availability: ${locationAvailability.isLocationAvailable}")

                if (!locationAvailability.isLocationAvailable) {
                    updateTrackingState(
                        trackingState.copy(
                            status = TrackingStatus.ERROR,
                            errorMessage = "Location services unavailable"
                        )
                    )
                }
            }
        }
    }

    private fun handleStartTracking(newConfig: BackgroundLocationConfig) {
        log("Starting location tracking")

        config = newConfig
        sessionId = UUID.randomUUID().toString()

        uploadManager = LocationUploadManager(newConfig, serviceScope)

        createLocationRequest()
        startForegroundService()
        startLocationUpdates()

        updateTrackingState(
            TrackingState(
                status = TrackingStatus.RUNNING,
                sessionStartTime = System.currentTimeMillis(),
                totalLocationsTracked = 0
            )
        )
    }

    private fun handleStopTracking() {
        log("Stopping location tracking")

        stopLocationUpdates()
        uploadManager?.uploadPendingLocations()

        updateTrackingState(TrackingState(TrackingStatus.STOPPED))

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun handlePauseTracking() {
        log("Pausing location tracking")

        stopLocationUpdates()
        updateTrackingState(trackingState.copy(status = TrackingStatus.PAUSED))
        updateNotification()
    }

    private fun handleResumeTracking() {
        log("Resuming location tracking")

        startLocationUpdates()
        updateTrackingState(trackingState.copy(status = TrackingStatus.RUNNING))
        updateNotification()
    }

    private fun handleUpdateConfig(newConfig: BackgroundLocationConfig) {
        log("Updating configuration")

        val wasRunning = trackingState.status == TrackingStatus.RUNNING

        if (wasRunning) {
            stopLocationUpdates()
        }

        config = newConfig
        createLocationRequest()
        uploadManager?.updateConfig(newConfig)

        if (wasRunning) {
            startLocationUpdates()
        }

        updateNotification()
    }

    private fun createLocationRequest() {
        val priority = when (config?.locationConfig?.priority) {
            LocationPriority.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
            LocationPriority.BALANCED_POWER_ACCURACY -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
            LocationPriority.LOW_POWER -> Priority.PRIORITY_LOW_POWER
            LocationPriority.NO_POWER -> Priority.PRIORITY_PASSIVE
            else -> Priority.PRIORITY_HIGH_ACCURACY
        }

        val locationConfig = config?.locationConfig ?: LocationConfig()

        locationRequest = LocationRequest.Builder(priority, locationConfig.updateIntervalMs)
            .setMinUpdateIntervalMillis(locationConfig.fastestIntervalMs)
            .setMinUpdateDistanceMeters(locationConfig.smallestDisplacementMeters)
            .setMaxUpdateDelayMillis(locationConfig.maxWaitTimeMs)
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        if (!hasLocationPermissions()) {
            log("Missing location permissions")
            updateTrackingState(
                trackingState.copy(
                    status = TrackingStatus.ERROR,
                    errorMessage = "Missing location permissions"
                )
            )
            return
        }

        acquireWakeLock()

        try {
            updateTrackingState(trackingState.copy(status = TrackingStatus.STARTING))

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            ).addOnSuccessListener {
                log("Location updates started successfully")
                updateTrackingState(trackingState.copy(status = TrackingStatus.RUNNING))
            }.addOnFailureListener { error ->
                log("Failed to start location updates: ${error.message}")
                updateTrackingState(
                    trackingState.copy(
                        status = TrackingStatus.ERROR,
                        errorMessage = error.message
                    )
                )
            }
        } catch (e: Exception) {
            log("Exception starting location updates: ${e.message}")
            updateTrackingState(
                trackingState.copy(
                    status = TrackingStatus.ERROR,
                    errorMessage = e.message
                )
            )
        }
    }

    private fun stopLocationUpdates() {
        log("Stopping location updates")

        try {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        } catch (e: Exception) {
            log("Error stopping location updates: ${e.message}")
        }

        releaseWakeLock()
    }

    private fun handleLocationUpdate(location: Location) {
        log("Location update: ${location.latitude}, ${location.longitude}")

        val currentTime = System.currentTimeMillis()
        lastLocationUpdate = currentTime
        totalLocationsTracked++

        val locationData = LocationData.fromLocation(
            location = location,
            deviceId = config?.payloadConfig?.deviceId,
            userId = config?.payloadConfig?.userId,
            sessionId = sessionId,
            customFields = config?.payloadConfig?.customFields
        )

        uploadManager?.queueLocation(locationData)

        updateTrackingState(
            trackingState.copy(
                lastLocationTime = currentTime,
                totalLocationsTracked = totalLocationsTracked
            )
        )

        updateNotification()
        broadcastLocationUpdate(locationData)
    }

    private fun startForegroundService() {
        val notification = createNotification()
        startForeground(config?.notificationConfig?.notificationId ?: 2001, notification)
        log("Foreground service started")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationConfig = config?.notificationConfig ?: NotificationConfig()

            val channel = NotificationChannel(
                notificationConfig.channelId,
                notificationConfig.channelName,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = notificationConfig.channelDescription
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
            }

            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val notificationConfig = config?.notificationConfig ?: NotificationConfig()

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(this, notificationConfig.channelId)
            .setContentTitle(notificationConfig.title)
            .setContentText(getNotificationText())
            .setOngoing(notificationConfig.ongoing)
            .setAutoCancel(notificationConfig.autoCancel)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)

        notificationConfig.color?.let { color ->
            builder.setColor(color)
        }

        if (notificationConfig.enableActions) {
            addNotificationActions(builder, notificationConfig)
        }

        return builder.build()
    }

    private fun addNotificationActions(
        builder: NotificationCompat.Builder,
        notificationConfig: NotificationConfig
    ) {
        val stopIntent = Intent(this, BackgroundLocationService::class.java).apply {
            action = ACTION_STOP_TRACKING
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            notificationConfig.stopActionText,
            stopPendingIntent
        )
    }

    private fun updateNotification() {
        val notification = createNotification()
        notificationManager.notify(
            config?.notificationConfig?.notificationId ?: 2001,
            notification
        )
    }

    private fun getNotificationText(): String {
        return when (trackingState.status) {
            TrackingStatus.RUNNING -> {
                val count = trackingState.totalLocationsTracked
                "Tracking active • $count locations"
            }

            TrackingStatus.PAUSED -> "Tracking paused"
            TrackingStatus.STARTING -> "Starting location tracking..."
            TrackingStatus.STOPPING -> "Stopping location tracking..."
            TrackingStatus.ERROR -> "Error: ${trackingState.errorMessage}"
            TrackingStatus.STOPPED -> "Location tracking stopped"
        }
    }

    private fun hasLocationPermissions(): Boolean {
        val fineLocation = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseLocation = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return fineLocation && coarseLocation
    }

    private fun acquireWakeLock() {
        if (!wakeLock.isHeld) {
            wakeLock.acquire(10 * 60 * 1000L)
            log("Wake lock acquired")
        }
    }

    private fun releaseWakeLock() {
        if (wakeLock.isHeld) {
            wakeLock.release()
            log("Wake lock released")
        }
    }

    private fun updateTrackingState(newState: TrackingState) {
        trackingState = newState
        broadcastTrackingStatus(newState)
    }

    private fun broadcastLocationUpdate(locationData: LocationData) {
        val intent = Intent(BROADCAST_LOCATION_UPDATE).apply {
            putExtra("location_data", locationData)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun broadcastTrackingStatus(state: TrackingState) {
        val intent = Intent(BROADCAST_TRACKING_STATUS).apply {
            putExtra("tracking_state", state)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun broadcastError(error: String) {
        val intent = Intent(BROADCAST_ERROR).apply {
            putExtra("error_message", error)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun log(message: String) {
        if (config?.enableDebugLogging == true) {
            Log.d(TAG, message)
        }
    }

    fun getCurrentState(): TrackingState = trackingState
    fun getConfiguration(): BackgroundLocationConfig? = config
    fun getTotalLocationsTracked(): Int = totalLocationsTracked
}

