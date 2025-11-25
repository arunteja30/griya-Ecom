Setup guide: Expo Notifications + Firebase Cloud Function (quick)

1) Install packages
   cd expo-app
   npm install
   or
   npx expo install expo-notifications

2) In app code (already added):
   - /expo-app/services/notificationService.js: uses expo-notifications to register and save token to Realtime Database under riderPushTokens/{uid}
   - AuthContext registers token on login and removes on logout
   - App.js sets notification handler to show notifications in foreground

3) Firebase Cloud Function (in /functions/index.js):
   - onOrderAssigned triggers when orders/{orderKey}/riderId changes and sends an Expo push notification to the rider's token stored at riderPushTokens/{riderId}/token

4) Deploy Cloud Function
   - cd functions
   - npm install firebase-functions firebase-admin node-fetch
   - firebase deploy --only functions

5) Notes & Troubleshooting
   - Expo push tokens are specific to Expo. For standalone builds with FCM/APNs, configure credentials and use expo-notifications docs.
   - Ensure Realtime Database rules allow the function to read riderPushTokens; admin SDK uses its own service account so it should work.
   - You may want to store multiple tokens per rider (array) for multiple devices.

6) Example test flow
   - Login in Expo app as rider -> token saved to /riderPushTokens/{uid}
   - Assign an order in DB by setting orders/{orderKey}/riderId = riderUid
   - Cloud Function triggers and sends push notification to the rider's device
