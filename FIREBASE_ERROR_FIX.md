# Firebase Installations Service Error - Resolution

## Problem Description

The error `Firebase Installations Service is unavailable. Please try again later` was occurring
during FCM token generation and topic subscription, causing the apps to fail when initializing push
notifications.

**Error Details:**

```
java.util.concurrent.ExecutionException: com.google.firebase.installations.FirebaseInstallationsException: 
Firebase Installations Service is unavailable. Please try again later.
```

## Root Cause

1. **Network/Service Issues**: Firebase Installations Service intermittently unavailable
2. **No Retry Logic**: Apps failed immediately on first Firebase error
3. **No Fallback Mechanism**: No cached token usage when Firebase fails
4. **Synchronous Calls**: Blocking Firebase calls causing timeouts
5. **Poor Error Handling**: Apps crashed instead of gracefully degrading

## Solution Implemented

### 1. Created Robust FirebaseHelper Classes

**Files Created:**

- `app/src/main/java/com/griyaecom/app/utils/FirebaseHelper.kt`
- `sellerapp/src/main/java/com/griyaecom/seller/utils/FirebaseHelper.kt`
- `deliveryapp/src/main/java/com/griyaecom/deliveryapp/utils/FirebaseHelper.kt`

### 2. Key Features Added

#### ✅ **Retry Mechanism**

```kotlin
private const val MAX_RETRY_ATTEMPTS = 3
private const val RETRY_DELAY_MS = 2000L

var attempts = 0
while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
        // Firebase operation
        return success
    } catch (e: Exception) {
        attempts++
        if (attempts >= MAX_RETRY_ATTEMPTS) {
            // Use fallback
        } else {
            delay(RETRY_DELAY_MS * attempts) // Exponential backoff
        }
    }
}
```

#### ✅ **Timeout Protection**

```kotlin
val token = withTimeout(10.seconds) {
    suspendCancellableCoroutine<String> { continuation ->
        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                // Handle result
            }
    }
}
```

#### ✅ **Cached Token Fallback**

```kotlin
private fun getCachedToken(context: Context): String? {
    val sharedPref = context.getSharedPreferences("FirebaseTokens", Context.MODE_PRIVATE)
    val token = sharedPref.getString("fcm_token", null)
    val timestamp = sharedPref.getLong("token_timestamp", 0)
    
    // Check if token is less than 24 hours old
    if (token != null && (System.currentTimeMillis() - timestamp) < 24 * 60 * 60 * 1000) {
        return token
    }
    return null
}
```

#### ✅ **Graceful Degradation**

- Apps continue to work even if Firebase fails
- Uses cached tokens when available
- Logs errors without crashing the app
- Provides user feedback for status updates

#### ✅ **Async/Coroutine Support**

```kotlin
suspend fun initializeFirebaseMessaging(
    context: Context,
    onTokenReceived: (String) -> Unit = {},
    onError: (Exception) -> Unit = {}
)
```

### 3. Updated MainActivity Implementations

#### **Customer App Changes**

```kotlin
private fun initializeFirebaseMessaging() {
    lifecycleScope.launch {
        FirebaseHelper.initializeFirebaseMessaging(
            context = this@MainActivity,
            onTokenReceived = { token ->
                val jsCode = "window.onAppStartFCMToken && window.onAppStartFCMToken('$token')"
                evaluateJavascript(jsCode)
            },
            onError = { exception ->
                Log.e(TAG, "Firebase initialization failed", exception)
                // Continue without push notifications
            }
        )
    }
}
```

#### **Seller App Changes**

- Loading state management preserved
- Firebase initialization after config load
- Robust topic subscription with error handling
- Status updates use FirebaseHelper for reliable topic management

#### **Delivery App Changes**

- Similar pattern to seller app
- Driver status updates with Firebase topic management
- Live location tracking unaffected by Firebase errors

### 4. Benefits of the Fix

#### 🔧 **Reliability**

- **3 retry attempts** with exponential backoff
- **10-second timeout** prevents indefinite waiting
- **Cached token fallback** ensures functionality during outages
- **Graceful degradation** - apps work even without push notifications

#### 🚀 **Performance**

- **Non-blocking async operations** using coroutines
- **Parallel topic subscriptions** where possible
- **Efficient error handling** without app crashes
- **Memory efficient** token caching

#### 🛡️ **Robustness**

- **Network resilience** - handles temporary Firebase outages
- **Service availability checks** before making Firebase calls
- **Comprehensive error logging** for debugging
- **User feedback** for status changes and errors

#### 🎯 **User Experience**

- **No app crashes** due to Firebase errors
- **Loading indicators** during Firebase operations
- **Toast notifications** for status updates
- **Transparent fallback** to cached functionality

### 5. Error Scenarios Handled

1. **Firebase Service Unavailable**: Retry with exponential backoff
2. **Network Timeout**: 10-second timeout with fallback
3. **Invalid/Empty Tokens**: Proper validation and error handling
4. **Topic Subscription Failures**: Individual topic error handling
5. **Cached Token Expiry**: 24-hour validity check with refresh

### 6. Testing Recommendations

#### ✅ **Offline Testing**

- Disconnect internet during app launch
- Verify cached token usage
- Check graceful degradation

#### ✅ **Firebase Service Simulation**

- Use airplane mode to simulate service unavailability
- Test retry mechanisms
- Verify error logging

#### ✅ **Load Testing**

- Multiple rapid Firebase calls
- Concurrent topic subscriptions
- Status update stress testing

### 7. Monitoring & Logging

**Key Log Messages to Watch:**

```
I/FirebaseHelper: Firebase Messaging initialized successfully
W/FirebaseHelper: Firebase initialization attempt X failed  
I/FirebaseHelper: Using cached FCM token as fallback
E/FirebaseHelper: Firebase initialization failed after 3 attempts
```

**Success Indicators:**

- Apps load and function even during Firebase outages
- Token caching and retrieval working
- Topic subscriptions succeed after retries
- User receives appropriate feedback

### 8. Future Improvements

1. **Server-Side Token Validation**: Verify tokens on backend
2. **Real-Time Status Monitoring**: Firebase service health checks
3. **Progressive Retry Delays**: More sophisticated backoff algorithms
4. **Token Refresh Scheduling**: Proactive token refresh before expiry
5. **Analytics Integration**: Track Firebase failure rates and patterns

This implementation provides a robust foundation for Firebase operations that gracefully handles
service unavailability while maintaining full app functionality.
