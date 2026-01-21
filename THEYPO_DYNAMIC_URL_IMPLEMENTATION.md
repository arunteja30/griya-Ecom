# Dynamic URL Configuration for Theypo Apps

## Firebase Realtime Database Structure

To configure dynamic URLs for theypo apps, add the following structure to your Firebase Realtime
Database:

```json
{
  "appConfig": {
    "theypo": {
      "webViewUrl": "https://fags.onrender.com"
    },
    "theypoDelivery": {
      "webViewUrl": "https://thepo-delivery.onrender.com"
    }
  }
}
```

## Implementation Details

### ConfigManager Paths
- **Theypo App**: `appConfig/theypo/webViewUrl`
- **Theypo Delivery App**: `appConfig/theypoDelivery/webViewUrl`

### Default Fallback URLs
- **Theypo App**: `https://fags.onrender.com`
- **Theypo Delivery App**: `https://thepo-delivery.onrender.com`

### How It Works

1. **App Startup**: Both apps load their respective URLs from Firebase Realtime Database
2. **Timeout**: 5 seconds timeout for Firebase fetch operation
3. **Fallback**: If Firebase fetch fails, apps use hardcoded fallback URLs
4. **Loading State**: Apps show loading screen while fetching configuration
5. **Dynamic Updates**: URLs can be changed in Firebase without app updates

### Usage in Firebase Console

1. Go to Firebase Console → Realtime Database
2. Navigate to the root of your database
3. Add or update the `appConfig` node with the structure above
4. The apps will automatically load the new URLs on next startup

### Advantages

- ✅ **No App Updates**: Change URLs without releasing new app versions
- ✅ **Instant Updates**: URL changes take effect on next app launch
- ✅ **Fallback Safety**: Apps continue working even if Firebase is unavailable
- ✅ **Centralized Management**: Control all app URLs from Firebase console
- ✅ **Environment Switching**: Easy switch between dev/staging/production URLs
- ✅ **A/B Testing**: Different URLs for different user segments (if implemented)

## Testing

1. **Test Firebase Connection**: Verify Firebase project is properly configured
2. **Test URL Loading**: Check app logs to confirm URL is loaded from Firebase
3. **Test Fallback**: Disconnect from internet during app startup to test fallback
4. **Test URL Changes**: Change URL in Firebase and restart app to verify new URL loads
