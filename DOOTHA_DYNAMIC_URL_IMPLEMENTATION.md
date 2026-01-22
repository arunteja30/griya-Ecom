# Dootha Apps - Dynamic URL Fetching Implementation

## Summary

Successfully implemented dynamic URL fetching for both Dootha apps (customer and driver) similar to
the Theypo apps. The apps now load URLs from Firebase Realtime Database with fallbacks and splash
screens.

## Implementation Details

### 1. ConfigManager Implementation

Created centralized configuration managers for both apps that:

- Fetch URLs from Firebase Realtime Database
- Use coroutines with timeout (5 seconds)
- Provide fallback URLs if Firebase fails
- Support real-time URL updates

**Firebase Paths:**

- Driver App: `appConfig/doothaDriver/webViewUrl`
- Customer App: `appConfig/dootha/webViewUrl`

**Fallback URLs:**

- Driver App: `https://dootha-driver.onrender.com`
- Customer App: `https://dootha.onrender.com`

### 2. Splash Screen Implementation

Both apps now feature:

- Modern splash screen with app logo and loading text
- Progressive loading states:
    - "Initializing..."
    - "Loading configuration..."
    - "Setting up app..."
    - "Loading [driver/customer] interface..."
- 10-second timeout to ensure app doesn't get stuck
- Smooth transition to WebView when ready

### 3. Enhanced WebView Features

Maintained existing features while adding dynamic loading:

- Edge-to-edge display support
- Safe area insets handling
- CSS custom properties injection
- Native bridge integration
- Permission handling
- Back button management

## Files Modified/Created

### Dootha Driver App (`dootha-driver/`)

1. **ConfigManager** - `src/main/java/com/mat/doothadriver/utils/ConfigManager.kt`
2. **Activity** - `src/main/java/com/mat/doothadriver/UberDriverActivity.kt`
3. **Layout** - `src/main/res/layout/activity_main.xml`
4. **Drawable** - `src/main/res/drawable/progress_indeterminate.xml`
5. **Dependencies** - `build.gradle.kts` (added Firebase BOM, coroutines, lifecycle)
6. **Config** - `google-services.json`

### Dootha Customer App (`dootha/`)

1. **ConfigManager** - `src/main/java/com/mat/dootha/utils/ConfigManager.kt`
2. **Activity** - `src/main/java/com/mat/dootha/UberCustomerActivity.kt`
3. **Layout** - `src/main/res/layout/activity_main.xml`
4. **Drawable** - `src/main/res/drawable/progress_indeterminate.xml`
5. **Dependencies** - `build.gradle.kts` (added Firebase BOM, coroutines, lifecycle)
6. **Config** - `google-services.json`

## Technical Implementation

### Configuration Loading Flow

```kotlin
lifecycleScope.launch {
    try {
        webViewUrl = ConfigManager.getDoothaWebUrl()
        Log.d("App", "Loaded webViewUrl: $webViewUrl")
    } catch (e: Exception) {
        Log.e("App", "Failed to load config, using fallback: $webViewUrl", e)
    }
    setupWebView()
    loadWebView()
}
```

### Firebase Database Structure

```json
{
  "appConfig": {
    "dootha": {
      "webViewUrl": "https://your-dynamic-customer-url.com"
    },
    "doothaDriver": {
      "webViewUrl": "https://your-dynamic-driver-url.com"
    }
  }
}
```

### Key Features

- ✅ **Async URL Loading** - Non-blocking Firebase fetch with coroutines
- ✅ **Fallback Support** - Always has working URLs even if Firebase fails
- ✅ **Timeout Protection** - 5-second Firebase timeout, 10-second splash timeout
- ✅ **Real-time Updates** - URL changes in Firebase update the app
- ✅ **Intent Override** - Custom URLs via `intent.getStringExtra("url")`
- ✅ **Loading States** - User-friendly progress indicators
- ✅ **Error Handling** - Graceful fallback to default URLs
- ✅ **Safe Areas** - Full edge-to-edge support with CSS injection

## Build Status

✅ **Dootha Driver**: BUILD SUCCESSFUL
✅ **Dootha Customer**: BUILD SUCCESSFUL

Both apps compile without errors and are ready for deployment.

## Usage

The apps will automatically:

1. Show splash screen on launch
2. Fetch latest URL from Firebase
3. Load the WebView with dynamic or fallback URL
4. Hide splash screen when page loads
5. Support real-time URL updates without app restart

## Firebase Setup Required

To use dynamic URLs, ensure Firebase Realtime Database has the structure:

```
appConfig/
├── dootha/
│   └── webViewUrl: "your-customer-app-url"
└── doothaDriver/
    └── webViewUrl: "your-driver-app-url"
```

This implementation matches the pattern used in Theypo apps and provides a consistent experience
across all hybrid apps in the project.
