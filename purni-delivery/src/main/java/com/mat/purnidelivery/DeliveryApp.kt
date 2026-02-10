package com.mat.purnidelivery

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.database.FirebaseDatabase

class DeliveryApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize Firebase
        FirebaseApp.initializeApp(this)

        // Enable Firebase Realtime Database offline persistence
        FirebaseDatabase.getInstance().setPersistenceEnabled(true)

        // Create notification channel for Android 8.0+
        createNotificationChannel()
    }


    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Channel for general delivery notifications
            val generalChannel = NotificationChannel(
                "delivery_app_notifications",
                "Delivery Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new orders and status updates"
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(generalChannel)

            // Channel for location tracking foreground service
            val trackingChannel = NotificationChannel(
                "delivery_tracking_channel",
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracks delivery partner location in background"
                setSound(null, null)
                enableVibration(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(trackingChannel)

            android.util.Log.d("DeliveryApp", "Notification channels created successfully")
        }
    }
}
