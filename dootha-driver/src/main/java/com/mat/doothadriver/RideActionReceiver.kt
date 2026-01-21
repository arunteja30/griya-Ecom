package com.mat.doothadriver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.app.NotificationManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore


class RideActionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "RideActionReceiver"
        private const val RIDE_REQUEST_NOTIFICATION_ID = 2001
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val rideId = intent.getStringExtra("rideId") ?: return

        Log.d(TAG, "🎬 Action received: $action for ride: $rideId")

        when (action) {
            "ACCEPT_RIDE" -> acceptRide(context, rideId)
            "DECLINE_RIDE" -> declineRide(context, rideId)
        }

        // Clear the notification
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(RIDE_REQUEST_NOTIFICATION_ID)
    }

    private fun acceptRide(context: Context, rideId: String) {
        Log.d(TAG, "✅ Accepting ride: $rideId")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ No authenticated user")
            return
        }

        val driverId = currentUser.uid
        val db = FirebaseFirestore.getInstance()

        // Update ride with driver acceptance
        val rideRef = db.collection("rides").document(rideId)
        val driverRef = db.collection("drivers").document(driverId)

        // Batch update both ride and driver status
        db.runBatch { batch ->
            // Update ride status
            batch.update(
                rideRef, mapOf(
                    "driverId" to driverId,
                    "status" to "accepted",
                    "acceptedAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
            )

            // Update driver status
            batch.update(
                driverRef, mapOf(
                    "status" to "busy",
                    "activeRideId" to rideId,
                    "lastActiveAt" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
            )
        }.addOnSuccessListener {
            Log.d(TAG, "✅ Ride accepted successfully")

            // Open app to ride details
            val openAppIntent = Intent(context, UberDriverActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("ride_id", rideId)
                putExtra("deep_link", "/active-ride/$rideId")
                putExtra("action", "accepted")
            }
            context.startActivity(openAppIntent)

        }.addOnFailureListener { e ->
            Log.e(TAG, "❌ Error accepting ride", e)
            showErrorNotification(context, "Failed to accept ride. Please try again.")
        }
    }

    private fun declineRide(context: Context, rideId: String) {
        Log.d(TAG, "❌ Declining ride: $rideId")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ No authenticated user")
            return
        }

        val driverId = currentUser.uid
        val db = FirebaseFirestore.getInstance()

        // Add driver to declined list for this ride
        val rideRef = db.collection("rides").document(rideId)

        rideRef.update(
            "declinedDrivers", com.google.firebase.firestore.FieldValue.arrayUnion(driverId)
        ).addOnSuccessListener {
            Log.d(TAG, "✅ Ride declined successfully")

            // Show brief confirmation
            showDeclineConfirmation(context)

        }.addOnFailureListener { e ->
            Log.e(TAG, "❌ Error declining ride", e)
        }
    }

    private fun showErrorNotification(context: Context, message: String) {
        // Implementation to show error notification
        Log.e(TAG, "Error: $message")
    }

    private fun showDeclineConfirmation(context: Context) {
        // Show brief toast or notification confirming decline
        Log.d(TAG, "Ride declined")
    }
}