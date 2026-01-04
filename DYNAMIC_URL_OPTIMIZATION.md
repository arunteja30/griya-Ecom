# Dynamic URL Loading Optimization - Implementation Summary

## Overview

Reimplement dynamic URL loading logic with optimized code across all 3 apps (Customer, Seller,
Delivery) to fix race conditions, improve performance, and eliminate redundant code.

## Problems Addressed

### Original Issues:

1. **Race Conditions**: Firebase fetch competing with WebView initialization
2. **Inefficient State Management**: Manual state tracking and complex callback handling
3. **Redundant Code**: Duplicated Firebase logic across all apps
4. **Poor Error Handling**: Inconsistent timeout and fallback mechanisms
5. **Loading UX**: No proper loading states during config fetch

## Solution Architecture

### 1. Centralized Configuration Manager

Created `ConfigManager.kt` in each app's utils package with:

```kotlin
object ConfigManager {
    // Centralized Firebase paths
    object Paths {
        const val CUSTOMER_WEB_URL = "appConfig/customer/webViewUrl"
        const val SELLER_WEB_URL = "appConfig/seller/webViewUrl" 
        const val DELIVERY_WEB_URL = "appConfig/delivery/webViewUrl"
    }
    
    // Default fallback URLs
    object Defaults {
        const val CUSTOMER_URL = "https://hungrimart.onrender.com"
        const val SELLER_URL = "https://seller-griyamart.onrender.com"
        const val DELIVERY_URL = "https://delivery-griyamart.onrender.com"
    }
    
    // Optimized config fetching with timeout and Flow support
    suspend fun getConfigValue(path: String, fallback: String, timeoutSeconds: Long = 5): String
    
    // App-specific convenience methods
    suspend fun getCustomerWebUrl(): String
    suspend fun getSellerWebUrl(): String  
    suspend fun getDeliveryWebUrl(): String
}
```

**Benefits:**

- ✅ Single source of truth for all Firebase paths
- ✅ Built-in timeout handling (5 seconds default)
- ✅ Automatic fallback to defaults on failure
- ✅ Coroutine-based for proper async handling
- ✅ Flow support for real-time config updates

### 2. Optimized MainActivity Implementations

#### Customer App (`app/MainActivity.kt`)

```kotlin
class MainActivity : AppCompatActivity() {
    private var webViewUrl: String = ConfigManager.Defaults.CUSTOMER_URL
    private var isConfigLoaded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Setup first
        setupFullScreen()
        initializeHelpers()
        
        // Load config asynchronously
        lifecycleScope.launch {
            loadConfigAndSetupWebView()
            handleDeepLink(intent)
        }
    }

    private suspend fun loadConfigAndSetupWebView() {
        try {
            webViewUrl = ConfigManager.getCustomerWebUrl()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load config, using fallback", e)
        }
        
        isConfigLoaded = true
        setupWebView()
        loadWebApp()
    }
}
```

#### Seller App (`sellerapp/MainActivity.kt`)

```kotlin
class MainActivity : ComponentActivity() {
    private var webViewUrl by mutableStateOf(ConfigManager.Defaults.SELLER_URL)
    private var isLoading by mutableStateOf(true)

    @Composable
    private fun AppContent() {
        Box(modifier = Modifier.fillMaxSize()) {
            if (isLoading) {
                LoadingIndicator() // Spinner while loading config
            } else {
                WebViewComposable(url = webViewUrl)
            }
        }
    }

    private suspend fun loadConfigAndSetup() {
        try {
            webViewUrl = ConfigManager.getSellerWebUrl()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load config, using fallback", e)
        } finally {
            isLoading = false // Hide loading, show WebView
        }
    }
}
```

#### Delivery App (`deliveryapp/DriverMainActivity.kt`)

```kotlin 
class DriverMainActivity : ComponentActivity() {
    private var webViewUrl by mutableStateOf(ConfigManager.Defaults.DELIVERY_URL)
    private var isLoading by mutableStateOf(true)

    // Same pattern as Seller app with loading state
    // Plus delivery-specific features like live location tracking
}
```

### 3. Key Optimizations Applied

#### ⚡ Performance Improvements

- **Coroutine-based async loading**: No more callback hell
- **Proper loading states**: User sees spinner during config fetch
- **Compose state management**: Automatic recomposition when URL changes
- **WebView caching**: Clear cache before loading for fresh content
- **Timeout handling**: 5-second timeout prevents indefinite waiting

#### 🔒 Reliability Improvements

- **Guaranteed initialization order**: WebView only created after config is resolved
- **Fallback handling**: Always has a working URL even if Firebase fails
- **Deep link timing**: Deep links only processed after config is loaded
- **Error resilience**: App continues working even with network/Firebase issues

#### 🎨 UX Improvements

- **Loading indicators**: Clear feedback during config fetch
- **No blank screens**: Immediate loading state shown
- **Smooth transitions**: From loading to WebView content
- **Toast removed**: No more debug toasts cluttering the UI

#### 🧹 Code Quality Improvements

- **DRY principle**: Single ConfigManager eliminates code duplication
- **Separation of concerns**: Config logic separated from UI logic
- **Type safety**: Compile-time checks for Firebase paths
- **Consistent error handling**: Same pattern across all apps
- **Future-proof**: Easy to add new config values or apps

## Migration Benefits

### Before (Problems):

```kotlin
// Race condition - WebView created before config loaded
loadCustomerWebUrl() // Async Firebase call
setupWebView()        // Immediate execution with fallback URL
handleDeepLink(intent) // Uses potentially wrong URL

// Scattered config logic in each app
private val webUrlConfigPath = "appConfig/customer/webViewUrl" // Hardcoded
ref.addListenerForSingleValueEvent(object : ValueEventListener { // Verbose
    override fun onDataChange(snapshot: DataSnapshot) { // Boilerplate
        // Manual state management
    }
})
```

### After (Optimized):

```kotlin
// Clean async flow
lifecycleScope.launch {
    webViewUrl = ConfigManager.getCustomerWebUrl() // Single line!
    setupWebView() // Only runs after config is loaded
    handleDeepLink(intent) // Uses correct URL
}

// Centralized, reusable config management
// All Firebase paths in one place
// Built-in timeout and error handling
// Coroutine-friendly API
```

## Files Created/Modified

### New Files:

- `app/src/main/java/com/griyaecom/app/utils/ConfigManager.kt`
- `sellerapp/src/main/java/com/griyaecom/seller/utils/ConfigManager.kt`
- `deliveryapp/src/main/java/com/griyaecom/deliveryapp/utils/ConfigManager.kt`

### Replaced Files:

- `app/src/main/java/com/griyamart/app/MainActivity.kt` (optimized version)
- `sellerapp/src/main/java/com/griyaecom/seller/MainActivity.kt` (with loading states)
- `deliveryapp/src/main/java/com/griyaecom/deliveryapp/DriverMainActivity.kt` (with loading states)

### Backup Files:

- `*_old.kt` versions of original files preserved

## Testing Checklist

### ✅ Functional Testing

- [ ] App loads with loading spinner initially
- [ ] WebView appears after config is loaded
- [ ] Fallback URL works when Firebase is unreachable
- [ ] Deep links work with dynamic URLs
- [ ] Dynamic host checking in WebView navigation

### ✅ Performance Testing

- [ ] No more race conditions between config and WebView
- [ ] Faster app startup (no blocking operations)
- [ ] Smooth loading transitions
- [ ] Memory efficient (proper cleanup)

### ✅ Error Handling

- [ ] Network errors don't crash the app
- [ ] Firebase permission errors handled gracefully
- [ ] Invalid URLs fall back to defaults
- [ ] Timeout prevents infinite loading

## Next Steps

1. **Deploy**: Build and install optimized APKs
2. **Test**: Verify dynamic URL loading in all 3 apps
3. **Monitor**: Check logs for any config loading issues
4. **Iterate**: Add more config values using the same pattern

This optimization provides a solid foundation for dynamic configuration management across all apps
while maintaining excellent performance and user experience.
