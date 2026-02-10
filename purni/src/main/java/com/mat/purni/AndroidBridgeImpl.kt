package com.mat.purni

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.net.ConnectivityManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import org.json.JSONException
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Native implementation for window.AndroidBridge used by customer-web.
 * Simplified version (no location tracking to Firebase) - just basic features.
 */
class AndroidBridgeImpl(
    private val activity: Activity,
    private val webView: WebView
) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var orderTrackingListener: ValueEventListener? = null
    private var currentOrderRef: DatabaseReference? = null
    private var currentOrderId: String? = null

    // Phone Authentication properties
    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null
    private val auth = FirebaseAuth.getInstance()

    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    // Back button handling support for web app
    @JavascriptInterface
    fun initializeWebViewService() {
        runOnUiThread {
            webView.evaluateJavascript(
                """
                window.webViewService = {
                    // Called when hardware back button is pressed
                    onBackPressed: function() {
                        // Web app should return true if it handled the back button
                        // Return false to let native handle it
                        if (typeof window.handleBackButton === 'function') {
                            return window.handleBackButton();
                        }
                        
                        // Check if we can go back in SPA history
                        if (window.history.length > 1 && typeof window.history.back === 'function') {
                            try {
                                // Try to detect if we're on a main page
                                var currentPath = window.location.pathname;
                                if (currentPath === '/' || currentPath === '/home' || currentPath === '/dashboard') {
                                    return false; // Let native handle exit
                                }
                                
                                // Go back in web app
                                window.history.back();
                                return true;
                            } catch (e) {
                                console.error('Error in web back navigation:', e);
                                return false;
                            }
                        }
                        
                        return false; // Let native handle it
                    },
                    
                    // Allow web app to control navigation behavior
                    setNavigationMode: function(mode) {
                        window.webViewNavigationMode = mode; // 'spa', 'hybrid', 'native'
                    },
                    
                    // Allow web app to indicate it can handle back navigation
                    setCanGoBack: function(canGoBack) {
                        window.webViewCanGoBack = canGoBack;
                    },
                    
                    // Allow web app to exit the app programmatically
                    exitApp: function() {
                        AndroidBridge.exitApp();
                    },
                    
                    // Allow web app to minimize the app
                    minimizeApp: function() {
                        AndroidBridge.minimizeApp();
                    }
                };
                
                // Initialize navigation mode
                window.webViewNavigationMode = 'hybrid';
                window.webViewCanGoBack = false;
                
                console.log('Enhanced WebViewService initialized with intelligent navigation');
            """.trimIndent(), null
            )
        }
    }

    // App lifecycle and navigation support
    @JavascriptInterface
    fun exitApp() {
        runOnUiThread {
            activity.finishAndRemoveTask()
        }
    }

    @JavascriptInterface
    fun minimizeApp() {
        runOnUiThread {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun refreshWebView() {
        runOnUiThread {
            webView.reload()
        }
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return try {
            val packageInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
            packageInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }

    @JavascriptInterface
    fun getNetworkStatus(): String {
        return try {
            val connectivityManager = activity.getSystemService(Context.CONNECTIVITY_SERVICE)
                    as ConnectivityManager
            val activeNetwork = connectivityManager.activeNetworkInfo

            val networkInfo = JSONObject().apply {
                put("isConnected", activeNetwork?.isConnected == true)
                put(
                    "networkType", when {
                        activeNetwork?.type == ConnectivityManager.TYPE_WIFI -> "wifi"
                        activeNetwork?.type == ConnectivityManager.TYPE_MOBILE -> "mobile"
                        else -> "none"
                    }
                )
            }
            networkInfo.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("isConnected", false)
                put("networkType", "unknown")
            }.toString()
        }
    }

    @JavascriptInterface
    fun getBatteryLevel(): Int {
        return try {
            val batteryManager = activity.getSystemService(Context.BATTERY_SERVICE)
                    as BatteryManager
            batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        } catch (e: Exception) {
            -1
        }
    }

    @JavascriptInterface
    fun showStatusBar() {
        runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                activity.window.insetsController?.show(WindowInsets.Type.statusBars())
            } else {
                @Suppress("DEPRECATION")
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }
        }
    }

    @JavascriptInterface
    fun hideStatusBar() {
        runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                activity.window.insetsController?.hide(WindowInsets.Type.statusBars())
            } else {
                @Suppress("DEPRECATION")
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }
        }
    }

    // Authentication method for WebView to authenticate the user
    @JavascriptInterface
    fun authenticateUser(email: String, password: String) {
        FirebaseAuth.getInstance().signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(activity) { task ->
                if (task.isSuccessful) {
                    val user = FirebaseAuth.getInstance().currentUser
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onAuthenticationSuccess && window.onAuthenticationSuccess('${user?.uid}', '${user?.email}')",
                            null
                        )
                    }
                } else {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onAuthenticationError && window.onAuthenticationError('${task.exception?.message}')",
                            null
                        )
                    }
                }
            }
    }

    // Get current authenticated user
    @JavascriptInterface
    fun getCurrentUser(): String {
        val user = FirebaseAuth.getInstance().currentUser
        return if (user != null) {
            "{\"uid\":\"${user.uid}\",\"email\":\"${user.email}\"}"
        } else {
            "{}"
        }
    }

    // ==================== PHONE AUTHENTICATION (PRODUCTION-PROVEN) ====================

    /**
     * Start phone authentication flow - sends OTP without captcha
     * This is the SAFE way for production: Native handles Firebase PhoneAuth
     */
    @JavascriptInterface
    fun startPhoneAuthentication(phoneNumber: String) {
        try {
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    // Auto-verification happened (instant verification)
                    signInWithPhoneCredential(credential)
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                e.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    // Store verification ID and resend token
                    this@AndroidBridgeImpl.verificationId = verificationId
                    this@AndroidBridgeImpl.resendToken = token

                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onOTPSent && window.onOTPSent('$verificationId')",
                            null
                        )
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(phoneNumber) // Phone number to verify
                .setTimeout(60L, TimeUnit.SECONDS) // Timeout and unit
                .setActivity(activity) // Activity (for callback binding)
                .setCallbacks(callbacks) // OnVerificationStateChangedCallbacks
                .build()

            PhoneAuthProvider.verifyPhoneNumber(options)

        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Verify OTP code entered by user
     */
    @JavascriptInterface
    fun verifyOTPCode(otpCode: String) {
        val currentVerificationId = verificationId
        if (currentVerificationId == null) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('No verification ID available')",
                    null
                )
            }
            return
        }

        try {
            val credential = PhoneAuthProvider.getCredential(currentVerificationId, otpCode)
            signInWithPhoneCredential(credential)
        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Resend OTP to the same phone number
     */
    @JavascriptInterface
    fun resendOTP(phoneNumber: String) {
        val currentResendToken = resendToken
        if (currentResendToken == null) {
            // If no resend token, start fresh
            startPhoneAuthentication(phoneNumber)
            return
        }

        try {
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    signInWithPhoneCredential(credential)
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                e.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    this@AndroidBridgeImpl.verificationId = verificationId
                    this@AndroidBridgeImpl.resendToken = token

                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onOTPResent && window.onOTPResent('$verificationId')",
                            null
                        )
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(phoneNumber)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks)
                .setForceResendingToken(currentResendToken) // Use resend token
                .build()

            PhoneAuthProvider.verifyPhoneNumber(options)

        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onPhoneAuthError && window.onPhoneAuthError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    /**
     * Sign in with phone credential (private helper)
     */
    private fun signInWithPhoneCredential(credential: PhoneAuthCredential) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener(activity) { task ->
                if (task.isSuccessful) {
                    val user = auth.currentUser
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthSuccess && window.onPhoneAuthSuccess('${user?.uid}', '${user?.phoneNumber}')",
                            null
                        )
                    }
                } else {
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.onPhoneAuthError && window.onPhoneAuthError('${
                                task.exception?.message?.replace(
                                    "'",
                                    "\\'"
                                )
                            }')",
                            null
                        )
                    }
                }
            }
    }

    /**
     * Sign out current user
     */
    @JavascriptInterface
    fun signOutUser() {
        try {
            auth.signOut()
            // Clear verification data
            verificationId = null
            resendToken = null

            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onSignOutSuccess && window.onSignOutSuccess()",
                    null
                )
            }
        } catch (e: Exception) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.onSignOutError && window.onSignOutError('${
                        e.message?.replace(
                            "'",
                            "\\'"
                        )
                    }')",
                    null
                )
            }
        }
    }

    // ==================== END PHONE AUTHENTICATION ====================

    @JavascriptInterface
    fun showToast(message: String) {
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun requestLocation() {
        if (!ensureLocationPermission()) {
            sendLocationError("Location permission not granted")
            return
        }

        // Get high accuracy location
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            1000
        ).apply {
            setMaxUpdateDelayMillis(2000)
            setMinUpdateIntervalMillis(500)
        }.build()

        try {
            fusedClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                null
            ).addOnSuccessListener { location: Location? ->
                if (location != null) {
                    sendLocationToJs(location)
                } else {
                    // Fallback to last known location
                    try {
                        fusedClient.lastLocation.addOnSuccessListener { lastLocation ->
                            if (lastLocation != null) {
                                sendLocationToJs(lastLocation)
                            } else {
                                sendLocationError("No location available")
                            }
                        }
                    } catch (e: SecurityException) {
                        sendLocationError("Location permission required")
                    }
                }
            }.addOnFailureListener {
                sendLocationError(it.message ?: "Failed to get location")
            }
        } catch (e: SecurityException) {
            sendLocationError("Location permission required")
        }
    }

    @JavascriptInterface
    fun getDeviceToken(callbackName: String) {
        val fakeToken = "CUSTOMER_FAKE_TOKEN"
        val js = "$callbackName('$fakeToken')"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    @JavascriptInterface
    fun vibrate(milliseconds: Int) {
        // Stub - can implement vibration if needed
    }

    @JavascriptInterface
    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun openExternalLink(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        activity.startActivity(intent)
    }

    @JavascriptInterface
    fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        activity.startActivity(Intent.createChooser(intent, "Share"))
    }

    @JavascriptInterface
    fun makeCall(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$phoneNumber")
            }
            activity.startActivity(intent)
        } catch (e: Exception) {
            showToast("Failed to open dialer: ${e.message}")
        }
    }

    @JavascriptInterface
    fun initiatePayment(amount: String, orderId: String): String {
        runOnUiThread {
            try {
                // Initialize payment gateway (Razorpay, Stripe, etc.)
                showToast("Payment of ₹$amount initiated")

                // Simulate payment processing
                val result = """
                    {
                        "success": true,
                        "orderId": "$orderId",
                        "paymentId": "pay_${System.currentTimeMillis()}",
                        "amount": "$amount",
                        "method": "razorpay"
                    }
                """.trimIndent()

                // Return result to web app
                val js = "window.handlePaymentResult && window.handlePaymentResult('$result')"
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                showToast("Payment error: ${e.message}")
            }
        }
        return "Payment initiated"
    }

    @JavascriptInterface
    fun openLocationPicker(title: String, initialLat: Double, initialLng: Double): String {
        runOnUiThread {
            try {
                // Launch native location picker
                showToast("Opening location picker: $title")

                // For demo, return current location or initial coordinates
                val result = """
                    {
                        "latitude": $initialLat,
                        "longitude": $initialLng,
                        "address": "Selected Location",
                        "timestamp": ${System.currentTimeMillis()}
                    }
                """.trimIndent()

                // Simulate location selection callback
                val js = "window.handleLocationSelected && window.handleLocationSelected('$result')"
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                showToast("Location picker error: ${e.message}")
            }
        }
        return "Location picker opened"
    }

    @JavascriptInterface
    fun submitRating(rideId: String, rating: Int, feedback: String): String {
        runOnUiThread {
            try {
                showToast("Rating submitted: $rating stars")

                val result = """
                    {
                        "success": true,
                        "rideId": "$rideId",
                        "rating": $rating,
                        "feedback": "$feedback",
                        "timestamp": ${System.currentTimeMillis()}
                    }
                """.trimIndent()

                val js = "window.handleRatingSubmitted && window.handleRatingSubmitted('$result')"
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                showToast("Rating error: ${e.message}")
            }
        }
        return "Rating submitted"
    }

    @JavascriptInterface
    fun trackRide(rideId: String): String {
        runOnUiThread {
            try {
                showToast("Starting ride tracking for: $rideId")

                // Simulate real-time ride tracking
                val trackingData = """
                    {
                        "rideId": "$rideId",
                        "status": "on_trip",
                        "driverLocation": {
                            "latitude": 12.9716,
                            "longitude": 77.5946
                        },
                        "estimatedTime": 15,
                        "distance": "2.3 km"
                    }
                """.trimIndent()

                val js = "window.handleRideTracking && window.handleRideTracking('$trackingData')"
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                showToast("Tracking error: ${e.message}")
            }
        }
        return "Ride tracking started"
    }

    private fun ensureLocationPermission(): Boolean {
        val granted = hasLocationPermission()
        if (!granted) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                1001
            )
        }
        return granted
    }

    private fun sendLocationToJs(location: Location) {
        val js =
            "window.receiveLocation && window.receiveLocation('${location.latitude}','${location.longitude}')"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    private fun sendLocationError(message: String) {
        val js = "window.receiveLocationError && window.receiveLocationError('$message')"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    @JavascriptInterface
    fun showActiveOrderBanner(orderId: String, status: String, restaurantName: String) {
        runOnUiThread {
            // Show native Android notification
            (activity as? HybridWebActivity)?.showActiveOrderNotification(
                orderId,
                status,
                restaurantName
            )
        }
    }

    @JavascriptInterface
    fun hideActiveOrderBanner() {
        runOnUiThread {
            // Hide native Android notification
            (activity as? HybridWebActivity)?.hideActiveOrderNotification()
        }
    }

    @JavascriptInterface
    fun startOrderTracking(orderId: String) {
        runOnUiThread {
            currentOrderId = orderId

            // Remove existing listener if any
            orderTrackingListener?.let { listener ->
                currentOrderRef?.removeEventListener(listener)
            }

            // Listen to Firebase order updates
            val database = FirebaseDatabase.getInstance()
            currentOrderRef = database.getReference("orders").child(orderId)

            orderTrackingListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val status = snapshot.child("status").getValue(String::class.java) ?: "pending"
                    val restaurantName =
                        snapshot.child("restaurantName").getValue(String::class.java)
                            ?: "Restaurant"

                    // Update persistent notification
                    (activity as? HybridWebActivity)?.showActiveOrderNotification(
                        orderId,
                        status,
                        restaurantName
                    )

                    Log.d("OrderTracking", "Order $orderId updated: $status")
                }

                override fun onCancelled(error: DatabaseError) {
                    Log.e("OrderTracking", "Failed to track order: ${error.message}")
                }
            }

            currentOrderRef?.addValueEventListener(orderTrackingListener!!)
            Log.d("OrderTracking", "Started tracking order: $orderId")
        }
    }

    @JavascriptInterface
    fun stopOrderTracking() {
        runOnUiThread {
            orderTrackingListener?.let { listener ->
                currentOrderRef?.removeEventListener(listener)
            }
            orderTrackingListener = null
            currentOrderRef = null
            currentOrderId = null

            // Hide notification
            (activity as? HybridWebActivity)?.hideActiveOrderNotification()

            Log.d("OrderTracking", "Stopped order tracking")
        }
    }

    // WebView Service Integration Methods
    @JavascriptInterface
    fun showLoader(params: String) {
        try {
            val data = JSONObject(params)
            val show = data.getBoolean("show")

            mainHandler.post {
                // Implement native loader logic here
                // You can show/hide a progress dialog or loading indicator
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun getDeviceInfo() {
        try {
            val deviceInfo = JSONObject().apply {
                put("platform", "android")
                put("version", Build.VERSION.RELEASE)
                put("model", Build.MODEL)
                put("manufacturer", Build.MANUFACTURER)
                put("brand", Build.BRAND)
                put("sdkVersion", Build.VERSION.SDK_INT)
            }

            mainHandler.post {
                webView.evaluateJavascript(
                    "if(window.deviceInfoCallback) window.deviceInfoCallback($deviceInfo);",
                    null
                )
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun showToastFromParams(params: String) {
        try {
            val data = JSONObject(params)
            val message = data.getString("message")
            val duration = data.optString("duration", "short")

            mainHandler.post {
                val toastDuration =
                    if (duration == "long") Toast.LENGTH_LONG else Toast.LENGTH_SHORT
                Toast.makeText(activity, message, toastDuration).show()
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun hapticFeedback(params: String) {
        try {
            val data = JSONObject(params)
            val type = data.optString("type", "light")

            mainHandler.post {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    activity.window.decorView.performHapticFeedback(
                        HapticFeedbackConstants.VIRTUAL_KEY
                    )
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun share(params: String) {
        try {
            val data = JSONObject(params)
            val title = data.optString("title", "")
            val text = data.optString("text", "")
            val url = data.optString("url", "")

            mainHandler.post {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"

                    val shareText = if (url.isNotEmpty()) "$text $url" else text
                    putExtra(Intent.EXTRA_TEXT, shareText)

                    if (title.isNotEmpty()) {
                        putExtra(Intent.EXTRA_SUBJECT, title)
                    }
                }

                activity.startActivity(Intent.createChooser(shareIntent, "Share"))
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun openAppSettings() {
        mainHandler.post {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.data = Uri.parse("package:${activity.packageName}")
            activity.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun setStatusBar(params: String) {
        try {
            val data = JSONObject(params)
            val backgroundColor = data.optString("backgroundColor", "#000000")
            val isLight = data.optBoolean("isLight", false)
            val hidden = data.optBoolean("hidden", false)

            mainHandler.post {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    try {
                        val color = Color.parseColor(backgroundColor)
                        activity.window.statusBarColor = color
                    } catch (e: Exception) {
                        // Invalid color, use default
                    }

                    if (hidden) {
                        activity.window.decorView.systemUiVisibility =
                            View.SYSTEM_UI_FLAG_FULLSCREEN
                    } else {
                        activity.window.decorView.systemUiVisibility =
                            View.SYSTEM_UI_FLAG_VISIBLE
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && isLight) {
                        activity.window.decorView.systemUiVisibility =
                            activity.window.decorView.systemUiVisibility or
                                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    }
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    // Generic permission APIs used by WebViewService
    @JavascriptInterface
    fun requestPermission(params: String) {
        try {
            val data = JSONObject(params)
            val permission = data.optString("permission", "")

            val hybridActivity = activity as? HybridWebActivity
            if (hybridActivity == null) {
                // Cannot handle without proper activity, respond with denied
                mainHandler.post {
                    webView.evaluateJavascript(
                        "if(window.permissionCallback) window.permissionCallback(false);",
                        null
                    )
                }
                return
            }

            when (permission) {
                "location" -> {
                    hybridActivity.requestLocationPermissionFromWeb(object :
                        PermissionManager.PermissionCallback {
                        override fun onGranted() {
                            mainHandler.post {
                                webView.evaluateJavascript(
                                    "if(window.permissionCallback) window.permissionCallback(true);",
                                    null
                                )
                            }
                        }

                        override fun onDenied() {
                            mainHandler.post {
                                webView.evaluateJavascript(
                                    "if(window.permissionCallback) window.permissionCallback(false);",
                                    null
                                )
                            }
                        }
                    })
                }

                "notifications" -> {
                    hybridActivity.requestNotificationPermissionFromWeb(object :
                        PermissionManager.PermissionCallback {
                        override fun onGranted() {
                            mainHandler.post {
                                webView.evaluateJavascript(
                                    "if(window.permissionCallback) window.permissionCallback(true);",
                                    null
                                )
                            }
                        }

                        override fun onDenied() {
                            mainHandler.post {
                                webView.evaluateJavascript(
                                    "if(window.permissionCallback) window.permissionCallback(false);",
                                    null
                                )
                            }
                        }
                    })
                }

                else -> {
                    // Unsupported permission type
                    mainHandler.post {
                        webView.evaluateJavascript(
                            "if(window.permissionCallback) window.permissionCallback(false);",
                            null
                        )
                    }
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
            mainHandler.post {
                webView.evaluateJavascript(
                    "if(window.permissionCallback) window.permissionCallback(false);",
                    null
                )
            }
        }
    }

    @JavascriptInterface
    fun checkPermission(params: String) {
        try {
            val data = JSONObject(params)
            val permission = data.optString("permission", "")

            val hybridActivity = activity as? HybridWebActivity
            val granted = if (hybridActivity != null) {
                when (permission) {
                    "location" -> hybridActivity.hasLocationPermissionsFromWeb()
                    "notifications" -> hybridActivity.hasNotificationPermissionFromWeb()
                    else -> false
                }
            } else {
                false
            }

            mainHandler.post {
                webView.evaluateJavascript(
                    "if(window.permissionCheckCallback) window.permissionCheckCallback($granted);",
                    null
                )
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
    }

    private fun runOnUiThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            activity.runOnUiThread { block() }
        }
    }
}
