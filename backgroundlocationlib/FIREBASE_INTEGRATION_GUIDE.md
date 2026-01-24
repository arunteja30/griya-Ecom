# 🔥 Firebase Realtime Database Integration Guide

## 📋 **Firebase RTDB Support - Already Built-In!**

The Background Location Library includes **complete Firebase Realtime Database integration**. Here's
how to set it up and use it:

## 🚀 **Quick Setup for Firebase RTDB**

### **1. Enable Firebase in Your App**

First, make sure your app has Firebase configured. In your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation project(':backgroundlocationlib')
    
    // Add Firebase dependencies to your main app
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-database-ktx'
    implementation 'com.google.firebase:firebase-analytics-ktx'
}
```

### **2. Configure Firebase RTDB in Library**

```kotlin
val config = BackgroundLocationConfig(
    networkConfig = NetworkConfig(
        baseUrl = "https://your-api.com", // Can still use API as backup
        endpoint = "/api/location"
    ),
    
    // 🔥 Firebase Configuration
    firebaseConfig = FirebaseConfig(
        enabled = true,
        databaseUrl = "https://your-project-default-rtdb.firebaseio.com", // Optional: custom DB URL
        rootPath = "driver_locations",              // Root path in RTDB
        userIdPath = "drivers/{userId}/location",   // Dynamic path with user ID
        enableRealtimeUpdates = true                // Update 'current' location in real-time
    ),
    
    payloadConfig = PayloadConfig(
        userId = "driver_123",
        deviceId = getDeviceId(),
        customFields = mapOf(
            "driver_name" to "John Doe",
            "vehicle_type" to "motorcycle"
        )
    ),
    
    enableDebugLogging = true
)

// Initialize and start tracking
val locationManager = BackgroundLocationManager.getInstance(this)
locationManager.initialize(config)
locationManager.startTracking()
```

## 📊 **Firebase Database Structure**

When configured as above, your Firebase RTDB will have this structure:

```json
{
  "driver_locations": {
    "drivers": {
      "driver_123": {
        "location": {
          "current": {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "timestamp": 1642809600000,
            "accuracy": 3.5,
            "speed": 5.2,
            "bearing": 45.0,
            "altitude": 10.0,
            "provider": "fused",
            "device_id": "abc123",
            "user_id": "driver_123",
            "session_id": "session456",
            "custom_fields": {
              "driver_name": "John Doe",
              "vehicle_type": "motorcycle"
            }
          },
          "history": {
            "1642809600000": { /* location object */ },
            "1642809605000": { /* location object */ },
            "1642809610000": { /* location object */ }
          }
        }
      }
    }
  }
}
```

## 🔧 **Configuration Options**

### **Basic Firebase Setup**

```kotlin
val firebaseConfig = FirebaseConfig(
    enabled = true,
    enableRealtimeUpdates = true
)
```

### **Custom Database URL**

```kotlin
val firebaseConfig = FirebaseConfig(
    enabled = true,
    databaseUrl = "https://your-project-rtdb-asia.firebaseio.com", // Regional DB
    rootPath = "live_tracking",
    enableRealtimeUpdates = true
)
```

### **Dynamic User Paths**

```kotlin
val firebaseConfig = FirebaseConfig(
    enabled = true,
    rootPath = "locations",
    userIdPath = "users/{userId}/current_location",  // Will replace {userId}
    enableRealtimeUpdates = true
)

// With userId = "driver_456", data goes to:
// /locations/users/driver_456/current_location/
```

### **Different Path Structures**

#### **Option 1: Simple Structure**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "locations",
    userIdPath = null  // Goes to /locations/user_id/
)
```

#### **Option 2: Organized by Type**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "tracking",
    userIdPath = "drivers/{userId}/location"  // /tracking/drivers/user_id/location/
)
```

#### **Option 3: Date-based Organization**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "daily_tracking",
    userIdPath = "{date}/drivers/{userId}"  // Could be enhanced to support date
)
```

## 📡 **Dual Upload: Firebase + API**

The library supports **simultaneous uploads** to both Firebase RTDB and your API:

```kotlin
val config = BackgroundLocationConfig(
    // API Upload
    networkConfig = NetworkConfig(
        baseUrl = "https://your-api.com",
        endpoint = "/api/location",
        enableBatching = false  // Real-time to API
    ),
    
    // Firebase Upload (Simultaneous)
    firebaseConfig = FirebaseConfig(
        enabled = true,
        enableRealtimeUpdates = true
    ),
    
    // Both will receive the same location data!
)
```

## 🔄 **Firebase-Only Mode**

To use **only Firebase RTDB** without API uploads:

```kotlin
val config = BackgroundLocationConfig(
    networkConfig = NetworkConfig(
        baseUrl = "https://unused.com",  // Won't be used
        endpoint = "/unused"
    ),
    
    firebaseConfig = FirebaseConfig(
        enabled = true,
        rootPath = "driver_locations",
        userIdPath = "active/{userId}",
        enableRealtimeUpdates = true
    )
)
```

## 📱 **Real-time Location Monitoring**

### **Listen to Firebase Changes in Your App**

```kotlin
// In your monitoring/admin app
val database = FirebaseDatabase.getInstance()
val driversRef = database.getReference("driver_locations/drivers")

// Listen to all active drivers
driversRef.addValueEventListener(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        for (driverSnapshot in snapshot.children) {
            val driverId = driverSnapshot.key
            val currentLocation = driverSnapshot.child("location/current").getValue<LocationData>()
            
            // Update your map/UI with driver location
            updateDriverOnMap(driverId, currentLocation)
        }
    }
    
    override fun onCancelled(error: DatabaseError) {
        Log.e("Firebase", "Error: ${error.message}")
    }
})

// Listen to specific driver
val specificDriverRef = driversRef.child("driver_123/location/current")
specificDriverRef.addValueEventListener(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        val location = snapshot.getValue<LocationData>()
        location?.let { updateSingleDriver(it) }
    }
    
    override fun onCancelled(error: DatabaseError) {
        Log.e("Firebase", "Error: ${error.message}")
    }
})
```

### **Query Location History**

```kotlin
// Get last 10 locations for a driver
val historyRef = database.getReference("driver_locations/drivers/driver_123/location/history")
    .orderByKey()
    .limitToLast(10)

historyRef.addListenerForSingleValueEvent(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        val locations = mutableListOf<LocationData>()
        for (locationSnapshot in snapshot.children) {
            locationSnapshot.getValue<LocationData>()?.let { locations.add(it) }
        }
        
        // Use location history for route tracking
        drawRouteOnMap(locations)
    }
    
    override fun onCancelled(error: DatabaseError) {
        Log.e("Firebase", "Error: ${error.message}")
    }
})
```

## 🔐 **Firebase Security Rules**

Add these rules to your Firebase RTDB to secure driver locations:

```json
{
  "rules": {
    "driver_locations": {
      "drivers": {
        "$driverId": {
          "location": {
            ".write": "$driverId == auth.uid",
            ".read": "auth != null"
          }
        }
      }
    },
    ".read": false,
    ".write": false
  }
}
```

## 🎯 **Use Cases**

### **1. Food Delivery App**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "delivery_tracking",
    userIdPath = "orders/{orderId}/driver_location",
    enableRealtimeUpdates = true
)
// Path: /delivery_tracking/orders/ORDER123/driver_location/current
```

### **2. Ride-sharing App**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "rides",
    userIdPath = "active/{userId}/location",
    enableRealtimeUpdates = true
)
// Path: /rides/active/DRIVER456/location/current
```

### **3. Fleet Management**

```kotlin
FirebaseConfig(
    enabled = true,
    rootPath = "fleet",
    userIdPath = "vehicles/{vehicleId}/gps",
    enableRealtimeUpdates = true
)
// Path: /fleet/vehicles/TRUCK789/gps/current
```

## ⚡ **Performance Features**

### **Automatic Cleanup**

The library automatically manages Firebase uploads with:

- ✅ **Connection Management**: Handles network disconnections
- ✅ **Offline Queueing**: Stores locations when offline, uploads when online
- ✅ **Error Retry**: Retries failed Firebase uploads
- ✅ **Memory Management**: Efficient data structure usage

### **Optimized Updates**

- ✅ **Real-time Current Location**: Always updates `/current` path
- ✅ **Historical Tracking**: Stores in `/history` with timestamps
- ✅ **Batch Operations**: Uses Firebase's updateChildren() for efficiency
- ✅ **Minimal Bandwidth**: Only sends changed data

## 🎉 **Ready to Use!**

The Firebase RTDB integration is **already implemented** in the Background Location Library. Just:

1. **Add Firebase to your app** (google-services.json, dependencies)
2. **Configure FirebaseConfig** in your BackgroundLocationConfig
3. **Start tracking** - data flows automatically to Firebase!

No additional code needed - it's all built-in! 🚀

## 🔗 **What's Already Implemented**

- ✅ **Automatic Firebase uploads** alongside API uploads
- ✅ **Real-time current location** updates
- ✅ **Historical location storage** with timestamps
- ✅ **Dynamic path generation** with user ID replacement
- ✅ **Batch upload support** for efficiency
- ✅ **Error handling and retries** for Firebase operations
- ✅ **Offline queueing** until Firebase is available

Your Background Location Library is **Firebase-ready out of the box**! 🔥
