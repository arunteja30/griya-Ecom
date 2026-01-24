# Background Location Library

A comprehensive Android library for reliable background location tracking with remote configuration
support.

## ✨ Features

- **🔄 Reliable Background Tracking**: Uses foreground service with wake locks for persistent
  location tracking
- **📡 Remote Configuration**: Support for API endpoints and Firebase with customizable payloads
- **🔋 Battery Optimization**: Handles Android's battery optimization and background limits
- **📱 Latest Android Policies**: Complies with Android 10+ background location restrictions
- **🔌 Plug-and-Play**: Easy integration with minimal configuration
- **🛡️ Permission Management**: Automatic handling of location permissions
- **📊 Upload Management**: Automatic retries, batching, and offline support
- **🔔 Smart Notifications**: Customizable foreground service notifications

## 🚀 Quick Start

### 1. Add Dependency

Add to your app's `build.gradle`:

```kotlin
dependencies {
    implementation project(':backgroundlocationlib')
    // Or when published:
    // implementation 'com.griyamart:background-location-lib:1.0.0'
}
```

### 2. Basic Implementation

```kotlin
class MyActivity : AppCompatActivity() {
    private lateinit var locationManager: BackgroundLocationManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize the library
        locationManager = BackgroundLocationManager.getInstance(this)
        
        // Configure the library
        val config = BackgroundLocationConfig(
            networkConfig = NetworkConfig(
                baseUrl = "https://your-api.com",
                endpoint = "/api/location",
                headers = mapOf("Authorization" to "Bearer your-token")
            ),
            payloadConfig = PayloadConfig(
                userId = "user123",
                deviceId = getDeviceId(),
                customFields = mapOf("app_version" to "1.0.0")
            ),
            enableDebugLogging = true
        )
        
        locationManager.initialize(config)
        
        // Add listeners
        locationManager.addLocationListener(object : BackgroundLocationManager.LocationListener {
            override fun onLocationUpdate(location: LocationData) {
                Log.d("Location", "New location: ${location.latitude}, ${location.longitude}")
            }
        })
        
        locationManager.addStatusListener(object : BackgroundLocationManager.StatusListener {
            override fun onStatusChanged(state: TrackingState) {
                Log.d("Status", "Tracking status: ${state.status}")
            }
        })
    }
    
    private fun startTracking() {
        if (locationManager.hasLocationPermissions()) {
            locationManager.startTracking()
        } else {
            locationManager.requestPermissions(this)
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == 1001 && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            locationManager.startTracking()
        }
    }
}
```

## ⚙️ Configuration

### Network Configuration

```kotlin
val networkConfig = NetworkConfig(
    baseUrl = "https://your-api.com",
    endpoint = "/api/location",
    method = HttpMethod.POST,
    headers = mapOf(
        "Authorization" to "Bearer your-token",
        "Content-Type" to "application/json"
    ),
    timeoutMs = 30000L,
    retryCount = 3,
    retryDelayMs = 5000L,
    enableBatching = true,
    batchSize = 50
)
```

### Location Configuration

```kotlin
val locationConfig = LocationConfig(
    updateIntervalMs = 5000L,           // 5 seconds
    fastestIntervalMs = 2000L,          // 2 seconds  
    smallestDisplacementMeters = 10f,   // 10 meters
    priority = LocationPriority.HIGH_ACCURACY,
    enableBackgroundUpdates = true
)
```

### Firebase Configuration (Optional)

```kotlin
val firebaseConfig = FirebaseConfig(
    enabled = true,
    databaseUrl = "https://your-project.firebaseio.com",
    rootPath = "locations",
    userIdPath = "drivers/{userId}/location",
    enableRealtimeUpdates = true
)
```

### Notification Configuration

```kotlin
val notificationConfig = NotificationConfig(
    channelId = "location_tracking",
    channelName = "Location Tracking", 
    title = "Tracking Location",
    contentText = "Your location is being tracked",
    enableActions = true,
    smallIcon = "ic_location_tracking"
)
```

## 🔧 Advanced Usage

### Custom Payload Fields

```kotlin
val payloadConfig = PayloadConfig(
    userId = getCurrentUserId(),
    deviceId = getUniqueDeviceId(),
    sessionId = generateSessionId(),
    customFields = mapOf(
        "app_version" to BuildConfig.VERSION_NAME,
        "user_type" to "driver",
        "vehicle_id" to "ABC123"
    )
)
```

### Handling Different HTTP Methods

```kotlin
// POST (default)
NetworkConfig(baseUrl = "https://api.com", method = HttpMethod.POST)

// PUT for updates  
NetworkConfig(baseUrl = "https://api.com", method = HttpMethod.PUT)

// PATCH for partial updates
NetworkConfig(baseUrl = "https://api.com", method = HttpMethod.PATCH)
```

### Batch Uploads

```kotlin
val config = NetworkConfig(
    baseUrl = "https://your-api.com",
    enableBatching = true,
    batchSize = 100,        // Send 100 locations at once
    endpoint = "/api/batch"  // Different endpoint for batches
)
```

## 📱 API Reference

### BackgroundLocationManager

| Method                          | Description                   |
|---------------------------------|-------------------------------|
| `getInstance(context)`          | Get singleton instance        |
| `initialize(config)`            | Initialize with configuration |
| `startTracking()`               | Start location tracking       |
| `stopTracking()`                | Stop location tracking        |
| `pauseTracking()`               | Pause tracking (can resume)   |
| `resumeTracking()`              | Resume paused tracking        |
| `isTracking()`                  | Check if currently tracking   |
| `getTrackingState()`            | Get current tracking state    |
| `updateConfig(config)`          | Update configuration          |
| `hasLocationPermissions()`      | Check if permissions granted  |
| `requestPermissions(activity)`  | Request permissions           |
| `addLocationListener(listener)` | Add location update listener  |
| `addStatusListener(listener)`   | Add status change listener    |
| `cleanup()`                     | Cleanup when done             |

### Data Models

#### LocationData

```kotlin
data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long,
    val accuracy: Float?,
    val speed: Float?,
    val bearing: Float?,
    val altitude: Double?,
    val provider: String?,
    val deviceId: String?,
    val userId: String?,
    val sessionId: String?,
    val customFields: Map<String, String>?
)
```

#### TrackingState

```kotlin
data class TrackingState(
    val status: TrackingStatus,
    val lastLocationTime: Long?,
    val totalLocationsTracked: Int,
    val sessionStartTime: Long?,
    val errorMessage: String?
)
```

## 🛠️ Integration Steps

### 1. Add to settings.gradle.kts

```kotlin
include(":backgroundlocationlib")
```

### 2. Add to app/build.gradle.kts

```kotlin
dependencies {
    implementation project(':backgroundlocationlib')
}
```

### 3. Update AndroidManifest.xml

The library automatically adds required permissions and services, but you may want to add:

```xml
<!-- Optional: Custom notification icon -->
<application>
    <meta-data
        android:name="com.griyamart.backgroundlocation.notification_icon"
        android:resource="@drawable/ic_your_custom_icon" />
</application>
```

### 4. Initialize in Application class (Recommended)

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize location manager
        val config = createLocationConfig()
        BackgroundLocationManager.getInstance(this).initialize(config)
    }
}
```

## 🔒 Permissions

The library handles these permissions automatically:

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION` (Android 10+)
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS` (Android 13+)

## 🔋 Battery Optimization

The library automatically:

- Guides users to disable battery optimization
- Uses wake locks to prevent CPU sleep
- Implements START_STICKY for service restart
- Handles app removal from recent apps

## 📊 Upload Behavior

### Single Location Upload (Real-time)

- Immediate upload after each location update
- Suitable for real-time tracking applications
- Higher network usage

### Batch Upload (Efficient)

- Collects locations and uploads in batches
- Configurable batch size and upload interval
- Lower network usage, better battery life

### Error Handling

- Automatic retries with exponential backoff
- Offline queue for when network is unavailable
- Detailed error reporting through listeners

## 🚨 Troubleshooting

### Location Not Updating

1. Check if all permissions are granted
2. Verify location services are enabled
3. Check if battery optimization is disabled
4. Ensure device has GPS signal

### Upload Failures

1. Verify network connectivity
2. Check API endpoint and credentials
3. Review server response format
4. Check firewall/proxy settings

### High Battery Usage

1. Increase update intervals
2. Enable batching
3. Use balanced power accuracy
4. Implement geofencing for start/stop

## 📄 License

This library is part of the GriyaMart project.

## 🤝 Support

For issues and support, contact the GriyaMart development team.
