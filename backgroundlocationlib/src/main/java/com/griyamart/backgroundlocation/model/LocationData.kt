package com.griyamart.backgroundlocation.model

import android.location.Location
import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

/**
 * Location data model for transmission
 */
@Parcelize
data class LocationData(
    @SerializedName("latitude")
    val latitude: Double,

    @SerializedName("longitude")
    val longitude: Double,

    @SerializedName("timestamp")
    val timestamp: Long,

    @SerializedName("accuracy")
    val accuracy: Float? = null,

    @SerializedName("speed")
    val speed: Float? = null,

    @SerializedName("bearing")
    val bearing: Float? = null,

    @SerializedName("altitude")
    val altitude: Double? = null,

    @SerializedName("provider")
    val provider: String? = null,

    @SerializedName("device_id")
    val deviceId: String? = null,

    @SerializedName("user_id")
    val userId: String? = null,

    @SerializedName("session_id")
    val sessionId: String? = null,

    @SerializedName("custom_fields")
    val customFields: Map<String, String>? = null
) : Parcelable {

    companion object {
        /**
         * Convert Android Location object to LocationData
         */
        fun fromLocation(
            location: Location,
            deviceId: String? = null,
            userId: String? = null,
            sessionId: String? = null,
            customFields: Map<String, String>? = null
        ): LocationData {
            return LocationData(
                latitude = location.latitude,
                longitude = location.longitude,
                timestamp = location.time,
                accuracy = if (location.hasAccuracy()) location.accuracy else null,
                speed = if (location.hasSpeed()) location.speed else null,
                bearing = if (location.hasBearing()) location.bearing else null,
                altitude = if (location.hasAltitude()) location.altitude else null,
                provider = location.provider,
                deviceId = deviceId,
                userId = userId,
                sessionId = sessionId,
                customFields = customFields
            )
        }
    }
}

/**
 * Batch location upload payload
 */
@Parcelize
data class LocationBatch(
    @SerializedName("locations")
    val locations: List<LocationData>,

    @SerializedName("batch_id")
    val batchId: String,

    @SerializedName("batch_timestamp")
    val batchTimestamp: Long = System.currentTimeMillis(),

    @SerializedName("device_id")
    val deviceId: String? = null,

    @SerializedName("user_id")
    val userId: String? = null
) : Parcelable

/**
 * Location upload response
 */
data class LocationResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("message")
    val message: String? = null,

    @SerializedName("processed_count")
    val processedCount: Int? = null,

    @SerializedName("errors")
    val errors: List<String>? = null
)

/**
 * Location tracking status
 */
enum class TrackingStatus {
    STOPPED,
    STARTING,
    RUNNING,
    PAUSED,
    STOPPING,
    ERROR
}

/**
 * Location tracking state
 */
@Parcelize
data class TrackingState(
    val status: TrackingStatus,
    val lastLocationTime: Long? = null,
    val totalLocationsTracked: Int = 0,
    val sessionStartTime: Long? = null,
    val errorMessage: String? = null
) : Parcelable
