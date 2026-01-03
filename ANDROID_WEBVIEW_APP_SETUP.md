# Android WebView App Setup (Like Swiggy / Zomato)

This document explains how to convert a React web app (example: https://hungrimart.onrender.com)
into a full Android application using WebView + Firebase.

---

## 1. Architecture

Android App (Kotlin)
- WebView
- Firebase Notifications
- Deep Linking
- Native APIs
- JS ↔ Native Bridge

---

## 2. Requirements

- Android Studio (latest)
- JDK 17
- Firebase Account
- Hosted React App

---

## 3. Create Android Project

- Empty Activity
- Kotlin
- Min SDK 23
- Package: com.hungrimart.app

---

## 4. AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <application
        android:allowBackup="true"
        android:theme="@style/Theme.App">

        <activity
            android:name=".MainActivity"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="https" android:host="hungrimart.onrender.com"/>
            </intent-filter>

        </activity>
    </application>
</manifest>
```

---

## 5. WebView Layout

```xml
<WebView
    android:id="@+id/webView"
    android:layout_width="match_parent"
    android:layout_height="match_parent"/>
```

---

## 6. MainActivity.kt

```kotlin
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.addJavascriptInterface(WebBridge(this), "Android")
        webView.webViewClient = WebViewClient()
        webView.loadUrl("https://hungrimart.onrender.com")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
```

---

## 7. JavaScript Bridge

```kotlin
class WebBridge(private val context: Context) {
    @JavascriptInterface
    fun showToast(msg: String) {
        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
    }
}
```

JS usage:
```js
window.Android?.showToast("Hello from web");
```

---

## 8. Firebase Setup

- Create Firebase project
- Add Android app
- Download google-services.json
- Place inside app/

---

## 9. Firebase Dependencies

```gradle
dependencies {
    implementation platform("com.google.firebase:firebase-bom:33.1.0")
    implementation "com.google.firebase:firebase-messaging"
}
```

---

## 10. Firebase Messaging Service

```kotlin
class MyFirebaseService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Log.d("FCM", "Token: $token")
    }

    override fun onMessageReceived(message: RemoteMessage) {}
}
```

---

## 11. SHA Setup

Run:
```
./gradlew signingReport
```

Add SHA-1 & SHA-256 in Firebase Console.

---

## 12. Emulator Requirement

Use **Google Play Emulator only**.

---

## 13. Final Result

✔ WebView loads React app  
✔ Push notifications  
✔ Deep linking  
✔ Play Store ready  

---

END
