# Background Location Library - Integration Example

Here's a complete example showing how to integrate the Background Location Library into your Android
app.

## 1. Add Dependency

In your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation project(':backgroundlocationlib')
}
```

## 2. Update AndroidManifest.xml

The library automatically adds most permissions, but you should verify these are included:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## 3. Basic Implementation

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var locationManager: BackgroundLocationManager
    private val permissionRequestCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        setupLocationTracking()
        setupUI()
    }

    private fun setupLocationTracking() {
        // Get the library instance
        locationManager = BackgroundLocationManager.getInstance(this)
        
        // Create configuration
        val config = BackgroundLocationConfig(
            networkConfig = NetworkConfig(
                baseUrl = "https://your-api.example.com",
                endpoint = "/api/location",
                method = HttpMethod.POST,
                headers = mapOf(
                    "Authorization" to "Bearer your-auth-token",
                    "X-App-Version" to BuildConfig.VERSION_NAME
                ),
                enableBatching = false, // Real-time updates
                retryCount = 3
            ),
            
            locationConfig = LocationConfig(
                updateIntervalMs = 5000L,      // 5 seconds
                priority = LocationPriority.HIGH_ACCURACY,
                smallestDisplacementMeters = 10f
            ),
            
            notificationConfig = NotificationConfig(
                title = "Delivery Tracking",
                contentText = "Tracking your delivery location",
                enableActions = true
            ),
            
            payloadConfig = PayloadConfig(
                userId = getCurrentUserId(),
                deviceId = getDeviceId(),
                customFields = mapOf(
                    "driver_id" to "DRV123",
                    "vehicle_type" to "bike"
                )
            ),
            
            enableDebugLogging = BuildConfig.DEBUG
        )
        
        // Initialize the library
        locationManager.initialize(config)
        
        // Add listeners
        addLocationListeners()
    }
    
    private fun addLocationListeners() {
        // Location updates
        locationManager.addLocationListener(object : BackgroundLocationManager.LocationListener {
            override fun onLocationUpdate(location: LocationData) {
                runOnUiThread {
                    updateLocationUI(location)
                }
            }
        })
        
        // Status changes
        locationManager.addStatusListener(object : BackgroundLocationManager.StatusListener {
            override fun onStatusChanged(state: TrackingState) {
                runOnUiThread {
                    updateStatusUI(state)
                }
            }
        })
        
        // Error handling
        locationManager.addErrorListener(object : BackgroundLocationManager.ErrorListener {
            override fun onError(error: String) {
                runOnUiThread {
                    showError(error)
                }
            }
        })
    }

    private fun setupUI() {
        findViewById<Button>(R.id.btn_start_tracking).setOnClickListener {
            startLocationTracking()
        }
        
        findViewById<Button>(R.id.btn_stop_tracking).setOnClickListener {
            locationManager.stopTracking()
        }
        
        findViewById<Button>(R.id.btn_pause_tracking).setOnClickListener {
            locationManager.pauseTracking()
        }
        
        findViewById<Button>(R.id.btn_resume_tracking).setOnClickListener {
            locationManager.resumeTracking()
        }
    }
    
    private fun startLocationTracking() {
        if (locationManager.hasLocationPermissions()) {
            val success = locationManager.startTracking()
            if (success) {
                showMessage("Location tracking started")
            } else {
                showMessage("Failed to start tracking")
            }
        } else {
            requestLocationPermissions()
        }
    }
    
    private fun requestLocationPermissions() {
        locationManager.requestPermissions(this, permissionRequestCode)
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        
        if (requestCode == permissionRequestCode) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                startLocationTracking()
            } else {
                val missingPermissions = locationManager.getMissingPermissions()
                showMessage("Missing permissions: ${missingPermissions.joinToString()}")
            }
        }
    }
    
    private fun updateLocationUI(location: LocationData) {
        findViewById<TextView>(R.id.tv_latitude).text = "Lat: ${location.latitude}"
        findViewById<TextView>(R.id.tv_longitude).text = "Lng: ${location.longitude}"
        findViewById<TextView>(R.id.tv_accuracy).text = "Accuracy: ${location.accuracy}m"
        findViewById<TextView>(R.id.tv_timestamp).text = 
            "Updated: ${Date(location.timestamp)}"
    }
    
    private fun updateStatusUI(state: TrackingState) {
        val statusText = when (state.status) {
            TrackingStatus.STOPPED -> "Stopped"
            TrackingStatus.STARTING -> "Starting..."
            TrackingStatus.RUNNING -> "Running (${state.totalLocationsTracked} locations)"
            TrackingStatus.PAUSED -> "Paused"
            TrackingStatus.STOPPING -> "Stopping..."
            TrackingStatus.ERROR -> "Error: ${state.errorMessage}"
        }
        
        findViewById<TextView>(R.id.tv_status).text = statusText
    }
    
    private fun showMessage(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    private fun showError(error: String) {
        Toast.makeText(this, "Error: $error", Toast.LENGTH_LONG).show()
    }
    
    private fun getCurrentUserId(): String {
        // Return your app's current user ID
        return "user_123"
    }
    
    private fun getDeviceId(): String {
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        locationManager.cleanup()
    }
}
```

## 4. Layout Example (activity_main.xml)

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:id="@+id/tv_status"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Status: Stopped"
        android:textSize="18sp"
        android:textStyle="bold"
        android:layout_marginBottom="16dp" />

    <TextView
        android:id="@+id/tv_latitude"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Latitude: -" />

    <TextView
        android:id="@+id/tv_longitude"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Longitude: -" />

    <TextView
        android:id="@+id/tv_accuracy"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Accuracy: -" />

    <TextView
        android:id="@+id/tv_timestamp"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Last Update: -"
        android:layout_marginBottom="24dp" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal">

        <Button
            android:id="@+id/btn_start_tracking"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Start"
            android:layout_marginEnd="8dp" />

        <Button
            android:id="@+id/btn_stop_tracking"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Stop" />

    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginTop="8dp">

        <Button
            android:id="@+id/btn_pause_tracking"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Pause"
            android:layout_marginEnd="8dp" />

        <Button
            android:id="@+id/btn_resume_tracking"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Resume" />

    </LinearLayout>

</LinearLayout>
```

## 5. Advanced Configuration Examples

### Firebase Integration

```kotlin
val firebaseConfig = FirebaseConfig(
    enabled = true,
    databaseUrl = "https://your-project.firebaseio.com",
    rootPath = "driver_locations",
    userIdPath = "drivers/{userId}/current_location",
    enableRealtimeUpdates = true
)

val config = BackgroundLocationConfig(
    networkConfig = networkConfig,
    firebaseConfig = firebaseConfig,
    // ... other configs
)
```

### Batch Upload Configuration

```kotlin
val networkConfig = NetworkConfig(
    baseUrl = "https://api.example.com",
    endpoint = "/api/location/batch",
    enableBatching = true,
    batchSize = 50,  // Upload 50 locations at once
    retryCount = 3,
    retryDelayMs = 5000L
)
```

### Custom Notification

```kotlin
val notificationConfig = NotificationConfig(
    channelId = "driver_tracking",
    channelName = "Driver Location",
    title = "📍 Active Delivery",
    contentText = "Tracking location for current delivery",
    enableActions = true,
    stopActionText = "End Shift",
    pauseActionText = "Break",
    ongoing = true,
    color = ContextCompat.getColor(this, R.color.primary_color)
)
```

## 6. Error Handling

```kotlin
locationManager.addErrorListener(object : BackgroundLocationManager.ErrorListener {
    override fun onError(error: String) {
        when {
            error.contains("permission", ignoreCase = true) -> {
                // Handle permission issues
                requestLocationPermissions()
            }
            error.contains("network", ignoreCase = true) -> {
                // Handle network issues
                showRetryOption()
            }
            error.contains("location", ignoreCase = true) -> {
                // Handle GPS issues
                promptToEnableGPS()
            }
            else -> {
                // Generic error handling
                showError(error)
            }
        }
    }
})
```

## 7. Application Class Integration (Recommended)

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initializeLocationLibrary()
    }
    
    private fun initializeLocationLibrary() {
        val config = createLocationConfig()
        BackgroundLocationManager.getInstance(this).initialize(config)
    }
    
    private fun createLocationConfig(): BackgroundLocationConfig {
        // Create and return your configuration
        return BackgroundLocationConfig(
            // ... configuration
        )
    }
}
```

This comprehensive example shows how to integrate the Background Location Library into your Android
app with proper error handling, UI updates, and configuration options.
