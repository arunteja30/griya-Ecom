package com.griyamart.backgroundlocation.config

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

/**
 * Configuration for location tracking behavior
 */
@Parcelize
data class LocationConfig(
    val updateIntervalMs: Long = 5000L, // 5 seconds
    val fastestIntervalMs: Long = 2000L, // 2 seconds
    val smallestDisplacementMeters: Float = 10f, // 10 meters
    val priority: LocationPriority = LocationPriority.HIGH_ACCURACY,
    val maxWaitTimeMs: Long = 10000L, // 10 seconds
    val enableBatching: Boolean = false,
    val enableHighAccuracy: Boolean = true,
    val enableBackgroundUpdates: Boolean = true
) : Parcelable

/**
 * Location priority levels
 */
enum class LocationPriority {
    HIGH_ACCURACY,
    BALANCED_POWER_ACCURACY,
    LOW_POWER,
    NO_POWER
}

/**
 * Network configuration for uploading location data
 */
@Parcelize
data class NetworkConfig(
    val baseUrl: String,
    val endpoint: String = "/api/location",
    val method: HttpMethod = HttpMethod.POST,
    val headers: Map<String, String> = emptyMap(),
    val timeoutMs: Long = 30000L, // 30 seconds
    val retryCount: Int = 3,
    val retryDelayMs: Long = 5000L, // 5 seconds
    val batchSize: Int = 50, // Upload 50 locations at once when batching
    val enableBatching: Boolean = false
) : Parcelable

/**
 * HTTP methods supported
 */
enum class HttpMethod {
    POST, PUT, PATCH
}

/**
 * Firebase configuration (optional)
 */
@Parcelize
data class FirebaseConfig(
    val enabled: Boolean = false,
    val databaseUrl: String? = null,
    val rootPath: String = "locations",
    val userIdPath: String? = null, // e.g., "drivers/{userId}/location"
    val enableRealtimeUpdates: Boolean = true
) : Parcelable

/**
 * Notification configuration
 */
@Parcelize
data class NotificationConfig(
    val channelId: String = "background_location_tracking",
    val channelName: String = "Location Tracking",
    val channelDescription: String = "Tracks your location in the background",
    val notificationId: Int = 2001,
    val title: String = "Location Tracking Active",
    val contentText: String = "Your location is being tracked",
    val enableActions: Boolean = true,
    val stopActionText: String = "Stop Tracking",
    val pauseActionText: String = "Pause Tracking",
    val smallIcon: String? = null, // Resource name without extension
    val color: Int? = null,
    val ongoing: Boolean = true,
    val autoCancel: Boolean = false
) : Parcelable

/**
 * Data payload configuration
 */
@Parcelize
data class PayloadConfig(
    val includeTimestamp: Boolean = true,
    val includeAccuracy: Boolean = true,
    val includeSpeed: Boolean = true,
    val includeBearing: Boolean = true,
    val includeAltitude: Boolean = true,
    val includeProvider: Boolean = true,
    val customFields: Map<String, String> = emptyMap(), // Additional custom fields
    val deviceId: String? = null,
    val userId: String? = null,
    val sessionId: String? = null
) : Parcelable

/**
 * Complete library configuration
 */
@Parcelize
data class BackgroundLocationConfig(
    val locationConfig: LocationConfig? = LocationConfig(),
    val networkConfig: NetworkConfig?,
    val firebaseConfig: FirebaseConfig = FirebaseConfig(),
    val notificationConfig: NotificationConfig = NotificationConfig(),
    val payloadConfig: PayloadConfig = PayloadConfig(),
    val enableDebugLogging: Boolean = false,
    val autoStart: Boolean = false,
    val stopOnAppKill: Boolean = false
) : Parcelable
