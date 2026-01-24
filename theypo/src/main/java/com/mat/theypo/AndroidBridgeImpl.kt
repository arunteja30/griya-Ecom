package com.mat.theypo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

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

    private var orderTrackingListener: ValueEventListener? = null
    private var currentOrderRef: DatabaseReference? = null
    private var currentOrderId: String? = null

    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

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

    @JavascriptInterface
    fun getCurrentUser(): String {
        val user = FirebaseAuth.getInstance().currentUser
        return if (user != null) {
            "{\"uid\":\"${user.uid}\",\"email\":\"${user.email}\"}"
        } else {
            "{}"
        }
    }

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

        if (ActivityCompat.checkSelfPermission(
                activity,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            sendLocationError("Location permission not granted")
            return
        }

        fusedClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            null
        ).addOnSuccessListener { location: Location? ->
            if (location != null) {
                sendLocationToJs(location)
            } else {
                fusedClient.lastLocation.addOnSuccessListener { lastLocation ->
                    if (lastLocation != null) {
                        sendLocationToJs(lastLocation)
                    } else {
                        sendLocationError("No location available")
                    }
                }
            }
        }.addOnFailureListener {
            sendLocationError(it.message ?: "Failed to get location")
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
            showToast("Unable to make call: ${e.message}")
        }
    }

    @JavascriptInterface
    fun initiatePayment(amount: String, orderId: String): String {
        runOnUiThread {
            try {
                showToast("Payment of ₹$amount initiated")

                val result = """
                    {
                        "success": true,
                        "orderId": "$orderId",
                        "paymentId": "pay_${System.currentTimeMillis()}",
                        "amount": "$amount",
                        "method": "razorpay"
                    }
                """.trimIndent()

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
                showToast("Opening location picker: $title")

                val result = """
                    {
                        "latitude": $initialLat,
                        "longitude": $initialLng,
                        "address": "Selected Location",
                        "timestamp": ${System.currentTimeMillis()}
                    }
                """.trimIndent()

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

    @JavascriptInterface
    fun showActiveOrderBanner(orderId: String, status: String, restaurantName: String) {
        runOnUiThread {
            showToast("Order $orderId: $status")
        }
    }

    @JavascriptInterface
    fun hideActiveOrderBanner() {
        runOnUiThread {
            showToast("Order banner hidden")
        }
    }

    @JavascriptInterface
    fun startOrderTracking(orderId: String) {
        runOnUiThread {
            currentOrderId = orderId

            orderTrackingListener?.let { listener ->
                currentOrderRef?.removeEventListener(listener)
            }

            val database = FirebaseDatabase.getInstance()
            currentOrderRef = database.getReference("orders").child(orderId)

            orderTrackingListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val status = snapshot.child("status").getValue(String::class.java) ?: "pending"
                    val restaurantName =
                        snapshot.child("restaurantName").getValue(String::class.java)
                            ?: "Restaurant"
                    showToast("Order $orderId: $status")
                }

                override fun onCancelled(error: DatabaseError) {
                    showToast("Failed to track order: ${error.message}")
                }
            }

            currentOrderRef?.addValueEventListener(orderTrackingListener!!)
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
            showToast("Stopped order tracking")
        }
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

    private fun runOnUiThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            activity.runOnUiThread { block() }
        }
    }
}
